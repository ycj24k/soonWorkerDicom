<template>
  <div class="container_box">
    <!-- 头部标题栏 -->
    <div class="flex_box flex_row_between header_box">
      <div class="header_title">SOONDICOMER</div>
      <div class="flex_box header_btns">
        <el-button @click="closeApp" icon="el-icon-close" class="header_btn"></el-button>
      </div>
    </div>

    <!-- 工具栏 -->
    <DicomToolbar 
      :active-action="activeAction"
      :active2="active2"
      :show-playback-console="showPlaybackConsole"
      :is-playback-playing="isPlaybackPlaying"
      :playback-speed="playbackSpeed"
      :is-playback-first="isPlaybackFirst"
      :is-playback-last="isPlaybackLast"
      @open-directory="selectPath"
      @open-file="selectFile"
      @reset-viewport="resetViewport"
      @rotate-image="rotateImage"
      @flip-image="flipImage"
      @fit-to-window="fitToWindow"
      @invert-image="invertImage"
      @activate-tool="activateTool"
      @set-window-level="setWindowLevel"
      @clear-measurements="clearMeasurements"
      @show-image-info="showImageInfo"
      @toggle-grid-layout="toggleGridLayout"
      @update:active2="active2 = $event"
      @close-playback-console="handleClosePlaybackConsole"
      @playback-previous="handlePlaybackPrevious"
      @playback-next="handlePlaybackNext"
      @playback-play-pause="handlePlaybackPlayPause"
      @playback-speed-change="handlePlaybackSpeedChange"
    />

    <!-- 主内容区 -->
    <div class="flex_box content_box">
      <!-- 侧边栏 -->
      <DicomSidebar @select-series="selectSeries" @clear-viewports="handleClearViewports" />

      <!-- 图像显示区 -->
      <div 
        ref="dicomViewer" 
        id="dicomViewer" 
        :style="{ cursor: currentCursor }"
        class="dicom-viewer"
        :class="{ 'grid-view': isGridViewActive, 'grid-active': isGridViewActive }"
      >
      </div>
    </div>

    <!-- 网格布局选择器 -->
    <GridLayoutSelector 
      ref="gridLayoutSelector"
      :show="showGridLayoutSelector"
      @apply-layout="applyGridLayout"
      @close="closeGridLayoutSelector"
    />


    <!-- 图像详细信息对话框 -->
    <ImageInfo ref="imageInfo" />

    <!-- 点距校准对话框 -->
    <el-dialog
      title="点距调整"
      :visible.sync="calibrationDialogVisible"
      width="360px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      append-to-body
    >
      <div class="calibration-dialog-body">
        <div class="calibration-row">
          <span class="label">线段长度：</span>
          <el-input
            class="calibration-input"
            :value="calibrationMeasuredLength"
            disabled
          >
            <template slot="append">mm</template>
          </el-input>
        </div>
        <div class="calibration-row">
          <span class="label">真实长度：</span>
          <el-input
            class="calibration-input"
            v-model="calibrationRealLength"
            placeholder="请输入真实长度"
          >
            <template slot="append">mm</template>
          </el-input>
        </div>
        <div class="calibration-hint">
          请确认该线段的真实物理长度，单位为毫米。
        </div>
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button size="small" @click="cancelPixelCalibration">取消</el-button>
        <el-button size="small" type="primary" @click="confirmPixelCalibration">确定</el-button>
      </span>
    </el-dialog>
    
    <!-- 加载动画 -->
    <div v-if="loading || localLoading" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">{{ loadingText }}</div>
      </div>
    </div>
    
    <!-- 底部系列后台加载进度条（自定义，无动画） -->
    <div
      v-if="seriesProgress && seriesProgress.isActive"
      class="series-progress-bar"
    >
      <div class="series-progress-text">
        正在加载系列 {{ seriesProgress.currentSeriesIndex + 1 }}/{{ totalSeriesCount }} ，
        图像 {{ seriesProgress.currentLoaded }}/{{ seriesProgress.currentTotal }}
      </div>
      <div class="custom-progress-container">
        <div 
          class="custom-progress-bar"
          :style="{ width: seriesProgressPercentage + '%' }"
        ></div>
      </div>
    </div>

  </div>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex';
