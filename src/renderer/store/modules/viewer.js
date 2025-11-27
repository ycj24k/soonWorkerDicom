/**
 * 查看器状态管理模块
 */

import { cornerstoneService, gridViewService } from '../../services/index.js';

const state = {
  // 工具状态
  toolState: {
    activeTool: 'WwwcTool',
    tools: {
      WwwcTool: { active: true },
      PanTool: { active: false },
      ZoomTool: { active: false },
      LengthTool: { active: false },
      AngleTool: { active: false },
      EllipticalRoiTool: { active: false },
      RectangleRoiTool: { active: false },
      ProbeTool: { active: false }
    }
  },
  // 窗口级别预设
  windowLevelPresets: [
    { name: '默认', ww: 400, wc: 50 },
    { name: '肺窗', ww: 1500, wc: -600 },
    { name: '纵隔窗', ww: 350, wc: 40 },
    { name: '骨窗', ww: 2000, wc: 300 },
    { name: '脑窗', ww: 80, wc: 40 }
  ],
  // 网格视图状态
  gridViewState: {
    isActive: false,
    layout: { rows: 3, cols: 3, totalSlots: 9 },
    viewports: [],
    selectedViewportIndex: 0
  },
  // 播放控制
  playbackControl: {
    isPlaying: false,
    isPaused: false,
    speed: 10, // 默认10帧/秒
    currentFrame: 0,
    totalFrames: 0,
    direction: 'forward',
    playbackType: 'none' // 播放类型：'none' | 'regular' | 'cine'
  },
  // 显示设置
  showImageInfo: true,
  zoomLevel: 100
};

const mutations = {
  SET_TOOL_STATE(state, toolState) {
    state.toolState = { ...state.toolState, ...toolState };
  },

  SET_ACTIVE_TOOL(state, toolName) {
    state.toolState.activeTool = toolName;
  },

  SET_WINDOW_LEVEL_PRESET(state, preset) {
    state.windowLevelPresets = state.windowLevelPresets.map(p => 
      p.name === preset.name ? { ...p, ...preset } : p
    );
  },

  SET_GRID_VIEW_STATE(state, gridState) {
    state.gridViewState = { ...state.gridViewState, ...gridState };
  },

  ACTIVATE_GRID_LAYOUT(state, layout) {
    state.gridViewState.isActive = true;
    state.gridViewState.layout = layout;
  },

  DEACTIVATE_GRID_LAYOUT(state) {
    state.gridViewState.isActive = false;
    state.gridViewState.viewports = [];
    state.gridViewState.selectedViewportIndex = 0;
  },

  SELECT_GRID_VIEWPORT(state, index) {
    state.gridViewState.selectedViewportIndex = index;
  },

  SET_PLAYBACK_CONTROL(state, control) {
    state.playbackControl = { ...state.playbackControl, ...control };
  },

  START_PLAYBACK(state, payload) {
    state.playbackControl.isPlaying = true;
    state.playbackControl.isPaused = false;
    // 设置播放类型
    if (payload && payload.type) {
      state.playbackControl.playbackType = payload.type; // 'regular' 或 'cine'
    }
  },

  STOP_PLAYBACK(state, payload) {
    state.playbackControl.isPlaying = false;
    state.playbackControl.isPaused = false;
    state.playbackControl.currentFrame = 0;
    state.playbackControl.totalFrames = 0;
    // 重置播放类型
    if (payload && payload.type) {
      // 只有在类型匹配时才重置
      if (state.playbackControl.playbackType === payload.type) {
        state.playbackControl.playbackType = 'none';
      }
    } else {
      state.playbackControl.playbackType = 'none';
    }
  },

  PAUSE_PLAYBACK(state, payload) {
    state.playbackControl.isPlaying = false;
    state.playbackControl.isPaused = true;
    // 保持播放类型不变
    if (payload && payload.type) {
      state.playbackControl.playbackType = payload.type;
    }
  },

  SET_PLAYBACK_SPEED(state, speed) {
    state.playbackControl.speed = speed;
  },

  SET_ZOOM_LEVEL(state, level) {
    state.zoomLevel = level;
  },

  SET_SHOW_IMAGE_INFO(state, show) {
    state.showImageInfo = show;
  }
};

