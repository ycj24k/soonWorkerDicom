/**
 * DICOM状态管理模块
 */

import { dicomService, errorHandler } from '../../services/index.js';

const state = {
  // 当前目录
  currentDirectory: '',
  // 目录树
  directoryTree: [],
  // DICOM序列
  dicomSeries: [],
  // 缩略图列表
  thumbnails: [],
  // 当前选中的序列索引
  activeSeriesIndex: 0,
  // 当前图像索引
  activeImageIndex: 0,
  // 当前图像的imageId列表
  currentImageIds: [],
  // DICOM字典数据
  dicomDict: [],
  // 加载状态
  loading: false,
  // 加载文本
  loadingText: '正在加载DICOM文件...',
  // 错误信息
  error: null,
  // 是否为动态影像系列
  isDynamicSeries: false,
  // 动态影像详细信息
  cineInfo: null,
  // 当前动态影像文件路径
  currentCineImagePath: null,
  // 系列后台加载进度（用于底部进度条和系列数量展示）
  seriesProgress: {
    isActive: false,
    currentSeriesIndex: -1,
    currentLoaded: 0,
    currentTotal: 0
  }
};

const mutations = {
  SET_LOADING(state, loading) {
    state.loading = loading;
  },

  SET_LOADING_TEXT(state, text) {
    state.loadingText = text;
  },

  SET_ERROR(state, error) {
    state.error = error;
  },

  SET_IS_DYNAMIC_SERIES(state, isDynamic) {
    state.isDynamicSeries = isDynamic;
  },

  SET_CINE_INFO(state, cineInfo) {
    state.cineInfo = cineInfo;
  },

  SET_CURRENT_CINE_IMAGE_PATH(state, path) {
    state.currentCineImagePath = path;
  },

  SET_SERIES_PROGRESS_STATE(state, payload) {
    state.seriesProgress.isActive = payload.isActive;
    state.seriesProgress.currentSeriesIndex = payload.currentSeriesIndex;
    state.seriesProgress.currentLoaded = payload.currentLoaded;
    state.seriesProgress.currentTotal = payload.currentTotal;
  },

  SET_SERIES_PROGRESS_LOADED(state, loaded) {
    state.seriesProgress.currentLoaded = loaded;
  },

  RESET_SERIES_PROGRESS(state) {
    state.seriesProgress.isActive = false;
    state.seriesProgress.currentSeriesIndex = -1;
    state.seriesProgress.currentLoaded = 0;
    state.seriesProgress.currentTotal = 0;
  },

  SET_CURRENT_DIRECTORY(state, directory) {
    state.currentDirectory = directory;
  },

  SET_DIRECTORY_TREE(state, tree) {
    state.directoryTree = tree;
  },

  SET_DICOM_SERIES(state, series) {
    state.dicomSeries = series;
  },

  ADD_IMAGE_TO_SERIES(state, { seriesIndex, imageNode }) {
    if (state.dicomSeries[seriesIndex] && Array.isArray(state.dicomSeries[seriesIndex].children)) {
      state.dicomSeries[seriesIndex].children.push(imageNode);
    }
  },

  ADD_IMAGES_TO_SERIES_BATCH(state, { seriesIndex, imageNodes }) {
    if (state.dicomSeries[seriesIndex] && Array.isArray(state.dicomSeries[seriesIndex].children) && Array.isArray(imageNodes)) {
      state.dicomSeries[seriesIndex].children.push(...imageNodes);
    }
  },

  SET_THUMBNAILS(state, thumbnails) {
    state.thumbnails = thumbnails;
  },

  SET_DICOM_DICT(state, dict) {
    state.dicomDict = dict;
  },

  SET_ACTIVE_SERIES(state, index) {
    state.activeSeriesIndex = index;
    state.activeImageIndex = 0;
  },

  SET_ACTIVE_IMAGE(state, index) {
    state.activeImageIndex = index !== undefined && index !== null ? index : 0;
  },

  SET_CURRENT_IMAGE_IDS(state, imageIds) {
    state.currentImageIds = imageIds;
  },

  RESET_STATE(state) {
    state.currentDirectory = '';
    state.directoryTree = [];
    state.dicomSeries = [];
    state.thumbnails = [];
    state.activeSeriesIndex = 0;
    state.activeImageIndex = 0;
    state.currentImageIds = [];
    state.dicomDict = [];
    // 不重置loading状态，因为可能正在加载中
    // state.loading = false;
    // state.loadingText = '正在加载DICOM文件...';
    state.error = null;
    state.isDynamicSeries = false;
    state.cineInfo = null;
    state.currentCineImagePath = null;
    state.seriesProgress = {
      isActive: false,
      currentSeriesIndex: -1,
      currentLoaded: 0,
      currentTotal: 0
    };
  }
};