import DicomToolbar from './DicomToolbar.vue';
import DicomSidebar from './DicomSidebar.vue';
import GridLayoutSelector from './GridLayoutSelector.vue';
import ImageInfo from './ImageInfo.vue';
import { cornerstoneService, gridViewService } from '../../services';
import playbackMixin from './mixins/playbackMixin';
import imageLoaderMixin from './mixins/imageLoaderMixin';
import toolMixin from './mixins/toolMixin';
import gridLayoutMixin from './mixins/gridLayoutMixin';
import keyboardMixin from './mixins/keyboardMixin';

const { ipcRenderer } = require('electron');
const cinePlaybackService = require('../../services/CinePlaybackService');

export default {
  name: 'DicomViewer',
  components: {
    DicomToolbar,
    DicomSidebar,
    GridLayoutSelector,
    ImageInfo
  },
  mixins: [
    playbackMixin,
    imageLoaderMixin,
    toolMixin,
    gridLayoutMixin,
    keyboardMixin
  ],
  data() {
    return {
      showGridLayoutSelector: false,
      showPlaybackConsole: false,
      // 本地loading状态
      localLoading: false,
      // 鼠标样式控制
      mode: '2', // 当前模式
      activeAction: 0,
      active2: 0,
      cwShow: false,
      // 窗宽窗位预设
      cwImgs: [
        { img: require('@/assets/images/action14-1.png'), ww: 80, wc: 35 },
        { img: require('@/assets/images/action14-2.png'), ww: 400, wc: 50 },
        { img: require('@/assets/images/action14-3.png'), ww: 2000, wc: 500 },
        { img: require('@/assets/images/action14-4.png'), ww: 1500, wc: -600 }
      ],
      // 点距校准对话框状态
      calibrationDialogVisible: false,
      calibrationMeasuredLength: '',
      calibrationRealLength: '',
      calibrationPixelDistance: 0
    };
  },
  computed: {
    ...mapState('dicom', ['loading', 'loadingText', 'error', 'isDynamicSeries', 'cineInfo', 'currentCineImagePath', 'activeImageIndex', 'dicomSeries', 'seriesProgress']),
    ...mapState('viewer', ['toolState']),
    ...mapGetters('dicom', ['currentImage', 'currentImageIds', 'currentSeries']),
    ...mapGetters('viewer', ['isGridViewActive', 'currentGridLayout', 'selectedGridViewport', 'isPlaying', 'isPaused', 'playbackSpeed']),
    
    // 播放状态计算
    isPausedState() {
      // 优先检查动态影像播放状态
      if (this.isDynamicSeries && this.cineInfo) {
        return cinePlaybackService.isPaused();
      }
      // 否则使用Vuex中的暂停状态
      return this.isPaused;
    },
    
    // 当前播放状态
    currentPlayingState() {
      if (this.isDynamicSeries && this.cineInfo) {
        return cinePlaybackService.isPlaying();
      }
      return this.isPlaying;
    },

    
    // 鼠标样式计算
    currentCursor() {
      const path = require('path');
      const fullPath = this.getCursorPath(`mouse${this.mode}.png`);
      return `url(${fullPath}) 0 0, auto`;
    },
    
    // 网格状态
    gridState() {
      return gridViewService.getGridState();
    },
    
    // 播放控制台相关计算属性
    isPlaybackPlaying() {
      // 使用 Vuex 状态，播放服务状态会在播放时同步更新
      return this.isPlaying;
    },
    
    isPlaybackFirst() {
      // 使用 mixin 中的方法，确保逻辑一致
      if (!this.getCurrentImageFileIndex) {
        return true;
      }
      
      // 确保计算属性能响应 activeImageIndex 的变化
      const _ = this.activeImageIndex; // 建立响应式依赖
      const currentSeries = this.$store.getters['dicom/currentSeries']; // 建立响应式依赖
      
      if (!currentSeries) {
        return true;
      }
      
      const { imageFiles, currentImageFileIndex } = this.getCurrentImageFileIndex();
      
      // 如果找不到当前图像索引或索引无效，则禁用
      if (imageFiles.length === 0 || currentImageFileIndex < 0) {
        return true;
      }
      
      // 只有第一个影像（索引为0）才禁用上一张按钮
      return currentImageFileIndex === 0;
    },
    
    isPlaybackLast() {
      // 使用 mixin 中的方法，确保逻辑一致
      if (!this.getCurrentImageFileIndex) {
        return true;
      }
      
      // 确保计算属性能响应 activeImageIndex 的变化
      const _ = this.activeImageIndex; // 建立响应式依赖
      const currentSeries = this.$store.getters['dicom/currentSeries']; // 建立响应式依赖
      
      if (!currentSeries) {
        return true;
      }
      
      const { imageFiles, currentImageFileIndex } = this.getCurrentImageFileIndex();
      
      // 如果找不到当前图像索引或索引无效，则禁用
      if (imageFiles.length === 0 || currentImageFileIndex < 0) {
        return true;
      }
      
      // 只有最后一个影像（索引为 imageFiles.length - 1）才禁用下一张按钮
      return currentImageFileIndex >= imageFiles.length - 1;
    },

    // 系列后台加载进度百分比
    seriesProgressPercentage() {
      if (!this.seriesProgress || !this.seriesProgress.isActive || !this.seriesProgress.currentTotal) {
        return 0;
      }
      const loaded = this.seriesProgress.currentLoaded || 0;
      const total = this.seriesProgress.currentTotal || 0;
      if (total === 0) return 0;
      const percent = Math.round((loaded * 100) / total);
      return percent > 100 ? 100 : percent;
    },

    totalSeriesCount() {
      return Array.isArray(this.dicomSeries) ? this.dicomSeries.length : 0;
    }
  },
  watch: {
    // 监听活动图像索引变化，自动更新视口信息
    '$store.state.dicom.activeImageIndex': {
      handler() {
        this.$nextTick(() => {
          if (typeof this.getGridViewportElements === 'function') {
            const viewports = this.getGridViewportElements();
            viewports.forEach(viewport => {
              const overlay = viewport.querySelector('.viewport-info-overlay');
              if (overlay && typeof this.updateViewportInfo === 'function') {
                this.updateViewportInfo(overlay, viewport);
              }
            });
          }
          // 强制更新计算属性，确保按钮状态正确
          this.$forceUpdate();
        });
      },
      immediate: false
    },
    // 监听当前系列变化，确保按钮状态更新（使用函数形式）
    currentSeries: {
      handler() {
        this.$nextTick(() => {
          this.$forceUpdate();
        });
      },
      deep: true
    },
    // 监听当前系列的图像数量变化：后台加载补充children时自动同步视口stack
    dicomSeries: {
      handler(newSeries, oldSeries) {
        try {
          const activeIndex = this.$store.state.dicom.activeSeriesIndex;
          if (!Array.isArray(newSeries) || !Array.isArray(oldSeries)) {
            return;
          }
          const newSeriesItem = newSeries[activeIndex];
          const oldSeriesItem = oldSeries[activeIndex];
          if (!newSeriesItem || !oldSeriesItem) {
            return;
          }
          const newChildren = Array.isArray(newSeriesItem.children) ? newSeriesItem.children : [];
          const oldChildren = Array.isArray(oldSeriesItem.children) ? oldSeriesItem.children : [];
          // 只有在当前系列 children 数量真正增加时才重新同步
          if (newChildren.length <= oldChildren.length || newChildren.length === 0) {
            return;
          }
          // 仅在网格视图激活且系列加载方法存在时才尝试刷新当前视口
          if (!this.isGridViewActive || typeof this.loadSeriesToGridViewport !== 'function') {
            return;
          }
          const viewportIndex = this.$store.state.viewer.gridViewState
            ? (this.$store.state.viewer.gridViewState.selectedViewportIndex || 0)
            : 0;
          this.loadSeriesToGridViewport(activeIndex, viewportIndex);
        } catch (error) {
          // 同步失败不影响主流程，静默处理
        }
      },
      deep: true
    },
    // 当 dicom 字典发生变化（尤其是后台完整解析完成）时，主动刷新当前系列视口上的患者/检查信息
    '$store.state.dicom.dicomDict': {
      handler(newVal, oldVal) {
        try {
          const activeIndex = this.$store.state.dicom.activeSeriesIndex;
          if (!Array.isArray(newVal) || activeIndex < 0 || activeIndex >= newVal.length) {
            return;
          }
          const newSeriesDict = newVal[activeIndex];
          const oldSeriesDict = Array.isArray(oldVal) ? oldVal[activeIndex] : null;
          // 仅在当前系列的字典对象实际发生变化时才刷新，避免不必要的重绘
          if (!newSeriesDict || newSeriesDict === oldSeriesDict) {
            return;
          }

          this.$nextTick(() => {
            if (typeof this.getGridViewportElements === 'function' &&
                typeof this.renderImageInfoToOverlay === 'function') {
              const viewports = this.getGridViewportElements() || [];
              viewports.forEach(viewport => {
                try {
                  const overlay = viewport.querySelector('.grid-image-info-overlay');
                  if (overlay) {
                    this.renderImageInfoToOverlay(overlay, viewport);
                  }
                } catch (e) {
                  // 单个视口刷新失败时静默忽略
                }
              });
            }
          });
        } catch (e) {
          // 刷新失败时不影响主流程
        }
      },
      deep: true
    }
  },
  async mounted() {
    this.initializeViewer();
    this.setupKeyboardShortcuts();
    // 等待一个微任务周期，确保Cornerstone初始化完成
    await this.$nextTick();
    
    // 在自动加载前显示加载动画
    this.$store.commit('dicom/SET_LOADING', true);
    this.$store.commit('dicom/SET_LOADING_TEXT', '正在初始化应用程序...');
    this.localLoading = true;
    
    // 自动加载DICOM目录
    this.autoLoadDicomDirectory();
  },
  /**
   * 组件销毁前清理资源
   */
  beforeDestroy() {
    try {
      // 清理所有资源
    this.cleanupViewer();
      
      // 移除键盘事件监听
    document.removeEventListener('keydown', this.handleKeyboardShortcuts);
    } catch (error) {
      // 组件销毁清理失败，静默处理
    }
  },
  methods: {
    ...mapActions('dicom', [
      'loadDicomDirectory', 
      'loadDicomFile',
      'selectDicomSeries', 
      'selectImage'
    ]),
    ...mapActions('viewer', [
      'activateGridLayout',
      'deactivateGridLayout',
      'selectGridViewport',
      'loadImageToGrid',
      'stopPlayback',
      'setPlaybackSpeed'
    ]),

    /**
     * 初始化查看器 - 默认创建1x1网格视口
     */
    async initializeViewer() {
      try {
        ipcRenderer.send('maximize-window');
        
        // 初始化1x1网格布局（统一使用网格视口系统）
        const layout = { rows: 1, cols: 1, totalSlots: 1 };
        await this.$store.dispatch('viewer/activateGridLayout', layout);
        await this.initializeGridView();
      } catch (error) {
        // 初始化失败，静默处理
      }
    },



    /**
     * 清理查看器（完整清理）
     */
    cleanupViewer() {
      try {
        // 清理播放状态
        this.cleanupPlayback();

        // 清理网格视图
        if (this.isGridViewActive) {
          gridViewService.clearAllViewports(this.$refs.dicomViewer);
          gridViewService.clearGridStyles(this.$refs.dicomViewer);
          gridViewService.deactivateGridLayout();
        }
        
        // 清理视口信息更新的事件监听器
        if (typeof this.getGridViewportElements === 'function') {
          const viewports = this.getGridViewportElements();
          viewports.forEach(viewport => {
            if (viewport._infoUpdateHandler) {
              viewport.removeEventListener('cornerstoneimagerendered', viewport._infoUpdateHandler);
              viewport.removeEventListener('cornerstonenewimage', viewport._infoUpdateHandler);
              delete viewport._infoUpdateHandler;
            }
          });
        }
        
        // 清理Cornerstone元素
        if (this.$refs.dicomViewer) {
        cornerstoneService.disableElement(this.$refs.dicomViewer);
        }
        
      } catch (error) {
        // 清理查看器失败，静默处理
      }
    },

    /**
     * 处理清空视口事件（从侧边栏触发）
     */
    async handleClearViewports() {
      try {
        // 清理播放状态
        this.cleanupPlayback();

        // 统一使用网格视口系统（1x1网格）
        // 确保网格视图已激活
        if (!this.isGridViewActive) {
          const layout = { rows: 1, cols: 1, totalSlots: 1 };
          await this.$store.dispatch('viewer/activateGridLayout', layout);
          if (typeof this.initializeGridView === 'function') {
            await this.initializeGridView();
          }
        }
        
        // 清空所有视口
        const viewports = typeof this.getGridViewportElements === 'function'
          ? this.getGridViewportElements()
          : [];
        
        viewports.forEach(viewport => {
          try {
            // 清除信息更新定时器
            if (viewport._infoUpdateTimer) {
              clearInterval(viewport._infoUpdateTimer);
              viewport._infoUpdateTimer = null;
            }
            
            // 清除stack state
            const stackState = this.$cornerstoneTools.getToolState(viewport, 'stack');
            if (stackState && stackState.data) {
              stackState.data = [];
            }
            
            // 清除系列信息标签
            const label = viewport.querySelector('.series-info-label');
            if (label) {
              label.remove();
            }
            
            // 清除覆盖层
            const overlay = viewport.querySelector('.grid-image-info-overlay');
            if (overlay) {
              overlay.remove();
            }
            
            // 禁用Cornerstone
            this.$cornerstone.disable(viewport);
            
            // 清除dataset
            delete viewport.dataset.seriesIndex;
            delete viewport.dataset.imageIndex;
            
            // 清除选中状态
            viewport.classList.remove('selected');
            viewport.style.outline = '';
            viewport.style.border = '';
            viewport.style.boxShadow = '';
            viewport.style.backgroundColor = '';
            viewport.style.zIndex = '';
          } catch (error) {
            // 清空视口失败，静默处理
          }
        });

        // 关键一步：重置网格布局状态
        // 说明：
        // - 清空系列列表后，当前网格布局虽然仍处于“激活”状态，但所有视口已经被禁用且无 stack 状态
        // - 如果不重置，后续通过树形结构新增系列时，selectSeries 会认为网格已激活而跳过初始化逻辑
        //   导致新系列加载不到视口、工具和滚轮事件也无法正确绑定
        // - 这里主动将网格布局标记为未激活，确保下次选择系列时重新执行 1x1 网格初始化流程
        if (this.$store && this.$store.dispatch) {
          await this.$store.dispatch('viewer/deactivateGridLayout');
        }
      } catch (error) {
        // 清空视口失败，静默处理
      }
    },

    /**
     * 关闭应用
     */
    closeApp() {
      ipcRenderer.send('close-window');
    },

    /**
     * 处理关闭播放控制台事件
     */
    handleClosePlaybackConsole() {
      // 直接调用 mixin 中的 closePlaybackConsole 方法
      // 该方法会停止播放并隐藏控制台
      // 注意：由于 mixin 方法会设置 this.showPlaybackConsole = false
      // 我们需要确保组件中有这个属性（已经在 data 中定义）
      this.showPlaybackConsole = false;
      // 停止播放
      this.stopPlayback();
    },

    /**
     * 处理播放控制台上一张
     */
    handlePlaybackPrevious() {
      this.previousImage();
    },

    /**
     * 处理播放控制台下一张
     */
    handlePlaybackNext() {
      this.nextImage();
    },

    /**
     * 处理播放控制台播放/暂停
     */
    handlePlaybackPlayPause() {
      this.togglePlayPause();
    },

    /**
     * 处理播放控制台速度变化
     */
    handlePlaybackSpeedChange(speed) {
      this.$store.dispatch('viewer/setPlaybackSpeed', speed);
      // 如果正在播放，更新播放速度
      const playbackService = require('../../services/PlaybackService').playbackService;
      if (playbackService.isPlaying() || this.isPlaybackPlaying) {
        playbackService.setPlaybackSpeed(speed);
      }
    },





  }
};
</script>

