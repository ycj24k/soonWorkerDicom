/**
 * DICOM文件处理服务
 * 负责DICOM文件的解析、处理和缓存管理
 */

import * as cornerstone from 'cornerstone-core';
import * as dicomParser from 'dicom-parser';
import { 
  DicomThumbnail, 
  DicomElement, 
  FileTreeNode, 
  DicomSeries, 
  DicomProcessResult 
} from '../types';
import { setItem, getItem } from '../utils/localforage';
import { CacheManager } from '../utils/CacheManager';
import { PerformanceManager } from '../utils/PerformanceManager';
import { Notification } from 'element-ui';

const dcmjs = require('dcmjs');
const fs = require('fs');
const path = require('path');

export class DicomService {
  private static instance: DicomService;
  private thumbnailCache: CacheManager<string>;
  private dicomDataCache: CacheManager<DicomElement[]>;
  private performanceManager: PerformanceManager;

  private constructor() {
    this.thumbnailCache = new CacheManager<string>(50 * 1024 * 1024, 500); // 50MB, 500项
    this.dicomDataCache = new CacheManager<DicomElement[]>(20 * 1024 * 1024, 200); // 20MB, 200项
    this.performanceManager = PerformanceManager.getInstance();
  }

  public static getInstance(): DicomService {
    if (!DicomService.instance) {
      DicomService.instance = new DicomService();
    }
    return DicomService.instance;
  }

  /**
   * 获取目录树结构
   */
  public getDirectoryTree(directory: string): FileTreeNode {
    const tree: FileTreeNode = {
      name: path.basename(directory),
      path: directory,
      children: []
    };

    try {
      const items = fs.readdirSync(directory, { withFileTypes: true });

      items.forEach(item => {
        const fullPath = path.join(directory, item.name);
        if (item.isDirectory()) {
          tree.children.push(this.getDirectoryTree(fullPath));
        } else {
          tree.children.push({
            name: item.name,
            path: fullPath,
            isFile: true,
            children: []
          });
        }
      });
    } catch (error) {
      console.error('读取目录失败:', error);
      throw new Error(`无法读取目录: ${directory}`);
    }

    return tree;
  }

  /**
   * 获取树的最大深度
   */
  private getMaxDepth(node: FileTreeNode): number {
    if (!node.children || node.children.length === 0) {
      return 0;
    }
    return 1 + Math.max(...node.children.map(child => this.getMaxDepth(child)));
  }

  /**
   * 获取树结构的最后两层数据
   */
  public getLastTwoLayers(tree: FileTreeNode): { secondLastLayer: FileTreeNode[], lastLayer: FileTreeNode[] } | false {
    const result = { secondLastLayer: [] as FileTreeNode[], lastLayer: [] as FileTreeNode[] };
    const maxDepth = this.getMaxDepth(tree);
    
    if (maxDepth !== 4 && maxDepth !== 3) {
      Notification({
        message: 'DICOM数据格式错误，请检查数据格式！',
        type: 'warning'
      });
      return false;
    }

    const traverse = (node: FileTreeNode, depth: number) => {
      if (depth === 3) {
        result.lastLayer.push(node);
      } else if (depth === 1) {
        result.secondLastLayer.push(node);
      }

      if (node.children) {
        node.children.forEach(child => {
          traverse(child, depth - 1);
        });
      }
    };

    traverse(tree, maxDepth);
    return result;
  }

  /**
   * 生成缩略图列表
   */
  public async generateThumbnailList(
    dicomFileList: DicomSeries[], 
    targetWidth: number = 1024
  ): Promise<DicomProcessResult> {
    return await this.performanceManager.measureTimeAsync('generateThumbnailList', async () => {
      const thumbnails: DicomThumbnail[] = [];
      const dicomDict: DicomElement[][] = [];

      // 使用批量处理优化性能
      await this.performanceManager.batch(
        dicomFileList,
        5, // 每批处理5个文件
        async (batch) => {
          const batchPromises = batch.map(async (file) => {
            try {
              const firstImagePath = file.children[0].path;
              
              // 检查缓存
              const cacheKey = `thumbnail_${firstImagePath}`;
              let thumbnailBase64 = this.thumbnailCache.get(cacheKey);
              
              if (!thumbnailBase64) {
                // 生成新缩略图
                thumbnailBase64 = await this.generateThumbnail(firstImagePath);
                this.thumbnailCache.set(cacheKey, thumbnailBase64);
              }

              // 解析DICOM数据
              const { dataSet, dicomElements } = await this.parseDicomFile(firstImagePath);
              
              const thumbnail: DicomThumbnail = {
                modality: dataSet.string("x00080060") || '',
                seriesNo: dataSet.string("x00200011") || '',
                seriesDate: dataSet.string("x00080021") || '',
                seriesTime: dataSet.string("x00080031") || '',
                description: dataSet.string("x0008103e") || '',
                seriesUID: dataSet.string("x0020000e") || '',
                image: thumbnailBase64
              };

              return { thumbnail, dicomElements };
            } catch (error) {
              console.error("处理DICOM文件时出错:", error);
              return null;
            }
          });

          const results = await Promise.all(batchPromises);
          
          results.forEach(result => {
            if (result) {
              thumbnails.push(result.thumbnail);
              dicomDict.push(result.dicomElements);
            }
          });
        },
        100 // 批次间延迟100ms
      );

      // 缓存结果
      await setItem('dicomDict', dicomDict);
      await setItem('thumbnails', thumbnails);

      return { thumbnails, dicomDict };
    });
  }