const actions = {
  /**
   * 加载DICOM目录
   */
  async loadDicomDirectory({ commit }, directory) {
    // 不再自动设置loading状态，由组件控制
    commit('SET_ERROR', null);
    
    try {
      // 重置状态
      commit('RESET_STATE');
      commit('SET_CURRENT_DIRECTORY', directory);

      // 获取目录树
      const directoryTree = dicomService.getDirectoryTree(directory);
      // 智能分析DICOM结构
      const structureAnalysis = dicomService.analyzeDicomStructure(directoryTree);
      
      if (!structureAnalysis) {
        console.error('DICOM目录结构分析失败');
        throw new Error('DICOM目录结构分析失败');
      }
      
      if (structureAnalysis.seriesNodes.length === 0 && structureAnalysis.imageNodes.length === 0) {
        console.error('未找到任何有效的DICOM文件');
        throw new Error('未找到任何有效的DICOM文件');
      }

      // 检测是否为动态影像
      const dynamicResult = dicomService.isDynamicImageSeries(structureAnalysis.seriesNodes);
      
      if (dynamicResult && dynamicResult.isDynamic) {
        commit('SET_IS_DYNAMIC_SERIES', true);
        commit('SET_CINE_INFO', dynamicResult.cineInfo);
        commit('SET_CURRENT_CINE_IMAGE_PATH', dynamicResult.imagePath);
      } else {
        commit('SET_IS_DYNAMIC_SERIES', false);
        commit('SET_CINE_INFO', null);
        commit('SET_CURRENT_CINE_IMAGE_PATH', null);
      }
      
      // 如果有图像但没有序列，创建默认序列
      if (structureAnalysis.seriesNodes.length === 0 && structureAnalysis.imageNodes.length > 0) {
        structureAnalysis.seriesNodes = [{
          name: '默认序列',
          path: directory,
          children: structureAnalysis.imageNodes,
          isFile: false
        }];
      }

      // 生成缩略图并过滤无效系列（快速模式 - 只解析关键标签）
      const { thumbnails, dicomDict, filteredSeries } = await dicomService.generateThumbnailList(structureAnalysis.seriesNodes, false);
      
      // 使用过滤后的系列列表（只包含有效影像的系列）
      commit('SET_DICOM_SERIES', filteredSeries || []);
      commit('SET_THUMBNAILS', thumbnails);
      commit('SET_DICOM_DICT', dicomDict);

      // 构建目录树（基于当前目录结构和最新的DICOM字典）
      const treeData = await dicomService.buildTree([directoryTree]);
      commit('SET_DIRECTORY_TREE', treeData);
      errorHandler.handleSuccess(`DICOM目录加载完成: ${directory}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载DICOM目录失败';
      commit('SET_ERROR', errorMessage);
      // 不调用errorHandler.handleError，避免误报DICOM解析错误
    } finally {
      commit('SET_LOADING', false);
    }
  },

  /**
   * 按系列顺序后台加载完整DICOM标签和影像数据
   */
  async startBackgroundSeriesLoading({ state, commit }) {
    const seriesList = state.dicomSeries || [];
    if (!Array.isArray(seriesList) || seriesList.length === 0) {
      commit('RESET_SERIES_PROGRESS');
      return;
    }

    // 串行遍历每个系列，按图像数量更新进度
    for (let i = 0; i < seriesList.length; i++) {
      const series = seriesList[i];
      const children = series && Array.isArray(series.children) ? series.children : [];
      
      // 检查是否为动态影像系列
      const isDynamicSeries = series.cineInfo && series.cineInfo.isCine && series.cineInfo.frameCount > 1;
      
      // 获取该系列的总影像数
      // 对于动态影像：使用children.length（帧数），因为动态影像已经分解为帧
      // 对于普通影像：优先使用_totalImageCount（文件数），如果没有则使用children.length
      let total;
      if (isDynamicSeries) {
        // 动态影像：总数应该是所有帧的总数
        // 如果_allImageNodes存在，需要计算所有文件的帧数总和
        if (series._allImageNodes && Array.isArray(series._allImageNodes)) {
          // 计算所有动态影像文件的帧数总和，同时缓存cineInfo到节点上，避免重复读取文件
          let totalFrames = 0;
          for (const node of series._allImageNodes) {
            if (node.isFile && !node.isFrame) {
              // 如果节点上已有缓存的cineInfo，直接使用（避免重复读取文件）
              if (node._cachedCineInfo !== undefined) {
                const cineInfo = node._cachedCineInfo;
                if (cineInfo && cineInfo.isCine && cineInfo.frameCount > 1) {
                  totalFrames += cineInfo.frameCount;
                } else {
                  totalFrames += 1; // 普通文件算1个
                }
              } else {
                // 首次检查，读取文件并缓存结果
                try {
                  const cineInfo = dicomService.cineService.isCineImage(node.path || node.fullPath);
                  // 缓存到节点上，后续处理时直接使用
                  node._cachedCineInfo = cineInfo;
                  if (cineInfo && cineInfo.isCine && cineInfo.frameCount > 1) {
                    totalFrames += cineInfo.frameCount;
                  } else {
                    totalFrames += 1; // 普通文件算1个
                  }
                } catch (error) {
                  node._cachedCineInfo = { isCine: false }; // 缓存失败结果
                  totalFrames += 1; // 解析失败，按普通文件处理
                }
              }
            }
          }
          total = totalFrames;
        } else {
          // 如果没有_allImageNodes，使用children.length（已经分解为帧）
          total = children.length;
        }
      } else {
        // 普通影像：使用_totalImageCount或children.length
        total = series._totalImageCount || children.length;
      }

      if (total === 0) {
        continue;
      }

      // 检查该系列是否已经完整解析过标签（避免重复解析）
      const currentDict = state.dicomDict[i];
      const isFullyParsed = currentDict && currentDict._fullyParsed === true;

      // 切换到新系列时，直接重置为0，立即更新UI，无延迟
      commit('SET_SERIES_PROGRESS_STATE', {
        isActive: true,
        currentSeriesIndex: i,
        currentLoaded: 0, // 从0开始，重新全部加载
        currentTotal: total
      });

      // 第二步：动态加载阶段 - 只添加影像节点，不解析完整标签（加快速度）
      // 完整标签解析将在第三步后台静默加载中完成

      // 如果系列有保存的所有影像节点（_allImageNodes），异步批量添加节点并更新进度
      if (series._allImageNodes && Array.isArray(series._allImageNodes)) {
        const allNodes = series._allImageNodes;
        
        // 使用 requestAnimationFrame 和 setTimeout 让出事件循环
        const scheduleNext = () => new Promise((resolve) => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 0);
          });
        });
        
        // 对于动态影像，需要将文件节点分解为帧节点（异步批量处理，避免阻塞）
        let targetCount;
        let nodesToProcess = [];
        
        if (isDynamicSeries) {
          // 动态影像：异步批量将文件节点分解为帧节点，避免一次性处理所有文件导致阻塞
          const fileNodesToProcess = allNodes.filter(node => 
            (node.isFile && !node.isFrame) || node.isFrame
          );
          
          // 对于超大数据集（超过10万帧），采用更激进的批量处理策略
          // 批量处理文件节点，每批处理1个文件，避免阻塞
          const fileBatchSize = 1; // 每次只处理1个文件，确保UI响应
          
          // 对于超大数据集，在创建帧节点时也要让出事件循环
          const isLargeDataset = total > 100000;
          const frameBatchSize = isLargeDataset ? 1000 : 10000; // 每创建1000个帧节点让出一次
          
          for (let fileIdx = 0; fileIdx < fileNodesToProcess.length; fileIdx++) {
            const node = fileNodesToProcess[fileIdx];
            
            if (node.isFrame) {
              // 已经是帧节点，直接添加
              nodesToProcess.push(node);
            } else if (node.isFile && !node.isFrame) {
              try {
                // 优先使用缓存的cineInfo，避免重复读取文件
                let cineInfo = node._cachedCineInfo;
                if (!cineInfo) {
                  // 如果没有缓存，才读取文件（这种情况应该很少，因为计算总数时已经缓存了）
                  cineInfo = dicomService.cineService.isCineImage(node.path || node.fullPath);
                  node._cachedCineInfo = cineInfo; // 缓存结果
                }
                
                if (cineInfo && cineInfo.isCine && cineInfo.frameCount > 1) {
                  // 分解为帧节点
                  const frameNodes = dicomService.cineService.extractFramesFromCineImage(node, cineInfo);
                  
                  // 对于超大数据集，分批添加帧节点，避免一次性创建太多对象导致阻塞
                  if (isLargeDataset && frameNodes.length > frameBatchSize) {
                    // 分批添加帧节点
                    for (let frameIdx = 0; frameIdx < frameNodes.length; frameIdx += frameBatchSize) {
                      const frameBatch = frameNodes.slice(frameIdx, frameIdx + frameBatchSize);
                      nodesToProcess.push(...frameBatch);
                      
                      // 每批帧节点添加后让出事件循环
                      if (frameIdx + frameBatchSize < frameNodes.length) {
                        // eslint-disable-next-line no-await-in-loop
                        await scheduleNext();
                      }
                    }
                  } else {
                    // 小数据集，直接添加所有帧节点
                    nodesToProcess.push(...frameNodes);
                  }
                } else {
                  // 普通文件，直接添加
                  nodesToProcess.push(node);
                }
              } catch (error) {
                // 解析失败，按普通文件处理
                nodesToProcess.push(node);
              }
            }
            
            // 每处理一个文件后让出事件循环，避免阻塞UI
            if ((fileIdx + 1) % fileBatchSize === 0 || fileIdx === fileNodesToProcess.length - 1) {
              // eslint-disable-next-line no-await-in-loop
              await scheduleNext();
            }
          }
          
          targetCount = nodesToProcess.length;
        } else {
          // 普通影像：直接使用文件节点
          nodesToProcess = allNodes;
          targetCount = allNodes.length;
        }
        
        const currentCount = children.length; // 当前已加载的数量（通常是1，动态影像可能是帧数）
        const remainingCount = targetCount - currentCount;
        
        // 优化批量大小：减少单次操作时间，避免长时间阻塞
        // 对于超大数据集（超过10万），使用更大的批量大小，减少 commit 次数
        let addBatchSize;
        if (remainingCount > 100000) {
          // 超大数据集：每批1000-5000个，减少 commit 次数
          addBatchSize = Math.max(1000, Math.floor(remainingCount / 200));
        } else if (remainingCount > 10000) {
          // 大数据集：每批100-500个
          addBatchSize = Math.max(100, Math.floor(remainingCount / 100));
        } else if (remainingCount < 50) {
          // 小系列：每批5-10个
          addBatchSize = Math.max(5, Math.floor(remainingCount / 10));
        } else {
          // 中等系列：每批20-30个
          addBatchSize = Math.max(20, Math.floor(remainingCount / 30));
        }
        
        // 异步批量添加节点并更新进度
        for (let batchStart = currentCount; batchStart < nodesToProcess.length; batchStart += addBatchSize) {
          const batchEnd = Math.min(batchStart + addBatchSize, nodesToProcess.length);
          
          // 批量添加节点（减少 commit 次数，提高性能）
          const nodesToAdd = [];
          for (let j = batchStart; j < batchEnd; j++) {
            nodesToAdd.push(nodesToProcess[j]);
          }
          
          // 一次性批量添加整批节点，减少 commit 次数，提高性能
          commit('ADD_IMAGES_TO_SERIES_BATCH', {
            seriesIndex: i,
            imageNodes: nodesToAdd
          });
          
          // 更新进度（基于已添加的节点数）
          const currentProgress = batchEnd;
          commit('SET_SERIES_PROGRESS_LOADED', currentProgress);
          
          // 使用 requestAnimationFrame 让出事件循环，性能更好
          // eslint-disable-next-line no-await-in-loop
          await scheduleNext();
        }
        
        // 确保最终进度是100%
        commit('SET_SERIES_PROGRESS_LOADED', targetCount);
      } else {
        // 如果没有_allImageNodes，说明已经是完整加载的系列，快速更新进度
        // 从0开始批量更新到total
        const batchSize = total < 50 
          ? Math.max(5, Math.floor(total / 10))
          : Math.max(20, Math.floor(total / 30));
        
        // 使用 requestAnimationFrame 替代 setTimeout
        const scheduleNext = () => new Promise((resolve) => requestAnimationFrame(resolve));
        
        for (let progress = 0; progress <= total; progress += batchSize) {
          const currentProgress = Math.min(progress, total);
          commit('SET_SERIES_PROGRESS_LOADED', currentProgress);
          
          // 使用 requestAnimationFrame 让出事件循环
          // eslint-disable-next-line no-await-in-loop
          await scheduleNext();
        }
        
        // 确保最终进度是100%
        commit('SET_SERIES_PROGRESS_LOADED', total);
      }
    }

    // 所有系列完成后隐藏进度条
    commit('RESET_SERIES_PROGRESS');
    
    // 第三步：后台静默加载完整标签（不显示进度，不影响用户体验）
    // 使用 requestAnimationFrame 异步执行，不阻塞UI，性能更好
    requestAnimationFrame(async () => {
      const finalSeriesList = state.dicomSeries || [];
      for (let i = 0; i < finalSeriesList.length; i++) {
        const series = finalSeriesList[i];
        const children = series && Array.isArray(series.children) ? series.children : [];
        
        if (children.length === 0) continue;
        
        // 检查是否已经完整解析
        const currentDict = state.dicomDict[i];
        const isFullyParsed = currentDict && currentDict._fullyParsed === true;
        
        if (!isFullyParsed) {
          try {
            // 找到该系列的第一张有效图像
            const firstImage = children.find(child => 
              child.isFile && child.path && dicomService.isDicomFile(child.path)
            );

            if (firstImage) {
              // 解析完整的DICOM标签
              const fs = require('fs');
              const dicomParser = require('dicom-parser');
              const arrayBuffer = fs.readFileSync(firstImage.path).buffer;
              const byteArray = new Uint8Array(arrayBuffer);
              const dataSet = dicomParser.parseDicom(byteArray);
              
              // 使用DicomThumbnailService的完整解析方法
              const fullDict = dicomService.thumbnailService.parseAllDicomTags(dataSet);
              fullDict._fullyParsed = true; // 标记为已完整解析
              
              // 更新dicomDict
              const newDicomDict = [...state.dicomDict];
              newDicomDict[i] = fullDict;
              commit('SET_DICOM_DICT', newDicomDict);
              
              // 每解析一个系列后让出事件循环，避免阻塞（使用 requestAnimationFrame 性能更好）
              await new Promise((resolve) => requestAnimationFrame(resolve));
            }
          } catch (error) {
            // 解析失败时记录但继续
            if (process.env.NODE_ENV === 'development') {
              console.warn(`系列 ${i} 完整标签解析失败:`, error);
            }
          }
        }
      }
    }, 0);
  },

  /**
   * 加载单个DICOM文件
   */
  async loadDicomFile({ commit }, filePath) {
    // 不再自动设置loading状态，由组件控制
    commit('SET_ERROR', null);
    
    try {
      // 重置状态
      commit('RESET_STATE');
      commit('SET_CURRENT_DIRECTORY', filePath);

      // 创建单文件树结构 - 标准化路径
      const path = require('path');
      const normalizedFilePath = path.normalize(filePath);
      const fileName = path.basename(normalizedFilePath);
      
      const directoryTree = {
        name: fileName,
        path: normalizedFilePath,
        children: [{
          name: fileName,
          path: normalizedFilePath,
          isFile: true,
          children: []
        }]
      };

      // 智能分析DICOM结构
      const structureAnalysis = dicomService.analyzeDicomStructure(directoryTree);
      if (!structureAnalysis) {
        throw new Error('DICOM文件格式无效');
      }

      // 检测是否为动态影像
      const dynamicResult = dicomService.isDynamicImageSeries(structureAnalysis.seriesNodes);
      
      if (dynamicResult && dynamicResult.isDynamic) {
        commit('SET_IS_DYNAMIC_SERIES', true);
        commit('SET_CINE_INFO', dynamicResult.cineInfo);
        commit('SET_CURRENT_CINE_IMAGE_PATH', dynamicResult.imagePath);
      } else {
        commit('SET_IS_DYNAMIC_SERIES', false);
        commit('SET_CINE_INFO', null);
        commit('SET_CURRENT_CINE_IMAGE_PATH', null);
      }

      // 创建单序列结构
      const singleSeries = {
        name: fileName,
        path: normalizedFilePath,
        children: [{
          name: fileName,
          path: normalizedFilePath,
          isFile: true,
          children: []
        }]
      };

      // 生成缩略图并过滤无效系列（快速模式 - 只解析关键标签）
      const { thumbnails, dicomDict, filteredSeries } = await dicomService.generateThumbnailList([singleSeries], false);
      
      // 使用过滤后的系列列表
      commit('SET_DICOM_SERIES', filteredSeries || []);
      commit('SET_THUMBNAILS', thumbnails);
      commit('SET_DICOM_DICT', dicomDict);

      // 构建目录树
      const treeData = await dicomService.buildTree([directoryTree]);
      commit('SET_DIRECTORY_TREE', treeData);


      errorHandler.handleSuccess(`DICOM文件加载完成: ${fileName}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载DICOM文件失败';
      commit('SET_ERROR', errorMessage);
      // 不调用errorHandler.handleError，避免误报DICOM解析错误
    } finally {
      commit('SET_LOADING', false);
    }
  },

  /**
   * 选择DICOM序列
   */
  selectDicomSeries({ commit, state }, index) {
    commit('SET_ACTIVE_SERIES', index);
    
    // 获取选中系列的imageId列表
    const dicomDict = state.dicomDict;
    if (dicomDict && dicomDict[index] && dicomDict[index].imageIds) {
      const imageIds = dicomDict[index].imageIds;
      commit('SET_CURRENT_IMAGE_IDS', imageIds);
    } else {
    }
  },

  /**
   * 选择图像
   */
  selectImage({ commit }, index) {
    commit('SET_ACTIVE_IMAGE', index);
  },

  /**
   * 下一张图像
   */
  nextImage({ commit, state }) {
    const currentSeries = state.dicomSeries[state.activeSeriesIndex];
    if (currentSeries && currentSeries.children) {
      const maxIndex = currentSeries.children.length - 1;
      if (state.activeImageIndex < maxIndex) {
        commit('SET_ACTIVE_IMAGE', state.activeImageIndex + 1);
      }
    }
  },

  /**
   * 上一张图像
   */
  previousImage({ commit, state }) {
    if (state.activeImageIndex > 0) {
      commit('SET_ACTIVE_IMAGE', state.activeImageIndex - 1);
    }
  }
};

const getters = {
  currentSeries: (state) => {
    return state.dicomSeries[state.activeSeriesIndex] || null;
  },

  currentImage: (state) => {
    const currentSeries = state.dicomSeries[state.activeSeriesIndex];
    if (currentSeries && currentSeries.children) {
      return currentSeries.children[state.activeImageIndex] || null;
    }
    return null;
  },

  currentImageIds: (state) => {
    const currentSeries = state.dicomSeries[state.activeSeriesIndex];
    if (currentSeries && currentSeries.children) {
      
      // 递归查找系列中的所有DICOM文件
      const imageIds = [];
      const findDicomFiles = (node) => {
        
        if (node.isFile && node.path) {
          // 检查是否为DICOM文件（包括无扩展名的情况）
          const isDicomFile = node.path.toLowerCase().endsWith('.dcm') || 
                             node.path.toLowerCase().endsWith('.dicom') ||
                             node.path.toLowerCase().endsWith('.dic') ||
                             node.path.toLowerCase().endsWith('.ima') ||
                             // 对于没有扩展名的文件，检查是否在DICOM目录结构中
                             (node.name.match(/^IMG\d+$/) && node.path.includes('SER'));
          
          if (isDicomFile) {
            const imageId = `wadouri:${node.path}`;
            imageIds.push(imageId);
          }
        } else if (node.children) {
          node.children.forEach(child => findDicomFiles(child));
        }
      };
      
      findDicomFiles(currentSeries);
      
      return imageIds;
    }
    return [];
  },

  currentDicomDict: (state) => {
    // 兼容原来的dashboard格式：dicomDict是数组，每个元素是DICOM标签数组
    const seriesDict = state.dicomDict[state.activeSeriesIndex];
    return Array.isArray(seriesDict) ? seriesDict : [];
  },

  getDicomValue: (state) => (tag) => {
    // 兼容原来的dashboard格式：dicomDict是数组，每个元素是DICOM标签数组
    const seriesDict = state.dicomDict[state.activeSeriesIndex];
    if (Array.isArray(seriesDict)) {
      const element = seriesDict.find(item => item.tag === tag);
      return element ? element.value : '';
    }
    return '';
  },
  
  // 获取当前图像索引（用于响应式更新）
  activeImageIndex: (state) => {
    return state.activeImageIndex || 0;
  }
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
};
