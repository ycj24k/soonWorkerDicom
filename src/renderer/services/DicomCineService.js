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

      // 如果有帧数信息且大于1，则为动态影像
      if (numberOfFrames && parseInt(numberOfFrames) > 1) {
        const result = {
          isCine: true,
          frameCount: parseInt(numberOfFrames),
          frameTime: frameTime,
          heartRate: heartRate,
          type: 'multi-frame'
        };
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
   * 处理系列中的动态影像，将其分解为帧
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

    const processedChildren = [];
    
    for (const child of seriesNode.children) {
      // 跳过已经是帧节点的子节点（避免重复处理）
      if (child.isFrame) {
        processedChildren.push(child);
        continue;
      }

      if (child.isFile && this.dicomService.isDicomFile(child.name || child.path)) {
        const imagePath = child.fullPath || child.path;
        if (imagePath) {
          try {
            // 检查是否为动态影像
            const cineInfo = this.isCineImage(imagePath);
            if (cineInfo && cineInfo.isCine && cineInfo.frameCount > 1) {
              // 分解为帧
              const frameNodes = this.extractFramesFromCineImage(child, cineInfo);
              processedChildren.push(...frameNodes);
              
              // 保存原始动态影像信息到系列节点（用于帧播放模式）
              if (!seriesNode.cineInfo) {
                seriesNode.cineInfo = cineInfo;
                seriesNode.cineImagePath = imagePath;
              }
            } else {
              // 普通图像，直接添加
              processedChildren.push(child);
            }
          } catch (error) {
            // 处理失败时，作为普通图像添加
            processedChildren.push(child);
          }
        } else {
          // 没有路径，作为普通节点添加
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
}

