/**
 * DICOM服务
 * 负责DICOM文件的读取、解析和缩略图生成
 */

const fs = require('fs');
const path = require('path');
const { Notification } = require('element-ui');
const dicomParser = require('dicom-parser');
import PathUtils from '../utils/PathUtils';
const { ConfigManager } = require('../utils/ConfigManager');
import { DicomCineService } from './DicomCineService';
import { DicomThumbnailService } from './DicomThumbnailService';
import { DicomStructureService } from './DicomStructureService';

export class DicomService {
  constructor() {
    this.cache = new Map();
    this.cineService = DicomCineService.getInstance(this);
    this.thumbnailService = DicomThumbnailService.getInstance(this);
    this.structureService = DicomStructureService.getInstance(this);
  }

  static getInstance() {
    if (!DicomService.instance) {
      DicomService.instance = new DicomService();
    }
    return DicomService.instance;
  }

  /**
   * 标准化文件路径，确保跨平台兼容性
   */
  normalizePath(filePath) {
    return PathUtils.normalizePath(filePath);
  }

  /**
   * 检查文件是否存在，支持跨平台路径
   */
  fileExists(filePath) {
    return PathUtils.fileExists(filePath);
  }

  /**
   * 获取目录树结构
   */
  getDirectoryTree(directory) {
    // 标准化路径，确保跨平台兼容性
    const normalizedDirectory = this.normalizePath(directory);
    const tree = {
      name: path.basename(normalizedDirectory),
      path: normalizedDirectory,
      children: []
    };

    try {
      const items = fs.readdirSync(normalizedDirectory, { withFileTypes: true });

      items.forEach((item) => {
        const fullPath = path.join(normalizedDirectory, item.name);
        
        // 过滤掉不需要的文件和目录
        if (this.shouldIgnoreFile(item.name)) {
          return; // 跳过这个文件/目录
        }
        
        if (item.isDirectory()) {
          // 递归处理目录
          const subTree = this.getDirectoryTree(fullPath);
          // 只有当子目录包含有效内容时才添加
          if (this.hasDicomFiles(subTree)) {
            tree.children.push(subTree);
          } else {
          }
        } else {
          // 只添加DICOM文件
          const isDicom = this.isDicomFile(fullPath);
          if (isDicom) {
            tree.children.push({
              name: item.name,
              path: fullPath,
              isFile: true,
              children: []
            });
          }
        }
      });
      
    } catch (error) {
      // 获取目录树失败，静默处理
    }

    return tree;
  }

  /**
   * 检查节点是否包含DICOM文件
   */
  hasDicomFiles(node) {
    if (node.isFile) {
      return this.isDicomFile(node.path);
    }
    
    if (node.children) {
      return node.children.some(child => this.hasDicomFiles(child));
    }
    
    return false;
  }

  /**
   * 检查是否应该忽略某个文件
   */
  shouldIgnoreFile(fileName) {
    // 忽略隐藏文件和系统文件
    const ignorePatterns = [
      /^\./,                    // 隐藏文件（以.开头）
      /\.DS_Store$/i,          // macOS系统文件
      /Thumbs\.db$/i,          // Windows缩略图文件
      /desktop\.ini$/i,        // Windows系统文件
      /\.tmp$/i,               // 临时文件
      /\.log$/i,               // 日志文件
      /\.txt$/i,               // 文本文件
      /\.xml$/i,               // XML文件
      /\.json$/i,              // JSON文件
      /\.pdf$/i,               // PDF文件
      /\.zip$/i,               // 压缩文件
      /\.rar$/i,               // 压缩文件
      /\.7z$/i,                // 压缩文件
      /\.bak$/i,               // 备份文件
      /\.old$/i,               // 旧文件
      /\.swp$/i,               // Vim交换文件
      /\.swo$/i,               // Vim交换文件
      /~$/i,                   // 备份文件（以~结尾）
      /^Icon\r?$/i,            // macOS图标文件
      /^\.Spotlight-V100$/i,   // macOS索引文件
      /^\.Trashes$/i,          // macOS垃圾箱文件
      /^\.fseventsd$/i,        // macOS文件系统事件
      /^\.VolumeIcon\.icns$/i  // macOS卷图标
    ];
    
    return ignorePatterns.some(pattern => pattern.test(fileName));
  }

