/**
 * 工具激活 Mixin
 * 处理Cornerstone工具的激活和图像操作
 */

import { errorHandler } from '../../../services';
import PathUtils from '../../../utils/PathUtils';
const path = require('path');

export default {
  methods: {
    /**
     * 获取当前活动的元素
     * 如果是网格模式，返回选中的视口；否则返回主视口
     */
    getActiveElement() {
      const isGridActive = this.$store.state.viewer.gridViewState.isActive;
      
      if (isGridActive) {
        const selectedIndex = this.$store.state.viewer.gridViewState.selectedViewportIndex;
        if (typeof this.getGridViewportElements === 'function') {
          const viewports = this.getGridViewportElements();
          if (viewports[selectedIndex]) {
            return viewports[selectedIndex];
          }
        }
      }
      
      // 单视图模式或网格模式未找到选中视口时，返回主容器
      return this.$refs.dicomViewer;
    },

    /**
     * 工具栏事件处理 - 基于dashboard的成功模式
     */
    async activateTool({ toolName, actionId }) {
      try {
        // 对于播放控制按钮（actionId 16），允许重复点击，不进行早期返回
        // 因为播放控制需要支持切换对话框显示/隐藏、播放/暂停等状态
        if (actionId !== 16 && this.activeAction === actionId) {
          return;
        }
        
        this.activeAction = actionId;
        // 窗宽窗位按钮（actionId 14）的 active2 由 cwChange 方法控制，不要在这里重置
        if (actionId !== 14) {
          this.active2 = 0;
        }
        
        // 获取当前活动的元素（网格模式下返回选中的视口）
        const activeElement = this.getActiveElement();
        const isGridActive = this.$store.state.viewer.gridViewState.isActive;
        
        // 在网格模式下，确保选中的视口获得焦点
        if (isGridActive && activeElement && activeElement !== this.$refs.dicomViewer) {
          if (activeElement.focus) {
            activeElement.focus();
          }
        }
        
        // 使用全局工具激活（CornerstoneTools 会作用于当前焦点元素）
        const tools = this.$cornerstoneTools;
        
        switch (actionId) {
          case 11: // 缩放
            this.mode = '3';
            tools.setToolActive('Zoom', { mouseButtonMask: 1 });
            break;
          case 12: // 平移
            this.mode = '2';
            tools.setToolActive('Pan', { mouseButtonMask: 1 });
            break;
          case 13: // 像素值
            this.mode = '5';
            tools.setToolActive('Probe', { mouseButtonMask: 1 });
            break;
          case 14: // 窗宽窗位
            this.mode = '4';
            tools.setToolActive('Wwwc', { mouseButtonMask: 1 });
            break;
          case 15: // 定位线
            this.mode = '2';
            tools.setToolActive('Crosshairs', { mouseButtonMask: 1 });
            break;
          case 16: // 单张播放 - 实现影像排列第二个按钮的功能（播放控制）
            this.togglePlayback();
            break;
          case 17: // 点距调整
            this.mode = '1';
            tools.setToolActive('Length', { mouseButtonMask: 1 });
            break;
          case 20: // 选择
            this.mode = '1';
            tools.setToolActive('Pan', { mouseButtonMask: 1 });
            break;
          case 21: // 长度测量
            this.mode = '1';
            tools.setToolActive('Length', { mouseButtonMask: 1 });
            break;
          case 22: // 角度测量
            this.mode = '1';
            tools.setToolActive('Angle', { mouseButtonMask: 1 });
            break;
          case 23: // 面积测量
            this.mode = '1';
            tools.setToolActive('RectangleRoi', { mouseButtonMask: 1 });
            break;
        }
        
        // 更新所有网格视口的鼠标样式
        this.$nextTick(() => {
          this.updateGridViewportCursors();
        });
      } catch (error) {
        errorHandler.handleError(error, 'activateTool');
      }
    },
    
    /**
     * 更新所有网格视口的鼠标样式
     */
    updateGridViewportCursors() {
      try {
        const isGridActive = this.$store && this.$store.state.viewer.gridViewState.isActive;
        if (!isGridActive) {
          return;
        }
        
        const viewports = typeof this.getGridViewportElements === 'function'
          ? this.getGridViewportElements()
          : [];
        
        // 获取当前鼠标样式
        const cursorStyle = this.currentCursor || 'default';
        
        // 更新所有视口和其内部的 canvas 的 cursor
        viewports.forEach(viewport => {
          if (viewport) {
            viewport.style.cursor = cursorStyle;
            // 同时更新 canvas 的 cursor
            const canvas = viewport.querySelector('canvas');
            if (canvas) {
              canvas.style.cursor = cursorStyle;
            }
          }
        });
      } catch (error) {
        // 更新网格视口鼠标样式失败，静默处理
      }
    },

    async resetViewport() {
      try {
        const element = this.getActiveElement();
        
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
      } catch (error) {
        errorHandler.handleError(error, 'resetViewport');
      }
    },

    async rotateImage(degrees = 90) {
      try {
        const element = this.getActiveElement();
        
        const viewport = this.$cornerstone.getViewport(element);
        viewport.rotation = (viewport.rotation + degrees) % 360;
        this.$cornerstone.setViewport(element, viewport);
        this.$cornerstone.updateImage(element);
      } catch (error) {
        errorHandler.handleError(error, 'rotateImage');
      }
    },

    async flipImage(direction) {
      try {
        const element = this.getActiveElement();
        
        const viewport = this.$cornerstone.getViewport(element);
        if (direction === 'horizontal') {
          viewport.hflip = !viewport.hflip;
        } else if (direction === 'vertical') {
          viewport.vflip = !viewport.vflip;
        }
        this.$cornerstone.setViewport(element, viewport);
        this.$cornerstone.updateImage(element);
      } catch (error) {
        errorHandler.handleError(error, 'flipImage');
      }
    },

    async fitToWindow() {
      try {
        const element = this.getActiveElement();
        
        this.$cornerstone.fitToWindow(element);
        this.$cornerstone.updateImage(element);
      } catch (error) {
        errorHandler.handleError(error, 'fitToWindow');
      }
    },

    async invertImage() {
      try {
        const element = this.getActiveElement();
        
        const viewport = this.$cornerstone.getViewport(element);
        viewport.invert = !viewport.invert;
        this.$cornerstone.setViewport(element, viewport);
        this.$cornerstone.updateImage(element);
      } catch (error) {
        errorHandler.handleError(error, 'invertImage');
      }
    },

    async setWindowLevel(index) {
      try {
        const element = this.getActiveElement();
        
        if (this.cwImgs[index]) {
          const preset = this.cwImgs[index];
          const viewport = this.$cornerstone.getViewport(element);
          viewport.voi.windowWidth = preset.ww;
          viewport.voi.windowCenter = preset.wc;
          this.$cornerstone.setViewport(element, viewport);
          this.$cornerstone.updateImage(element);
        }
      } catch (error) {
        errorHandler.handleError(error, 'setWindowLevel');
      }
    },

    async clearMeasurements() {
      try {
        const element = this.getActiveElement();
        
        const toolStateManager = this.$cornerstoneTools.globalImageIdSpecificToolStateManager;
        toolStateManager.restoreToolState({});
        this.$cornerstone.updateImage(element);
      } catch (error) {
        errorHandler.handleError(error, 'clearMeasurements');
      }
    },

    /**
     * 显示图像信息
     */
    showImageInfo() {
      try {
        // 调用ImageInfo组件的show方法，传递当前活动的系列索引
        const activeSeriesIndex = this.$store.state.dicom.activeSeriesIndex || 0;
        this.$refs.imageInfo.show(activeSeriesIndex);
      } catch (error) {
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
      // 更新 active2 状态
      this.active2 = index;
      // 激活工具并设置窗宽窗位
      this.activateTool({ toolName: 'Wwwc', actionId: 14 });
      this.setWindowLevel(index);
    }
  }
};

