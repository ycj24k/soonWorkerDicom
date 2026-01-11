/**
 * 网格布局 Mixin
 * 处理网格视图的布局和管理
 */

import { gridViewService, errorHandler } from '../../../services';
import { buildImageId } from '../../../utils/DicomUtils';

export default {
  methods: {
    /**
     * 确保 StackScrollMouseWheel 工具已注册（工具已在 main.js 中全局注册，此方法仅作备用）
     */
    ensureStackScrollMouseWheelTool() {
      // StackScrollMouseWheel 工具已在 main.js 中全局注册
      // 该工具不需要全局激活，会在元素启用时自动工作
      // 如果确实需要激活，可以在这里调用 setToolActive，但通常不需要
      return true;
    },
    /**
     * 切换网格布局
     * 点击直接显示选择器，让用户选择想要的宫格布局
     */
    toggleGridLayout() {
      // 直接显示选择器，让用户选择想要的布局
      this.showGridLayoutSelector = true;
    },

    /**
     * 应用网格布局
     */
    async applyGridLayout(layout) {
      try {
        const element = this.$refs.dicomViewer;

        // 在切换布局前，保存当前选中的视口对应的系列索引
        let currentSeriesIndex = this.$store.state.dicom.activeSeriesIndex;
        if (this.isGridViewActive) {
          const selectedViewportIndex = this.$store.state.viewer.gridViewState.selectedViewportIndex;
          const viewports = this.getGridViewportElements();
          if (viewports.length > 0 && viewports[selectedViewportIndex]) {
            const selectedViewport = viewports[selectedViewportIndex];
            if (selectedViewport.dataset.seriesIndex !== undefined) {
              const seriesIndex = parseInt(selectedViewport.dataset.seriesIndex, 10);
              if (!isNaN(seriesIndex)) {
                currentSeriesIndex = seriesIndex;
              }
            }
          }
        }

        // 禁用主视图的 Cornerstone 元素（避免遮挡网格视口）
        try {
          this.$cornerstone.disable(element);
        } catch (error) {
          // 忽略错误，可能已经禁用
        }

        // 更新当前选中的系列索引
        await this.$store.dispatch('dicom/selectDicomSeries', currentSeriesIndex);

        await this.activateGridLayout(layout);
        await this.initializeGridView();
        this.closeGridLayoutSelector();
      } catch (error) {
        errorHandler.handleError(error, 'applyGridLayout');
      }
    },

    /**
     * 清除所有视口的选中状态
     */
    clearAllViewportSelections() {
      const viewports = this.getGridViewportElements();
      viewports.forEach(viewport => {
        viewport.classList.remove('selected');
        viewport.style.outline = '';
        viewport.style.border = '';
        viewport.style.boxShadow = 'none';
        viewport.style.backgroundColor = '';
        viewport.style.zIndex = '';
        const label = viewport.querySelector('.series-info-label');
        if (label) {
          label.classList.remove('selected');
        }
      });
    },

    /**
     * 关闭网格布局（已废弃，统一使用网格系统）
     * 保留此方法以防其他地方调用，但实际功能已由 toggleGridLayout 处理
     */
    async deactivateGridLayout() {
      // 不再清除网格，而是切换回1x1
      await this.applyGridLayout({ rows: 1, cols: 1, totalSlots: 1 });
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
        if (!element) {
          return;
        }

        const layout = this.$store.state.viewer.gridViewState.layout;
        await this.applyGridStyles(element, layout);
        await this.$nextTick();

        const viewports = this.getGridViewportElements();
        if (viewports.length === 0) {
          this.createGridViewports(layout.rows, layout.cols);
          await this.$nextTick();
        }

        // 加载多个系列到网格中
        await this.loadMultipleSeriesToGrid(layout);
      } catch (error) {
        errorHandler.handleError(error, 'initializeGridView');
      }
    },

    /**
     * 应用网格样式
     */
    async applyGridStyles(element, layout) {
      const { rows, cols } = layout;

      // 设置网格容器样式（行列由布局决定，其余由全局CSS控制）
      element.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      element.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

      // 创建网格视口
      this.createGridViewports(rows, cols);

      // 等待 DOM 更新完成
      await this.$nextTick();

      // 为容器添加事件委托（处理所有视口的点击）
      this.setupGridViewportEvents(element);
    },

    /**
     * 设置网格视口事件（使用事件委托）
     */
    setupGridViewportEvents(container) {
      // 移除旧的事件监听器（如果存在）
      if (this._gridClickHandler) {
        container.removeEventListener('mousedown', this._gridClickHandler, true);
      }
      if (this._gridWheelHandler) {
        container.removeEventListener('wheel', this._gridWheelHandler, true);
      }

      // 创建新的事件处理器
      this._gridClickHandler = (e) => {
        // 查找被点击的视口
        let target = e.target;
        let viewport = null;

        // 向上查找，直到找到 .grid-viewport 或到达容器
        while (target && target !== container) {
          if (target.classList && target.classList.contains('grid-viewport')) {
            viewport = target;
            break;
          }
          target = target.parentElement;
        }

        if (viewport && viewport.dataset.viewportIndex !== undefined) {
          const viewportIndex = parseInt(viewport.dataset.viewportIndex, 10);
          this.selectGridViewport(viewportIndex);
        }
      };

      // 添加事件监听器（使用捕获阶段，确保在 canvas 事件之前）
      container.addEventListener('mousedown', this._gridClickHandler, true);

      // 绑定鼠标滚轮事件：直接根据 stack 手动切换图像，绕过工具可能的兼容性问题
      this._gridWheelHandler = (e) => {
        try {
          let target = e.target;
          let viewport = null;

          // 向上查找，直到找到 .grid-viewport 或到达容器
          while (target && target !== container) {
            if (target.classList && target.classList.contains('grid-viewport')) {
              viewport = target;
              break;
            }
            target = target.parentElement;
          }

          if (!viewport) {
            return;
          }

          // 阻止默认滚动，避免整个页面滚动
          if (e.cancelable) {
            e.preventDefault();
          }

          const tools = this.$cornerstoneTools;
          const cornerstone = this.$cornerstone;
          if (!tools || !cornerstone) {
            return;
          }

          const stackState = tools.getToolState(viewport, 'stack');
          if (!stackState || !stackState.data || stackState.data.length === 0) {
            return;
          }

          const stack = stackState.data[0];
          let imageIds = Array.isArray(stack.imageIds) ? stack.imageIds : [];
          let currentIndex = typeof stack.currentImageIdIndex === 'number'
            ? stack.currentImageIdIndex
            : 0;

          // 关键修复：如果 stack 的 imageIds 数量少于 series.children 的数量，自动更新 stack
          const seriesIndex = parseInt(viewport.dataset.seriesIndex, 10);
          if (!isNaN(seriesIndex)) {
            const dicomSeries = this.$store.state.dicom.dicomSeries;
            const currentSeries = dicomSeries && dicomSeries[seriesIndex];
            if (currentSeries && Array.isArray(currentSeries.children)) {
              const childrenLength = currentSeries.children.length;
              if (childrenLength > imageIds.length) {
                // 重新构建 imageIds
                const { buildImageId } = require('../../../utils/DicomUtils');
                const newImageIds = currentSeries.children
                  .map(img => buildImageId(img))
                  .filter(id => id !== null);
                if (newImageIds.length > imageIds.length) {
                  const oldLength = imageIds.length;
                  // 更新 stack
                  stack.imageIds = newImageIds;
                  // 确保当前索引在有效范围内
                  if (currentIndex >= newImageIds.length) {
                    currentIndex = newImageIds.length - 1;
                    stack.currentImageIdIndex = currentIndex;
                  }
                  // 更新 tool state
                  tools.addToolState(viewport, 'stack', stack);
                  imageIds = newImageIds;
                }
              }
            }
          }


          if (imageIds.length <= 1) {
            return; // 只有一张图时滚轮无意义
          }

          const delta = e.deltaY || e.wheelDelta || 0;
          if (!delta) {
            return;
          }

          const step = delta > 0 ? 1 : -1;
          let newIndex = currentIndex + step;
          if (newIndex < 0) newIndex = 0;
          if (newIndex >= imageIds.length) newIndex = imageIds.length - 1;
          if (newIndex === currentIndex) {
            return;
          }

          // 优先使用 cornerstoneTools 自带的 stack 滚动方法（更稳定）
          if (typeof tools.stackScroll === 'function') {
            tools.stackScroll(viewport, step);
            return;
          }

          // 兜底方案：手动切换当前索引并加载新图像
          const imageId = imageIds[newIndex];
          if (!imageId) {
            return;
          }

          stack.currentImageIdIndex = newIndex;


          cornerstone.loadImage(imageId).then(image => {
            try {
              cornerstone.displayImage(viewport, image);
            } catch (err) {
              // 显示失败，静默处理
            }
          }).catch((err) => {
            // 加载失败，静默处理
          });
        } catch (error) {
          // 滚轮切换异常，静默处理
        }
      };

      // 使用捕获阶段 + 非被动监听器：
      // - 捕获阶段可以在 Cornerstone 工具处理前先拿到事件
      // - 非被动才能调用 preventDefault 阻止页面滚动
      container.addEventListener('wheel', this._gridWheelHandler, { capture: true, passive: false });
    },

    /**
     * 获取当前所有网格视口元素（过滤掉非视口子节点）
     */
    getGridViewportElements() {
      const container = this.$refs.dicomViewer;
      if (!container) {
        return [];
      }
      return Array.from(container.querySelectorAll('.grid-viewport'));
    },

    /**
     * 创建网格视口
     */
    createGridViewports(rows, cols) {
      const element = this.$refs.dicomViewer;
      if (!element) {
        return;
      }

      // 清除现有的视口，但保留其它由 Vue 渲染的节点
      const existingViewports = this.getGridViewportElements();
      existingViewports.forEach(viewport => {
        try {
          // 清除信息更新定时器
          if (viewport._infoUpdateTimer) {
            clearInterval(viewport._infoUpdateTimer);
            viewport._infoUpdateTimer = null;
          }
          this.$cornerstone.disable(viewport);
        } catch (error) {
          // 禁用网格视口失败，静默处理
        }
        viewport.remove();
      });

      // 创建网格视口
      for (let i = 0; i < rows * cols; i++) {
        const viewport = document.createElement('div');
        viewport.className = 'grid-viewport';
        // 背景色已在CSS中设置为透明，不需要在这里设置
        viewport.style.position = 'relative';
        // cursor 样式由父容器继承，不在这里硬编码
        // 不在这里设置 border，使用 CSS 类和 outline 来避免被 canvas 遮挡

        // 添加视口索引
        viewport.dataset.viewportIndex = i;

        // 添加 tabindex 使其可以获得焦点（重要！）
        viewport.setAttribute('tabindex', '0');

        // 不在这里添加 click 事件，因为 canvas 会覆盖
        // 改为使用 mousedown 事件（在 canvas 上也能触发）

        element.appendChild(viewport);
      }

      // 创建视口后，应用当前鼠标样式
      this.$nextTick(() => {
        if (typeof this.updateGridViewportCursors === 'function') {
          this.updateGridViewportCursors();
        }
      });
    },

    /**
     * 加载多个系列到网格
     */
    async loadMultipleSeriesToGrid(layout) {
      try {
        const { rows, cols } = layout;
        const totalSlots = rows * cols;

        // 获取当前活动的系列
        const activeSeriesIndex = this.$store.state.dicom.activeSeriesIndex;
        const availableSeries = this.$store.state.dicom.dicomSeries;
        const currentSeries = availableSeries[activeSeriesIndex];

        const viewports = this.getGridViewportElements();

        // 初始化所有视口（启用 Cornerstone 和工具）
        for (let i = 0; i < totalSlots; i++) {
          const viewport = viewports[i];
          if (viewport) {
            // 启用 Cornerstone 元素
            this.$cornerstone.enable(viewport);

            // 为视口添加 stack state manager
            this.$cornerstoneTools.addStackStateManager(viewport, ['stack']);

            // 为每个视口注册所有可能用到的工具（不激活）
            const tools = this.$cornerstoneTools;
            // 临时禁用警告，避免重复添加工具的警告
            const originalWarn = console.warn;
            console.warn = function () { }; // 临时禁用警告
            try {
              tools.addToolForElement(viewport, tools.WwwcTool);
              tools.addToolForElement(viewport, tools.PanTool);
              tools.addToolForElement(viewport, tools.ZoomTool);
              tools.addToolForElement(viewport, tools.LengthTool);
              tools.addToolForElement(viewport, tools.AngleTool);
              tools.addToolForElement(viewport, tools.ProbeTool);
              tools.addToolForElement(viewport, tools.RectangleRoiTool);

              // 添加滚轮切换工具（重要！）
              if (tools.StackScrollMouseWheelTool) {
                tools.addToolForElement(viewport, tools.StackScrollMouseWheelTool);
                // 激活滚轮切换工具（不占用鼠标按钮）
                tools.setToolActiveForElement(viewport, 'StackScrollMouseWheel', {});
              }
            } catch (error) {
              // 为网格视口注册工具失败，静默处理
            } finally {
              console.warn = originalWarn; // 恢复警告
            }

            // 不在这里单独绑定事件，使用容器级别的事件委托（在 applyGridStyles 中已设置）

            // 监听图像渲染事件，用于同步外部 UI (如播放控制台)
            // 使用 cornerstoneimagerendered 可能太频繁，cornerstonenewimage 是切换图片的事件
            viewport.addEventListener('cornerstonenewimage', (e) => {
              try {
                // 如果正在播放中，这由 playbackMixin 负责更新状态，这里不再重复处理，避免冲突
                const isPlaying = this.$store.getters['viewer/isPlaying'] || false;
                if (isPlaying) return;

                // 如果当前视口是选中状态，或者是唯一的视口，则同步全局状态
                const isSelected = viewport.classList.contains('selected');
                const viewports = this.getGridViewportElements();
                const isSingle = viewports.length === 1;

                if (isSelected || isSingle) {
                  const tools = this.$cornerstoneTools;
                  const stackState = tools.getToolState(viewport, 'stack');
                  if (stackState && stackState.data && stackState.data.length > 0) {
                    const stack = stackState.data[0];
                    const newImageIdIndex = stack.currentImageIdIndex;

                    // 获取 seriesIndex
                    const seriesIndex = parseInt(viewport.dataset.seriesIndex, 10);
                    const activeSeriesIndex = this.$store.state.dicom.activeSeriesIndex;

                    // 只有当操作的是当前活动系列的视口时，才更新全局 activeImageIndex
                    if (seriesIndex === activeSeriesIndex && typeof newImageIdIndex === 'number') {
                      // 将 stack index 映射回全局 children index
                      // 这里的 stack.imageIds 通常对应 series.children (除非经过过滤)
                      // 简单起见，假设一一对应。如果涉及到多帧组合，可能需要更复杂的映射

                      // 使用防抖，避免滚轮高速滚动时频繁 commit vuex 导致卡顿
                      if (this._syncImageIndexTimer) clearTimeout(this._syncImageIndexTimer);
                      this._syncImageIndexTimer = setTimeout(() => {
                        this.$store.commit('dicom/SET_ACTIVE_IMAGE', newImageIdIndex);

                        // 强制更新视口信息 (Image No)，确保与播放状态同步
                        if (typeof this.updateViewportInfo === 'function') {
                          const overlay = viewport.querySelector('.grid-image-info-overlay');
                          if (overlay) {
                            this.updateViewportInfo(overlay, viewport);
                          }
                        }

                        this._syncImageIndexTimer = null;
                      }, 50);
                    }
                  }
                }
              } catch (err) {
                // console.warn('Sync failed', err);
              }
            });
          }
        }

        // 所有视口初始化完成后，激活默认工具（窗宽窗位）
        try {
          this.$cornerstoneTools.setToolActive('Wwwc', { mouseButtonMask: 1 });
        } catch (error) {
          // 激活默认工具失败，静默处理
        }

        // 使用统一的系列加载逻辑初始化当前活动系列到第一个视口
        if (currentSeries && currentSeries.children && currentSeries.children.length > 0 && totalSlots > 0) {
          try {
            if (typeof this.loadSeriesToGridViewport === 'function') {
              await this.loadSeriesToGridViewport(activeSeriesIndex, 0);
            }
          } catch (error) {
            // 初始化失败，静默处理
          }
        }

        // 默认选择第一个视口
        if (totalSlots > 0) {
          this.selectGridViewport(0);
        }
      } catch (error) {
        // 加载失败，忽略
      }
    },

    /**
     * 添加系列信息标签和信息覆盖层
     */
    addSeriesInfoLabel(viewport, series, index) {
      // 先移除旧标签（如果存在）
      const oldLabel = viewport.querySelector('.series-info-label');
      if (oldLabel) {
        oldLabel.remove();
      }

      // 确保 seriesIndex 已设置
      viewport.dataset.seriesIndex = index;

      // 系列标签已不需要，因为信息覆盖层会显示完整的系列信息
      // 直接为每个网格视口添加信息覆盖层容器
      this.addImageInfoOverlay(viewport);
    },

    /**
     * 为网格视口添加信息覆盖层（完全复制主视图的样式，无背景遮罩）
     */
    addImageInfoOverlay(viewport) {
      // 先移除旧覆盖层（如果存在）
      const oldOverlay = viewport.querySelector('.grid-image-info-overlay');
      if (oldOverlay) {
        oldOverlay.remove();
      }

      // 创建信息覆盖层容器
      const overlay = document.createElement('div');
      overlay.className = 'grid-image-info-overlay';
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 999;
      `;

      viewport.appendChild(overlay);

      // 延迟渲染信息内容，确保数据已准备好
      setTimeout(() => {
        this.renderImageInfoToOverlay(overlay, viewport);
      }, 100);
    },

    /**
     * 渲染图像信息到覆盖层
     */
    renderImageInfoToOverlay(overlay, viewport) {
      // 获取当前视口对应的系列信息
      const seriesIndex = parseInt(viewport.dataset.seriesIndex, 10);
      if (isNaN(seriesIndex)) {
        return;
      }

      const series = this.$store.state.dicom.dicomSeries[seriesIndex];
      if (!series || !series.children || series.children.length === 0) {
        return;
      }

      // 从 Vuex store 获取 DICOM 字典数据
      const dicomDict = this.$store.state.dicom.dicomDict[seriesIndex];
      if (!Array.isArray(dicomDict) || dicomDict.length === 0) {
        return;
      }

      // 获取 DICOM 标签值
      const getDicomValue = (tag) => {
        const element = dicomDict.find(item => item.tag === tag);
        return element ? element.value : '';
      };

      // 格式化 DICOM 日期：YYYYMMDD -> YYYY/MM/DD
      const formatDicomDate = (value) => {
        if (!value || typeof value !== 'string') {
          return value || '';
        }
        const trimmed = value.trim();
        // 已经包含分隔符时直接返回
        if (/[\/\-\.]/.test(trimmed)) {
          return trimmed;
        }
        const digits = trimmed.replace(/[^\d]/g, '');
        if (digits.length === 8) {
          const y = digits.slice(0, 4);
          const m = digits.slice(4, 6);
          const d = digits.slice(6, 8);
          return `${y}/${m}/${d}`;
        }
        return trimmed;
      };

      // 格式化 DICOM 时间：HHMMSS(.ffff) -> HH:MM:SS[.ffff]
      const formatDicomTime = (value) => {
        if (!value || typeof value !== 'string') {
          return value || '';
        }
        const trimmed = value.trim();
        // 已经包含冒号时认为已格式化
        if (/:/.test(trimmed)) {
          return trimmed;
        }
        // 保留原始小数部分：将前6位作为 HHMMSS，剩余部分（包括小数点）原样附加
        const main = trimmed.replace(/[^\d.]/g, '');
        const fullMatch = main.match(/^(\d{2})(\d{2})(\d{2})(.*)$/);
        if (fullMatch) {
          const hh = fullMatch[1];
          const mm = fullMatch[2];
          const ss = fullMatch[3];
          const suffix = fullMatch[4] || ''; // 可能是 .ffff 或更长，原样保留
          return `${hh}:${mm}:${ss}${suffix}`;
        }
        // 只有 HHMM 的情况
        const mmMatch = main.match(/^(\d{2})(\d{2})$/);
        if (mmMatch) {
          return `${mmMatch[1]}:${mmMatch[2]}`;
        }
        return trimmed;
      };

      const patientName = getDicomValue('00100010') || '';
      const patientAge = getDicomValue('00101010') || '';
      const patientSex = getDicomValue('00100040') || '';
      const patientBirthDate = formatDicomDate(getDicomValue('00100030') || '');
      const patientID = getDicomValue('00100020') || '';
      const accessionNumber = getDicomValue('00080050') || '';

      const studyDate = formatDicomDate(getDicomValue('00080020') || '');
      const studyTime = formatDicomTime(getDicomValue('00080030') || '');
      const institution = getDicomValue('00080080') || '';
      const studyDesc = getDicomValue('00081030') || '';
      const seriesNo = getDicomValue('00200011') || '';
      const acqTime = formatDicomTime(getDicomValue('00080032') || '');

      const model = getDicomValue('00081090') || '';
      const stationName = getDicomValue('00081010') || '';
      const manufacturer = getDicomValue('00080070') || '';

      // 获取视口的窗宽窗位和缩放级别（从 Cornerstone viewport）
      let windowWidth = 400;
      let windowCenter = 50;
      let zoomLevel = 100;
      try {
        const viewportState = this.$cornerstone.getViewport(viewport);
        if (viewportState) {
          windowWidth = viewportState.voi?.windowWidth || 400;
          windowCenter = viewportState.voi?.windowCenter || 50;
          zoomLevel = Math.round((viewportState.scale || 1) * 100);
        }
      } catch (error) {
        // 忽略错误，使用默认值
      }

      // 获取图像尺寸（从 DICOM 标签，初始估算），并缓存基础物理宽度，后续在 updateViewportInfo 中结合缩放更新
      // 默认使用 11cm，保持原项目行为，在无法从 DICOM 获取 Pixel Spacing / Imager Pixel Spacing 时不会出现空白
      let imageSize = '11cm'; // 显示在右下角的水平视野长度（单位 cm）
      let baseWidthMm = null; // 图像原始物理宽度（未考虑缩放，单位 mm）
      try {
        const colsTag = getDicomValue('00280011'); // Columns
        const cols = colsTag ? parseInt(colsTag, 10) : null;

        let colSpacing = null;

        // 1) 优先使用 Pixel Spacing (0028,0030)
        const pixelSpacingTag = getDicomValue('00280030'); // Pixel Spacing: row\col
        if (pixelSpacingTag) {
          const parts = String(pixelSpacingTag).split(/\\|,/).map(v => parseFloat(v));
          if (parts.length >= 2 && !isNaN(parts[1])) {
            colSpacing = parts[1];
          } else if (parts.length === 1 && !isNaN(parts[0])) {
            colSpacing = parts[0];
          }
        }

        // 2) 如果 Pixel Spacing 缺失，再尝试使用 Imager Pixel Spacing (0018,1164)
        if (!colSpacing || !isFinite(colSpacing) || colSpacing <= 0) {
          const imagerPixelSpacingTag = getDicomValue('00181164'); // Imager Pixel Spacing: row\col
          if (imagerPixelSpacingTag) {
            const parts = String(imagerPixelSpacingTag).split(/\\|,/).map(v => parseFloat(v));
            if (parts.length >= 2 && !isNaN(parts[1])) {
              colSpacing = parts[1];
            } else if (parts.length === 1 && !isNaN(parts[0])) {
              colSpacing = parts[0];
            }
          }
        }

        // 优先使用列方向的 FOV 作为水平标尺
        if (cols) {
          // 1) 若系列存在校准后的像素间距，优先使用
          const calibrated = series && series.calibratedPixelSpacing && series.calibratedPixelSpacing.col;
          const effectiveSpacing = calibrated && isFinite(calibrated) && calibrated > 0
            ? calibrated
            : (colSpacing && isFinite(colSpacing) && colSpacing > 0 ? colSpacing : null);

          if (effectiveSpacing) {
            baseWidthMm = cols * effectiveSpacing; // 图像原始物理宽度（未考虑缩放）
            const widthCm = baseWidthMm / 10;
            // 只显示到 1 位小数，避免抖动太大
            // 如果计算出的值非常小（例如 < 1cm），也显示为 11cm 避免异常，或者按实际显示
            if (widthCm > 0.1) {
              imageSize = `${widthCm.toFixed(1)}cm`;
            }
          }
        }
      } catch (e) {
        // 标签缺失或解析失败时保持默认值（11cm），由后续 updateViewportInfo 使用实际图像数据更新（如有）
      }

      // 获取当前图像索引的优先级：
      // 1. 优先使用 Cornerstone stack state（反映实际显示的图像，滚动时实时更新）
      // 2. 只有在 stack state 不可用时，才尝试使用 Vuex 的 activeImageIndex
      let currentImageIndex = 0;
      try {
        const stackState = this.$cornerstoneTools.getToolState(viewport, 'stack');
        if (stackState && stackState.data && stackState.data.length > 0) {
          // 这是当前视口实际渲染的图片索引
          currentImageIndex = stackState.data[0].currentImageIdIndex || 0;
        } else {
          // 兜底：如果视口没有 stack state（罕见），且是活动系列，则用 Vuex
          const seriesIndexForInit = parseInt(viewport.dataset.seriesIndex, 10);
          const activeSeriesIndex = this.$store.state.dicom.activeSeriesIndex;
          if (!isNaN(seriesIndexForInit) && seriesIndexForInit === activeSeriesIndex) {
            currentImageIndex = this.$store.state.dicom.activeImageIndex || 0;
          }
        }
      } catch (error) {
        // 忽略错误，使用默认值
      }

      // 计算影像文件序号（而非帧序号）
      // 对于普通影像：1 个文件 = 1 帧，文件序号 = 帧索引 + 1
      // 对于动态影像：1 个文件 = 多帧，需要找到当前帧所属的文件，显示文件序号
      let imageNo = currentImageIndex + 1; // 默认值
      try {
        const seriesIndexForImageNo = parseInt(viewport.dataset.seriesIndex, 10);
        if (!isNaN(seriesIndexForImageNo)) {
          const dicomSeries = this.$store.state.dicom.dicomSeries || [];
          const currentSeries = dicomSeries[seriesIndexForImageNo];
          if (currentSeries) {
            // 选取用于计算的节点源：优先使用 _allImageNodes，兜底使用 children
            let sourceNodes = [];
            if (Array.isArray(currentSeries._allImageNodes) && currentSeries._allImageNodes.length > 0) {
              sourceNodes = currentSeries._allImageNodes;
            } else if (Array.isArray(currentSeries.children) && currentSeries.children.length > 0) {
              sourceNodes = currentSeries.children;
            }

            if (sourceNodes.length > 0) {
              // 所有真正的「影像文件」节点（排除帧节点）
              const imageFiles = sourceNodes.filter(child => child && child.isFile && !child.isFrame);
              if (imageFiles.length > 0) {
                // 当前视口对应的节点（优先从 children 取，其次从 sourceNodes 取）
                let currentNode = null;
                if (Array.isArray(currentSeries.children) && currentSeries.children[currentImageIndex]) {
                  currentNode = currentSeries.children[currentImageIndex];
                } else if (sourceNodes[currentImageIndex]) {
                  currentNode = sourceNodes[currentImageIndex];
                }

                const getNodePath = (node) => {
                  if (!node) return null;
                  const p = node.fullPath || node.path || '';
                  return p ? p.replace(/\\/g, '/').toLowerCase() : null;
                };

                let currentFileIndex = -1;
                if (currentNode) {
                  if (currentNode.isFrame && currentNode.parentCineImage) {
                    // 当前是帧：使用父动态影像文件来计算序号
                    const parentPath = getNodePath(currentNode.parentCineImage);
                    if (parentPath) {
                      currentFileIndex = imageFiles.findIndex(img => getNodePath(img) === parentPath);
                    }
                  } else if (currentNode.isFile && !currentNode.isFrame) {
                    // 当前就是普通影像文件
                    const currentPath = getNodePath(currentNode);
                    if (currentPath) {
                      currentFileIndex = imageFiles.findIndex(img => getNodePath(img) === currentPath);
                    }
                  }
                }

                if (currentFileIndex >= 0) {
                  imageNo = currentFileIndex + 1;
                }
              }
            }
          }
        }
      } catch (e) {
        // 影像序号计算失败时，退回到帧索引序号
      }

      // 视口上方显示「当前影像文件」的序号，而不是帧序号
      const imageNoDisplay = `${imageNo}`;

      // 创建方向指示数据（适当增加刻度数量，使标尺更长但仍居中，不与顶部患者信息重叠）
      const xData = Array.from({ length: 42 }, (_, i) => i);
      const yData = Array.from({ length: 30 }, (_, i) => i);

      // 创建完整的信息显示
      overlay.innerHTML = `
        <!-- 患者信息 (左上) -->
        <div class="top_info top_info1">
          <div class="top_info_item" style="margin-bottom: 20px;">${patientName}</div>
          <div class="top_info_item">(${patientAge}/${patientSex})</div>
          <div class="top_info_item">${patientBirthDate}</div>
          <div class="top_info_item">${patientID}</div>
          <div class="top_info_item">${accessionNumber}</div>
        </div>

        <!-- 检查信息 (右上) -->
        <div class="top_info top_info2">
          <div class="top_info_item">Study Date : ${studyDate}</div>
          <div class="top_info_item">Study Time : ${studyTime}</div>
          <div class="top_info_item">${institution}</div>
          <div class="top_info_item">${studyDesc}</div>
          <div class="top_info_item">Series No : ${seriesNo}</div>
          <div class="top_info_item image-no-item">Image No : ${imageNoDisplay}</div>
          <div class="top_info_item">Acq Time : ${acqTime}</div>
        </div>

        <!-- 技术参数 (右下) -->
        <div class="top_info top_info3">
          <div class="top_info_item image-size-item">${imageSize}</div>
          <div class="top_info_item zoom-level-item">${zoomLevel}%</div>
          <div class="top_info_item">${model}</div>
          <div class="top_info_item">${stationName}</div>
          <div class="top_info_item">${manufacturer}</div>
          <div class="top_info_item" style="margin-top: 20px;">
            W= <span class="window-width-value">${windowWidth}</span> L= <span class="window-center-value">${windowCenter}</span>
          </div>
        </div>

        <!-- 方向指示 X (底部中间，水平刻度线) -->
        <div class="top_x">
          <div class="flex_box flex_col_bottom top_x_lines">
            ${xData.map((_, index) => `
              <div class="top_x_line ${index % 5 === 0 ? 'top_x_line1' : ''}"></div>
            `).join('')}
          </div>
          <div class="top_x_text">P</div>
        </div>

        <!-- 方向指示 Y (右侧中间，垂直刻度线) -->
        <div class="top_y">
          <div class="flex_box flex_col flex_col_bottom top_y_lines">
            ${yData.map((_, index) => `
              <div class="top_y_line ${index % 5 === 0 ? 'top_y_line1' : ''}"></div>
            `).join('')}
          </div>
          <div class="top_y_text">L</div>
        </div>
      `;

      // 将基础物理宽度缓存到 overlay 上，供 updateViewportInfo 轻量级使用
      if (baseWidthMm && isFinite(baseWidthMm) && baseWidthMm > 0) {
        overlay.dataset.baseWidthMm = String(baseWidthMm);
      } else {
        delete overlay.dataset.baseWidthMm;
      }

      // 立即更新一次
      this.updateViewportInfo(overlay, viewport);

      // 使用 Cornerstone 事件监听，图像改变时自动更新（替代定时器）
      const updateHandler = () => {
        this.updateViewportInfo(overlay, viewport);
      };

      // 保存事件处理器引用，便于清理
      viewport._infoUpdateHandler = updateHandler;

      // 监听 Cornerstone 的图像渲染事件
      viewport.addEventListener('cornerstoneimagerendered', updateHandler);
      viewport.addEventListener('cornerstonenewimage', updateHandler)
    },

    /**
     * 更新视口信息（实时更新窗宽窗位、缩放级别和图像编号）
     * @param {HTMLElement} overlay - 覆盖层元素
     * @param {HTMLElement} viewport - 视口元素
     * @param {number|null} forceIndex - 强制使用的图像索引（用于播放时）
     */
    updateViewportInfo(overlay, viewport, forceIndex = null) {
      try {
        const viewportState = this.$cornerstone.getViewport(viewport);
        if (!viewportState) {
          return;
        }

        const windowWidth = viewportState.voi?.windowWidth || 400;
        const windowCenter = viewportState.voi?.windowCenter || 50;
        const zoomLevel = Math.round((viewportState.scale || 1) * 100);
        const scale = viewportState.scale || 1;

        // 获取当前图像索引
        let currentImageIndex = 0;
        if (typeof forceIndex === 'number') {
          currentImageIndex = forceIndex;
        } else {
          // 尝试从 Stack State 获取
          try {
            // 获取当前图像索引
            // 1. 优先使用 Cornerstone stack state
            const stackState = this.$cornerstoneTools.getToolState(viewport, 'stack');
            if (stackState && stackState.data && stackState.data.length > 0) {
              currentImageIndex = stackState.data[0].currentImageIdIndex || 0;
            } else {
              const seriesIndexForInit = parseInt(viewport.dataset.seriesIndex, 10);
              const activeSeriesIndex = this.$store.state.dicom.activeSeriesIndex;
              if (!isNaN(seriesIndexForInit) && seriesIndexForInit === activeSeriesIndex) {
                currentImageIndex = this.$store.state.dicom.activeImageIndex || 0;
              }
            }
          } catch (error) {
            // 忽略错误
          }
        }

        // 计算影像文件序号（而非帧序号）
        let imageNo = currentImageIndex + 1; // 默认值
        try {
          const seriesIndexForImageNo = parseInt(viewport.dataset.seriesIndex, 10);
          if (!isNaN(seriesIndexForImageNo)) {
            const dicomSeries = this.$store.state.dicom.dicomSeries || [];
            const currentSeries = dicomSeries[seriesIndexForImageNo];
            if (currentSeries) {
              // 选取用于计算的节点源：优先使用 _allImageNodes，兜底使用 children
              let sourceNodes = [];
              if (Array.isArray(currentSeries._allImageNodes) && currentSeries._allImageNodes.length > 0) {
                sourceNodes = currentSeries._allImageNodes;
              } else if (Array.isArray(currentSeries.children) && currentSeries.children.length > 0) {
                sourceNodes = currentSeries.children;
              }

              if (sourceNodes.length > 0) {
                // 所有真正的「影像文件」节点（排除帧节点）
                const imageFiles = sourceNodes.filter(child => child && child.isFile && !child.isFrame);
                if (imageFiles.length > 0) {
                  // 当前视口对应的节点（优先从 children 取，其次从 sourceNodes 取）
                  let currentNode = null;
                  if (Array.isArray(currentSeries.children) && currentSeries.children[currentImageIndex]) {
                    currentNode = currentSeries.children[currentImageIndex];
                  } else if (sourceNodes[currentImageIndex]) {
                    currentNode = sourceNodes[currentImageIndex];
                  }

                  const getNodePath = (node) => {
                    if (!node) return null;
                    const p = node.fullPath || node.path || '';
                    return p ? p.replace(/\\/g, '/').toLowerCase() : null;
                  };

                  let currentFileIndex = -1;
                  const isDynamicSeries = this.$store.state.dicom.isDynamicSeries;

                  if (currentNode) {
                    // 如果是动态影像系列，或者显式要求显示帧序号，则忽略文件映射
                    if (isDynamicSeries && currentNode.isFrame) {
                      // 动态影像：直接使用帧索引作为ImageNo，保持与播放栏同步
                      imageNo = currentImageIndex + 1;
                      currentFileIndex = -2; // 标记为已处理
                    } else if (currentNode.isFrame && currentNode.parentCineImage) {
                      // 当前是帧：使用父动态影像文件来计算序号
                      const parentPath = getNodePath(currentNode.parentCineImage);
                      if (parentPath) {
                        currentFileIndex = imageFiles.findIndex(img => getNodePath(img) === parentPath);
                      }
                    } else if (currentNode.isFile && !currentNode.isFrame) {
                      // 当前就是普通影像文件
                      const currentPath = getNodePath(currentNode);
                      if (currentPath) {
                        currentFileIndex = imageFiles.findIndex(img => getNodePath(img) === currentPath);
                      }
                    }
                  }

                  if (currentFileIndex >= 0) {
                    imageNo = currentFileIndex + 1;
                  }
                }
              }
            }
          }
        } catch (e) {
          // 影像序号计算失败时，退回到帧索引序号
        }

        // 视口上方显示「当前影像文件」的序号，而不是帧序号
        const imageNoDisplay = `${imageNo}`;

        // 计算当前视口实际可见的物理视野大小（根据基础物理宽度 + 缩放）
        try {
          let baseWidthMmStr = overlay.dataset.baseWidthMm;
          let baseWidthMm = baseWidthMmStr ? parseFloat(baseWidthMmStr) : null;

          // 如果还没有缓存基础物理宽度，则尝试从 Cornerstone / series 信息 中轻量级推导一次并缓存
          if ((!baseWidthMm || !isFinite(baseWidthMm) || baseWidthMm <= 0) && this.$cornerstone) {
            try {
              const enabledElement = this.$cornerstone.getEnabledElement(viewport);
              const image = enabledElement && enabledElement.image;
              if (image) {
                const cols = image.columns || image.width || 0;
                let spacing = null;

                // 1) 优先使用 Cornerstone image 对象上的像素间距
                if (image.columnPixelSpacing && isFinite(image.columnPixelSpacing) && image.columnPixelSpacing > 0) {
                  spacing = Number(image.columnPixelSpacing);
                } else if (image.rowPixelSpacing && isFinite(image.rowPixelSpacing) && image.rowPixelSpacing > 0) {
                  spacing = Number(image.rowPixelSpacing);
                }

                // 2) 如果 image 上没有，尝试从 Cornerstone 元数据中获取（适用于多帧 / 动态影像）
                if ((!spacing || !isFinite(spacing) || spacing <= 0) && this.$cornerstone.metaData) {
                  try {
                    const stackState = this.$cornerstoneTools.getToolState(viewport, 'stack');
                    const stack = stackState && stackState.data && stackState.data[0];
                    const imageIds = stack && Array.isArray(stack.imageIds) ? stack.imageIds : null;
                    const currentIndex = stack && typeof stack.currentImageIdIndex === 'number'
                      ? stack.currentImageIdIndex
                      : 0;
                    const imageId = imageIds && imageIds[currentIndex] ? imageIds[currentIndex] : null;
                    if (imageId) {
                      const imagePlane = this.$cornerstone.metaData.get('imagePlaneModule', imageId);
                      if (imagePlane && Array.isArray(imagePlane.pixelSpacing)) {
                        const spacingArray = imagePlane.pixelSpacing
                          .map(v => parseFloat(v))
                          .filter(v => isFinite(v) && v > 0);
                        // pixelSpacing: [rowSpacing, colSpacing]
                        if (spacingArray.length >= 2) {
                          spacing = spacingArray[1];
                        } else if (spacingArray.length === 1) {
                          spacing = spacingArray[0];
                        }
                      }
                    }
                  } catch (metaError) {
                    // 元数据获取失败时忽略，保持 spacing 为空
                  }
                }

                // 3) 如果依然没有 spacing，尝试使用系列级的校准/动态影像像素间距
                try {
                  const seriesIndex = parseInt(viewport.dataset.seriesIndex, 10);
                  if (!isNaN(seriesIndex)) {
                    const series = this.$store.state.dicom.dicomSeries[seriesIndex];
                    if (series) {
                      // 3.1 校准后的像素间距优先
                      if (!spacing && series.calibratedPixelSpacing) {
                        const cps = series.calibratedPixelSpacing;
                        if (cps.col && isFinite(cps.col) && cps.col > 0) {
                          spacing = Number(cps.col);
                        } else if (cps.row && isFinite(cps.row) && cps.row > 0) {
                          spacing = Number(cps.row);
                        }
                      }
                      // 3.2 动态影像的 cineInfo 像素间距作为兜底
                      if ((!spacing || !isFinite(spacing) || spacing <= 0) && series.cineInfo && series.cineInfo.pixelSpacing) {
                        const ps = series.cineInfo.pixelSpacing;
                        if (ps.col && isFinite(ps.col) && ps.col > 0) {
                          spacing = Number(ps.col);
                        } else if (ps.row && isFinite(ps.row) && ps.row > 0) {
                          spacing = Number(ps.row);
                        }
                      }
                    }
                  }
                } catch (cineError) {
                  // spacing 解析失败时忽略
                }

                if (cols && spacing && isFinite(spacing) && spacing > 0) {
                  baseWidthMm = cols * spacing;
                  overlay.dataset.baseWidthMm = String(baseWidthMm);
                }
              }
            } catch (innerError) {
              // 轻量推导失败时保持现状，不影响后续逻辑
            }
          }

          if (baseWidthMm && isFinite(baseWidthMm) && baseWidthMm > 0 && scale > 0) {
            const widthMm = baseWidthMm / scale;
            const widthCm = widthMm / 10;
            const imageSizeElement = overlay.querySelector('.image-size-item');
            if (imageSizeElement && isFinite(widthCm) && widthCm > 0) {
              imageSizeElement.textContent = `${widthCm.toFixed(1)}cm`;
            }
          }
        } catch (e) {
          // 物理视野计算失败时不影响其它信息更新
        }

        // 根据当前缩放与物理视野大小，动态调整 X / Y 轴主刻度（按 10mm = 1cm 的国际通用标尺规则）
        try {
          const baseWidthMmStr = overlay.dataset.baseWidthMm;
          const baseWidthMm = baseWidthMmStr ? parseFloat(baseWidthMmStr) : null;
          if (baseWidthMm && isFinite(baseWidthMm) && baseWidthMm > 0 && scale > 0) {
            const visibleWidthMm = baseWidthMm / scale;

            // --- X 轴：水平方向标尺 ---
            const xLines = overlay.querySelectorAll('.top_x_line');
            if (xLines && xLines.length > 0) {
              const tickCount = xLines.length;
              const mmPerTick = visibleWidthMm / tickCount;
              const halfTickMm = mmPerTick / 2;

              xLines.forEach((lineEl, idx) => {
                const posMm = idx * mmPerTick;
                const mod10 = posMm % 10;
                const distanceToCm =
                  Math.min(Math.abs(mod10), Math.abs(mod10 - 10));

                // 每 10mm（1cm）处为主刻度：最长刻度
                if (distanceToCm <= halfTickMm) {
                  lineEl.classList.add('top_x_line1');
                } else {
                  lineEl.classList.remove('top_x_line1');
                }
              });
            }

            // --- Y 轴：垂直方向标尺 ---
            const yLines = overlay.querySelectorAll('.top_y_line');
            if (yLines && yLines.length > 0) {
              const tickCountY = yLines.length;
              const mmPerTickY = visibleWidthMm / tickCountY;
              const halfTickMmY = mmPerTickY / 2;

              yLines.forEach((lineEl, idx) => {
                const posMm = idx * mmPerTickY;
                const mod10 = posMm % 10;
                const distanceToCm =
                  Math.min(Math.abs(mod10), Math.abs(mod10 - 10));

                // 每 10mm（1cm）处为主刻度
                if (distanceToCm <= halfTickMmY) {
                  lineEl.classList.add('top_y_line1');
                } else {
                  lineEl.classList.remove('top_y_line1');
                }
              });
            }
          }
        } catch (e) {
          // 标尺刻度动态调整失败时不影响其它信息更新
        }

        // 更新缩放级别
        const zoomElement = overlay.querySelector('.zoom-level-item');
        if (zoomElement) {
          zoomElement.textContent = `${zoomLevel}%`;
        }

        // 更新窗宽窗位
        const windowWidthElement = overlay.querySelector('.window-width-value');
        const windowCenterElement = overlay.querySelector('.window-center-value');
        if (windowWidthElement) {
          windowWidthElement.textContent = windowWidth;
        }
        if (windowCenterElement) {
          windowCenterElement.textContent = windowCenter;
        }

        // 更新图像编号（显示帧数）
        const imageNoElement = overlay.querySelector('.image-no-item');
        if (imageNoElement) {
          imageNoElement.textContent = `Image No : ${imageNoDisplay}`;
        }
      } catch (error) {
        // 忽略错误
      }
    },

    /**
     * 获取 DICOM 标签值
     */
    getDicomValue(dicomDict, tag) {
      if (!dicomDict || !dicomDict[tag]) {
        return '';
      }
      const value = dicomDict[tag].Value;
      if (Array.isArray(value)) {
        return value.join('\\');
      }
      return value || '';
    },

    /**
     * 选择网格视口
     */
    selectGridViewport(viewportIndex) {
      const viewports = this.getGridViewportElements();
      if (viewports.length === 0) {
        return;
      }

      // 清除所有视口的选中状态
      viewports.forEach(viewport => {
        viewport.classList.remove('selected');
        viewport.style.outline = '';
        viewport.style.border = '';
        viewport.style.boxShadow = 'none';
        viewport.style.backgroundColor = '#222';
        viewport.style.zIndex = '';
        const label = viewport.querySelector('.series-info-label');
        if (label) {
          label.classList.remove('selected');
        }
      });

      // 选中当前视口
      if (viewports[viewportIndex]) {
        const selectedViewport = viewports[viewportIndex];

        // 添加选中类名
        selectedViewport.classList.add('selected');

        // 强制添加内联样式确保可见
        selectedViewport.style.outline = '4px solid #ff0000';
        selectedViewport.style.outlineOffset = '-4px';
        selectedViewport.style.boxShadow = '0 0 20px rgba(255, 0, 0, 1), 0 0 40px rgba(255, 0, 0, 0.6), inset 0 0 30px rgba(255, 0, 0, 0.25)';
        selectedViewport.style.zIndex = '10';

        // 更新store中的选中视口索引
        this.$store.dispatch('viewer/selectGridViewport', viewportIndex);

        // 如果该视口绑定了系列，同步更新左侧系列列表的选中状态
        if (selectedViewport.dataset.seriesIndex !== undefined) {
          const seriesIndex = parseInt(selectedViewport.dataset.seriesIndex, 10);
          if (!isNaN(seriesIndex)) {
            // 更新全局的 activeSeriesIndex，触发左侧系列列表高亮
            this.$store.dispatch('dicom/selectDicomSeries', seriesIndex);
          }
        }

        // 最后激活工具（确保 store 已更新）
        this.activateToolsForViewport(selectedViewport);
      }
    },

    /**
     * 为选中的视口激活当前工具
     */
    activateToolsForViewport(viewport) {
      if (!viewport) {
        return;
      }

      try {
        const tools = this.$cornerstoneTools;

        // 确保工具已添加到视口元素（如果还没有添加）
        const originalWarn = console.warn;
        console.warn = function () { }; // 临时禁用警告
        try {
          tools.addToolForElement(viewport, tools.WwwcTool);
          tools.addToolForElement(viewport, tools.PanTool);
          tools.addToolForElement(viewport, tools.ZoomTool);
          tools.addToolForElement(viewport, tools.LengthTool);
          tools.addToolForElement(viewport, tools.AngleTool);
          tools.addToolForElement(viewport, tools.ProbeTool);
          tools.addToolForElement(viewport, tools.RectangleRoiTool);
        } catch (e) {
          // 工具可能已添加过，忽略
        } finally {
          console.warn = originalWarn; // 恢复警告
        }

        // 首先停用所有工具（针对该视口）
        const toolsToDeactivate = ['Wwwc', 'Pan', 'Zoom', 'Length', 'Angle', 'Probe', 'RectangleRoi', 'Crosshairs'];
        toolsToDeactivate.forEach(toolName => {
          try {
            tools.setToolPassiveForElement(viewport, toolName);
          } catch (e) {
            // 工具可能未注册，忽略
          }
        });

        // 获取当前激活的工具模式（从组件状态）
        const mode = this.mode || '4'; // 默认窗宽窗位

        // 根据模式激活对应的工具（针对该视口激活）
        switch (mode) {
          case '1':
            tools.setToolActiveForElement(viewport, 'Length', { mouseButtonMask: 1 });
            break;
          case '2':
            tools.setToolActiveForElement(viewport, 'Pan', { mouseButtonMask: 1 });
            break;
          case '3':
            tools.setToolActiveForElement(viewport, 'Zoom', { mouseButtonMask: 1 });
            break;
          case '4':
            tools.setToolActiveForElement(viewport, 'Wwwc', { mouseButtonMask: 1 });
            break;
          case '5':
            tools.setToolActiveForElement(viewport, 'Probe', { mouseButtonMask: 1 });
            break;
          default:
            tools.setToolActiveForElement(viewport, 'Wwwc', { mouseButtonMask: 1 });
        }

        // 确保视口获得焦点（让工具事件正确绑定）
        if (viewport.focus) {
          viewport.focus();
        }
      } catch (error) {
        // 为视口激活工具失败，静默处理
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
    }
  }
};