<style lang="scss">
// 全局样式，防止页面滚动
body {
  overflow: hidden;
}

// 网格容器样式（非scoped，适用于动态创建的DOM）
#dicomViewer.grid-active {
  display: grid;
  gap: 4px;
  padding: 4px;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
  border: 1px solid #2a2a2a;
  
  // 隐藏主视图的 canvas（如果存在）
  > canvas {
    display: none !important;
  }
}

// 网格视口通用样式
.grid-viewport {
  background: transparent;
  border: 2px solid #2a2a2a;
  position: relative;
  cursor: inherit; // 继承父容器的 cursor 样式（动态根据工具改变）
  transition: all 0.2s ease;
  box-sizing: border-box;
  outline: none;
  overflow: hidden;
  border-radius: 2px;

  &:hover:not(.selected) {
    border-color: #444;
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
  }

  &.selected {
    border: 3px solid #ff0000 !important;
    box-shadow:
      0 0 0 1px #ff0000,
      0 0 15px rgba(255, 0, 0, 0.8),
      0 0 30px rgba(255, 0, 0, 0.5) !important;
    z-index: 10 !important;
    position: relative;
    animation: gridPulse 2s ease-in-out infinite;
  }

  canvas {
    position: absolute !important;
    top: 0;
    left: 0;
    width: 100% !important;
    height: 100% !important;
    pointer-events: auto;
    z-index: 1;
  }

  .series-info-label {
    z-index: 100 !important;
    position: absolute;
    background-color: rgba(0, 0, 0, 0.85);
    color: #fff;
    padding: 3px 8px;
    font-size: 12px;
    border-radius: 3px;
    pointer-events: none;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  &.selected .series-info-label {
    background-color: rgba(255, 0, 0, 0.9);
    border-color: #ff0000;
    color: #fff;
    font-weight: bold;
  }
  
  // 网格视口信息覆盖层样式
  .grid-image-info-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 999;
    
    .top_info {
      position: absolute;
      
      .top_info_item {
        color: #fff;
        font-size: 13px;
        line-height: 20px;
      }
    }
    
    .top_info1 {
      top: 0px;
      left: 4px;
    }
    
    .top_info2 {
      top: 0px;
      right: 4px;
      text-align: right;
    }
    
    .top_info3 {
      bottom: 15px;
      right: 4px;
      text-align: right;
    }
    
    .top_x {
      position: absolute;
      left: 50%;
      bottom: 0;
      transform: translateX(-50%);
      
      .top_x_lines {
        border-bottom: 1px solid #fff;
        gap: 10px;
        display: flex;
        flex-direction: row;
        align-items: flex-end;
        justify-content: center;
        
        .top_x_line {
          width: 1px;
          height: 4px;
          background-color: #fff;
        }
        
        .top_x_line1 {
          height: 8px;
        }
      }
      
      .top_x_text {
        color: #fff;
        font-size: 13px;
        padding-top: 6px;
        text-align: center;
      }
    }
    
    .top_y {
      position: absolute;
      top: 50%;
      right: 4px;
      transform: translateY(-50%);
      display: flex;
      flex-direction: row;
      align-items: center;
      
      .top_y_lines {
        border-right: 1px solid #fff;
        gap: 10px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        
        .top_y_line {
          width: 4px;
          height: 1px;
          background-color: #fff;
        }
        
        .top_y_line1 {
          width: 8px;
        }
      }
      
      .top_y_text {
        color: #fff;
        font-size: 13px;
        padding-left: 10px;
        text-align: center;
      }
    }
  }
}