const actions = {
  setToolState({ commit }, toolState) {
    commit('SET_TOOL_STATE', toolState);
  },

  setActiveTool({ commit }, toolName) {
    commit('SET_ACTIVE_TOOL', toolName);
  },

  setWindowLevelPreset({ commit }, preset) {
    commit('SET_WINDOW_LEVEL_PRESET', preset);
  },

  activateGridLayout({ commit }, layout) {
    commit('ACTIVATE_GRID_LAYOUT', layout);
  },

  deactivateGridLayout({ commit }) {
    commit('DEACTIVATE_GRID_LAYOUT');
  },

  selectGridViewport({ commit }, index) {
    commit('SELECT_GRID_VIEWPORT', index);
  },

  async loadImageToGrid({ commit, state }, { viewportIndex, imageId, element, seriesIndex, imageIndex }) {
    await gridViewService.loadImageToViewport(viewportIndex, imageId, element, seriesIndex, imageIndex);
    commit('SELECT_GRID_VIEWPORT', viewportIndex);
  },

  /**
   * 开始播放
   * @param {Object} context - Vuex context
   * @param {Object} payload - 播放参数
   * @param {string} payload.type - 播放类型：'regular' | 'cine'
   */
  startPlayback({ commit }, payload = {}) {
    commit('START_PLAYBACK', payload);
  },

  /**
   * 停止播放
   * @param {Object} context - Vuex context
   * @param {Object} payload - 停止参数
   * @param {string} payload.type - 播放类型：'regular' | 'cine'
   */
  stopPlayback({ commit }, payload = {}) {
    commit('STOP_PLAYBACK', payload);
  },

  /**
   * 暂停播放
   * @param {Object} context - Vuex context
   * @param {Object} payload - 暂停参数
   * @param {string} payload.type - 播放类型：'regular' | 'cine'
   */
  pausePlayback({ commit }, payload = {}) {
    commit('PAUSE_PLAYBACK', payload);
  },

  /**
   * 清理播放资源
   */
  cleanupPlayback({ commit, state }) {
    // 重置所有播放状态
    commit('STOP_PLAYBACK', { type: state.playbackControl.playbackType });
    commit('SET_PLAYBACK_CONTROL', {
      isPlaying: false,
      isPaused: false,
      speed: 10,
      currentFrame: 0,
      totalFrames: 0,
      direction: 'forward',
      playbackType: 'none'
    });
  },

  setPlaybackSpeed({ commit }, speed) {
    commit('SET_PLAYBACK_SPEED', speed);
  },

  setPlaybackControl({ commit }, control) {
    commit('SET_PLAYBACK_CONTROL', control);
  },

  setZoomLevel({ commit }, level) {
    commit('SET_ZOOM_LEVEL', level);
  },

  setShowImageInfo({ commit }, show) {
    commit('SET_SHOW_IMAGE_INFO', show);
  }
};

const getters = {
  isToolActive: (state) => (toolName) => {
    return state.toolState.tools[toolName] && state.toolState.tools[toolName].active;
  },

  currentCursor: (state) => {
    const toolCursors = {
      WwwcTool: 'ns-resize',
      PanTool: 'grab',
      ZoomTool: 'zoom-in',
      LengthTool: 'crosshair',
      AngleTool: 'crosshair',
      EllipticalRoiTool: 'crosshair',
      RectangleRoiTool: 'crosshair',
      ProbeTool: 'crosshair'
    };
    return toolCursors[state.toolState.activeTool] || 'default';
  },

  currentWindowLevelPreset: (state) => {
    return state.windowLevelPresets[0] || { ww: 400, wc: 50 };
  },

  isGridViewActive: (state) => state.gridViewState.isActive,
  currentGridLayout: (state) => state.gridViewState.layout,
  selectedGridViewport: (state) => state.gridViewState.viewports[state.gridViewState.selectedViewportIndex] || null,
  isPlaying: (state) => state.playbackControl.isPlaying,
  isPaused: (state) => state.playbackControl.isPaused,
  playbackSpeed: (state) => state.playbackControl.speed,
  playbackType: (state) => state.playbackControl.playbackType
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
};
