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
      @toggle-playback="togglePlayback"
    />

    <!-- 主内容区 -->
    <div class="flex_box content_box">
      <!-- 侧边栏 -->
      <DicomSidebar @select-series="selectSeries" />

      <!-- 图像显示区 -->
      <div 
        ref="dicomViewer" 
        id="dicomViewer" 
        :style="{ cursor: currentCursor }"
        class="dicom-viewer"
        :class="{ 'grid-view': isGridViewActive }"
      >
        <!-- 图像信息覆盖层 -->
        <DicomImageInfo />
      </div>
    </div>

    <!-- 网格布局选择器 -->
    <GridLayoutSelector 
      ref="gridLayoutSelector"
      :show="showGridLayoutSelector"
      @apply-layout="applyGridLayout"
      @close="closeGridLayoutSelector"
    />

    <!-- 播放控制对话框 -->
    <PlaybackControlDialog
      ref="playbackControlDialog"
      :show="showPlaybackDialog"
      :total-frames="currentImageIds.length"
      @start-playback="startPlayback"
      @close="closePlaybackDialog"
    />

    <!-- 图像详细信息对话框 -->
    <ImageInfo ref="imageInfo" />
    
    <!-- 加载动画 -->
    <div v-if="loading || localLoading" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">{{ loadingText }}</div>
      </div>
    </div>
    
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex';
import DicomToolbar from './DicomToolbar.vue';
import DicomSidebar from './DicomSidebar.vue';
import DicomImageInfo from './DicomImageInfo.vue';
import GridLayoutSelector from './GridLayoutSelector.vue';
import PlaybackControlDialog from './PlaybackControlDialog.vue';
import ImageInfo from '../../views/dashboard/components/image-info.vue';
import { cornerstoneService, gridViewService, playbackService, errorHandler } from '../../services';
import PathUtils from '../../utils/PathUtils';
// 移除已删除的工具类引用

const { ipcRenderer } = require('electron');
const { dialog } = require('@electron/remote');