@keyframes gridPulse {
  0%, 100% {
    box-shadow:
      0 0 0 1px #ff0000,
      0 0 15px rgba(255, 0, 0, 0.8),
      0 0 30px rgba(255, 0, 0, 0.5),
      inset 0 0 20px rgba(255, 0, 0, 0.15);
  }
  50% {
    box-shadow:
      0 0 0 2px #ff0000,
      0 0 25px rgba(255, 0, 0, 1),
      0 0 50px rgba(255, 0, 0, 0.7),
      inset 0 0 30px rgba(255, 0, 0, 0.25);
  }
}
</style>

<style lang="scss" scoped>
.container_box {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .header_box {
    height: 26px;
    -webkit-app-region: drag;

    .header_title {
      font-size: 14px;
      font-weight: bold;
      padding-left: 20px;
    }

    .header_btns {
      .header_btn {
        -webkit-app-region: no-drag;
        border: none;
        font-size: 18px;
        color: #333;
        font-weight: bold;
        height: 26px;
        width: 26px;
        padding: 0;
      }
    }
  }

  .content_box {
    display: flex;
    align-items: stretch;
    height: calc(100vh - 124px);
    padding: 0 0 0 10px;
    position: relative;
    overflow: hidden;

    .dicom-viewer {
      width: 80%;
      position: relative;
      background-color: #000;
      transition: all 0.3s ease;

      &.grid-view {
        display: grid;
        gap: 2px;
        padding: 2px;
        position: relative;
      }
    }
  }
}

// 系列信息标签样式
.series-info-label {
  position: absolute;
  top: 5px;
  left: 5px;
  background-color: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 2px 6px;
  font-size: 12px;
  border-radius: 3px;
  z-index: 10;
  pointer-events: none;
}

// 加载动画样式
.loading-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  background-color: rgba(0, 0, 0, 0.7) !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  z-index: 99999 !important;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #409EFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

.loading-text {
  font-size: 16px;
  font-weight: 500;
  color: #fff;
}

.series-progress-bar {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: 16px;
  z-index: 9999;
  background-color: rgba(0, 0, 0, 0.8);
  padding: 8px 16px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.series-progress-text {
  color: #fff;
  font-size: 12px;
  margin-bottom: 4px;
}

.custom-progress-container {
  width: 100%;
  height: 6px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.custom-progress-bar {
  height: 100%;
  background-color: #67c23a;
  border-radius: 3px;
  transition: none; /* 无过渡动画，立即更新 */
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

</style>
