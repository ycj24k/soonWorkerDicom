/**
 * 图像查看器状态管理模块
 */

import { ViewportConfig, ToolState, WindowLevelSetting } from '../../types';
import { cornerstoneService } from '../../services';

interface ViewerState {
  // 工具状态
  toolState: ToolState;
  // 视口配置
  viewportConfig: ViewportConfig;
  // 窗宽窗位预设
  windowLevelPresets: WindowLevelSetting[];
  // 当前窗宽窗位索引
  activeWindowLevelIndex: number;
  // 是否显示图像信息
  showImageInfo: boolean;
  // 是否显示测量工具
  showMeasurements: boolean;
  // 缩放比例显示
  zoomLevel: number;
}

const state: ViewerState = {
  toolState: {
    activeAction: 0,
    mode: '2',
    currentCursor: 'mouse2.png'
  },
  viewportConfig: {
    scale: 1,
    translation: { x: 0, y: 0 },
    rotation: 0,
    hflip: false,
    vflip: false,
    invert: false,
    voi: { windowWidth: 400, windowCenter: 50 }
  },
  windowLevelPresets: [
    { img: 'action14-1.png', ww: 80, wc: 35 },    // 软组织
    { img: 'action14-2.png', ww: 400, wc: 50 },   // 腹部
    { img: 'action14-3.png', ww: 2000, wc: 500 }, // 骨窗
    { img: 'action14-4.png', ww: 1500, wc: -600 } // 肺窗
  ],
  activeWindowLevelIndex: 0,
  showImageInfo: true,
  showMeasurements: true,
  zoomLevel: 100
};

const mutations = {
  SET_TOOL_STATE(state: ViewerState, toolState: Partial<ToolState>) {
    state.toolState = { ...state.toolState, ...toolState };
  },

  SET_VIEWPORT_CONFIG(state: ViewerState, config: Partial<ViewportConfig>) {
    state.viewportConfig = { ...state.viewportConfig, ...config };
  },

  SET_ACTIVE_WINDOW_LEVEL(state: ViewerState, index: number) {
    if (index >= 0 && index < state.windowLevelPresets.length) {
      state.activeWindowLevelIndex = index;
      const preset = state.windowLevelPresets[index];
      state.viewportConfig.voi = {
        windowWidth: preset.ww,
        windowCenter: preset.wc
      };
    }
  },

  SET_SHOW_IMAGE_INFO(state: ViewerState, show: boolean) {
    state.showImageInfo = show;
  },

  SET_SHOW_MEASUREMENTS(state: ViewerState, show: boolean) {
    state.showMeasurements = show;
  },

  SET_ZOOM_LEVEL(state: ViewerState, level: number) {
    state.zoomLevel = level;
  },

  RESET_VIEWPORT(state: ViewerState) {
    state.viewportConfig = {
      scale: 1,
      translation: { x: 0, y: 0 },
      rotation: 0,
      hflip: false,
      vflip: false,
      invert: false,
      voi: { windowWidth: 400, windowCenter: 50 }
    };
    state.zoomLevel = 100;
  }
};

const actions = {
  /**
   * 激活工具
   */
  activateTool({ commit }: any, { toolName, actionId }: { toolName: string; actionId: number }) {
    cornerstoneService.activateTool(toolName);
    const toolState = cornerstoneService.getToolState();
    
    commit('SET_TOOL_STATE', {
      activeAction: actionId,
      mode: toolState.mode,
      currentCursor: toolState.currentCursor
    });
  },

  /**
   * 重置视口
   */
  resetViewport({ commit }: any, element: HTMLElement) {
    cornerstoneService.resetViewport(element);
    commit('RESET_VIEWPORT');
  },

  /**
   * 旋转图像
   */
  rotateImage({ commit, state }: any, { element, degrees }: { element: HTMLElement; degrees: number }) {
    cornerstoneService.rotateImage(element, degrees);
    const newRotation = (state.viewportConfig.rotation + degrees) % 360;
    commit('SET_VIEWPORT_CONFIG', { rotation: newRotation });
  },

  /**
   * 翻转图像
   */
  flipImage({ commit, state }: any, { element, direction }: { element: HTMLElement; direction: 'horizontal' | 'vertical' }) {
    cornerstoneService.flipImage(element, direction);
    
    const config: Partial<ViewportConfig> = {};
    if (direction === 'horizontal') {
      config.hflip = !state.viewportConfig.hflip;
    } else {
      config.vflip = !state.viewportConfig.vflip;
    }
    
    commit('SET_VIEWPORT_CONFIG', config);
  },

  /**
   * 适应窗口
   */
  fitToWindow({ commit }: any, element: HTMLElement) {
    cornerstoneService.fitToWindow(element);
    commit('SET_ZOOM_LEVEL', 100);
  },

  /**
   * 反转图像
   */
  invertImage({ commit, state }: any, element: HTMLElement) {
    cornerstoneService.invertImage(element);
    commit('SET_VIEWPORT_CONFIG', { invert: !state.viewportConfig.invert });
  },

  /**
   * 设置窗宽窗位
   */
  setWindowLevel({ commit }: any, { element, index }: { element: HTMLElement; index: number }) {
    commit('SET_ACTIVE_WINDOW_LEVEL', index);
    const preset = state.windowLevelPresets[index];
    cornerstoneService.setWindowLevel(element, preset.ww, preset.wc);
  },

  /**
   * 清除所有测量
   */
  clearAllMeasurements({ }: any, element: HTMLElement) {
    cornerstoneService.clearAllMeasurements(element);
  },

  /**
   * 切换图像信息显示
   */
  toggleImageInfo({ commit, state }: any) {
    commit('SET_SHOW_IMAGE_INFO', !state.showImageInfo);
  },

  /**
   * 切换测量显示
   */
  toggleMeasurements({ commit, state }: any) {
    commit('SET_SHOW_MEASUREMENTS', !state.showMeasurements);
  }
};

const getters = {
  // 当前鼠标样式
  currentCursor: (state: ViewerState) => {
    return cornerstoneService.getCursorPath(state.toolState.currentCursor);
  },

  // 当前窗宽窗位预设
  currentWindowLevelPreset: (state: ViewerState) => {
    return state.windowLevelPresets[state.activeWindowLevelIndex];
  },

  // 是否激活指定工具
  isToolActive: (state: ViewerState) => (actionId: number) => {
    return state.toolState.activeAction === actionId;
  }
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
};