/**
 * DICOM动态影像服务
 * 负责动态影像（Cine/Dynamic Images）的检测和处理
 */

const path = require('path');

export class DicomCineService {
  constructor(dicomService) {
    this.dicomService = dicomService;
  }

  static getInstance(dicomService) {
    if (!DicomCineService.instance) {
      DicomCineService.instance = new DicomCineService(dicomService);
    }
    return DicomCineService.instance;
  }

  /**
   * 检测单个DICOM文件是否为动态影像（包含多个帧）
   * @param {string} dicomFilePath - DICOM文件路径
   * @returns {Object} 动态影像信息对象，如果不是动态影像则返回 { isCine: false }
   */
  isCineImage(dicomFilePath) {
    try {
      const dicomInfo = this.dicomService.parseDicomFile(dicomFilePath);
      if (!dicomInfo) {
        return { isCine: false };
      }

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
        const value = this.dicomService.getTagValue(dicomInfo, tag);
        if (value) {
          tagValues[tag] = value;
        }
      });

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
        numberOfFrames = this.dicomService.getTagValue(dicomInfo, 'x00280008') || this.dicomService.getTagValue(dicomInfo, '00280008');
        frameTime = this.dicomService.getTagValue(dicomInfo, 'x00181063') || this.dicomService.getTagValue(dicomInfo, '00181063');
        cardiacNumberOfImages = this.dicomService.getTagValue(dicomInfo, 'x00181016') || this.dicomService.getTagValue(dicomInfo, '00181016');
        heartRate = this.dicomService.getTagValue(dicomInfo, 'x00181015') || this.dicomService.getTagValue(dicomInfo, '00181015');
      }
      
      // 检查其他可能的动态影像标签
      const temporalPositionIdentifier = this.dicomService.getTagValue(dicomInfo, 'x00200100') || this.dicomService.getTagValue(dicomInfo, '00200100');
      const temporalPosition = this.dicomService.getTagValue(dicomInfo, 'x00200105') || this.dicomService.getTagValue(dicomInfo, '00200105');
      const numberOfTemporalPositions = this.dicomService.getTagValue(dicomInfo, 'x00201020') || this.dicomService.getTagValue(dicomInfo, '00201020');
      const frameIncrementPointer = this.dicomService.getTagValue(dicomInfo, 'x00280009') || this.dicomService.getTagValue(dicomInfo, '00280009');
      
      // 检查序列相关标签
      const imagesInAcquisition = this.dicomService.getTagValue(dicomInfo, 'x00201002') || this.dicomService.getTagValue(dicomInfo, '00201002');
      const numberOfSlices = this.dicomService.getTagValue(dicomInfo, 'x00540081') || this.dicomService.getTagValue(dicomInfo, '00540081');

      // 获取文件大小，用于合理性检查
      const fs = require('fs');
      let fileSize = 0;
      try {
        if (fs.existsSync(dicomFilePath)) {
          const stats = fs.statSync(dicomFilePath);
          fileSize = stats.size;
        }
      } catch (error) {
        // 无法获取文件大小，忽略
      }

      // 最可靠的检测：Number of Frames (0028,0008) - DICOM标准标签
      // 这是唯一能准确表示单个文件包含帧数的标签
      if (numberOfFrames) {
        const frameCount = parseInt(numberOfFrames);
        if (frameCount > 1) {
          // 合理性检查：如果文件很小（<1MB），但帧数很大（>100），可能是误判
          // 动态影像文件通常比较大，因为包含多帧图像数据
          if (fileSize > 0 && fileSize < 1024 * 1024 && frameCount > 100) {
            // 文件太小但帧数太多，可能是标签值错误，不判定为动态影像
            if (process.env.NODE_ENV === 'development') {
              console.warn(`文件 ${dicomFilePath} 大小 ${(fileSize / 1024).toFixed(2)}KB，但帧数 ${frameCount}，可能是误判，跳过动态影像检测`);
            }
            return { isCine: false };
          }

          const result = {
            isCine: true,
            frameCount: frameCount,
            frameTime: frameTime,
            heartRate: heartRate,
            type: 'multi-frame'
          };
          return result;
        }
      }

      // 检查心脏相关标签（需要结合其他条件，更严格）
      // Cardiac Number of Images (0018,1016) 通常用于心脏序列，但需要结合其他标签确认
      if (cardiacNumberOfImages && parseInt(cardiacNumberOfImages) > 1) {
        const cardiacCount = parseInt(cardiacNumberOfImages);
        // 需要同时有帧时间或心率信息，且文件大小合理
        if ((frameTime || heartRate) && (fileSize === 0 || fileSize > 512 * 1024 || cardiacCount < 100)) {
          return {
            isCine: true,
            frameCount: cardiacCount,
            frameTime: frameTime,
            heartRate: heartRate,
            type: 'cardiac'
          };
        }
      }

      // 其他标签（frameTime、numberOfTemporalPositions、imagesInAcquisition、numberOfSlices、frameIncrementPointer）
      // 单独存在不足以判定为动态影像，因为这些标签可能出现在普通影像中
      // 只有 Number of Frames (0028,0008) 是唯一可靠的单个文件帧数标签

      return { isCine: false };

    } catch (error) {
      console.error(`检测动态影像失败: ${dicomFilePath}`, error);
      return { isCine: false };
    }
  }

  /**
   * 分解动态影像为单独的帧图像节点
   * 将多帧DICOM文件分解成多个单帧图像节点
   * @param {Object} cineImageNode - 动态影像节点
   * @param {Object} cineInfo - 动态影像信息
   * @returns {Array<Object>} 帧节点数组
   */
  extractFramesFromCineImage(cineImageNode, cineInfo) {
    if (!cineInfo || !cineInfo.isCine || cineInfo.frameCount <= 1) {
      return [cineImageNode]; // 不是动态影像，返回原节点
    }

    const frameNodes = [];
    
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
    
    return frameNodes;
  }

  /**
   * 处理系列中的动态影像，将其分解为帧（优化：只检查第一张影像）
   * @param {Object} seriesNode - 系列节点
   * @returns {Object} 处理后的系列节点
   */
  processCineImagesInSeries(seriesNode) {
    if (!seriesNode || !seriesNode.children || seriesNode.children.length === 0) {
      return seriesNode;
    }

    // 如果已经处理过，直接返回
    if (seriesNode.processedForFrames) {
      return seriesNode;
    }

    // 优化：只检查第一张影像来确定整个系列是否为动态影像
    // 通常一个系列中的所有影像都是同一类型（要么都是动态，要么都是静态）
    const firstChild = seriesNode.children.find(child => 
      child.isFile && 
      !child.isFrame && 
      this.dicomService.isDicomFile(child.name || child.path)
    );

    if (firstChild) {
      const imagePath = firstChild.fullPath || firstChild.path;
      if (imagePath) {
        try {
          // 只检查第一张影像是否为动态影像
          const cineInfo = this.isCineImage(imagePath);
          if (cineInfo && cineInfo.isCine && cineInfo.frameCount > 1) {
            // 第一张是动态影像，分解为帧
            const frameNodes = this.extractFramesFromCineImage(firstChild, cineInfo);
            
            // 保存原始动态影像信息到系列节点
            seriesNode.cineInfo = cineInfo;
            seriesNode.cineImagePath = imagePath;
            
            // 更新系列的子节点：第一张分解为帧，其他保持原样（假设它们也是动态影像）
            // 注意：如果系列中有多个动态影像文件，这里只处理第一个
            // 其他动态影像文件会在用户实际查看时再处理
            seriesNode.children = [
              ...frameNodes,
              ...seriesNode.children.slice(1)
            ];
            seriesNode.processedForFrames = true;
            return seriesNode;
          }
        } catch (error) {
          // 检查失败，继续正常处理
          if (process.env.NODE_ENV === 'development') {
            console.warn(`检查动态影像失败: ${imagePath}`, error);
          }
        }
      }
    }

    // 第一张不是动态影像，或者检查失败，保持原样
    // 所有子节点都作为普通图像处理（不分解为帧）
    seriesNode.processedForFrames = true; // 标记已处理，避免重复检查
    
    return seriesNode;
  }
}

