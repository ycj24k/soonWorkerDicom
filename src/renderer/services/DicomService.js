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

export class DicomService {
  constructor() {
    this.cache = new Map();
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
    
    const maxDepth = this.getMaxDepth(tree);

    // 检查是否为多患者目录
    const isMultiPatient = this.isMultiPatientDirectory(tree);
    
    if (isMultiPatient) {
      const result = this.analyzeMultiPatientStructure(tree);
      
      // 确保多患者结构有有效的系列和图像
      if (result && result.seriesNodes && result.seriesNodes.length > 0) {
        return result;
      } else {
      }
    }

    // 检查是否为单文件结构
    if (maxDepth === 1 && tree.children && tree.children.length === 1 && tree.children[0].isFile) {
      const singleFile = tree.children[0];
      
      // 创建单文件结果
      const result = {
        seriesNodes: [{
          name: singleFile.name,
          path: path.dirname(singleFile.path),
          children: [singleFile],
          isFile: false,
          imageCount: 1
        }],
        imageNodes: [singleFile],
        structureType: 'single-file',
        maxDepth: 1,
        isMultiPatient: false
      };
      return result;
    }

    // 单患者目录分析
    const lastTwoLayers = this.getLastTwoLayersStandard(tree);
    if (!lastTwoLayers) {
      return null;
    }


    // 基于DICOM标签重新分组系列
    const seriesNodes = this.groupSeriesByDicomTags(lastTwoLayers.lastLayer);
    
    const imageNodes = lastTwoLayers.lastLayer; // 图像节点

    const result = {
      seriesNodes,
      imageNodes,
      structureType: 'standard', // 标准DICOM结构
      maxDepth,
      isMultiPatient: false
    };
    return result;
  }

  /**
   * 检查是否为多患者目录
   */
  isMultiPatientDirectory(tree) {
    if (!tree.children || tree.children.length === 0) {
      return false;
    }
    
    
    // 检查根目录下的子目录是否包含DICOM文件
    // 如果多个子目录都包含DICOM文件，则是多患者目录
    let patientCount = 0;
    const patientDirs = [];
    
    tree.children.forEach(child => {
      if (!child.isFile && this.hasDicomFiles(child)) {
        patientCount++;
        patientDirs.push(child.name);
      }
    });
    
    
    // 如果只有1个患者目录，也检查是否是特殊的单患者结构
    if (patientCount === 1) {
      const singlePatient = tree.children.find(child => !child.isFile && this.hasDicomFiles(child));
      if (singlePatient) {
        // 检查这个患者目录的深度，如果太深可能是单患者结构
        const patientDepth = this.getMaxDepth(singlePatient);
        
        // 如果深度大于3，可能是复杂的单患者结构，不应该作为多患者处理
        if (patientDepth > 3) {
          return false;
        }
      }
    }
    
    const isMulti = patientCount > 1;
    return isMulti;
  }

  /**
   * 分析多患者结构
   */
  analyzeMultiPatientStructure(tree) {
    
    const patients = [];
    
    tree.children.forEach((patientNode, index) => {
      
      if (!patientNode.isFile && this.hasDicomFiles(patientNode)) {
        // 分析每个患者
        const patientAnalysis = this.analyzeDicomStructure(patientNode);
        
        if (patientAnalysis && patientAnalysis.seriesNodes.length > 0) {
          patients.push({
            patientName: patientNode.name,
            patientPath: patientNode.path,
            seriesNodes: patientAnalysis.seriesNodes,
            imageNodes: patientAnalysis.imageNodes,
            structureType: patientAnalysis.structureType,
            maxDepth: patientAnalysis.maxDepth
          });
        } else {
        }
      } else {
      }
    });

    
    // 把所有患者的系列合并成一个数组
    const allSeriesNodes = [];
    const allImageNodes = [];
    
    patients.forEach(patient => {
      if (patient.seriesNodes && patient.seriesNodes.length > 0) {
        allSeriesNodes.push(...patient.seriesNodes);
      }
      if (patient.imageNodes && patient.imageNodes.length > 0) {
        allImageNodes.push(...patient.imageNodes);
      }
    });
    
    
    return {
      patients,
      seriesNodes: allSeriesNodes, // 添加这个字段供dashboard使用
      imageNodes: allImageNodes,   // 添加这个字段供dashboard使用
      structureType: 'multi-patient',
      maxDepth: this.getMaxDepth(tree),
      isMultiPatient: true,
      totalPatients: patients.length
    };
  }

