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
      // 统一使用网格视口系统（1x1网格）
      // 确保网格视图已激活
      if (!this.isGridViewActive) {
        const layout = { rows: 1, cols: 1, totalSlots: 1 };
        this.$store.dispatch('viewer/activateGridLayout', layout).then(() => {
          if (typeof this.initializeGridView === 'function') {
            this.initializeGridView();
          }
        });
      }
      
      // 获取选中的视口
      const selectedIndex = this.$store.state.viewer.gridViewState?.selectedViewportIndex || 0;
      if (typeof this.getGridViewportElements === 'function') {
        const viewports = this.getGridViewportElements();
        if (viewports[selectedIndex]) {
          return viewports[selectedIndex];
        }
        // 如果视口列表为空，返回第一个视口（如果存在）
        if (viewports.length > 0) {
          return viewports[0];
        }
      }
      
      // 如果视口不存在，返回 null（调用者需要处理）
      return null;
    },

    /**
     * 工具栏事件处理 - 基于dashboard的成功模式
     */
    async activateTool({ toolName, actionId }) {
      try {
        // 对于播放控制按钮（actionId 16）和点距调整（actionId 17），允许重复点击（用于开关/切换）
        // 其他工具如果已激活则直接返回，避免重复执行
        if (actionId !== 16 && actionId !== 17 && this.activeAction === actionId) {
          return;
        }
        
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
            this.activeAction = actionId;
            this.mode = '3';
            tools.setToolActive('Zoom', { mouseButtonMask: 1 });
            break;
          case 12: // 平移
            this.activeAction = actionId;
            this.mode = '2';
            tools.setToolActive('Pan', { mouseButtonMask: 1 });
            break;
          case 13: // 像素值
            this.activeAction = actionId;
            this.mode = '5';
            tools.setToolActive('Probe', { mouseButtonMask: 1 });
            break;
          case 14: // 窗宽窗位
            this.activeAction = actionId;
            this.mode = '4';
            tools.setToolActive('Wwwc', { mouseButtonMask: 1 });
            break;
          case 15: // 定位线
            this.activeAction = actionId;
            this.mode = '2';
            tools.setToolActive('Crosshairs', { mouseButtonMask: 1 });
            break;
          case 16: // 单张播放 - 实现影像排列第二个按钮的功能（播放控制）
            this.activeAction = actionId;
            this.togglePlayback();
            break;
          case 17: // 点距调整
            // 点击同一个按钮用于开启/关闭点距校准模式
            if (this._calibrationActive) {
              this.finishPixelCalibration(false);
            } else {
              this.startPixelCalibration();
            }
            break;
          case 20: // 选择
            this.activeAction = actionId;
            this.mode = '1';
            tools.setToolActive('Pan', { mouseButtonMask: 1 });
            break;
          case 21: // 长度测量
            this.activeAction = actionId;
            this.mode = '1';
            tools.setToolActive('Length', { mouseButtonMask: 1 });
            break;
          case 22: // 角度测量
            this.activeAction = actionId;
            this.mode = '1';
            tools.setToolActive('Angle', { mouseButtonMask: 1 });
            break;
          case 23: // 面积测量
            this.activeAction = actionId;
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
    },

    /**
     * 开始点距校准模式
     */
    startPixelCalibration() {
      try {
        const tools = this.$cornerstoneTools;
        const element = this.getActiveElement();
        if (!element || !tools) {
          this.$message && this.$message.error('无法进入点距调整模式：未找到有效视口');
          return;
        }

        // 标记进入校准模式
        this._calibrationActive = true;
        this.activeAction = 17;
        this.mode = '1';

        // 激活长度工具
        tools.setToolActive('Length', { mouseButtonMask: 1 });

        // 清理之前遗留的长度测量，避免干扰
        try {
          const state = tools.getToolState(element, 'Length');
          if (state && Array.isArray(state.data)) {
            state.data = [];
            this.$cornerstone.updateImage(element);
          }
        } catch (e) {
          // 静默忽略
        }

        // 为当前视口绑定一次性的 mouseup 事件，用于捕获校准线段
        const handler = async () => {
          try {
            await this.handlePixelCalibrationMeasurement(element);
          } finally {
            // 无论成功与否都不再保留 DOM 事件处理器
            if (element && handler) {
              element.removeEventListener('mouseup', handler);
            }
          }
        };
        element.addEventListener('mouseup', handler, { once: true });
        this._calibrationElement = element;
      } catch (error) {
        this._calibrationActive = false;
        errorHandler.handleError(error, 'startPixelCalibration');
      }
    },

    /**
     * 处理一次点距校准测量（在用户画完一条长度线后调用）
     */
    async handlePixelCalibrationMeasurement(element) {
      try {
        const tools = this.$cornerstoneTools;
        const cornerstone = this.$cornerstone;
        if (!tools || !cornerstone || !element) {
          this.finishPixelCalibration(false);
          return;
        }

        // 等待一个渲染周期，确保 Length 测量写入 toolState
        await this.$nextTick();

        const state = tools.getToolState(element, 'Length');
        if (!state || !Array.isArray(state.data) || state.data.length === 0) {
          // 用户可能没有真正画线，直接退出校准模式
          this.finishPixelCalibration(false);
          return;
        }

        const measurement = state.data[state.data.length - 1];
        const handles = measurement && measurement.handles;
        if (!handles || !handles.start || !handles.end) {
          this.finishPixelCalibration(false);
          return;
        }

        const dx = handles.end.x - handles.start.x;
        const dy = handles.end.y - handles.start.y;
        const pixelDistance = Math.sqrt(dx * dx + dy * dy);
        if (!pixelDistance || !isFinite(pixelDistance) || pixelDistance <= 0) {
          this.finishPixelCalibration(false);
          return;
        }

        // 如果 Cornerstone 已经根据 Pixel Spacing 计算过长度，则优先使用现有毫米值展示给用户
        let measuredMm = null;
        if (typeof measurement.length === 'number' && isFinite(measurement.length)) {
          measuredMm = measurement.length;
        } else if (measurement.cachedStats && typeof measurement.cachedStats.length === 'number') {
          measuredMm = measurement.cachedStats.length;
        }

        // 如果没有现成的毫米值，就用像素距离近似展示
        if (!measuredMm || !isFinite(measuredMm) || measuredMm <= 0) {
          measuredMm = pixelDistance;
        }

        const measuredDisplay = measuredMm.toFixed(2);

        // 使用 ElementUI 的 prompt 弹出校准对话框
        // 将本次测量结果传递给校准对话框，由用户输入真实长度后再应用
        this.calibrationPixelDistance = pixelDistance;
        this.calibrationMeasuredLength = measuredMm.toFixed(2);
        this.calibrationRealLength = this.calibrationMeasuredLength;
        this.calibrationDialogVisible = true;
      } catch (error) {
        errorHandler.handleError(error, 'handlePixelCalibrationMeasurement');
        this.finishPixelCalibration(false);
      }
    },

    /**
     * 结束点距校准模式
     * @param {boolean} applied 是否已成功应用校准
     */
    finishPixelCalibration(applied) {
      try {
        const tools = this.$cornerstoneTools;
        const cornerstone = this.$cornerstone;
        const element = this._calibrationElement || this.getActiveElement();

        // 清除本次校准产生的最后一条长度测量线，避免干扰普通测量
        if (tools && element) {
          try {
            const state = tools.getToolState(element, 'Length');
            if (state && Array.isArray(state.data) && state.data.length > 0) {
              state.data.pop();
              cornerstone && cornerstone.updateImage && cornerstone.updateImage(element);
            }
          } catch (e) {
            // 静默忽略
          }
        }

        // 恢复默认工具（窗宽窗位），并清除点距按钮高亮
        if (tools) {
          tools.setToolActive('Wwwc', { mouseButtonMask: 1 });
        }
        this.mode = '4';
        this.activeAction = 14;

        // 清理内部状态
        this._calibrationActive = false;
        this._calibrationElement = null;
        this.calibrationDialogVisible = false;
        this.calibrationMeasuredLength = '';
        this.calibrationRealLength = '';
        this.calibrationPixelDistance = 0;
      } catch (error) {
        // 校准结束出错不影响主流程
      }
    },

    /**
     * 校准对话框：确认应用点距校准
     */
    confirmPixelCalibration() {
      try {
        const pixelDistance = this.calibrationPixelDistance;
        const rawInput = String(this.calibrationRealLength || '').trim();

        // 基本格式校验：必须是数字
        if (!rawInput || !/^[-+]?(\d+(\.\d+)?|\.\d+)$/.test(rawInput)) {
          this.$message && this.$message.error('请输入大于 0 的数字（单位 mm）');
          return; // 仅提示，不退出对话框
        }

        let realLength = parseFloat(rawInput);
        const measuredDisplay = parseFloat(String(this.calibrationMeasuredLength || '').trim());
        if (!pixelDistance || !isFinite(pixelDistance) || pixelDistance <= 0 ||
            !realLength || !isFinite(realLength) || realLength <= 0 ||
            !measuredDisplay || !isFinite(measuredDisplay) || measuredDisplay <= 0) {
          this.$message && this.$message.error('真实长度无效，点距调整已取消');
          this.finishPixelCalibration(false);
          return;
        }
        
        // 计算新的像素间距：采用“等比例”方式：
        // newSpacing = baseSpacing * (realLength / measuredDisplay)
        // 其中 baseSpacing 为当前系列正在使用的像素间距（优先：已校准值 -> DICOM PixelSpacing/ImagerPixelSpacing -> 当前 image spacing -> 1）
        const seriesIndex = this.$store.state.dicom.activeSeriesIndex || 0;
        const series = this.$store.state.dicom.dicomSeries[seriesIndex];

        let baseSpacing = null;
        // 1) 已有的校准点距
        if (series && series.calibratedPixelSpacing && isFinite(series.calibratedPixelSpacing.col) && series.calibratedPixelSpacing.col > 0) {
          baseSpacing = series.calibratedPixelSpacing.col;
        }

        // 2) DICOM 标签中的 Pixel Spacing / Imager Pixel Spacing（与 imageSize 的初始来源保持一致）
        if (!baseSpacing) {
          try {
            const dicomDictArr = this.$store.state.dicom.dicomDict[seriesIndex] || [];
            const findTag = (tag) => {
              const item = Array.isArray(dicomDictArr) ? dicomDictArr.find(t => t.tag === tag) : null;
              return item ? item.value : '';
            };
            let colSpacing = null;
            const pixelSpacingTag = findTag('00280030');
            if (pixelSpacingTag) {
              const parts = String(pixelSpacingTag).split(/\\|,/).map(v => parseFloat(v));
              if (parts.length >= 2 && !isNaN(parts[1])) {
                colSpacing = parts[1];
              } else if (parts.length === 1 && !isNaN(parts[0])) {
                colSpacing = parts[0];
              }
            }
            if (!colSpacing || !isFinite(colSpacing) || colSpacing <= 0) {
              const imagerPixelSpacingTag = findTag('00181164');
              if (imagerPixelSpacingTag) {
                const parts = String(imagerPixelSpacingTag).split(/\\|,/).map(v => parseFloat(v));
                if (parts.length >= 2 && !isNaN(parts[1])) {
                  colSpacing = parts[1];
                } else if (parts.length === 1 && !isNaN(parts[0])) {
                  colSpacing = parts[0];
                }
              }
            }
            if (colSpacing && isFinite(colSpacing) && colSpacing > 0) {
              baseSpacing = colSpacing;
            }
          } catch (e) {
            // 忽略 DICOM 解析错误
          }
        }

        // 3) 当前 Cornerstone image 上的 spacing
        let cornerstone, element, enabledElement, image;
        try {
          cornerstone = this.$cornerstone;
          element = this._calibrationElement || this.getActiveElement();
          enabledElement = cornerstone && element ? cornerstone.getEnabledElement(element) : null;
          image = enabledElement && enabledElement.image;
          if (!baseSpacing && image) {
            const imgSpacing = image.columnPixelSpacing || image.rowPixelSpacing;
            if (imgSpacing && isFinite(imgSpacing) && imgSpacing > 0) {
              baseSpacing = imgSpacing;
            }
          }
        } catch (e) {
          // 忽略获取 image 失败
        }

        // 4) 全部获取失败时，退化为 1mm/px
        if (!baseSpacing || !isFinite(baseSpacing) || baseSpacing <= 0) {
          baseSpacing = 1;
        }

        const scaleFactor = realLength / measuredDisplay;
        const spacingMmPerPixel = baseSpacing * scaleFactor;

        // 更新当前系列的像素间距（覆盖 Pixel Spacing），供后续标尺和测量使用
        if (series) {
          series.calibratedPixelSpacing = {
            row: spacingMmPerPixel,
            col: spacingMmPerPixel,
            source: 'Calibration'
          };
        }

        // 同步更新当前 Cornerstone image 的 spacing，确保测量工具立即使用新的点距
        try {
          const localCornerstone = this.$cornerstone || cornerstone;
          const localElement = this._calibrationElement || this.getActiveElement() || element;
          const localEnabledElement = localCornerstone && localElement ? localCornerstone.getEnabledElement(localElement) : null;
          const localImage = localEnabledElement && localEnabledElement.image;
          if (localImage) {
            localImage.rowPixelSpacing = spacingMmPerPixel;
            localImage.columnPixelSpacing = spacingMmPerPixel;
            localCornerstone.updateImage(localElement);
          }

          // 重新渲染所有视口的覆盖层（包括 imageSize 和标尺），使用新的校准 spacing
          if (typeof this.getGridViewportElements === 'function' &&
              typeof this.renderImageInfoToOverlay === 'function') {
            const viewports = this.getGridViewportElements() || [];
            viewports.forEach(vp => {
              const overlay = vp.querySelector('.grid-image-info-overlay');
              if (overlay) {
                this.renderImageInfoToOverlay(overlay, vp);
              }
            });
          }
        } catch (e) {
          // spacing 更新失败不终止校准
        }

        this.$message && this.$message.success('点距调整已应用');
        this.finishPixelCalibration(true);
      } catch (error) {
        errorHandler.handleError(error, 'confirmPixelCalibration');
        this.finishPixelCalibration(false);
      }
    },

    /**
     * 校准对话框：取消点距校准
     */
    cancelPixelCalibration() {
      this.finishPixelCalibration(false);
    }
  }
};