  /**
   * 检查文件是否为DICOM文件
   */
  isDicomFile(filename) {
    try {
      // 标准化路径，确保跨平台兼容性
      const filePath = this.normalizePath(filename);
      const fileName = path.basename(filePath);
      
      // 过滤隐藏文件和系统文件
      if (this.shouldIgnoreFile(fileName)) {
        return false;
      }
      
      // 使用配置文件中的扩展名列表
      const configManager = ConfigManager.getInstance();
      const dicomExtensions = configManager.getDicomExtensions();
      const fileExt = path.extname(fileName).toLowerCase();
      
      // 检查文件扩展名
      if (dicomExtensions.includes(fileExt)) {
        return true;
      }
      
      // 检查文件名模式（无扩展名的DICOM文件）
      const dicomFileNamePatterns = [
        /^IMG\d+$/i,                    // IMG001, IMG002
        /^\d+\.\d+\.\d+.*$/i,          // UID格式: 1.2.840.113619...
        /^[A-Z0-9]{8,}$/i,             // 8位以上大写字母数字组合
        /^SER\d+$/i,                   // SER001, SER002
        /^STD\d+$/i,                   // STD001, STD002
        /^STUDY\d+$/i                  // STUDY001, STUDY002
      ];
      
      for (const pattern of dicomFileNamePatterns) {
        if (pattern.test(fileName)) {
          return true;
        }
      }
      
      const stats = fs.statSync(filePath);
      
      // 检查文件大小是否合理（DICOM文件通常大于1KB）
      if (stats.size < 1024 || stats.size > 500 * 1024 * 1024) { // 1KB到500MB之间
        return false;
      }
      
      // 尝试读取文件头
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(132); // DICOM文件头长度
      fs.readSync(fd, buffer, 0, 132, 0);
      fs.closeSync(fd);
      
      // 检查DICOM文件头标识 'DICM'
      const header = buffer.toString('ascii', 128, 132);
      if (header === 'DICM') {
        return true;
      }
      
      // 如果没有DICM标识，尝试用dicom-parser解析
      try {
        const fileBuffer = fs.readFileSync(filePath);
        const dataSet = dicomParser.parseDicom(fileBuffer);
        
        // 如果能成功解析且包含基本DICOM标签，认为是DICOM文件
        if (dataSet && dataSet.elements && Object.keys(dataSet.elements).length > 0) {
          // 检查是否包含基本的DICOM标签
          const hasBasicTags = Object.keys(dataSet.elements).some(tag => {
            return tag.includes('0008') || tag.includes('0010') || tag.includes('0020');
          });
          if (hasBasicTags) {
            return true;
          }
        }
      } catch (parseError) {
        return false;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取树的最大深度 - 支持1-6层结构
   */
  getMaxDepth(node) {
    if (!node.children || node.children.length === 0) {
      // 如果是叶子节点且是文件，返回1（表示单文件结构）
      // 如果是叶子节点且是目录，返回0（表示空目录）
      return node.isFile ? 1 : 0;
    }
    return 1 + Math.max(...node.children.map(child => this.getMaxDepth(child)));
  }

  /**
   * 智能分析DICOM目录结构
   */
  analyzeDicomStructure(tree) {
    return this.structureService.analyzeDicomStructure(tree);
  }

  /**
   * 检查是否为多患者目录
   */
  isMultiPatientDirectory(tree) {
    return this.structureService.isMultiPatientDirectory(tree);
  }

  /**
   * 分析多患者结构
   */
  analyzeMultiPatientStructure(tree) {
    return this.structureService.analyzeMultiPatientStructure(tree);
  }

  /**
   * 基于DICOM标签智能分组系列 - 真正的DICOM标准实现
   */
  groupSeriesByDicomTags(imageNodes) {
    return this.structureService.groupSeriesByDicomTags(imageNodes);
      }
      

  /**
   * 获取DICOM标签值
   */
  getTagValue(dicomInfo, tag) {
    if (!dicomInfo || !dicomInfo.elements) {
      return null;
    }
    
    // 标准化标签格式（去掉x前缀，转大写）
    const normalizedTag = tag.replace(/^x/, '').toUpperCase();
    
    for (const element of dicomInfo.elements) {
      // 支持多种标签格式匹配
      if (element.tag === tag || 
          element.tag === normalizedTag ||
          element.tag === tag.replace(/^x/, '') ||
          element.tag === tag.toUpperCase()) {
        return element.value;
      }
    }
    
    // 如果没有找到，尝试从原始DICOM数据中直接提取
    if (dicomInfo.rawData && dicomInfo.rawData.elements) {
      try {
        const value = dicomInfo.rawData.string(tag);
        if (value) return value;
        
        // 尝试不带x前缀的格式
        const tagWithoutX = tag.replace(/^x/, '');
        const value2 = dicomInfo.rawData.string(tagWithoutX);
        if (value2) return value2;
      } catch (error) {
        // 忽略错误，继续其他方式
      }
    }
    
    return null;
  }

  /**
   * 检测是否为动态影像系列（优化：只检查每个系列的第一张影像）
   * @param {Array<Object>} seriesNodes - 系列节点数组
   * @returns {Object|boolean} 如果是动态影像，返回包含动态影像信息的对象；否则返回false
   */
  isDynamicImageSeries(seriesNodes) {
    if (!seriesNodes || seriesNodes.length === 0) {
      return false;
    }

    // 检查每个系列的第一张DICOM文件，看是否有真正的动态影像
    for (const series of seriesNodes) {
      if (!series.children || series.children.length === 0) {
        continue;
      }
      
      // 只检查第一个DICOM文件（通常第一个文件就能确定整个系列的类型）
      // 优化：不遍历所有影像，只检查第一张，避免大目录时加载所有文件
      const firstImageNode = series.children.find(child => {
        // 跳过帧节点，只检查原始文件节点
        if (child.isFrame) {
          return false;
        }
        return child.isFile && this.isDicomFile(child.name || child.path);
      });

      if (firstImageNode) {
        const imagePath = firstImageNode.fullPath || firstImageNode.path;
          if (imagePath) {
            try {
            // 检测单个文件是否为动态影像
            const cineInfo = this.cineService.isCineImage(imagePath);
              if (cineInfo && cineInfo.isCine && cineInfo.frameCount > 1) {
              return {
                isDynamic: true,
                cineInfo: cineInfo,
                seriesName: series.name,
                  imagePath: imagePath,
                  seriesInstanceUID: series.seriesInstanceUID || null
                };
              }
            } catch (error) {
            // 检测失败时记录错误但继续检查其他系列
            // 检测失败，继续下一个系列
          }
        }
      }
    }

    return false;
  }


  /**
   * 解析DICOM文件获取标签
   */
  parseDicomFile(filePath) {
    try {
      
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      const fileBuffer = fs.readFileSync(filePath);
      
      if (fileBuffer.length === 0) {
        return null;
      }
      
      const dicomData = dicomParser.parseDicom(fileBuffer);
      
      const elements = [];
      
      // 提取关键DICOM标签 - 使用带x前缀的格式
      const tags = [
        'x0020000e', // Series Instance UID
        'x00080060', // Modality
        'x0008103e', // Series Description
        'x00200011', // Series Number
        'x00100010', // Patient Name
        'x00100020', // Patient ID
        'x00080020', // Study Date
        'x00080030', // Study Time
        'x0020000d', // Study Instance UID
        // 动态影像相关标签
        'x00181063', // Frame Time
        'x00181065', // Frame Time Vector
        'x00181100', // Reconstruction Diameter
        'x00181210', // Convolution Kernel
        'x00280008', // Number of Frames
        'x00280009', // Frame Increment Pointer
        'x00181015', // Heart Rate
        'x00181016', // Cardiac Number of Images
        'x00181018', // Cardiac Cycle Time
        'x00082111', // Derivation Description
        'x00082112', // Source Image Sequence
        'x00082120', // Stage Name
        'x00082121', // Stage Description
        'x00082122'  // Stage Number
      ];
      
      // 也尝试不带x前缀的格式作为备选
      const tagsWithoutX = [
        '0020000E', // Series Instance UID
        '00080060', // Modality
        '0008103E', // Series Description
        '00200011', // Series Number
        '00100010', // Patient Name
        '00100020', // Patient ID
        '00080020', // Study Date
        '00080030', // Study Time
        '0020000D', // Study Instance UID
        // 动态影像相关标签
        '00181063', // Frame Time
        '00181065', // Frame Time Vector
        '00181100', // Reconstruction Diameter
        '00181210', // Convolution Kernel
        '00280008', // Number of Frames
        '00280009', // Frame Increment Pointer
        '00181015', // Heart Rate
        '00181016', // Cardiac Number of Images
        '00181018', // Cardiac Cycle Time
        '00082111', // Derivation Description
        '00082112', // Source Image Sequence
        '00082120', // Stage Name
        '00082121', // Stage Description
        '00082122'  // Stage Number
      ];
      
      // 移除详细调试日志以提升性能
      
      // 尝试提取标签，支持带x前缀和不带x前缀的格式
      const allTags = [...tags, ...tagsWithoutX];
      const extractedTags = new Set(); // 避免重复提取
      
      allTags.forEach(tag => {
        const normalizedTag = tag.replace(/^x/, '').toUpperCase(); // 标准化标签格式（去掉x前缀，转大写）
        if (extractedTags.has(normalizedTag)) return; // 避免重复
        
        try {
          const element = dicomData.elements[tag];
          if (element) {
            const value = dicomData.string(tag);
            elements.push({
              tag: normalizedTag,
              value: value,
              vr: element.vr
            });
            extractedTags.add(normalizedTag);
          }
        } catch (error) {
          // 标签提取失败，跳过该标签
        }
      });
      
      
      return {
        elements: elements,
        rawData: dicomData
      };
    } catch (error) {
      // 静默处理解析错误（某些DICOM文件可能有格式问题，但不影响整体流程）
      return null;
    }
  }

  /**
   * 获取树结构的最后两层数据 - 智能兼容多种结构
   */
  getLastTwoLayersStandard(tree) {
    return this.structureService.getLastTwoLayersStandard(tree);
  }

  /**
   * 获取最后两层（向后兼容）
   */
  getLastTwoLayers(tree) {
    return this.structureService.getLastTwoLayers(tree);
  }

  /**
   * 构建目录树标签
   */
  async buildTree(tree) {
    let num = 0;
    const dicomDict = await require('localforage').getItem('dicomDict') || [];

    const buildNodeLabels = (node, parentId = '', depth = 0) => {
      node.id = parentId ? `${parentId}-${num++}` : `${num++}`;
      
      // 根据深度和DICOM字典设置标签
      if (depth === 0) {
        node.label = node.name;
      } else if (depth === 1 && Array.isArray(dicomDict) && dicomDict.length > 0) {
        // 尝试从DICOM字典获取患者信息
        const seriesDict = dicomDict.find(dict => dict.seriesPath === node.path);
        if (seriesDict && seriesDict.patientName) {
          node.label = `${seriesDict.patientName} (${node.name})`;
        } else {
          node.label = node.name;
        }
      } else {
        node.label = node.name;
      }

      if (node.children) {
        node.children.forEach((child, index) => {
          buildNodeLabels(child, node.id, depth + 1);
        });
      }
    };

    tree.forEach((node, index) => {
      buildNodeLabels(node, `${index}`, 0);
    });
    
    return tree;
  }

  /**
   * 生成缩略图列表
   */
  async generateThumbnailList(seriesList) {
    return this.thumbnailService.generateThumbnailList(seriesList);
  }

  /**
   * 从系列中获取第一张图像
   */
  getFirstImageFromSeries(series) {
    return this.thumbnailService.getFirstImageFromSeries(series);
  }

  /**
   * 生成缩略图
   */
  async generateThumbnail(imageNode) {
    return this.thumbnailService.generateThumbnail(imageNode);
  }

  /**
   * 解析DICOM元数据
   */
  async parseDicomMetadata(imageNode) {
    try {
      const dicomParser = require('dicom-parser');
      
      // 读取文件内容
      const fs = require('fs');
      const arrayBuffer = fs.readFileSync(imageNode.path).buffer;
      const byteArray = new Uint8Array(arrayBuffer);
      
      // 解析 DICOM 文件
      const dataSet = dicomParser.parseDicom(byteArray);
      
      // 解析所有DICOM标签
      const result = [];
      for (const tag of Object.keys(dataSet.elements)) {
        let description = 'Unknown Item';
        let value = '';
        
        // 尝试获取标签描述
        try {
          // 使用dicom-parser的内置字典
          const tagStr = `(${tag.slice(1, 5)},${tag.slice(5)})`;
          const dict = dicomParser.data.DicomMetaDictionary.dictionary[tagStr];
          if (dict && dict.name) {
            description = dict.name;
          }
        } catch (e) {
          // 如果获取描述失败，使用默认值
        }
        
        // 获取标签值
        if (dataSet.string(tag)) {
          value = dataSet.string(tag).slice(0, 50); // 限制长度
        }
        
        result.push({
          tag: `${tag.slice(1)}`,
          description,
          value
        });
      }
      
      return result;
    } catch (error) {
      return [];
    }
  }
}
