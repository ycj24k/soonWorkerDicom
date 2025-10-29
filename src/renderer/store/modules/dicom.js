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
  currentCineImagePath: null
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
    state.activeImageIndex = index;
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
        console.log('🎬 Vuex: 动态影像信息已保存');
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

      // 直接使用结构分析结果设置系列数据
      commit('SET_DICOM_SERIES', structureAnalysis.seriesNodes);
      
      // 生成缩略图
      const { thumbnails, dicomDict } = await dicomService.generateThumbnailList(structureAnalysis.seriesNodes);
      commit('SET_THUMBNAILS', thumbnails);
      commit('SET_DICOM_DICT', dicomDict);

      // 构建目录树
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
   * 加载单个DICOM文件
   */
  async loadDicomFile({ commit }, filePath) {
    console.log('📁 Vuex: 开始加载单个DICOM文件:', filePath);
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
      console.log('📄 Vuex: 文件名:', fileName);
      console.log('📄 Vuex: 标准化路径:', normalizedFilePath);
      
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
      console.log('🌳 Vuex: 创建的单文件树结构:', directoryTree);

      // 智能分析DICOM结构
      console.log('🔍 Vuex: 开始分析单文件DICOM结构...');
      const structureAnalysis = dicomService.analyzeDicomStructure(directoryTree);
      if (!structureAnalysis) {
        console.error('❌ Vuex: DICOM文件格式无效');
        throw new Error('DICOM文件格式无效');
      }
      console.log('✅ Vuex: DICOM结构分析成功:', structureAnalysis);

      // 检测是否为动态影像
      const dynamicResult = dicomService.isDynamicImageSeries(structureAnalysis.seriesNodes);
      
      if (dynamicResult && dynamicResult.isDynamic) {
        commit('SET_IS_DYNAMIC_SERIES', true);
        commit('SET_CINE_INFO', dynamicResult.cineInfo);
        commit('SET_CURRENT_CINE_IMAGE_PATH', dynamicResult.imagePath);
        console.log('🎬 Vuex: 动态影像信息已保存');
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

      commit('SET_DICOM_SERIES', [singleSeries]);

      // 生成缩略图
      const { thumbnails, dicomDict } = await dicomService.generateThumbnailList([singleSeries]);
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
  }
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
};