  /**
   * 生成单个缩略图
   */
  private async generateThumbnail(imagePath: string): Promise<string> {
    const response = await fetch(imagePath);
    const arrayBuffer = await response.arrayBuffer();
    
    const image = await cornerstone.loadImage('wadouri:' + imagePath);
    
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256 * (image.rows / image.columns);
    
    cornerstone.renderToCanvas(canvas, image);
    
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  /**
   * 解析DICOM文件
   */
  private async parseDicomFile(filePath: string): Promise<{
    dataSet: any;
    dicomElements: DicomElement[];
  }> {
    return await this.performanceManager.measureTimeAsync('parseDicomFile', async () => {
      const cacheKey = `dicom_${filePath}`;
      let dicomElements = this.dicomDataCache.get(cacheKey);
      
      if (!dicomElements) {
        const response = await fetch(filePath);
        const arrayBuffer = await response.arrayBuffer();
        const byteArray = new Uint8Array(arrayBuffer);
        
        const dataSet = dicomParser.parseDicom(byteArray);
        
        dicomElements = [];
        for (const tag of Object.keys(dataSet.elements)) {
          const dict = dcmjs.data.DicomMetaDictionary.dictionary[`(${tag.slice(1, 5)},${tag.slice(5)})`];
          const description = dict && dict.name ? dict.name : 'Unknown Item';
          let value = '';
          
          if (dataSet.string(tag)) {
            value = dataSet.string(tag).slice(0, 50);
          }
          
          dicomElements.push({
            tag: tag.slice(1),
            description,
            value
          });
        }
        
        // 估算缓存项大小
        const estimatedSize = dicomElements.length * 100; // 每个元素约100字节
        this.dicomDataCache.set(cacheKey, dicomElements, estimatedSize);
        
        return { dataSet, dicomElements };
      }
      
      // 从缓存返回时需要重新解析dataSet
      const response = await fetch(filePath);
      const arrayBuffer = await response.arrayBuffer();
      const byteArray = new Uint8Array(arrayBuffer);
      const dataSet = dicomParser.parseDicom(byteArray);
      
      return { dataSet, dicomElements };
    });
  }

  /**
   * 构建结构树
   */
  public async buildTree(tree: FileTreeNode[]): Promise<FileTreeNode[]> {
    let num = 0;
    const dicomDict = await getItem('dicomDict') as DicomElement[][];
    
    tree.forEach((node1, index1) => {
      if (dicomDict[num]) {
        const patientId = dicomDict[num].find(item => item.tag === '00100020')?.value || '';
        const patientName = dicomDict[num].find(item => item.tag === '00100010')?.value || '';
        node1.label = `ID:${patientId}/Name:${patientName}`;
      }
      node1.id = `${index1 + 1}`;
      
      node1.children.forEach((node2, index2) => {
        if (dicomDict[num]) {
          const studyDate = dicomDict[num].find(item => item.tag === '00080020')?.value || '';
          const modality = dicomDict[num].find(item => item.tag === '00080060')?.value || '';
          const studyDescription = dicomDict[num].find(item => item.tag === '00081030')?.value || '';
          node2.label = `${studyDate}: ${modality} :${studyDescription}`;
        }
        node2.id = `${node1.id}-${index2 + 1}`;
        
        node2.children.forEach((node3, index3) => {
          if (dicomDict[num]) {
            const seriesNo = dicomDict[num].find(item => item.tag === '00200011')?.value || '';
            const seriesDescription = dicomDict[num].find(item => item.tag === '0008103e')?.value || '';
            node3.label = `${seriesNo}:${seriesDescription}`;
          } else {
            node3.label = node3.name;
          }
          node3.id = `${node1.id}-${node2.id}-${index3 + 1}`;
          num++;
          
          node3.children.forEach((node4, index4) => {
            node4.label = node4.name;
            node4.id = `${node1.id}-${node2.id}-${node3.id}-${index4 + 1}`;
          });
        });
      });
    });
    
    return tree;
  }

  /**
   * 清理缓存
   */
  public clearCache(): void {
    this.thumbnailCache.clear();
    this.dicomDataCache.clear();
  }

  /**
   * 获取缓存统计信息
   */
  public getCacheStats(): { 
    thumbnails: any; 
    dicomData: any;
    performance: any;
  } {
    return {
      thumbnails: this.thumbnailCache.getStats(),
      dicomData: this.dicomDataCache.getStats(),
      performance: {
        generateThumbnailList: this.performanceManager.getPerformanceStats('generateThumbnailList'),
        parseDicomFile: this.performanceManager.getPerformanceStats('parseDicomFile'),
        memoryInfo: this.performanceManager.getMemoryInfo()
      }
    };
  }

  /**
   * 预加载缩略图
   */
  public async preloadThumbnails(imagePaths: string[]): Promise<void> {
    const urls = imagePaths.map(path => `wadouri:${path}`);
    await this.performanceManager.preloadImages(urls, 3);
  }
}
