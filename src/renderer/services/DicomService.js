/**
 * DICOM服务
 * 负责DICOM文件的读取、解析和缩略图生成
 */

const fs = require('fs');
const path = require('path');
const { Notification } = require('element-ui');
const dicomParser = require('dicom-parser');
import PathUtils from '../utils/PathUtils';

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
   * 获取树的最大深度 - 完全按照dashboard的实现
   */
  getMaxDepth(node) {
    if (!node.children || node.children.length === 0) {
      return 0; // 叶子节点深度为0，完全按照dashboard
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

    return {
      seriesNodes,
      imageNodes,
      structureType: 'standard', // 标准DICOM结构
      maxDepth,
      isMultiPatient: false
    };
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
    tree.children.forEach(child => {
      if (!child.isFile && this.hasDicomFiles(child)) {
        patientCount++;
      }
    });
    
    return patientCount > 1;
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
    
    return result;
  }

  /**
   * 解析DICOM文件获取标签
   */
  parseDicomFile(filePath) {
    try {
      const fileBuffer = fs.readFileSync(filePath);
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
        'x0020000d'  // Study Instance UID
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
        '0020000D'  // Study Instance UID
      ];
      
      // 移除详细调试日志以提升性能
      
      // 尝试提取标签，支持带x前缀和不带x前缀的格式
      const allTags = [...tags, ...tagsWithoutX];
      const extractedTags = new Set(); // 避免重复提取
      
      allTags.forEach(tag => {
        const normalizedTag = tag.replace(/^x/, '').toUpperCase(); // 标准化标签格式（去掉x前缀，转大写）
        if (extractedTags.has(normalizedTag)) return; // 避免重复
        
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
      });
      
      return elements;
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取树结构的最后两层数据 - 完全按照dashboard的实现
   */
  getLastTwoLayersStandard(tree) {
    const result = { secondLastLayer: [], lastLayer: [] };
    // 从根节点开始遍历，初始深度为树的高度
    const maxDepth = this.getMaxDepth(tree);
    
    
    if (maxDepth < 2 || maxDepth > 4) {
      console.warn(`DICOM数据格式错误，深度为${maxDepth}，期望2-4层！`);
      return false;
    }
    
    // 递归函数 - 完全按照dashboard的逻辑
    function traverse(node, depth) {
      
      // 根据最大深度和当前深度判断节点类型
      if (maxDepth === 2) {
        // 2层结构：PAT-IMG（单文件系列）
        if (depth === 0 && node.isFile) {
          // 最底层：图像文件，同时也是系列
          result.lastLayer.push(node);
          result.secondLastLayer.push(node);
        }
      } else if (maxDepth === 3) {
        // 3层结构：PAT-STUDY-IMG (单系列)
        if (depth === 0 && node.isFile) {
          // 最底层：图像文件
          result.lastLayer.push(node);
        } else if (depth === 2) {
          // 研究层：直接包含图像，也是系列层
          result.secondLastLayer.push(node);
        }
      } else if (maxDepth === 4) {
        // 4层结构：PAT-STD-SER-IMG
        if (depth === 0 && node.isFile) {
          // 最底层：图像文件
          result.lastLayer.push(node);
        } else if (depth === 2) {
          // 系列层：包含图像的目录
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
