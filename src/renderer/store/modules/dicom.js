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
  },
  // 按需加载的完整 DICOM 标签字典（每个元素对应一个系列）
  fullDicomDict: []
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

  CLEAR_SERIES(state) {
    state.dicomSeries = [];
    state.thumbnails = [];
    state.activeSeriesIndex = 0;
    state.activeImageIndex = 0;
    state.currentImageIds = [];
  },

  ADD_SERIES(state, { thumbnails, dicomDict, filteredSeries }) {
    // 添加系列到现有列表中（避免重复）
    if (Array.isArray(filteredSeries) && filteredSeries.length > 0) {
      // 检查每个系列是否已存在（基于 seriesUID）
      const existingSeriesUIDs = new Set(
        state.dicomSeries.map(s => {
          // 尝试从 children 的第一个文件中获取 seriesUID
          if (s.children && s.children.length > 0) {
            const firstChild = s.children[0];
            return firstChild.seriesUID || firstChild.path;
          }
          return s.path || s.name;
        })
      );

      filteredSeries.forEach((series, index) => {
        // 尝试获取 seriesUID
        let seriesUID = series.path || series.name;
        if (series.children && series.children.length > 0) {
          const firstChild = series.children[0];
          seriesUID = firstChild.seriesUID || firstChild.path || seriesUID;
        }

        // 如果不存在，添加到列表
        if (!existingSeriesUIDs.has(seriesUID)) {
          state.dicomSeries.push(series);
          if (thumbnails && thumbnails[index]) {
            state.thumbnails.push(thumbnails[index]);
          }
          if (dicomDict && dicomDict[index]) {
            state.dicomDict.push(dicomDict[index]);
          }
        }
      });
    }
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
    state.fullDicomDict = [];
  },

  SET_FULL_DICOM_DICT(state, dict) {
    state.fullDicomDict = dict;
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
        throw new Error('DICOM目录结构分析失败');
      }
      
      if (structureAnalysis.seriesNodes.length === 0 && structureAnalysis.imageNodes.length === 0) {
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
   * @param {Object} context - Vuex context
   * @param {Object} options - 选项
   * @param {boolean} options.silent - 是否静默模式（不显示进度条）
   */
  async startBackgroundSeriesLoading({ state, commit }, options = {}) {
    const { silent = false } = options;
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
          // 优化：使用缓存的总数，避免重复计算
          if (series._cachedTotalFrames !== undefined) {
            total = series._cachedTotalFrames;
          } else {
            // 计算所有动态影像文件的帧数总和，同时缓存cineInfo到节点上
            // 使用 requestAnimationFrame 分批处理，避免阻塞
            const scheduleNext = () => new Promise((resolve) => requestAnimationFrame(resolve));
            let totalFrames = 0;
            const fileNodes = series._allImageNodes.filter(node => node.isFile && !node.isFrame);
            const checkBatchSize = 10; // 每检查10个文件让出一次事件循环
            
            for (let nodeIdx = 0; nodeIdx < fileNodes.length; nodeIdx++) {
              const node = fileNodes[nodeIdx];
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
              
              // 每处理一批文件后让出事件循环，避免阻塞
              if ((nodeIdx + 1) % checkBatchSize === 0 || nodeIdx === fileNodes.length - 1) {
                await scheduleNext();
              }
            }
            total = totalFrames;
            series._cachedTotalFrames = total; // 缓存总数，避免重复计算
          }
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

      // 如果不是静默模式，显示进度条
      if (!silent) {
        // 切换到新系列时，直接重置为0，立即更新UI，无延迟
        commit('SET_SERIES_PROGRESS_STATE', {
          isActive: true,
          currentSeriesIndex: i,
          currentLoaded: 0, // 从0开始，重新全部加载
          currentTotal: total
        });
      }

      // 第二步：动态加载阶段 - 只添加影像节点，不解析完整标签（加快速度）
      // 完整标签解析将在第三步后台静默加载中完成

      // 如果系列有保存的所有影像节点（_allImageNodes），异步批量添加节点并更新进度
      if (series._allImageNodes && Array.isArray(series._allImageNodes)) {
        const allNodes = series._allImageNodes;
        
        // 优化：使用更轻量的方式让出事件循环，减少延迟
        // 直接使用 requestAnimationFrame，不再使用双重延迟（requestAnimationFrame + setTimeout）
        const scheduleNext = () => new Promise((resolve) => requestAnimationFrame(resolve));
        
        // 对于动态影像，需要将文件节点分解为帧节点（批量处理，减少让出次数）
        let targetCount;
        let nodesToProcess = [];
        
        // 重构：后台加载直接处理所有文件，覆盖初始化数据
        // 不需要判断已处理/未处理，直接重新构建整个 children
        const fileNodesToProcess = allNodes.filter(node => node.isFile && !node.isFrame);
        
        // 优化：批量处理文件，减少让出次数，提高性能
        // 小系列（<100个文件）：每5个文件让出一次
        // 中等系列（100-1000个文件）：每10个文件让出一次
        // 大系列（>1000个文件）：每20个文件让出一次
        const fileCount = fileNodesToProcess.length;
        const fileBatchSize = fileCount < 100 ? 5 : (fileCount < 1000 ? 10 : 20);
        
        for (let fileIdx = 0; fileIdx < fileNodesToProcess.length; fileIdx++) {
          const node = fileNodesToProcess[fileIdx];
          const rawPath = node.fullPath || node.path;
          
          try {
            let cineInfo = node._cachedCineInfo;
            if (!cineInfo && rawPath) {
              // 检查是否为动态影像（使用缓存避免重复读取）
              cineInfo = dicomService.cineService.isCineImage(rawPath);
              node._cachedCineInfo = cineInfo;
            }
            
            if (cineInfo && cineInfo.isCine && cineInfo.frameCount > 1) {
              // 动态影像：分解为帧节点
              const frameNodes = dicomService.cineService.extractFramesFromCineImage(node, cineInfo);
              nodesToProcess.push(...frameNodes);
            } else {
              // 普通影像：直接添加文件节点
              nodesToProcess.push(node);
            }
          } catch (error) {
            // 处理失败，作为普通文件添加
            nodesToProcess.push(node);
          }
          
          // 批量处理文件后让出事件循环，减少延迟
          if ((fileIdx + 1) % fileBatchSize === 0 || fileIdx === fileNodesToProcess.length - 1) {
            await scheduleNext();
          }
        }
        
        targetCount = nodesToProcess.length;
        
        const currentCount = children.length; // 当前已加载的数量（通常是1，动态影像可能是帧数）
        const remainingCount = targetCount - currentCount;
        
        // 优化批量大小：增加批量大小，减少让出次数，提高性能
        // 不再每批都让出，而是处理更多节点后再让出
        let addBatchSize;
        if (remainingCount > 100000) {
          // 超大数据集：每批5000-10000个
          addBatchSize = Math.max(5000, Math.floor(remainingCount / 50));
        } else if (remainingCount > 10000) {
          // 大数据集：每批1000-2000个
          addBatchSize = Math.max(1000, Math.floor(remainingCount / 30));
        } else if (remainingCount < 100) {
          // 小系列：一次性添加所有节点
          addBatchSize = remainingCount;
        } else {
          // 中等系列：每批500-1000个
          addBatchSize = Math.max(500, Math.floor(remainingCount / 20));
        }
        
        // 批量添加节点并更新进度
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
          
          // 如果不是静默模式，更新进度（基于已添加的节点数）
          if (!silent) {
            const currentProgress = batchEnd;
            commit('SET_SERIES_PROGRESS_LOADED', currentProgress);
          }
          
          // 只在每批结束后让出事件循环，减少延迟
          // eslint-disable-next-line no-await-in-loop
          await scheduleNext();
        }
        
        // 如果不是静默模式，确保最终进度是100%
        if (!silent) {
          commit('SET_SERIES_PROGRESS_LOADED', targetCount);
        }
      } else {
        // 如果没有_allImageNodes，说明已经是完整加载的系列
        // 如果是静默模式，直接跳过进度更新；否则快速更新进度
        if (!silent) {
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
    }

    // 如果不是静默模式，所有系列完成后隐藏进度条
    if (!silent) {
      commit('RESET_SERIES_PROGRESS');
    }
    
    // 注意：完整 DICOM 标签解析改为按需触发，不在此处统一后台解析
  },

  /**
   * 按需加载指定系列的完整 DICOM 标签
   * @param {Object} context - Vuex context
   * @param {number|Object} payload - 系列索引或包含 seriesIndex 的对象
   */
  async loadFullDicomTagsForSeries({ state, commit }, payload) {
    try {
      const seriesIndex = typeof payload === 'number'
        ? payload
        : (payload && typeof payload.seriesIndex === 'number' ? payload.seriesIndex : state.activeSeriesIndex);

      const seriesList = state.dicomSeries || [];
      if (!Array.isArray(seriesList) || seriesIndex < 0 || seriesIndex >= seriesList.length) {
        return;
      }

      // 如果已经有完整解析结果且标记为 _fullyParsed，直接返回
      const existingFullDict = state.fullDicomDict[seriesIndex];
      if (existingFullDict && existingFullDict._fullyParsed === true) {
        return;
      }

      const series = seriesList[seriesIndex];
      const children = series && Array.isArray(series.children) ? series.children : [];
      if (children.length === 0) {
        return;
      }

      // 找到该系列的第一张有效图像（与原后台解析逻辑保持一致）
      const firstImage = children.find(child =>
        child.isFile && child.path && dicomService.isDicomFile(child.path)
      );

      if (!firstImage) {
        return;
      }

      const fs = require('fs');
      const dicomParser = require('dicom-parser');

      const arrayBuffer = fs.readFileSync(firstImage.path).buffer;
      const byteArray = new Uint8Array(arrayBuffer);
      const dataSet = dicomParser.parseDicom(byteArray);

      // 使用 DicomThumbnailService 的完整解析方法
      const fullDict = dicomService.thumbnailService.parseAllDicomTags(dataSet);
      fullDict._fullyParsed = true; // 标记为已完整解析

      const newFullDicomDict = [...state.fullDicomDict];
      newFullDicomDict[seriesIndex] = fullDict;
      commit('SET_FULL_DICOM_DICT', newFullDicomDict);
    } catch (error) {
      // 按需完整解析失败时静默处理，避免影响主流程
    }
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
  },

  /**
   * 清空系列列表
   */
  clearSeries({ commit }) {
    commit('CLEAR_SERIES');
  },

  /**
   * 从目录节点加载系列（用于双击系列或点击上级目录）
   * @param {Object} context - Vuex context
   * @param {Object} nodeData - 树节点数据
   */
  async loadSeriesFromNode({ state, commit, dispatch }, nodeData) {
    console.log('[loadSeriesFromNode] 开始加载系列', { nodeData: nodeData ? { name: nodeData.name || nodeData.label, path: nodeData.path, hasChildren: !!nodeData.children } : null });
    try {
      commit('SET_ERROR', null);
      
      if (!nodeData) {
        console.error('[loadSeriesFromNode] 错误：无效的节点数据');
        throw new Error('无效的节点数据');
      }

      // 直接使用 nodeData 作为目标节点（el-tree 的节点数据已经包含了完整信息）
      // 但需要确保 nodeData 有 path 属性（可能是 data.path 或 nodeData.path）
      const targetNode = nodeData.data || nodeData;
      console.log('[loadSeriesFromNode] 目标节点', { 
        name: targetNode?.name || targetNode?.label, 
        path: targetNode?.path, 
        isFile: targetNode?.isFile,
        childrenCount: targetNode?.children?.length || 0
      });
      
      if (!targetNode || !targetNode.path) {
        console.error('[loadSeriesFromNode] 错误：节点数据缺少路径信息', { targetNode });
        throw new Error('节点数据缺少路径信息');
      }

      // 判断节点类型：如果是目录且有子节点，可能是上级目录；否则可能是系列
      let seriesNodes = [];
      
      if (targetNode.isFile) {
        console.log('[loadSeriesFromNode] 跳过：文件节点不应该触发加载系列');
        return;
      }

      if (!targetNode.children || targetNode.children.length === 0) {
        console.log('[loadSeriesFromNode] 跳过：空目录');
        return;
      }

      // 分析节点结构
      let structureAnalysis = null;
      try {
        console.log('[loadSeriesFromNode] 开始分析节点结构...');
        structureAnalysis = dicomService.analyzeDicomStructure(targetNode);
        console.log('[loadSeriesFromNode] 结构分析结果', {
          hasSeriesNodes: !!(structureAnalysis?.seriesNodes?.length),
          seriesNodesCount: structureAnalysis?.seriesNodes?.length || 0,
          hasImageNodes: !!(structureAnalysis?.imageNodes?.length),
          imageNodesCount: structureAnalysis?.imageNodes?.length || 0
        });
      } catch (error) {
        console.error('[loadSeriesFromNode] 结构分析失败', error);
        // 分析失败，尝试其他方式
        errorHandler.handleError(error, 'analyzeDicomStructure in loadSeriesFromNode');
      }
      
      if (structureAnalysis && structureAnalysis.seriesNodes && structureAnalysis.seriesNodes.length > 0) {
        // 找到系列节点
        console.log('[loadSeriesFromNode] 使用结构分析得到的系列节点', { count: structureAnalysis.seriesNodes.length });
        seriesNodes = structureAnalysis.seriesNodes;
      } else if (targetNode.children && targetNode.children.length > 0) {
        // 可能是上级目录，尝试分析其子节点
        // 检查是否有直接的子系列
        const hasDirectSeries = targetNode.children.some(child => 
          !child.isFile && child.children && child.children.some(grandchild => 
            grandchild.isFile || (grandchild.children && grandchild.children.length > 0)
          )
        );

        if (hasDirectSeries) {
          // 尝试将每个子节点作为系列分析
          for (const child of targetNode.children) {
            if (!child.isFile) {
              try {
                const childAnalysis = dicomService.analyzeDicomStructure(child);
                if (childAnalysis && childAnalysis.seriesNodes && childAnalysis.seriesNodes.length > 0) {
                  seriesNodes.push(...childAnalysis.seriesNodes);
                }
              } catch (error) {
                // 子节点分析失败，跳过
              }
            }
          }
        } else {
          // 如果没有子系列，尝试将当前节点作为单个系列处理
          let allImageNodes = [];
          
          if (structureAnalysis && structureAnalysis.imageNodes && structureAnalysis.imageNodes.length > 0) {
            // 如果有图像节点但没有系列，使用结构分析得到的 imageNodes
            allImageNodes = structureAnalysis.imageNodes;
          } else {
            // 如果 structureAnalysis 为 null，尝试直接检查 children 是否是图像文件
            allImageNodes = targetNode.children.filter(child => child.isFile);
          }
          
          if (allImageNodes.length > 0) {
            console.log('[loadSeriesFromNode] 手动创建系列节点', { allImageNodesCount: allImageNodes.length });
            // 找到第一个有效的影像文件节点（排除帧节点）
            const firstImageNode = allImageNodes.find(node => node.isFile && !node.isFrame);
            if (!firstImageNode) {
              console.warn('[loadSeriesFromNode] 未找到有效的文件节点，尝试使用第一个节点');
              // 如果没有找到有效的文件节点，尝试使用第一个节点
              const fallbackNode = allImageNodes[0];
              if (!fallbackNode) {
                console.error('[loadSeriesFromNode] 完全没有节点，无法创建系列');
                return; // 完全没有节点，无法创建系列
              }
              // 使用第一个节点（即使可能是帧节点）
              seriesNodes = [{
                name: targetNode.name || targetNode.label || '默认系列',
                path: targetNode.path,
                children: [fallbackNode],
                _allImageNodes: allImageNodes,
                _totalImageCount: allImageNodes.length,
                imageCount: allImageNodes.length,
                isFile: false
              }];
              console.log('[loadSeriesFromNode] 使用备用节点创建系列', { seriesNode: seriesNodes[0] });
            } else {
              // 创建系列节点，模拟 groupSeriesByDicomTags 的结构
              // 关键：只保留第一个影像在 children，其他保存在 _allImageNodes 供后台加载使用
              seriesNodes = [{
                name: targetNode.name || targetNode.label || '默认系列',
                path: targetNode.path,
                children: [firstImageNode],  // 只保留第一个影像文件节点
                _allImageNodes: allImageNodes,  // 保存所有影像节点
                _totalImageCount: allImageNodes.length,  // 记录总数
                imageCount: allImageNodes.length,  // 用于显示总数
                isFile: false
                // 注意：不设置 processedForFrames，让后续的 processCineImagesInSeries 处理
              }];
              console.log('[loadSeriesFromNode] 创建系列节点', { 
                name: seriesNodes[0].name,
                childrenCount: seriesNodes[0].children.length,
                _allImageNodesCount: seriesNodes[0]._allImageNodes.length,
                _totalImageCount: seriesNodes[0]._totalImageCount
              });
            }
          }
        }
      }

      if (seriesNodes.length === 0) {
        console.warn('[loadSeriesFromNode] 没有找到系列节点，静默返回');
        // 不抛出错误，静默返回（可能是非DICOM目录）
        return;
      }

      console.log('[loadSeriesFromNode] 处理动态影像', { seriesNodesCount: seriesNodes.length });
      // 注意：analyzeDicomStructure 已经调用了 processCineImagesInSeries（第102行）
      // 所以如果 seriesNodes 来自 structureAnalysis.seriesNodes，它们已经处理过了
      // 只有手动创建的节点（没有 processedForFrames 标记）才需要处理
      const processedSeriesNodes = seriesNodes.map((series, index) => {
        // 如果已经处理过，直接返回（避免重复处理）
        if (series.processedForFrames === true) {
          console.log(`[loadSeriesFromNode] 系列 ${index} 已处理过，跳过`);
          return series;
        }
        console.log(`[loadSeriesFromNode] 处理系列 ${index} 的动态影像`, { 
          name: series.name,
          childrenCount: series.children?.length 
        });
        // 手动创建的节点需要处理动态影像
        const processed = dicomService.cineService.processCineImagesInSeries(series);
        console.log(`[loadSeriesFromNode] 系列 ${index} 处理完成`, {
          processedForFrames: processed.processedForFrames,
          hasCineInfo: !!processed.cineInfo,
          childrenCount: processed.children?.length
        });
        return processed;
      });

      // 检测动态影像（基于处理后的节点）
      console.log('[loadSeriesFromNode] 检测动态影像');
      const dynamicResult = dicomService.isDynamicImageSeries(processedSeriesNodes);
      if (dynamicResult && dynamicResult.isDynamic) {
        commit('SET_IS_DYNAMIC_SERIES', true);
        commit('SET_CINE_INFO', dynamicResult.cineInfo);
        commit('SET_CURRENT_CINE_IMAGE_PATH', dynamicResult.imagePath);
      } else {
        commit('SET_IS_DYNAMIC_SERIES', false);
        commit('SET_CINE_INFO', null);
        commit('SET_CURRENT_CINE_IMAGE_PATH', null);
      }

      // 生成缩略图并过滤无效系列（快速模式）- 使用处理后的系列节点
      console.log('[loadSeriesFromNode] 开始生成缩略图', { processedSeriesNodesCount: processedSeriesNodes.length });
      const { thumbnails, dicomDict, filteredSeries } = await dicomService.generateThumbnailList(processedSeriesNodes, false);
      console.log('[loadSeriesFromNode] 缩略图生成完成', {
        thumbnailsCount: thumbnails?.length || 0,
        dicomDictCount: dicomDict?.length || 0,
        filteredSeriesCount: filteredSeries?.length || 0
      });

      if (!filteredSeries || filteredSeries.length === 0) {
        console.warn('[loadSeriesFromNode] 没有有效的系列，静默返回');
        // 没有有效的系列，静默返回（可能是无效的DICOM目录）
        return;
      }

      // 记录添加前的系列数量
      const seriesCountBefore = state.dicomSeries.length;
      console.log('[loadSeriesFromNode] 添加系列前', { seriesCountBefore });
      
      // 添加到现有系列列表（避免重复）
      commit('ADD_SERIES', { thumbnails, dicomDict, filteredSeries });
      
      // 获取新添加的系列数量
      const seriesCountAfter = state.dicomSeries.length;
      const newSeriesCount = seriesCountAfter - seriesCountBefore;
      console.log('[loadSeriesFromNode] 添加系列后', { 
        seriesCountAfter, 
        newSeriesCount,
        firstNewSeriesIndex: seriesCountBefore
      });
      
      // 启动后台加载（静默模式，不显示进度，因为数据已缓存）
      console.log('[loadSeriesFromNode] 启动后台加载');
      dispatch('startBackgroundSeriesLoading', { silent: true });
      
      // 如果有新系列添加，自动选中第一个新系列并返回索引
      if (newSeriesCount > 0) {
        const firstNewSeriesIndex = seriesCountBefore;
        commit('SET_ACTIVE_SERIES', firstNewSeriesIndex);
        console.log('[loadSeriesFromNode] 设置活动系列', { firstNewSeriesIndex });
        
        // 返回新系列索引，供组件加载影像使用
        const result = { newSeriesIndex: firstNewSeriesIndex };
        console.log('[loadSeriesFromNode] 完成，返回结果', result);
        return result;
      }
      
      console.log('[loadSeriesFromNode] 完成，但没有新系列添加');
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载系列失败';
      console.error('[loadSeriesFromNode] 发生错误', { error, errorMessage, stack: error.stack });
      commit('SET_ERROR', errorMessage);
      errorHandler.handleError(error, 'loadSeriesFromNode');
      return null;
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
            // 统一使用构建函数生成本地文件 URI（wadouri:file://...）
            const { buildImageId } = require('../../utils/DicomUtils');
            const imageId = buildImageId({ fullPath: node.path, path: node.path });
            if (imageId) {
            imageIds.push(imageId);
            }
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
