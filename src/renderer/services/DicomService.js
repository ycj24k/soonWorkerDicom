/**
 * DICOM服务
 * 负责DICOM文件的读取、解析和缩略图生成
 */

const fs = require('fs');
const path = require('path');
const { Notification } = require('element-ui');

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
   * 获取目录树结构
   */
  getDirectoryTree(directory) {
    const tree = {
      name: path.basename(directory),
      path: directory,
      children: []
    };

    try {
      const items = fs.readdirSync(directory, { withFileTypes: true });
      console.log(`读取目录 ${directory}，找到 ${items.length} 个项目`);

      items.forEach((item) => {
        const fullPath = path.join(directory, item.name);
        if (item.isDirectory()) {
          tree.children.push(this.getDirectoryTree(fullPath));
        } else {
          const isDicom = this.isDicomFile(fullPath);
          console.log(`文件 ${item.name} 是否为DICOM: ${isDicom}`);
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
   * 检查文件是否为DICOM文件
   */
  isDicomFile(filename) {
    try {
      const filePath = path.resolve(filename);
      const stats = fs.statSync(filePath);
      
      // 检查文件大小是否合理（DICOM文件通常大于1KB）
      if (stats.size < 1024 || stats.size > 500 * 1024 * 1024) { // 1KB到500MB之间
        console.log(`文件 ${path.basename(filename)} 大小不合理: ${stats.size} bytes`);
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
        console.log(`文件 ${path.basename(filename)} 有DICM标识，是DICOM文件`);
        return true;
      }
      
      // 如果没有DICM标识，尝试用dicom-parser解析
      try {
        const dicomParser = require('dicom-parser');
        const arrayBuffer = fs.readFileSync(filePath).buffer;
        const dataSet = dicomParser.parseDicom(arrayBuffer);
        
        // 如果能成功解析且包含基本DICOM标签，认为是DICOM文件
        if (dataSet && dataSet.elements && Object.keys(dataSet.elements).length > 0) {
          // 检查是否包含基本的DICOM标签
          const hasBasicTags = Object.keys(dataSet.elements).some(tag => {
            return tag.includes('0008') || tag.includes('0010') || tag.includes('0020');
          });
          if (hasBasicTags) {
            console.log(`文件 ${path.basename(filename)} 解析成功，包含${Object.keys(dataSet.elements).length}个标签，是DICOM文件`);
            return true;
          }
        }
      } catch (parseError) {
        console.log(`文件 ${path.basename(filename)} 解析失败: ${parseError.message}`);
        return false;
      }
      
      console.log(`文件 ${path.basename(filename)} 不是DICOM文件`);
      return false;
    } catch (error) {
      console.log(`文件 ${path.basename(filename)} 读取失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 获取树的最大深度 - 完全按照dashboard的实现
   */
  getMaxDepth(node) {
    if (!node.children || node.children.length === 0) {
      return 0;
    }
    return 1 + Math.max(...node.children.map(child => this.getMaxDepth(child)));
  }

  /**
   * 智能分析DICOM目录结构
   */
  analyzeDicomStructure(tree) {
    const maxDepth = this.getMaxDepth(tree);
    console.log('DICOM结构分析开始，最大深度:', maxDepth);

    // 使用与原来dashboard相同的getLastTwoLayers方法
    const lastTwoLayers = this.getLastTwoLayersStandard(tree);
    if (!lastTwoLayers) {
      console.error('DICOM数据格式错误，请检查数据格式！');
      return null;
    }

    const seriesNodes = lastTwoLayers.secondLastLayer; // 系列节点
    const imageNodes = lastTwoLayers.lastLayer; // 图像节点

    console.log('DICOM结构分析结果:', {
      maxDepth,
      seriesCount: seriesNodes.length,
      imageCount: imageNodes.length,
      seriesNodes: seriesNodes.map(node => ({ 
        name: node.name, 
        path: node.path, 
        isFile: node.isFile,
        childrenCount: node.children ? node.children.length : 0,
        children: node.children ? node.children.map(child => ({ name: child.name, isFile: child.isFile })) : []
      }))
    });

    return {
      seriesNodes,
      imageNodes,
      structureType: 'standard', // 标准DICOM结构
      maxDepth
    };
  }

  /**
   * 获取树结构的最后两层数据 - 完全按照dashboard的实现
   */
  getLastTwoLayersStandard(tree) {
    const result = { secondLastLayer: [], lastLayer: [] };
    // 从根节点开始遍历，初始深度为树的高度
    const maxDepth = this.getMaxDepth(tree);
    console.log('DICOM树最大深度:', maxDepth);
    
    if (maxDepth != 4 && maxDepth != 3) {
      console.warn(`DICOM数据格式错误，深度为${maxDepth}，期望3或4层！`);
      return false;
    }
    
    // 递归函数 - 完全按照dashboard的逻辑：深度递减
    function traverse(node, depth) {
      console.log(`遍历节点: ${node.name}, 深度: ${depth}, 是否为文件: ${node.isFile}`);
      
      if (depth === 3) {
        // 当前节点是倒数第3层（图像层）
        console.log(`找到图像节点: ${node.name}`);
        result.lastLayer.push(node);
      } else if (depth === 1) {
        // 当前节点是倒数第1层（系列层）
        console.log(`找到系列节点: ${node.name}`);
        result.secondLastLayer.push(node);
      }

      if (node.children) {
        node.children.forEach(child => {
          traverse(child, depth - 1); // 深度递减！
        });
      }
    }
    
    // 从根节点开始遍历，初始深度为最大深度
    traverse(tree, maxDepth);

    console.log('getLastTwoLayersStandard结果:', {
      maxDepth,
      secondLastLayerCount: result.secondLastLayer.length,
      lastLayerCount: result.lastLayer.length,
      seriesNames: result.secondLastLayer.map(node => node.name),
      imageNames: result.lastLayer.map(node => node.name)
    });

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
    console.log('开始生成缩略图列表，系列数量:', seriesList.length);
    const thumbnails = [];
    const dicomDict = []; // 保持与原来dashboard兼容的数组格式

    for (let i = 0; i < seriesList.length; i++) {
      const series = seriesList[i];
      console.log(`处理系列 ${i}: ${series.name}, 路径: ${series.path}`);
      
      // 参考dashboard的逻辑：每个系列的第一张图像
      if (series.children && series.children.length > 0) {
        // 找到系列中的第一个DICOM文件（不是目录）
        let firstImage = null;
        for (const child of series.children) {
          console.log(`检查子节点: ${child.name}, isFile: ${child.isFile}, 路径: ${child.path}`);
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
          console.warn(`系列 ${series.name} 没有找到DICOM文件，跳过该系列`);
          continue;
        }
        
        // 预检查：验证文件是否存在且可读
        try {
          const fs = require('fs');
          const stats = fs.statSync(firstImage.path);
          if (!stats.isFile() || stats.size === 0) {
            console.warn(`系列 ${series.name} 的图像文件无效（不是文件或大小为0），跳过该系列`);
            continue;
          }
          console.log(`系列 ${series.name} 文件验证通过，大小: ${stats.size} bytes`);
        } catch (error) {
          console.warn(`系列 ${series.name} 文件访问失败: ${error.message}，跳过该系列`);
          continue;
        }
        
        console.log(`系列 ${series.name} 第一张图像: ${firstImage.name}`);
        
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
          
          console.log(`系列 ${series.name} DICOM标签数量: ${seriesDict.length}`);
          
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
            
            console.log(`系列 ${series.name} 处理完成，缩略图已生成`);
          } else {
            console.warn(`系列 ${series.name} 缩略图生成失败，跳过该系列`);
          }
        } catch (error) {
          console.error(`处理系列 ${series.name} 时出错:`, error);
          console.warn(`系列 ${series.name} 处理失败，跳过该系列`);
        }
      } else {
        console.warn(`系列 ${series.name} 没有子图像，跳过该系列`);
      }
    }
    
    console.log('缩略图列表生成完成:', {
      thumbnailsCount: thumbnails.length,
      dicomDictCount: dicomDict.length
    });
    
    return {
      thumbnails,
      dicomDict
    };
  }

  /**
   * 从系列中获取第一张图像
   */
  getFirstImageFromSeries(series) {
    console.log(`查找系列 ${series.name} 的第一张图像，子节点数量: ${series.children ? series.children.length : 0}`);
    
    if (series.children && series.children.length > 0) {
      for (const child of series.children) {
        console.log(`检查子节点: ${child.name}, 是否为文件: ${child.isFile}, 路径: ${child.path}`);
        
        if (child.isFile && this.isDicomFile(child.path)) {
          console.log(`从系列 ${series.name} 中找到第一张DICOM图像: ${child.name}`);
          return child;
        }
        if (child.children) {
          const found = this.getFirstImageFromSeries(child);
          if (found) return found;
        }
      }
    }
    console.log(`系列 ${series.name} 中没有找到DICOM图像`);
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
    console.log(`生成imageId: ${imageId}`);
    return imageId;
  }

  /**
   * 获取系列中所有DICOM图像的imageId列表
   */
  getSeriesImageIds(series) {
    const imageIds = [];
    
    console.log(`开始查找系列 ${series.name} 的图像，子节点数量: ${series.children ? series.children.length : 0}`);
    
    if (!series.children || series.children.length === 0) {
      console.log(`系列 ${series.name} 没有子节点`);
      return imageIds;
    }
    
    // 直接遍历系列的所有子节点，找到DICOM文件
    series.children.forEach((child, index) => {
      console.log(`检查子节点 ${index}: ${child.name}, 是否为文件: ${child.isFile}, 路径: ${child.path}`);
      
      if (child.isFile && this.isDicomFile(child.path)) {
        // 这是DICOM图像文件，直接生成imageId
        const imageId = `wadouri:${child.path}`;
        imageIds.push(imageId);
        console.log(`找到DICOM影像文件: ${child.name} -> ${imageId}`);
      } else if (!child.isFile) {
        // 如果子节点不是文件，说明可能是目录，递归查找
        console.log(`子节点 ${child.name} 是目录，递归查找...`);
        const subImageIds = this.getSeriesImageIds(child);
        imageIds.push(...subImageIds);
      }
    });
    
    console.log(`系列 ${series.name} 找到 ${imageIds.length} 个DICOM影像文件`);
    return imageIds;
  }

  /**
   * 生成缩略图
   */
  async generateThumbnail(imageNode) {
    try {
      const cornerstone = require('cornerstone-core');
      const dicomParser = require('dicom-parser');
      
      console.log(`开始生成缩略图: ${imageNode.name}`);
      
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
      console.log('DICOM文件解析成功，尝试加载图像...');
      
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
      console.log(`缩略图生成成功: ${imageNode.name}`);
      return result;
    } catch (error) {
      console.error(`生成缩略图失败: ${imageNode.name}`, error.message);
      
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
      console.error('解析DICOM元数据失败:', error);
      return [];
    }
  }
}
