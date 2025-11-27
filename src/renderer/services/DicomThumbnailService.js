/**
 * DICOM缩略图服务
 * 负责DICOM图像的缩略图生成
 */

const fs = require('fs');
const dicomParser = require('dicom-parser');
const dcmjs = require('dcmjs');
const cornerstone = require('cornerstone-core');

export class DicomThumbnailService {
  constructor(dicomService) {
    this.dicomService = dicomService;
  }

  static getInstance(dicomService) {
    if (!DicomThumbnailService.instance) {
      DicomThumbnailService.instance = new DicomThumbnailService(dicomService);
    }
    return DicomThumbnailService.instance;
  }

  /**
   * 从系列中获取第一张图像
   * @param {Object} series - 系列节点
   * @returns {Object|null} 第一张图像节点
   */
  getFirstImageFromSeries(series) {
    if (series.children && series.children.length > 0) {
      for (const child of series.children) {
        if (child.isFile && this.dicomService.isDicomFile(child.path)) {
          return child;
        }
        if (child.children) {
          const found = this.getFirstImageFromSeries(child);
          if (found) return found;
        }
      }
    }
    return null;
  }

  /**
   * 生成缩略图
   * @param {Object} imageNode - 图像节点
   * @returns {string|null} Base64编码的缩略图，失败时返回null
   */
  async generateThumbnail(imageNode) {
    try {
      // 读取文件内容
      const arrayBuffer = fs.readFileSync(imageNode.path).buffer;
      const byteArray = new Uint8Array(arrayBuffer);
      
      // 检查文件大小
      if (byteArray.length < 1000) {
        throw new Error(`文件太小，可能不是有效的DICOM文件: ${byteArray.length} bytes`);
      }
      
      // 解析 DICOM 文件
      const dataSet = dicomParser.parseDicom(byteArray);
      
      // 使用cornerstone加载图像
      const imageId = `wadouri:${imageNode.path}`;
      const image = await cornerstone.loadImage(imageId);
      
      // 检查图像是否有效
      if (!image || !image.rows || !image.columns) {
        throw new Error('图像加载失败或无效');
      }
      
      // 创建Canvas渲染
      const canvas = document.createElement('canvas');
      canvas.width = 256;  // 缩略图宽度
      canvas.height = 256 * (image.rows / image.columns); // 保持比例
      
      // 渲染图像
      cornerstone.renderToCanvas(canvas, image);
      
      // 转换为Base64
      const result = canvas.toDataURL('image/jpeg', 0.9);
      
      // 验证结果是否有效（真实的图像数据应该有足够的长度）
      if (!result || result.length < 5000) {
        throw new Error('生成的缩略图数据无效');
      }
      
      return result;
    } catch (error) {
      // 失败时返回 null，而不是占位符，这样无效影像会被过滤掉
      return null;
    }
  }

  /**
   * 生成缩略图列表
   * @param {Array<Object>} seriesList - 系列节点数组
   * @returns {Object} 包含thumbnails、dicomDict和filteredSeries的对象
   */
  async generateThumbnailList(seriesList) {
    const thumbnails = [];
    const dicomDict = [];
    const filteredSeries = []; // 过滤后的系列列表，只包含成功生成缩略图的系列

    for (const series of seriesList) {
      // 递归查找第一个有效的DICOM文件节点
      const findFirstValidImage = (node) => {
        if (!node) return null;
        
        const isFile = node.isFile || (!node.children || node.children.length === 0);
        if (isFile && node.path) {
          const isDicomFile = this.dicomService.isDicomFile(node.path) ||
                             (node.name && /^IMG\d+$/i.test(node.name) && node.path.toLowerCase().includes('ser'));
          if (isDicomFile) {
            try {
              const stats = fs.statSync(node.path);
              if (stats.isFile() && stats.size > 0) {
                return node;
              }
            } catch (e) {
              return null;
            }
          }
        }
        
        if (node.children && Array.isArray(node.children)) {
          for (const child of node.children) {
            const found = findFirstValidImage(child);
            if (found) return found;
          }
        }
        return null;
      };

      const firstImage = findFirstValidImage(series);
      if (!firstImage) continue;

      try {
        // 解析DICOM文件
        const arrayBuffer = fs.readFileSync(firstImage.path).buffer;
        const byteArray = new Uint8Array(arrayBuffer);
        const dataSet = dicomParser.parseDicom(byteArray);
        
        // 提取所有DICOM标签
        const seriesDict = [];
        for (const tag of Object.keys(dataSet.elements || {})) {
          try {
            const group = tag.slice(1, 5);
            const element = tag.slice(5);
            const tagStr = `(${group},${element})`;
            const dict = dcmjs.data.DicomMetaDictionary.dictionary[tagStr];
            const description = dict && dict.name ? dict.name : 'Unknown Item';
            
            let value = '';
            const elementData = dataSet.elements[tag];
            if (elementData) {
              if (elementData.vr === 'SQ') {
                value = `Sequence with ${elementData.items ? elementData.items.length : 0} items`;
              } else if (['OB', 'OW', 'OF'].includes(elementData.vr)) {
                value = `Binary data (${elementData.length} bytes)`;
              } else {
                const stringValue = dataSet.string(tag);
                if (stringValue) {
                  value = stringValue.length > 200 ? stringValue.slice(0, 200) + '...' : stringValue;
                } else {
                  try {
                    value = dataSet.floatString(tag) || dataSet.intString(tag) || `[${elementData.vr}]`;
                  } catch {
                    value = `[${elementData.vr}]`;
                  }
                }
              }
            }
            
            seriesDict.push({
              tag: tag.slice(1),
              description,
              value
            });
          } catch (e) {
            // 跳过单个标签错误
          }
        }
        
        seriesDict.sort((a, b) => a.tag.localeCompare(b.tag));
        
        // 生成缩略图 - 只有成功生成有效缩略图才算有效系列
        const thumbnail = await this.generateThumbnail(firstImage);
        // 验证缩略图是否有效（长度足够表示真实图像数据）
        if (!thumbnail || thumbnail.length < 5000) {
          // 缩略图无效（null 或数据太小），跳过该系列
          continue;
        }
        
        // 成功生成缩略图，添加到结果列表
        thumbnails.push({
          modality: dataSet.string("x00080060") || "Unknown",
          seriesNo: dataSet.string("x00200011") || "0",
          seriesDate: dataSet.string("x00080021") || "",
          seriesTime: dataSet.string("x00080031") || "",
          description: dataSet.string("x0008103e") || series.name,
          seriesUID: dataSet.string("x0020000e") || "",
          image: thumbnail,
          path: firstImage.path
        });
        dicomDict.push(seriesDict);
        filteredSeries.push(series); // 添加到过滤后的系列列表
      } catch (error) {
        // 解析失败或生成缩略图失败，跳过该系列（无效影像）
      }
    }
    
    return { thumbnails, dicomDict, filteredSeries };
  }
}

