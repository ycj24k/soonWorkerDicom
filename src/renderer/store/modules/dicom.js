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

      // 生成缩略图并过滤无效系列（只有成功生成缩略图的系列才是有效的）
      const { thumbnails, dicomDict, filteredSeries } = await dicomService.generateThumbnailList(structureAnalysis.seriesNodes);

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
   * 按系列顺序后台加载（仅用于进度反馈，不重复实际图像解码）
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
      const total = children.length;

      if (total === 0) {
        continue;
      }

      commit('SET_SERIES_PROGRESS_STATE', {
        isActive: true,
        currentSeriesIndex: i,
        currentLoaded: 0,
        currentTotal: total
      });

      for (let j = 0; j < total; j++) {
        // 这里不进行真正的图像解码，仅作为“按文件数遍历”的后台加载进度反馈
        commit('SET_SERIES_PROGRESS_LOADED', j + 1);
        // 让出事件循环，避免阻塞UI
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    // 所有系列完成后隐藏进度条
    commit('RESET_SERIES_PROGRESS');
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

      // 生成缩略图并过滤无效系列
      const { thumbnails, dicomDict, filteredSeries } = await dicomService.generateThumbnailList([singleSeries]);
      
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
