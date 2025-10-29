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
    direction: 'forward'
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

  START_PLAYBACK(state) {
    state.playbackControl.isPlaying = true;
    state.playbackControl.isPaused = false;
  },

  STOP_PLAYBACK(state) {
    state.playbackControl.isPlaying = false;
    state.playbackControl.isPaused = false;
  },

  PAUSE_PLAYBACK(state) {
    state.playbackControl.isPlaying = false;
    state.playbackControl.isPaused = true;
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

  startPlayback({ commit }) {
    commit('START_PLAYBACK');
  },

  stopPlayback({ commit }) {
    commit('STOP_PLAYBACK');
  },

  pausePlayback({ commit }) {
    commit('PAUSE_PLAYBACK');
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
  playbackSpeed: (state) => state.playbackControl.speed
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
};