  /**
   * 基于DICOM标签智能分组系列 - 真正的DICOM标准实现
   */
  groupSeriesByDicomTags(imageNodes) {
    const seriesMap = new Map();
    
    imageNodes.forEach((imageNode, index) => {
      if (!imageNode.isFile) return;
      
      try {
        // 解析DICOM文件获取关键标签
        const dicomData = this.parseDicomFile(imageNode.path);
        if (dicomData) {
          const seriesInstanceUID = dicomData.find(tag => tag.tag === '0020000E')?.value;
          const studyInstanceUID = dicomData.find(tag => tag.tag === '0020000D')?.value;
          const patientID = dicomData.find(tag => tag.tag === '00100020')?.value;
          const patientName = dicomData.find(tag => tag.tag === '00100010')?.value;
          
          
          if (seriesInstanceUID) {
            if (!seriesMap.has(seriesInstanceUID)) {
              // 创建新的系列对象
              const modality = dicomData.find(tag => tag.tag === '00080060')?.value || 'Unknown';
              const seriesDescription = dicomData.find(tag => tag.tag === '0008103E')?.value || 'Unknown';
              const seriesNumber = dicomData.find(tag => tag.tag === '00200011')?.value || 'Unknown';
              const studyDate = dicomData.find(tag => tag.tag === '00080020')?.value || 'Unknown';
              
              
              seriesMap.set(seriesInstanceUID, {
                name: `${seriesNumber}: ${seriesDescription}`,
                path: path.normalize(path.dirname(imageNode.path)),
                children: [],
                isFile: false,
                seriesInstanceUID: seriesInstanceUID,
                studyInstanceUID: studyInstanceUID,
                patientID: patientID,
                patientName: patientName,
                modality: modality,
                seriesDescription: seriesDescription,
                seriesNumber: seriesNumber,
                studyDate: studyDate,
                imageCount: 0
              });
            }
            
            // 添加图像到系列
            const series = seriesMap.get(seriesInstanceUID);
            series.children.push(imageNode);
            series.imageCount++;
          }
        } else {
        }
      } catch (error) {
      }
    });
    
    const result = Array.from(seriesMap.values()).sort((a, b) => {
      // 按系列编号排序
      const aNum = parseInt(a.seriesNumber) || 999;
      const bNum = parseInt(b.seriesNumber) || 999;
      return aNum - bNum;
    });
    
    // 处理每个系列中的动态影像，将其分解为帧
    const processedResult = result.map(series => this.processCineImagesInSeries(series));
    
    return processedResult;
  }

