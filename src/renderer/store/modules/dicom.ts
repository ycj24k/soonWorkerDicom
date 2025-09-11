/**
 * DICOM状态管理模块
 */

import { DicomThumbnail, DicomElement, FileTreeNode, DicomSeries } from '../../types';
import { dicomService, errorHandler } from '../../services';

interface DicomState {
  // 当前目录
  currentDirectory: string;
  // 目录树
  directoryTree: FileTreeNode[];
  // DICOM序列
  dicomSeries: DicomSeries[];
  // 缩略图列表
  thumbnails: DicomThumbnail[];
  // 当前选中的序列索引
  activeSeriesIndex: number;
  // 当前图像索引
  activeImageIndex: number;
  // DICOM字典数据
  dicomDict: DicomElement[][];
  // 加载状态
  loading: boolean;
  // 错误信息
  error: string | null;
}

const state: DicomState = {
  currentDirectory: '',
  directoryTree: [],
  dicomSeries: [],
  thumbnails: [],
  activeSeriesIndex: 0,
  activeImageIndex: 0,
  dicomDict: [],
  loading: false,
  error: null
};

const mutations = {
  SET_LOADING(state: DicomState, loading: boolean) {
    state.loading = loading;
  },

  SET_ERROR(state: DicomState, error: string | null) {
    state.error = error;
  },

  SET_CURRENT_DIRECTORY(state: DicomState, directory: string) {
    state.currentDirectory = directory;
  },

  SET_DIRECTORY_TREE(state: DicomState, tree: FileTreeNode[]) {
    state.directoryTree = tree;
  },

  SET_DICOM_SERIES(state: DicomState, series: DicomSeries[]) {
    state.dicomSeries = series;
  },

  SET_THUMBNAILS(state: DicomState, thumbnails: DicomThumbnail[]) {
    state.thumbnails = thumbnails;
  },

  SET_DICOM_DICT(state: DicomState, dict: DicomElement[][]) {
    state.dicomDict = dict;
  },

  SET_ACTIVE_SERIES_INDEX(state: DicomState, index: number) {
    state.activeSeriesIndex = index;
    state.activeImageIndex = 0; // 切换序列时重置图像索引
  },

  SET_ACTIVE_IMAGE_INDEX(state: DicomState, index: number) {
    state.activeImageIndex = index;
  },

  RESET_STATE(state: DicomState) {
    state.directoryTree = [];
    state.dicomSeries = [];
    state.thumbnails = [];
    state.activeSeriesIndex = 0;
    state.activeImageIndex = 0;
    state.dicomDict = [];
    state.error = null;
  }
};

const actions = {
  /**
   * 加载DICOM目录
   */
  async loadDicomDirectory({ commit }: any, directory: string) {
    commit('SET_LOADING', true);
    commit('SET_ERROR', null);
    
    try {
      // 重置状态
      commit('RESET_STATE');
      commit('SET_CURRENT_DIRECTORY', directory);

      // 获取目录树
      const directoryTree = dicomService.getDirectoryTree(directory);
      
      // 获取最后两层数据
      const lastTwoLayers = dicomService.getLastTwoLayers(directoryTree);
      if (!lastTwoLayers) {
        throw new Error('DICOM目录结构无效');
      }

      // 设置DICOM序列
      const dicomSeries = lastTwoLayers.secondLastLayer;
      commit('SET_DICOM_SERIES', dicomSeries);

      // 生成缩略图
      const { thumbnails, dicomDict } = await dicomService.generateThumbnailList(dicomSeries);
      commit('SET_THUMBNAILS', thumbnails);
      commit('SET_DICOM_DICT', dicomDict);

      // 构建目录树
      const treeData = await dicomService.buildTree(lastTwoLayers.lastLayer);
      commit('SET_DIRECTORY_TREE', treeData);

      errorHandler.handleSuccess('DICOM文件加载完成');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载DICOM文件失败';
      commit('SET_ERROR', errorMessage);
      errorHandler.handleError(error as Error, 'loadDicomDirectory');
    } finally {
      commit('SET_LOADING', false);
    }
  },

  /**
   * 选择DICOM序列
   */
  selectDicomSeries({ commit, state }: any, index: number) {
    if (index >= 0 && index < state.dicomSeries.length) {
      commit('SET_ACTIVE_SERIES_INDEX', index);
    }
  },

  /**
   * 选择图像
   */
  selectImage({ commit, state }: any, index: number) {
    const currentSeries = state.dicomSeries[state.activeSeriesIndex];
    if (currentSeries && index >= 0 && index < currentSeries.children.length) {
      commit('SET_ACTIVE_IMAGE_INDEX', index);
    }
  },

  /**
   * 下一张图像
   */
  nextImage({ commit, state }: any) {
    const currentSeries = state.dicomSeries[state.activeSeriesIndex];
    if (currentSeries && state.activeImageIndex < currentSeries.children.length - 1) {
      commit('SET_ACTIVE_IMAGE_INDEX', state.activeImageIndex + 1);
    }
  },

  /**
   * 上一张图像
   */
  previousImage({ commit, state }: any) {
    if (state.activeImageIndex > 0) {
      commit('SET_ACTIVE_IMAGE_INDEX', state.activeImageIndex - 1);
    }
  },

  /**
   * 清理缓存
   */
  clearCache() {
    dicomService.clearCache();
  }
};

const getters = {
  // 当前选中的序列
  currentSeries: (state: DicomState) => {
    return state.dicomSeries[state.activeSeriesIndex] || null;
  },

  // 当前选中的图像
  currentImage: (state: DicomState, getters: any) => {
    const series = getters.currentSeries;
    return series ? series.children[state.activeImageIndex] || null : null;
  },

  // 当前图像路径
  currentImagePath: (state: DicomState, getters: any) => {
    const image = getters.currentImage;
    return image ? image.path : null;
  },

  // 当前序列的所有图像ID
  currentImageIds: (state: DicomState, getters: any) => {
    const series = getters.currentSeries;
    return series ? series.children.map((child: any) => `wadouri:${child.path}`) : [];
  },

  // 当前DICOM字典
  currentDicomDict: (state: DicomState) => {
    return state.dicomDict[state.activeSeriesIndex] || [];
  },

  // 获取DICOM标签值
  getDicomValue: (state: DicomState, getters: any) => (tag: string) => {
    const dict = getters.currentDicomDict;
    const item = dict.find((item: DicomElement) => item.tag === tag);
    return item ? item.value : '';
  },

  // 缓存统计
  cacheStats: () => {
    return dicomService.getCacheStats();
  }
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
};