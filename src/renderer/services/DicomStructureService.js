/**
 * DICOM目录结构分析服务
 * 负责DICOM目录结构的智能分析和系列分组
 */

const path = require('path');

export class DicomStructureService {
  constructor(dicomService) {
    this.dicomService = dicomService;
  }

  static getInstance(dicomService) {
    if (!DicomStructureService.instance) {
      DicomStructureService.instance = new DicomStructureService(dicomService);
    }
    return DicomStructureService.instance;
  }

  /**
   * 智能分析DICOM目录结构
   * @param {Object} tree - 目录树
   * @returns {Object|null} 分析结果
   */
  analyzeDicomStructure(tree) {
    const maxDepth = this.dicomService.getMaxDepth(tree);

    // 检查是否为多患者目录
    const isMultiPatient = this.isMultiPatientDirectory(tree);
    
    if (isMultiPatient) {
      const result = this.analyzeMultiPatientStructure(tree);
      
      // 确保多患者结构有有效的系列和图像
      if (result && result.seriesNodes && result.seriesNodes.length > 0) {
        return result;
      }
    }

    // 检查是否为单文件结构
    if (maxDepth === 1 && tree.children && tree.children.length === 1 && tree.children[0].isFile) {
      const singleFile = tree.children[0];
      
      // 检查单文件是否为动态影像
      let cineInfo = null;
      let cineImagePath = null;
      try {
        const detectedCine = this.dicomService.cineService.isCineImage(singleFile.path);
        if (detectedCine && detectedCine.isCine && detectedCine.frameCount > 1) {
          cineInfo = detectedCine;
          cineImagePath = singleFile.path;
        }
      } catch (error) {
        // 检测失败，忽略
      }
      
      // 创建单文件结果
      let children = [singleFile];
      let imageNodes = [singleFile];
      
      // 如果是动态影像，分解为帧节点
      if (cineInfo && cineInfo.isCine && cineInfo.frameCount > 1) {
        const frameNodes = this.dicomService.cineService.extractFramesFromCineImage(singleFile, cineInfo);
        children = frameNodes;
        imageNodes = frameNodes;
      }
      
      const seriesNode = {
        name: singleFile.name,
        path: path.dirname(singleFile.path),
        children: children,
        isFile: false,
        imageCount: children.length
      };

      // 如果检测到动态影像，保存信息到系列节点
      if (cineInfo) {
        seriesNode.cineInfo = cineInfo;
        seriesNode.cineImagePath = cineImagePath;
      }

      const result = {
        seriesNodes: [seriesNode],
        imageNodes: imageNodes,
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
    
    // 处理每个系列中的动态影像（确保动态影像信息正确传递）
    const processedSeriesNodes = seriesNodes.map(series => this.dicomService.cineService.processCineImagesInSeries(series));
    
    const imageNodes = lastTwoLayers.lastLayer; // 图像节点

    const result = {
      seriesNodes: processedSeriesNodes,
      imageNodes,
      structureType: 'standard', // 标准DICOM结构
      maxDepth,
      isMultiPatient: false
    };
    return result;
  }

  /**
   * 检查是否为多患者目录
   * @param {Object} tree - 目录树
   * @returns {boolean} 是否为多患者目录
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
      if (!child.isFile && this.dicomService.hasDicomFiles(child)) {
        patientCount++;
        patientDirs.push(child.name);
      }
    });
    
    // 如果只有1个患者目录，也检查是否是特殊的单患者结构
    if (patientCount === 1) {
      const singlePatient = tree.children.find(child => !child.isFile && this.dicomService.hasDicomFiles(child));
      if (singlePatient) {
        // 检查这个患者目录的深度，如果太深可能是单患者结构
        const patientDepth = this.dicomService.getMaxDepth(singlePatient);
        
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
   * @param {Object} tree - 目录树
   * @returns {Object} 多患者分析结果
   */
  analyzeMultiPatientStructure(tree) {
    const patients = [];
    
    tree.children.forEach((patientNode) => {
      if (!patientNode.isFile && this.dicomService.hasDicomFiles(patientNode)) {
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
        }
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
      maxDepth: this.dicomService.getMaxDepth(tree),
      isMultiPatient: true,
      totalPatients: patients.length
    };
  }

  /**
   * 基于DICOM标签智能分组系列 - 真正的DICOM标准实现
   * @param {Array<Object>} imageNodes - 图像节点数组
   * @returns {Array<Object>} 系列节点数组
   */
  groupSeriesByDicomTags(imageNodes) {
    const seriesMap = new Map();
    
    // 优化：先按目录分组，每个目录只解析第一张影像
    const directoryGroups = new Map();
    
    // 第一步：按目录分组影像节点（不解析）
    imageNodes.forEach((imageNode) => {
      if (!imageNode.isFile) return;
      
      const dirPath = path.normalize(path.dirname(imageNode.path));
      if (!directoryGroups.has(dirPath)) {
        directoryGroups.set(dirPath, []);
      }
      directoryGroups.get(dirPath).push(imageNode);
    });
    
    // 第二步：对每个目录，只解析第一张影像来确定系列信息
    directoryGroups.forEach((nodesInDir, dirPath) => {
      if (nodesInDir.length === 0) return;
      
      // 只解析该目录的第一张影像
      const firstNode = nodesInDir[0];
      let seriesInstanceUID = null;
      let seriesInfo = null;
      
      try {
        const dicomData = this.dicomService.parseDicomFile(firstNode.path);
        if (dicomData && dicomData.elements) {
          seriesInstanceUID = this.dicomService.getTagValue(dicomData, 'x0020000E') || this.dicomService.getTagValue(dicomData, '0020000E');
          
          if (seriesInstanceUID) {
            // 获取系列信息（只解析一次）
            const studyInstanceUID = this.dicomService.getTagValue(dicomData, 'x0020000D') || this.dicomService.getTagValue(dicomData, '0020000D');
            const patientID = this.dicomService.getTagValue(dicomData, 'x00100020') || this.dicomService.getTagValue(dicomData, '00100020');
            const patientName = this.dicomService.getTagValue(dicomData, 'x00100010') || this.dicomService.getTagValue(dicomData, '00100010');
            const modality = this.dicomService.getTagValue(dicomData, 'x00080060') || this.dicomService.getTagValue(dicomData, '00080060') || 'Unknown';
            const seriesDescription = this.dicomService.getTagValue(dicomData, 'x0008103E') || this.dicomService.getTagValue(dicomData, '0008103E') || 'Unknown';
            const seriesNumber = this.dicomService.getTagValue(dicomData, 'x00200011') || this.dicomService.getTagValue(dicomData, '00200011') || 'Unknown';
            const studyDate = this.dicomService.getTagValue(dicomData, 'x00080020') || this.dicomService.getTagValue(dicomData, '00080020') || 'Unknown';
            
            seriesInfo = {
              name: `${seriesNumber}: ${seriesDescription}`,
              path: dirPath,
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
            };
            
            // 如果该系列已存在（不同目录可能有相同Series Instance UID），合并节点
            if (seriesMap.has(seriesInstanceUID)) {
              const existingSeries = seriesMap.get(seriesInstanceUID);
              // 优化：初始阶段只保留第一张影像，其他影像在后台加载时再添加
              // 但需要记录总数，以便进度条显示
              if (existingSeries.children.length === 0 || existingSeries.children.length === 1) {
                // 如果现有系列只有第一张或为空，添加第一张
                if (existingSeries.children.length === 0) {
                  existingSeries.children.push(firstNode);
                }
                // 更新总数（但不添加所有节点到children）
                existingSeries._totalImageCount = (existingSeries._totalImageCount || 0) + nodesInDir.length;
                existingSeries.imageCount = existingSeries._totalImageCount;
              } else {
                // 如果已有多个节点，说明是后台加载阶段，可以添加所有节点
                existingSeries.children.push(...nodesInDir);
                existingSeries.imageCount += nodesInDir.length;
              }
            } else {
              // 创建新系列，初始阶段只添加第一张影像
              seriesInfo.children = [firstNode]; // 只保留第一张影像
              seriesInfo._totalImageCount = nodesInDir.length; // 记录总数
              seriesInfo.imageCount = nodesInDir.length; // 用于显示总数
              seriesInfo._allImageNodes = nodesInDir; // 保存所有节点引用，供后台加载使用
              seriesMap.set(seriesInstanceUID, seriesInfo);
            }
          } else {
            // 无法获取Series Instance UID，创建默认系列
            const defaultSeriesUID = `default_${dirPath}`;
            if (!seriesMap.has(defaultSeriesUID)) {
              seriesMap.set(defaultSeriesUID, {
                name: `默认系列 (${path.basename(dirPath)})`,
                path: dirPath,
                children: [firstNode], // 初始只保留第一张影像
                isFile: false,
                seriesInstanceUID: null,
                studyInstanceUID: null,
                patientID: null,
                patientName: null,
                modality: 'Unknown',
                seriesDescription: '默认系列',
                seriesNumber: '0',
                studyDate: '',
                _totalImageCount: nodesInDir.length,
                imageCount: nodesInDir.length, // 用于显示总数
                _allImageNodes: nodesInDir // 保存所有节点引用
              });
            }
          }
        }
      } catch (error) {
        // 解析失败，创建默认系列
        const defaultSeriesUID = `default_${dirPath}`;
        if (!seriesMap.has(defaultSeriesUID)) {
          seriesMap.set(defaultSeriesUID, {
            name: `默认系列 (${path.basename(dirPath)})`,
            path: dirPath,
            children: [firstNode], // 初始只保留第一张影像
            isFile: false,
            seriesInstanceUID: null,
            studyInstanceUID: null,
            patientID: null,
            patientName: null,
            modality: 'Unknown',
            seriesDescription: '默认系列',
            seriesNumber: '0',
            studyDate: '',
            _totalImageCount: nodesInDir.length,
            imageCount: nodesInDir.length, // 用于显示总数
            _allImageNodes: nodesInDir // 保存所有节点引用
          });
        }
      }
    });
    
    const result = Array.from(seriesMap.values()).sort((a, b) => {
      // 按系列编号排序
      const aNum = parseInt(a.seriesNumber) || 999;
      const bNum = parseInt(b.seriesNumber) || 999;
      return aNum - bNum;
    });
    
    // 处理每个系列中的动态影像，将其分解为帧
    const processedResult = result.map(series => this.dicomService.cineService.processCineImagesInSeries(series));
    
    return processedResult;
  }

  /**
   * 获取树结构的最后两层数据 - 智能兼容多种结构
   * @param {Object} tree - 目录树
   * @returns {Object|false} 最后两层数据或false
   */
  getLastTwoLayersStandard(tree) {
    const result = { secondLastLayer: [], lastLayer: [] };
    // 从根节点开始遍历，初始深度为树的高度
    const maxDepth = this.dicomService.getMaxDepth(tree);
    
    if (maxDepth < 1 || maxDepth > 6) {
      // DICOM数据格式错误，深度超出范围
      return false;
    }
    
    // 智能递归函数 - 自适应多种结构
    const self = this;
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
   * @param {Object} tree - 目录树
   * @returns {Object|false} 最后两层数据或false
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
}