  /**
   * 检测单个DICOM文件是否为动态影像（包含多个帧）
   */
  isCineImage(dicomFilePath) {
    try {
      const dicomInfo = this.parseDicomFile(dicomFilePath);
      if (!dicomInfo) {
        return false;
      }

      // 调试：输出DICOM标签信息
      const path = require('path');
      const fileName = path.basename(dicomFilePath);
      console.log(`🔍 检查动态影像标签: ${fileName}`);
      
      // 输出所有相关标签的值
      const tagsToCheck = [
        'x00280008', '00280008', // Number of Frames
        'x00181063', '00181063', // Frame Time
        'x00181016', '00181016', // Cardiac Number of Images
        'x00181015', '00181015', // Heart Rate
        'x00200100', '00200100', // Temporal Position Identifier
        'x00200105', '00200105', // Temporal Position
        'x00201020', '00201020', // Number of Temporal Positions
        'x00280009', '00280009', // Frame Increment Pointer
        'x00201002', '00201002', // Images in Acquisition
        'x00540081', '00540081'  // Number of Slices
      ];
      
      const tagValues = {};
      tagsToCheck.forEach(tag => {
        const value = this.getTagValue(dicomInfo, tag);
        if (value) {
          tagValues[tag] = value;
        }
      });
      
      if (Object.keys(tagValues).length > 0) {
        console.log(`📋 ${fileName} 相关标签:`, tagValues);
      }

      // 直接从原始DICOM数据获取标签值（更可靠）
      const rawData = dicomInfo.rawData;
      
      // 检查关键动态影像标签（多种格式）
      let numberOfFrames = null;
      let frameTime = null;
      let cardiacNumberOfImages = null;
      let heartRate = null;
      
      try {
        // 尝试多种标签格式
        numberOfFrames = rawData.string('x00280008') || 
                        rawData.string('00280008') ||
                        rawData.uint16('x00280008') ||
                        rawData.uint16('00280008');
        
        frameTime = rawData.string('x00181063') || 
                   rawData.string('00181063') ||
                   rawData.floatString('x00181063') ||
                   rawData.floatString('00181063');
        
        cardiacNumberOfImages = rawData.string('x00181016') || 
                              rawData.string('00181016') ||
                              rawData.uint16('x00181016') ||
                              rawData.uint16('00181016');
        
        heartRate = rawData.string('x00181015') || 
                   rawData.string('00181015') ||
                   rawData.uint16('x00181015') ||
                   rawData.uint16('00181015');
      } catch (error) {
        // 如果直接获取失败，使用getTagValue方法
        numberOfFrames = this.getTagValue(dicomInfo, 'x00280008') || this.getTagValue(dicomInfo, '00280008');
        frameTime = this.getTagValue(dicomInfo, 'x00181063') || this.getTagValue(dicomInfo, '00181063');
        cardiacNumberOfImages = this.getTagValue(dicomInfo, 'x00181016') || this.getTagValue(dicomInfo, '00181016');
        heartRate = this.getTagValue(dicomInfo, 'x00181015') || this.getTagValue(dicomInfo, '00181015');
      }
      
      // 检查其他可能的动态影像标签
      const temporalPositionIdentifier = this.getTagValue(dicomInfo, 'x00200100') || this.getTagValue(dicomInfo, '00200100');
      const temporalPosition = this.getTagValue(dicomInfo, 'x00200105') || this.getTagValue(dicomInfo, '00200105');
      const numberOfTemporalPositions = this.getTagValue(dicomInfo, 'x00201020') || this.getTagValue(dicomInfo, '00201020');
      const frameIncrementPointer = this.getTagValue(dicomInfo, 'x00280009') || this.getTagValue(dicomInfo, '00280009');
      
      // 检查序列相关标签
      const imagesInAcquisition = this.getTagValue(dicomInfo, 'x00201002') || this.getTagValue(dicomInfo, '00201002');
      const numberOfSlices = this.getTagValue(dicomInfo, 'x00540081') || this.getTagValue(dicomInfo, '00540081');

      // 调试：显示获取到的标签值
      console.log(`🔍 ${fileName} 标签值检测:`, {
        numberOfFrames,
        frameTime,
        cardiacNumberOfImages,
        heartRate
      });

      // 如果有帧数信息且大于1，则为动态影像
      if (numberOfFrames && parseInt(numberOfFrames) > 1) {
        const result = {
          isCine: true,
          frameCount: parseInt(numberOfFrames),
          frameTime: frameTime,
          heartRate: heartRate,
          type: 'multi-frame'
        };
        console.log(`✅ ${fileName} 检测为动态影像:`, result);
        return result;
      }

      // 检查心脏相关标签
      if (cardiacNumberOfImages && parseInt(cardiacNumberOfImages) > 1) {
        return {
          isCine: true,
          frameCount: parseInt(cardiacNumberOfImages),
          frameTime: frameTime,
          heartRate: heartRate,
          type: 'cardiac'
        };
      }

      // 检查帧时间信息
      if (frameTime && parseFloat(frameTime) > 0) {
        return {
          isCine: true,
          frameCount: 2, // 默认至少有2帧
          frameTime: frameTime,
          heartRate: heartRate,
          type: 'time-series'
        };
      }

      // 检查时间位置信息
      if (numberOfTemporalPositions && parseInt(numberOfTemporalPositions) > 1) {
        return {
          isCine: true,
          frameCount: parseInt(numberOfTemporalPositions),
          frameTime: frameTime,
          heartRate: heartRate,
          type: 'temporal'
        };
      }

      // 检查采集中的图像数量
      if (imagesInAcquisition && parseInt(imagesInAcquisition) > 1) {
        return {
          isCine: true,
          frameCount: parseInt(imagesInAcquisition),
          frameTime: frameTime,
          heartRate: heartRate,
          type: 'acquisition'
        };
      }

      // 检查切片数量
      if (numberOfSlices && parseInt(numberOfSlices) > 1) {
        return {
          isCine: true,
          frameCount: parseInt(numberOfSlices),
          frameTime: frameTime,
          heartRate: heartRate,
          type: 'multi-slice'
        };
      }

      // 检查帧增量指针（表示有多个帧）
      if (frameIncrementPointer) {
        return {
          isCine: true,
          frameCount: 2, // 默认至少有2帧
          frameTime: frameTime,
          heartRate: heartRate,
          type: 'frame-increment'
        };
      }

      console.log(`❌ ${fileName} 不是动态影像`);
      return { isCine: false };

    } catch (error) {
      console.error(`检测动态影像失败: ${dicomFilePath}`, error);
      return { isCine: false };
    }
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
   * 检测是否为动态影像系列
   */
  isDynamicImageSeries(seriesNodes) {
    if (!seriesNodes || seriesNodes.length === 0) {
      return false;
    }

    // 检查每个系列中的DICOM文件，看是否有真正的动态影像
    for (const series of seriesNodes) {
      if (!series.children) continue;
      
      // 检查系列中的每个文件
      for (const imageNode of series.children) {
        if (imageNode.isFile && this.isDicomFile(imageNode.name)) {
          const imagePath = imageNode.fullPath || imageNode.path;
          if (imagePath) {
            // 检测单个文件是否为动态影像
            const cineInfo = this.isCineImage(imagePath);
            if (cineInfo && cineInfo.isCine) {
              return {
                isDynamic: true,
                cineInfo: cineInfo,
                seriesName: series.name,
                imagePath: imagePath
              };
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * 分解动态影像为单独的帧图像节点
   * 将多帧DICOM文件分解成多个单帧图像节点
   */
  extractFramesFromCineImage(cineImageNode, cineInfo) {
    if (!cineInfo || !cineInfo.isCine || cineInfo.frameCount <= 1) {
      return [cineImageNode]; // 不是动态影像，返回原节点
    }

    const frameNodes = [];
    const path = require('path');
    
    for (let frameIndex = 0; frameIndex < cineInfo.frameCount; frameIndex++) {
      const frameNode = {
        name: `${path.basename(cineImageNode.name, path.extname(cineImageNode.name))}_frame_${frameIndex + 1}`,
        path: cineImageNode.path,
        fullPath: cineImageNode.fullPath || cineImageNode.path,
        isFile: true,
        isFrame: true, // 标记为帧节点
        parentCineImage: cineImageNode, // 指向原始动态影像
        frameIndex: frameIndex, // 帧索引
        frameId: `frame_${frameIndex}`,
        cineInfo: cineInfo
      };
      
      frameNodes.push(frameNode);
    }
    
    console.log(`🎬 分解动态影像: ${cineImageNode.name} -> ${frameNodes.length} 帧`);
    return frameNodes;
  }

  /**
   * 处理系列中的动态影像，将其分解为帧
   */
  processCineImagesInSeries(seriesNode) {
    if (!seriesNode.children) {
      return seriesNode;
    }

    const processedChildren = [];
    
    for (const child of seriesNode.children) {
      if (child.isFile && this.isDicomFile(child.name)) {
        // 检查是否为动态影像
        const cineInfo = this.isCineImage(child.fullPath || child.path);
        if (cineInfo && cineInfo.isCine && cineInfo.frameCount > 1) {
          // 分解为帧
          const frameNodes = this.extractFramesFromCineImage(child, cineInfo);
          processedChildren.push(...frameNodes);
        } else {
          // 普通图像，直接添加
          processedChildren.push(child);
        }
      } else {
        // 非文件节点，直接添加
        processedChildren.push(child);
      }
    }
    
    // 更新系列的子节点
    seriesNode.children = processedChildren;
    seriesNode.processedForFrames = true; // 标记已处理
    
    return seriesNode;
  }

  /**
   * 解析DICOM文件获取标签
   */
  parseDicomFile(filePath) {
    try {
      
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        console.error(`文件不存在: ${filePath}`);
        return null;
      }
      
      const fileBuffer = fs.readFileSync(filePath);
      
      if (fileBuffer.length === 0) {
        console.error(`文件为空: ${filePath}`);
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
          console.warn(`标签 ${tag} 提取失败:`, error.message);
        }
      });
      
      
      return {
        elements: elements,
        rawData: dicomData
      };
    } catch (error) {
      console.error(`解析DICOM文件失败: ${filePath}`, error);
      return null;
    }
  }

  /**
   * 获取树结构的最后两层数据 - 智能兼容多种结构
   */
  getLastTwoLayersStandard(tree) {
    const result = { secondLastLayer: [], lastLayer: [] };
    // 从根节点开始遍历，初始深度为树的高度
    const maxDepth = this.getMaxDepth(tree);
    
    
    if (maxDepth < 1 || maxDepth > 6) {
      console.warn(`DICOM数据格式错误，深度为${maxDepth}，期望1-6层！`);
      return false;
    }
    
    // 智能递归函数 - 自适应多种结构
    function traverse(node, depth) {
      
      // 智能识别节点类型，不依赖固定深度映射
      if (node.isFile) {
        // 这是图像文件，添加到图像层
        result.lastLayer.push(node);
        
        // 如果是单文件结构，也添加到系列层
        if (maxDepth === 1) {
          result.secondLastLayer.push(node);
        }
      } else {
        // 这是目录，检查是否应该作为系列
        const shouldBeSeries = checkIfShouldBeSeries(node, depth, maxDepth);
        if (shouldBeSeries) {
          result.secondLastLayer.push(node);
        }
      }

      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          traverse(child, depth - 1);
        });
      } else {
      }
    }

    // 智能判断目录是否应该作为系列
    function checkIfShouldBeSeries(node, depth, maxDepth) {
      // 检查目录名是否像系列名
      const isSeriesName = /^(SER|STD|STUDY|SERIES|SEQ)\d*$/i.test(node.name);
      
      // 检查目录是否包含图像文件
      const hasImageFiles = node.children && node.children.some(child => 
        child.isFile && isDicomFileName(child.name)
      );
      
      // 检查深度是否合理（系列通常在倒数第二层）
      const isReasonableDepth = depth >= maxDepth - 2 && depth <= maxDepth - 1;
      
      
      return (isSeriesName || hasImageFiles) && isReasonableDepth;
    }

    // 判断文件名是否像DICOM图像文件
    function isDicomFileName(fileName) {
      const dicomPatterns = [
        /^IMG\d+$/i,                    // IMG001, IMG002
        /^\d+\.\d+\.\d+.*$/i,          // UID格式
        /\.dcm$/i,                      // .dcm扩展名
        /\.dicom$/i,                    // .dicom扩展名
        /\.dic$/i,                      // .dic扩展名
        /\.ima$/i                       // .ima扩展名
      ];
      
      return dicomPatterns.some(pattern => pattern.test(fileName));
    }
    
    // 从根节点开始遍历，初始深度为最大深度
    traverse(tree, maxDepth);
    
    
    return result;
  }

  /**
   * 获取最后两层（向后兼容）
   */
  getLastTwoLayers(tree) {
    const analysis = this.analyzeDicomStructure(tree);
    if (!analysis) {
      return false;
    }

    const { seriesNodes, structureType, imageNodes } = analysis;

    if (structureType === 'flat') {
      // 平铺结构：直接返回所有DICOM文件
      return {
        secondLastLayer: seriesNodes,
        lastLayer: imageNodes
      };
    } else {
      // 嵌套结构：返回序列和图像
      return {
        secondLastLayer: seriesNodes,
        lastLayer: imageNodes
      };
    }
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
    const thumbnails = [];
    const dicomDict = []; // 保持与原来dashboard兼容的数组格式

    for (let i = 0; i < seriesList.length; i++) {
      const series = seriesList[i];
      
      // 参考dashboard的逻辑：每个系列的第一张图像
      if (series.children && series.children.length > 0) {
        // 找到系列中的第一个DICOM文件（不是目录）
        let firstImage = null;
        for (const child of series.children) {
          if (child.isFile) {
            // 检查是否为DICOM文件（包括无扩展名的情况）
            const isDicomFile = this.isDicomFile(child.path) ||
                               (child.name.match(/^IMG\d+$/) && child.path.includes('SER'));
            if (isDicomFile) {
              firstImage = child;
              break;
            }
          }
        }
        
        if (!firstImage) {
          continue;
        }
        
        // 预检查：验证文件是否存在且可读
        try {
          const fs = require('fs');
          const stats = fs.statSync(firstImage.path);
          if (!stats.isFile() || stats.size === 0) {
            continue;
          }
        } catch (error) {
          continue;
        }
        
        
        try {
          // 解析DICOM元数据
          const dicomParser = require('dicom-parser');
          const fs = require('fs');
          const arrayBuffer = fs.readFileSync(firstImage.path).buffer;
          const byteArray = new Uint8Array(arrayBuffer);
          const dataSet = dicomParser.parseDicom(byteArray);
          
          // 创建DICOM标签数组，与dashboard格式完全一致
          const seriesDict = [];
          const tags = [
            { tag: '00100020', name: 'Patient ID' }, // 患者ID
            { tag: '00100010', name: 'Patient Name' }, // 患者姓名
            { tag: '00080020', name: 'Study Date' }, // 检查日期
            { tag: '00080060', name: 'Modality' }, // 设备类型
            { tag: '00081030', name: 'Study Description' }, // 检查描述
            { tag: '00200011', name: 'Series Number' }, // 序列序号
            { tag: '0008103e', name: 'Series Description' }, // 序列描述
            { tag: '00200013', name: 'Instance Number' }, // 实例号
            { tag: '00200032', name: 'Image Position' }, // 图像位置
            { tag: '00200037', name: 'Image Orientation' }, // 图像方向
            { tag: '00280010', name: 'Rows' }, // 行数
            { tag: '00280011', name: 'Columns' }, // 列数
            { tag: '00280030', name: 'Pixel Spacing' }, // 像素间距
            { tag: '00281050', name: 'Window Center' }, // 窗位
            { tag: '00281051', name: 'Window Width' }, // 窗宽
            { tag: '00080018', name: 'SOP Instance UID' }, // SOP实例UID
            { tag: '0020000d', name: 'Study Instance UID' }, // 检查实例UID
            { tag: '0020000e', name: 'Series Instance UID' } // 序列实例UID
          ];
          
          tags.forEach(tagInfo => {
            try {
              const value = dataSet.string(`x${tagInfo.tag}`);
              if (value) {
                seriesDict.push({
                  tag: tagInfo.tag,
                  vr: dataSet.string(`x${tagInfo.tag}`).length > 0 ? 'CS' : 'UN',
                  value: value
                });
              }
            } catch (e) {
              // 忽略解析错误
            }
          });
          
          
          // 生成缩略图
          const thumbnail = await this.generateThumbnail(firstImage);
          
          if (thumbnail) {
            // 创建缩略图数据
            const thumbnailData = {
              modality: dataSet.string("x00080060") || "Unknown",
              seriesNo: dataSet.string("x00200011") || "0",
              seriesDate: dataSet.string("x00080021") || "", // 序列日期
              seriesTime: dataSet.string("x00080031") || "", // 序列时间
              description: dataSet.string("x0008103e") || series.name, // 序列描述
              seriesUID: dataSet.string("x0020000e") || "", // 序列UID
              image: thumbnail, // 缩略图Base64
              path: firstImage.path // 图像路径
            };
            
            thumbnails.push(thumbnailData);
            dicomDict.push(seriesDict); // 将DICOM标签数组添加到字典中
            
          } else {
          }
        } catch (error) {
        }
      } else {
      }
    }
    
    
    return {
      thumbnails,
      dicomDict
    };
  }

  /**
   * 从系列中获取第一张图像
   */
  getFirstImageFromSeries(series) {
    
    if (series.children && series.children.length > 0) {
      for (const child of series.children) {
        
        if (child.isFile && this.isDicomFile(child.path)) {
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
   * 生成DICOM图像的imageId
   */
  getImageId(imageNode) {
    if (!imageNode || !imageNode.path) {
      return null;
    }
    
    // 使用wadouri:协议生成imageId（与你之前的实现一致）
    const imageId = `wadouri:${imageNode.path}`;
    return imageId;
  }

  /**
   * 获取系列中所有DICOM图像的imageId列表
   */
  getSeriesImageIds(series) {
    const imageIds = [];
    
    
    if (!series.children || series.children.length === 0) {
      return imageIds;
    }
    
    // 直接遍历系列的所有子节点，找到DICOM文件
    series.children.forEach((child, index) => {
      
      if (child.isFile && this.isDicomFile(child.path)) {
        // 这是DICOM图像文件，直接生成imageId
        const imageId = `wadouri:${child.path}`;
        imageIds.push(imageId);
      } else if (!child.isFile) {
        // 如果子节点不是文件，说明可能是目录，递归查找
        const subImageIds = this.getSeriesImageIds(child);
        imageIds.push(...subImageIds);
      }
    });
    
    return imageIds;
  }

  /**
   * 生成缩略图
   */
  async generateThumbnail(imageNode) {
    try {
      const cornerstone = require('cornerstone-core');
      const dicomParser = require('dicom-parser');
      
      
      // 读取文件内容
      const fs = require('fs');
      const arrayBuffer = fs.readFileSync(imageNode.path).buffer;
      const byteArray = new Uint8Array(arrayBuffer);
      
      // 检查文件大小
      if (byteArray.length < 1000) {
        throw new Error(`文件太小，可能不是有效的DICOM文件: ${byteArray.length} bytes`);
      }
      
      // 解析 DICOM 文件
      const dataSet = dicomParser.parseDicom(byteArray);
      
      // 不进行DICOM标签验证，直接尝试加载图像
      
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
      return result;
    } catch (error) {
      
      // 如果失败，返回占位符
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      
      // 创建渐变背景
      const gradient = ctx.createLinearGradient(0, 0, 100, 100);
      gradient.addColorStop(0, '#e0e0e0');
      gradient.addColorStop(1, '#c0c0c0');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 100, 100);
      
      // 添加边框
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 98, 98);
      
      // 添加文本
      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DICOM', 50, 40);
      
      ctx.font = '10px Arial';
      ctx.fillText(imageNode.name, 50, 60);
      
      return canvas.toDataURL();
    }
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
