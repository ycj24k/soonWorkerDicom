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
        const layout = this.$store.state.viewer.gridViewState.layout;
        
        // 应用网格样式
        this.applyGridStyles(element, layout);
        
        // 加载多个系列到网格中
        await this.loadMultipleSeriesToGrid(layout);
      } catch (error) {
        errorHandler.handleError(error, 'initializeGridView');
      }
    },

    /**
     * 应用网格样式
     */
    applyGridStyles(element, layout) {
      const { rows, cols } = layout;
      
      // 设置网格容器样式（行列由布局决定，其余由全局CSS控制）
      element.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      element.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
      
      // 创建网格视口
      this.createGridViewports(rows, cols);
      
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
            console.warn = function() {}; // 临时禁用警告
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
      
      const patientName = getDicomValue('00100010') || '';
      const patientAge = getDicomValue('00101010') || '';
      const patientSex = getDicomValue('00100040') || '';
      const patientBirthDate = getDicomValue('00100030') || '';
      const patientID = getDicomValue('00100020') || '';
      const accessionNumber = getDicomValue('00080050') || '';
      
      const studyDate = getDicomValue('00080020') || '';
      const studyTime = getDicomValue('00080030') || '';
      const institution = getDicomValue('00080080') || '';
      const studyDesc = getDicomValue('00081030') || '';
      const seriesNo = getDicomValue('00200011') || '';
      const acqTime = getDicomValue('00080032') || '';
      
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
      
      // 获取图像尺寸（从 DICOM 标签）
      const imageSize = '11cm'; // 默认值，可以从 DICOM 标签获取
      
      // 获取当前图像索引（从 stack state）
      let currentImageIndex = 0;
      try {
        const stackState = this.$cornerstoneTools.getToolState(viewport, 'stack');
        if (stackState && stackState.data && stackState.data.length > 0) {
          currentImageIndex = stackState.data[0].currentImageIdIndex || 0;
        }
      } catch (error) {
        // 忽略错误，使用默认值
      }
      const imageNo = currentImageIndex + 1;
      // 视口上方只显示当前帧数，不显示总帧数
      const imageNoDisplay = `${imageNo}`;
      
      // 创建方向指示数据
      const xData = Array.from({ length: 33 }, (_, i) => i);
      const yData = Array.from({ length: 20 }, (_, i) => i);
      
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
          <div class="top_info_item">${imageSize}</div>
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
     */
    updateViewportInfo(overlay, viewport) {
      try {
        const viewportState = this.$cornerstone.getViewport(viewport);
        if (!viewportState) {
          return;
        }
        
        const windowWidth = viewportState.voi?.windowWidth || 400;
        const windowCenter = viewportState.voi?.windowCenter || 50;
        const zoomLevel = Math.round((viewportState.scale || 1) * 100);
        
        // 获取当前图像索引
        let currentImageIndex = 0;
        let totalImages = 1;
        try {
          const seriesIndex = parseInt(viewport.dataset.seriesIndex, 10);
          if (!isNaN(seriesIndex)) {
            const series = this.$store.state.dicom.dicomSeries[seriesIndex];
            if (series && series.children) {
              totalImages = series.children.length;
            }
          }
          
          // 优先从 Cornerstone stack state 获取当前图像索引（最准确，反映实际显示的图像）
          const stackState = this.$cornerstoneTools.getToolState(viewport, 'stack');
          if (stackState && stackState.data && stackState.data.length > 0) {
            currentImageIndex = stackState.data[0].currentImageIdIndex || 0;
          } else {
            // 如果没有 stack state，尝试从 Vuex 获取（作为后备）
            const activeSeriesIndex = this.$store.state.dicom.activeSeriesIndex;
            if (!isNaN(seriesIndex) && seriesIndex === activeSeriesIndex) {
              currentImageIndex = this.$store.state.dicom.activeImageIndex || 0;
            }
          }
        } catch (error) {
          // 忽略错误
        }
        const imageNo = currentImageIndex + 1;
        // 视口上方只显示当前帧数，不显示总帧数
        const imageNoDisplay = `${imageNo}`;
        
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
        
        // 首先停用所有工具（全局）
        const toolsToDeactivate = ['Wwwc', 'Pan', 'Zoom', 'Length', 'Angle', 'Probe', 'RectangleRoi', 'Crosshairs'];
        toolsToDeactivate.forEach(toolName => {
          try {
            tools.setToolPassive(toolName);
          } catch (e) {
            // 工具可能未注册，忽略
          }
        });
        
        // 获取当前激活的工具模式（从组件状态）
        const mode = this.mode || '4'; // 默认窗宽窗位
        
        // 根据模式激活对应的工具（全局激活）
        switch (mode) {
          case '1':
            tools.setToolActive('Length', { mouseButtonMask: 1 });
            break;
          case '2':
            tools.setToolActive('Pan', { mouseButtonMask: 1 });
            break;
          case '3':
            tools.setToolActive('Zoom', { mouseButtonMask: 1 });
            break;
          case '4':
            tools.setToolActive('Wwwc', { mouseButtonMask: 1 });
            break;
          case '5':
            tools.setToolActive('Probe', { mouseButtonMask: 1 });
            break;
          default:
            tools.setToolActive('Wwwc', { mouseButtonMask: 1 });
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