export default {
  name: 'DicomViewer',
  components: {
    DicomToolbar,
    DicomSidebar,
    DicomImageInfo,
    GridLayoutSelector,
    PlaybackControlDialog,
    ImageInfo
  },
  data() {
    return {
      showGridLayoutSelector: false,
      showPlaybackDialog: false,
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
      ]
    };
  },
  computed: {
    ...mapState('dicom', ['loading', 'loadingText', 'error']),
    ...mapState('viewer', ['toolState']),
    ...mapGetters('dicom', ['currentImage', 'currentImageIds']),
    ...mapGetters('viewer', ['isGridViewActive', 'currentGridLayout', 'selectedGridViewport', 'isPlaying', 'playbackSpeed']),
    
    // 鼠标样式计算
    currentCursor() {
      const path = require('path');
      const fullPath = this.getCursorPath(`mouse${this.mode}.png`);
      return `url(${fullPath}) 0 0, auto`;
    },
    
    // 网格状态
    gridState() {
      return gridViewService.getGridState();
    }
  },
  async mounted() {
    this.initializeViewer();
    this.setupKeyboardShortcuts();
    // 等待一个微任务周期，确保Cornerstone初始化完成
    await this.$nextTick();
    // 自动加载DICOM目录
    this.autoLoadDicomDirectory();
  },
  beforeDestroy() {
    this.cleanupViewer();
    document.removeEventListener('keydown', this.handleKeyboardShortcuts);
  },
  methods: {
    ...mapActions('dicom', [
      'loadDicomDirectory', 
      'selectDicomSeries', 
      'selectImage'
    ]),
    ...mapActions('viewer', [
      'activateTool',
      'resetViewport',
      'rotateImage',
      'flipImage',
      'fitToWindow',
      'invertImage',
      'setWindowLevel',
      'clearAllMeasurements',
      'activateGridLayout',
      'deactivateGridLayout',
      'selectGridViewport',
      'loadImageToGrid',
      'startPlayback',
      'stopPlayback',
      'setPlaybackSpeed'
    ]),

    /**
     * 初始化查看器 - 使用改进后的服务类
     */
    initializeViewer() {
      try {
        // console.log('initializeViewer方法被调用');
        // console.log('this.$refs.dicomViewer:', this.$refs.dicomViewer);
        // console.log('初始化DICOM查看器');
        ipcRenderer.send('maximize-window');
        
        // 使用改进后的服务类
        // console.log('准备调用cornerstoneService.enableElement...');
        cornerstoneService.enableElement(this.$refs.dicomViewer);
        // console.log('DICOM查看器初始化完成');
      } catch (error) {
        // console.error('初始化查看器失败', error);
      }
    },

    /**
     * 自动加载DICOM目录
     */
    async autoLoadDicomDirectory() {
      try {
        // 设置超时保护，防止loading状态一直显示
        const timeoutId = setTimeout(() => {
          this.$store.commit('dicom/SET_LOADING', false);
          this.localLoading = false;
        }, 30000); // 30秒超时
        
        const path = require('path');
        const fs = require('fs');
        
        // 加载DICOM目录 - 使用跨平台路径工具
        const dicomPath = PathUtils.findDicomDirectory();
        
        if (dicomPath) {
          try {
            await this.loadDicomDirectory(dicomPath);
            
            // 加载完成后显示第一个系列的影像
            await this.loadFirstImage();
            
            // 最终确保loading状态为false
            this.$store.commit('dicom/SET_LOADING', false);
            this.localLoading = false;
            
            // 清除超时定时器
            clearTimeout(timeoutId);
          } catch (error) {
            // 发生错误时确保loading状态为false
            this.$store.commit('dicom/SET_LOADING', false);
            this.localLoading = false;
            clearTimeout(timeoutId);
          }
        } else {
          // 确保loading状态为false
          this.$store.commit('dicom/SET_LOADING', false);
          this.localLoading = false;
          clearTimeout(timeoutId);
        }
      } catch (error) {
        // 发生错误时确保loading状态为false
        this.$store.commit('dicom/SET_LOADING', false);
        this.localLoading = false;
      }
    },

    /**
     * 清理查看器
     */
    cleanupViewer() {
      try {
        // 清理网格视图
        if (this.isGridViewActive) {
          gridViewService.clearAllViewports(this.$refs.dicomViewer);
          gridViewService.clearGridStyles(this.$refs.dicomViewer);
          gridViewService.deactivateGridLayout();
        }
        
        // 停止播放
        if (playbackService.isPlaying()) {
          playbackService.stopPlayback();
        }
        
        // 清理Cornerstone元素
        cornerstoneService.disableElement(this.$refs.dicomViewer);
        
        // console.log('查看器清理完成');
      } catch (error) {
        // console.error('清理查看器失败', error);
        // console.error('清理查看器失败:', error);
      }
    },

    /**
     * 选择目录或文件
     */
    async selectPath() {
      try {
        const result = await dialog.showOpenDialog({
          properties: ["openDirectory", "openFile"],
          filters: [
            { name: 'DICOM Files', extensions: ['dcm', 'dicom', 'dic', 'ima', ''] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });
        
        if (result.filePaths[0]) {
          const selectedPath = result.filePaths[0];
          const fs = require('fs');
          const path = require('path');
          
          // 检查选择的是文件还是目录
          const stats = fs.statSync(selectedPath);
          if (stats.isFile()) {
            // 选择的是单个文件
            // console.log(`选择单个DICOM文件: ${selectedPath}`);
            await this.loadDicomFile(selectedPath);
          } else {
            // 选择的是目录
            // console.log(`选择DICOM目录: ${selectedPath}`);
            await this.loadDicomDirectory(selectedPath);
          }
          
          await this.loadFirstImage();
        }
      } catch (error) {
        errorHandler.handleError(error, 'selectPath');
      }
    },

    /**
     * 选择单个文件
     */
    async selectFile() {
      try {
        const result = await dialog.showOpenDialog({
          properties: ["openFile"],
          filters: [
            { name: 'DICOM Files', extensions: ['dcm', 'dicom', 'dic', 'ima', ''] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });
        
        if (result.filePaths[0]) {
          // console.log(`选择单个DICOM文件: ${result.filePaths[0]}`);
          await this.loadDicomFile(result.filePaths[0]);
          await this.loadFirstImage();
        }
      } catch (error) {
        errorHandler.handleError(error, 'selectFile');
      }
    },

    /**
     * 选择序列
     */
    async selectSeries(index) {
      try {
        await this.selectDicomSeries(index);
        
        if (this.isGridViewActive) {
          // 在网格模式下，加载到下一个空视口
          const nextEmptyViewport = gridViewService.getNextEmptyViewport();
          if (nextEmptyViewport) {
            const gridState = gridViewService.getGridState();
            const viewportIndex = gridState.viewports.findIndex(vp => vp.id === nextEmptyViewport.id);
            await this.loadCurrentImageToGrid(viewportIndex);
          }
        } else {
          // 在单视图模式下，正常加载
        await this.loadCurrentImage();
        }
      } catch (error) {
        errorHandler.handleError(error, 'selectSeries');
      }
    },

    /**
     * 加载第一张图像
     */
    async loadFirstImage() {
      try {
        // 检查是否有可用的系列
        const seriesCount = this.$store.state.dicom.dicomSeries.length;
        if (seriesCount === 0) {
          // 确保loading状态为false
          this.$store.commit('dicom/SET_LOADING', false);
          this.localLoading = false;
          return;
        }
        
        // 确保第一个系列被选中
        if (this.$store.state.dicom.activeSeriesIndex !== 0) {
          this.$store.commit('dicom/SET_ACTIVE_SERIES', 0);
        }
        
        // 加载当前图像
        await this.loadCurrentImage();
        
        // 确保loading状态为false
        this.$store.commit('dicom/SET_LOADING', false);
        this.localLoading = false;
      } catch (error) {
        // 发生错误时确保loading状态为false
        this.$store.commit('dicom/SET_LOADING', false);
        this.localLoading = false;
      }
    },

    /**
     * 加载当前图像 - 使用改进后的服务类
     */
    async loadCurrentImage() {
      try {
        // console.log('loadCurrentImage被调用');
        
        const currentSeries = this.$store.getters['dicom/currentSeries'];
        // console.log('当前系列:', currentSeries);
        
        if (!currentSeries || !currentSeries.children || currentSeries.children.length === 0) {
          // console.log('没有可用的系列或图像');
          return;
        }

        // 确保图像加载器已注册
        await this.$cornerstoneService.ensureImageLoaderRegistered();
        
        // 递归查找系列中的所有DICOM文件
        const imageIds = [];
        const findDicomFiles = (node) => {
          // console.log(`检查节点: ${node.name}, isFile: ${node.isFile}, 路径: ${node.path}`);
          
          if (node.isFile && node.path) {
            // 检查是否为DICOM文件（包括无扩展名的情况）
            const isDicomFile = node.path.toLowerCase().endsWith('.dcm') || 
                               node.path.toLowerCase().endsWith('.dicom') ||
                               node.path.toLowerCase().endsWith('.dic') ||
                               node.path.toLowerCase().endsWith('.ima') ||
                               // 对于没有扩展名的文件，检查是否在DICOM目录结构中
                               (node.name.match(/^IMG\d+$/) && node.path.includes('SER'));
            
            if (isDicomFile) {
              imageIds.push(`wadouri:${node.path}`);
              // console.log(`找到DICOM文件: ${node.name} -> wadouri:${node.path}`);
            }
          } else if (node.children) {
            node.children.forEach(child => findDicomFiles(child));
          }
        };
        
        findDicomFiles(currentSeries);
        // console.log('生成的imageIds:', imageIds);
        
        if (imageIds.length === 0) {
          // console.log('没有找到DICOM图像文件');
          return;
        }
        
        const element = this.$refs.dicomViewer;
        
        // 创建stack对象，参考dashboard
          const stack = {
            currentImageIdIndex: 0,
            imageIds
          };
          
        // 加载第一个图像
        const firstImageId = imageIds[0];
        // console.log('加载第一个图像:', firstImageId);
        
        const image = await this.$cornerstone.loadImage(firstImageId);
        this.$cornerstone.displayImage(element, image);
        
        // 添加stack状态管理器
        this.$cornerstoneTools.addStackStateManager(element, ['stack']);
        this.$cornerstoneTools.addToolState(element, 'stack', stack);
        
        // 添加滚动工具
        const StackScrollMouseWheelTool = this.$cornerstoneTools.StackScrollMouseWheelTool;
        this.$cornerstoneTools.addTool(StackScrollMouseWheelTool);
        this.$cornerstoneTools.setToolActive('StackScrollMouseWheel', {});
        
        // console.log('图像加载成功');
      } catch (error) {
        // console.error('loadCurrentImage失败:', error);
      }
    },

    /**
     * 工具栏事件处理 - 基于dashboard的成功模式
     */
    async activateTool({ toolName, actionId }) {
      try {
        // console.log('activateTool被调用:', { toolName, actionId });
        
        if (this.activeAction === actionId) {
          return;
        }
        
        this.activeAction = actionId;
        this.active2 = 0;
        
        // 直接使用cornerstoneTools激活工具，就像dashboard一样
        switch (actionId) {
          case 11: // 缩放
            this.mode = '3';
            this.$cornerstoneTools.setToolActive('Zoom', { mouseButtonMask: 1 });
            break;
          case 12: // 平移
            this.mode = '2';
            this.$cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 1 });
            break;
          case 13: // 像素值
            this.mode = '5';
            this.$cornerstoneTools.setToolActive('Probe', { mouseButtonMask: 1 });
            break;
          case 14: // 窗宽窗位
            this.mode = '4';
            this.$cornerstoneTools.setToolActive('Wwwc', { mouseButtonMask: 1 });
            break;
          case 15: // 定位线
            this.mode = '2';
            this.$cornerstoneTools.setToolActive('Crosshairs', { mouseButtonMask: 1 });
            break;
          case 16: // 单张播放 - 实现影像排列第二个按钮的功能（播放控制）
            this.togglePlayback();
            break;
          case 17: // 点距调整
            this.mode = '1';
            this.$cornerstoneTools.setToolActive('Length', { mouseButtonMask: 1 });
            break;
          case 20: // 选择
            this.mode = '1';
            this.$cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 1 });
            break;
          case 21: // 长度测量
            this.mode = '1';
            this.$cornerstoneTools.setToolActive('Length', { mouseButtonMask: 1 });
            break;
          case 22: // 角度测量
            this.mode = '1';
            this.$cornerstoneTools.setToolActive('Angle', { mouseButtonMask: 1 });
            break;
          case 23: // 面积测量
            this.mode = '1';
            this.$cornerstoneTools.setToolActive('RectangleRoi', { mouseButtonMask: 1 });
            break;
          default:
            // console.log('未知的工具ID:', actionId);
        }
      } catch (error) {
        // console.error('activateTool失败:', error);
        errorHandler.handleError(error, 'activateTool');
      }
    },

    async resetViewport() {
      try {
        // console.log('resetViewport被调用');
        const element = this.$refs.dicomViewer;
        
        // 基于dashboard的成功模式
        const viewport = this.$cornerstone.getViewport(element);
        
        // 重置窗宽窗位
        viewport.voi.windowWidth = 400;
        viewport.voi.windowCenter = 50;
        
        // 重置缩放和平移
        viewport.scale = 1;
        viewport.translation.x = 0;
        viewport.translation.y = 0;
        
        this.$cornerstone.setViewport(element, viewport);
        
        // 清除所有标注数据
        const toolStateManager = this.$cornerstoneTools.globalImageIdSpecificToolStateManager;
        toolStateManager.restoreToolState({});
        
        // 刷新视图
        this.$cornerstone.updateImage(element);
        
        // console.log('视口重置完成');
      } catch (error) {
        // console.error('resetViewport失败:', error);
        errorHandler.handleError(error, 'resetViewport');
      }
    },

    async rotateImage(degrees = 90) {
      try {
        // console.log('rotateImage被调用:', degrees);
        const element = this.$refs.dicomViewer;
        
        const viewport = this.$cornerstone.getViewport(element);
        viewport.rotation = (viewport.rotation + degrees) % 360;
        this.$cornerstone.setViewport(element, viewport);
        this.$cornerstone.updateImage(element);
        
        // console.log('图像旋转完成');
      } catch (error) {
        // console.error('rotateImage失败:', error);
        errorHandler.handleError(error, 'rotateImage');
      }
    },

    async flipImage(direction) {
      try {
        // console.log('flipImage被调用:', direction);
        const element = this.$refs.dicomViewer;
        
        const viewport = this.$cornerstone.getViewport(element);
        if (direction === 'horizontal') {
          viewport.hflip = !viewport.hflip;
        } else if (direction === 'vertical') {
          viewport.vflip = !viewport.vflip;
        }
        this.$cornerstone.setViewport(element, viewport);
        this.$cornerstone.updateImage(element);
        
        // console.log('图像翻转完成');
      } catch (error) {
        // console.error('flipImage失败:', error);
        errorHandler.handleError(error, 'flipImage');
      }
    },

    async fitToWindow() {
      try {
        // console.log('fitToWindow被调用');
        const element = this.$refs.dicomViewer;
        
        this.$cornerstone.fitToWindow(element);
        this.$cornerstone.updateImage(element);
        
        // console.log('适应窗口完成');
      } catch (error) {
        // console.error('fitToWindow失败:', error);
        errorHandler.handleError(error, 'fitToWindow');
      }
    },

    async invertImage() {
      try {
        // console.log('invertImage被调用');
        const element = this.$refs.dicomViewer;
        
        const viewport = this.$cornerstone.getViewport(element);
        viewport.invert = !viewport.invert;
        this.$cornerstone.setViewport(element, viewport);
        this.$cornerstone.updateImage(element);
        
        // console.log('图像反转完成');
      } catch (error) {
        // console.error('invertImage失败:', error);
        errorHandler.handleError(error, 'invertImage');
      }
    },

    async setWindowLevel(index) {
      try {
        // console.log('setWindowLevel被调用:', index);
        const element = this.$refs.dicomViewer;
        
        if (this.cwImgs[index]) {
          const preset = this.cwImgs[index];
          const viewport = this.$cornerstone.getViewport(element);
          viewport.voi.windowWidth = preset.ww;
          viewport.voi.windowCenter = preset.wc;
          this.$cornerstone.setViewport(element, viewport);
          this.$cornerstone.updateImage(element);
          // console.log('窗宽窗位设置完成:', preset);
        }
      } catch (error) {
        // console.error('setWindowLevel失败:', error);
        errorHandler.handleError(error, 'setWindowLevel');
      }
    },

    async clearMeasurements() {
      try {
        // console.log('clearMeasurements被调用');
        const element = this.$refs.dicomViewer;
        
        const toolStateManager = this.$cornerstoneTools.globalImageIdSpecificToolStateManager;
        toolStateManager.restoreToolState({});
        this.$cornerstone.updateImage(element);
        
        // console.log('测量清除完成');
      } catch (error) {
        // console.error('clearMeasurements失败:', error);
        errorHandler.handleError(error, 'clearMeasurements');
      }
    },

    /**
     * 显示图像信息
     */
    showImageInfo() {
      // console.log('showImageInfo被调用');
      try {
        // 调用ImageInfo组件的show方法，传递当前活动的系列索引
        const activeSeriesIndex = this.$store.state.dicom.activeSeriesIndex || 0;
        this.$refs.imageInfo.show(activeSeriesIndex);
        // console.log('图像信息对话框已打开');
      } catch (error) {
        // console.error('显示图像信息失败:', error);
        this.$message.error('显示图像信息失败');
      }
    },

    /**
     * 获取鼠标光标路径
     */
    getCursorPath(filename) {
      if (process.env.NODE_ENV === 'development') {
        return 'static/cursors/' + filename;
      } else {
        // 使用跨平台路径工具
        return PathUtils.getResourcePath(path.join('cursors', filename));
      }
    },

    /**
     * 窗宽窗位切换
     */
    cwChange(index) {
      this.active2 = index;
      this.cwShow = false;
      this.activateTool({ toolName: 'Wwwc', actionId: 14 });
      this.setWindowLevel(index);
    },

    /**
     * 关闭应用
     */
    closeApp() {
      ipcRenderer.send('close-window');
    },

    /**
     * 切换网格布局
     */
    async toggleGridLayout() {
      if (this.isGridViewActive) {
        await this.deactivateGridLayout();
        this.closeGridLayoutSelector();
      } else {
        this.showGridLayoutSelector = true;
      }
    },

    /**
     * 应用网格布局
     */
    async applyGridLayout(layout) {
      try {
        await this.activateGridLayout(layout);
        await this.initializeGridView();
        this.closeGridLayoutSelector();
      } catch (error) {
        errorHandler.handleError(error, 'applyGridLayout');
      }
    },

    /**
     * 关闭网格布局
     */
    async deactivateGridLayout() {
      try {
        const element = this.$refs.dicomViewer;
        
        // 清理网格视图
        gridViewService.clearAllViewports(element);
        gridViewService.clearGridStyles(element);
        gridViewService.deactivateGridLayout();
        
        // 更新状态
        await this.$store.dispatch('viewer/deactivateGridLayout');
        
        // 重新加载当前图像到单视图模式
        await this.loadCurrentImage();
        
        // console.log('网格布局已关闭');
      } catch (error) {
        errorHandler.handleError(error, 'deactivateGridLayout');
      }
    },

    /**
     * 关闭网格布局选择器
     */
    closeGridLayoutSelector() {
      this.showGridLayoutSelector = false;
    },

    /**
     * 初始化网格视图
     */
    async initializeGridView() {
      try {
        const element = this.$refs.dicomViewer;
        const layout = this.$store.state.viewer.gridViewState.layout;
        
        // console.log('初始化网格视图，布局:', layout);
        // console.log('可用系列数量:', this.$store.state.dicom.dicomSeries.length);
        
        // 应用网格样式
        this.applyGridStyles(element, layout);
        
        // 加载多个系列到网格中
        await this.loadMultipleSeriesToGrid(layout);
        
        // console.log('网格视图初始化完成');
      } catch (error) {
        errorHandler.handleError(error, 'initializeGridView');
      }
    },

    /**
     * 应用网格样式
     */
    applyGridStyles(element, layout) {
      const { rows, cols } = layout;
      
      // 设置网格容器样式
      element.style.display = 'grid';
      element.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      element.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
      element.style.gap = '2px';
      element.style.padding = '2px';
      element.style.backgroundColor = '#000';
      
      // 创建网格视口
      this.createGridViewports(rows, cols);
    },

    /**
     * 创建网格视口
     */
    createGridViewports(rows, cols) {
      const element = this.$refs.dicomViewer;
      
      // 清除现有的视口
      element.innerHTML = '';
      
      // 创建网格视口
      for (let i = 0; i < rows * cols; i++) {
        const viewport = document.createElement('div');
        viewport.className = 'grid-viewport';
        viewport.style.backgroundColor = '#222';
        viewport.style.border = '1px solid #444';
        viewport.style.position = 'relative';
        viewport.style.cursor = 'pointer';
        
        // 添加视口索引
        viewport.dataset.viewportIndex = i;
        
        // 添加点击事件
        viewport.addEventListener('click', () => {
          this.selectGridViewport(i);
        });
        
        element.appendChild(viewport);
      }
    },

    /**
     * 加载多个系列到网格
     */
    async loadMultipleSeriesToGrid(layout) {
      try {
        const { rows, cols } = layout;
        const totalSlots = rows * cols;
        const availableSeries = this.$store.state.dicom.dicomSeries;
        
        // console.log(`加载 ${Math.min(totalSlots, availableSeries.length)} 个系列到网格`);
        
        // 为每个视口加载对应的系列
        for (let i = 0; i < Math.min(totalSlots, availableSeries.length); i++) {
          const series = availableSeries[i];
          const viewport = this.$refs.dicomViewer.children[i];
          
          if (viewport && series && series.children.length > 0) {
            // 获取系列的第一张图像
            const firstImage = series.children[0];
            const imageId = `wadouri:${firstImage.path}`;
            
            // console.log(`加载系列 ${i} 到视口 ${i}:`, series.name);
            
            // 启用Cornerstone元素
            this.$cornerstone.enable(viewport);
            
            // 加载图像
            try {
              const image = await this.$cornerstone.loadImage(imageId);
              this.$cornerstone.displayImage(viewport, image);
              
              // 添加系列信息标签
              this.addSeriesInfoLabel(viewport, series, i);
              
            } catch (error) {
              // console.error(`加载系列 ${i} 失败:`, error);
            }
          }
        }
        
        // 默认选择第一个视口
        if (totalSlots > 0) {
          this.selectGridViewport(0);
        }
        
      } catch (error) {
        // console.error('加载多个系列到网格失败:', error);
      }
    },

    /**
     * 添加系列信息标签
     */
    addSeriesInfoLabel(viewport, series, index) {
      const label = document.createElement('div');
      label.className = 'series-info-label';
      label.style.position = 'absolute';
      label.style.top = '5px';
      label.style.left = '5px';
      label.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      label.style.color = '#fff';
      label.style.padding = '2px 6px';
      label.style.fontSize = '12px';
      label.style.borderRadius = '3px';
      label.style.zIndex = '10';
      label.textContent = `S${index + 1}: ${series.name}`;
      
      viewport.appendChild(label);
    },

    /**
     * 选择网格视口
     */
    selectGridViewport(viewportIndex) {
      // 清除所有视口的选中状态
      const viewports = this.$refs.dicomViewer.children;
      for (let i = 0; i < viewports.length; i++) {
        viewports[i].classList.remove('selected');
      }
      
      // 选中当前视口
      if (viewports[viewportIndex]) {
        viewports[viewportIndex].classList.add('selected');
        
        // 更新选中的系列
        const availableSeries = this.$store.state.dicom.dicomSeries;
        if (viewportIndex < availableSeries.length) {
          this.$store.dispatch('dicom/selectDicomSeries', viewportIndex);
          // console.log(`选中视口 ${viewportIndex}，对应系列: ${availableSeries[viewportIndex].name}`);
        }
      }
    },

    /**
     * 加载当前图像到网格
     */
    async loadCurrentImageToGrid(viewportIndex = 0) {
      try {
        if (this.currentImageIds.length > 0) {
          const element = this.$refs.dicomViewer;
          await gridViewService.loadImageToViewport(
            viewportIndex,
            this.currentImageIds[0],
            element,
            this.$store.state.dicom.activeSeriesIndex,
            0
          );
          await this.selectGridViewport(viewportIndex);
        }
      } catch (error) {
        errorHandler.handleError(error, 'loadCurrentImageToGrid');
      }
    },

    /**
     * 切换播放控制
     */
    togglePlayback() {
      if (playbackService.isPlaying()) {
        // 如果正在播放，则暂停
        playbackService.pausePlayback();
        this.$store.dispatch('viewer/stopPlayback');
      } else if (this.$store.state.viewer.playbackControl.isPlaying) {
        // 如果已暂停，则恢复播放
        playbackService.resumePlayback(this.$refs.dicomViewer, this.currentImageIds);
        this.$store.dispatch('viewer/startPlayback');
      } else {
        // 如果未播放，则显示播放设置对话框
        this.showPlaybackDialog = true;
      }
    },

    /**
     * 开始播放
     */
    async startPlayback(playbackOptions) {
      try {
        const element = this.$refs.dicomViewer;
        playbackService.setPlaybackSpeed(playbackOptions.speed);
        playbackService.setPlaybackDirection(playbackOptions.direction);
        
        // 开始播放
        playbackService.startPlayback(element, this.currentImageIds, {
          speed: playbackOptions.speed,
          direction: playbackOptions.direction,
          startFrame: playbackOptions.startFrame,
          endFrame: playbackOptions.endFrame,
          loop: playbackOptions.loop
        });

        await this.$store.dispatch('viewer/startPlayback'); // 更新状态
        this.closePlaybackDialog();
      } catch (error) {
        errorHandler.handleError(error, 'startPlayback');
      }
    },

    /**
     * 关闭播放控制对话框
     */
    closePlaybackDialog() {
      this.showPlaybackDialog = false;
    },

    /**
     * 停止播放
     */
    async stopPlayback() {
      try {
        playbackService.stopPlayback();
        await this.$store.dispatch('viewer/stopPlayback'); // 更新状态
      } catch (error) {
        errorHandler.handleError(error, 'stopPlayback');
      }
    },

    /**
     * 设置键盘快捷键
     */
    setupKeyboardShortcuts() {
      document.addEventListener('keydown', this.handleKeyboardShortcuts);
    },

    /**
     * 处理键盘快捷键
     */
    handleKeyboardShortcuts(event) {
      // 如果焦点在输入框中，不处理快捷键
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          this.togglePlayback();
          break;
        case 'KeyG':
          event.preventDefault();
          this.toggleGridLayout();
          break;
        case 'KeyR':
          event.preventDefault();
          this.resetViewport();
          break;
        case 'Escape':
          event.preventDefault();
          this.closeGridLayoutSelector();
          this.closePlaybackDialog();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          this.previousImage();
          break;
        case 'ArrowRight':
          event.preventDefault();
          this.nextImage();
          break;
      }
    },

    /**
     * 下一张图像
     */
    async nextImage() {
      try {
        await this.$store.dispatch('dicom/nextImage');
        await this.loadCurrentImage();
      } catch (error) {
        errorHandler.handleError(error, 'nextImage');
      }
    },

    /**
     * 上一张图像
     */
    async previousImage() {
      try {
        await this.$store.dispatch('dicom/previousImage');
        await this.loadCurrentImage();
      } catch (error) {
        errorHandler.handleError(error, 'previousImage');
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

// 网格视口样式
.grid-viewport {
  background-color: #222;
  border: 1px solid #444;
  position: relative;
  cursor: pointer;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: #666;
  }

  &.selected {
    border: 2px solid #00C325;
    box-shadow: 0 0 10px rgba(0, 195, 37, 0.5);
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

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
