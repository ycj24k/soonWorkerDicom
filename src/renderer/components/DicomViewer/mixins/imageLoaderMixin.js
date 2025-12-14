/**
 * 图像加载 Mixin
 * 处理DICOM图像的加载和选择逻辑
 */

import { errorHandler, gridViewService } from '../../../services';
import { findDicomFiles, buildImageId, validateDicomFile } from '../../../utils/DicomUtils';
const { ConfigManager } = require('../../../utils/ConfigManager');
const { dialog } = require('@electron/remote');
const fs = require('fs');

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
     * 自动加载DICOM目录
     */
    async autoLoadDicomDirectory() {
      try {
        // 设置超时保护，防止loading状态一直显示
        const timeoutId = setTimeout(() => {
          this.$store.commit('dicom/SET_LOADING', false);
          this.localLoading = false;
        }, 30000); // 30秒超时
        
        // 确保UI更新后再执行配置读取操作
        await this.$nextTick();
        
        // 使用setTimeout确保UI完全更新后再执行配置操作
        setTimeout(async () => {
          try {
            // 加载DICOM目录 - 使用配置文件管理器
            const configManager = ConfigManager.getInstance();
            const dicomPath = configManager.findAvailableDicomDirectory();
            const isAutoLoadEnabled = configManager.isAutoLoadEnabled();
        
            if (dicomPath && isAutoLoadEnabled) {
              // 更新加载文本（loading状态已在mounted中设置）
              this.$store.commit('dicom/SET_LOADING_TEXT', '正在扫描DICOM目录...');
              
              try {
                await this.loadDicomDirectory(dicomPath);
                
                // 加载完成后显示第一个系列的影像
                this.$store.commit('dicom/SET_LOADING_TEXT', '正在加载第一个影像...');
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
                errorHandler.handleError(error, 'autoLoadDicomDirectory');
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
            clearTimeout(timeoutId);
            errorHandler.handleError(error, 'autoLoadDicomDirectory');
          }
        }, 50); // 50ms延迟确保UI完全更新
      } catch (error) {
        // 发生错误时确保loading状态为false
        this.$store.commit('dicom/SET_LOADING', false);
        this.localLoading = false;
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
          
          // 立即显示加载动画 - 在文件对话框选择完成后立即显示
          this.$store.commit('dicom/SET_LOADING', true);
          this.$store.commit('dicom/SET_LOADING_TEXT', '正在分析选择的文件...');
          this.localLoading = true;
          
          // 强制立即更新UI，然后异步执行文件检查
          await this.$nextTick();
          
          // 使用setTimeout确保UI完全更新后再执行文件操作
          setTimeout(async () => {
            try {
              // 检查选择的是文件还是目录
              this.$store.commit('dicom/SET_LOADING_TEXT', '正在检查文件类型...');
              const stats = fs.statSync(selectedPath);
              
              if (stats.isFile()) {
                // 选择的是单个文件
                this.$store.commit('dicom/SET_LOADING_TEXT', '正在解析DICOM文件...');
                await this.loadDicomFile(selectedPath);
              } else {
                // 选择的是目录
                this.$store.commit('dicom/SET_LOADING_TEXT', '正在扫描DICOM目录...');
                await this.loadDicomDirectory(selectedPath);
              }
              
              this.$store.commit('dicom/SET_LOADING_TEXT', '正在加载第一个影像...');
              await this.loadFirstImage();
            } catch (error) {
              // 加载失败时确保隐藏加载动画
              this.$store.commit('dicom/SET_LOADING', false);
              this.localLoading = false;
              throw error;
            }
          }, 50); // 50ms延迟确保UI完全更新
        }
      } catch (error) {
        // 确保在错误时也隐藏加载动画
        this.$store.commit('dicom/SET_LOADING', false);
        this.localLoading = false;
        errorHandler.handleError(error, 'selectPath');
      }
    },

    /**
     * 选择单个文件
     */
    async selectFile() {
      try {
        // 清理之前的播放状态
        this.cleanupPlayback();

        const result = await dialog.showOpenDialog({
          properties: ["openFile"],
          filters: [
            { name: 'DICOM Files', extensions: ['dcm', 'dicom', 'dic', 'ima', ''] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });
        
        if (result.filePaths[0]) {
          // 立即显示加载动画 - 在文件对话框选择完成后立即显示
          this.$store.commit('dicom/SET_LOADING', true);
          this.$store.commit('dicom/SET_LOADING_TEXT', '正在解析DICOM文件...');
          this.localLoading = true;
          
          // 强制立即更新UI，然后异步执行文件加载
          await this.$nextTick();
          
          // 使用setTimeout确保UI完全更新后再执行文件操作
          setTimeout(async () => {
            try {
              await this.loadDicomFile(result.filePaths[0]);
              
              this.$store.commit('dicom/SET_LOADING_TEXT', '正在加载第一个影像...');
              await this.loadFirstImage();
            } catch (error) {
              // 加载失败时确保隐藏加载动画
              this.$store.commit('dicom/SET_LOADING', false);
              this.localLoading = false;
              throw error;
            }
          }, 50); // 50ms延迟确保UI完全更新
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
        // 清理之前的播放状态
        this.cleanupPlayback();

        await this.selectDicomSeries(index);
        
        if (this.isGridViewActive) {
          // 在网格模式下，先检查该系列是否已经在某个视口中
          const viewports = typeof this.getGridViewportElements === 'function'
            ? this.getGridViewportElements()
            : [];
          let foundViewportIndex = -1;
          
          for (let i = 0; i < viewports.length; i++) {
            const viewportSeriesIndex = viewports[i].dataset.seriesIndex;
            if (
              viewportSeriesIndex !== undefined &&
              parseInt(viewportSeriesIndex, 10) === index
            ) {
              foundViewportIndex = i;
              break;
            }
          }
          
          if (foundViewportIndex >= 0) {
            this.selectGridViewport(foundViewportIndex);
          } else {
            const selectedViewportIndex = this.$store.state.viewer.gridViewState.selectedViewportIndex;
            await this.loadSeriesToGridViewport(index, selectedViewportIndex);
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
     * 加载系列到指定网格视口（完整加载，包括 stack state）
     */
    async loadSeriesToGridViewport(seriesIndex, viewportIndex) {
      let series = null;
      try {
        const viewports = typeof this.getGridViewportElements === 'function'
          ? this.getGridViewportElements()
          : [];
        
        if (!viewports[viewportIndex]) {
          return;
        }
        
        const viewport = viewports[viewportIndex];
        const availableSeries = this.$store.state.dicom.dicomSeries;
        series = availableSeries && availableSeries[seriesIndex];

        if (!series || !series.children || series.children.length === 0) {
          return;
        }

        // 检查是否为动态影像系列
        const isDynamicSeries = series.cineInfo && series.cineInfo.isCine && series.cineInfo.frameCount > 1;

        // 构建系列的图像ID列表
        let imageIds = series.children.map(img => buildImageId(img)).filter(id => id !== null);

        // 关键修复：如果是动态影像系列，检查 imageIds 是否正确构建
        // 如果 imageIds 为空，或者第一个 imageId 没有 ?frame= 参数，说明帧节点可能没有正确构建
        if (isDynamicSeries) {
          const needsFix = imageIds.length === 0 || (imageIds.length > 0 && !imageIds[0].includes('?frame='));
          
          if (needsFix) {
            // 尝试从帧节点重新构建 imageId
            // 对于动态影像，children 应该是帧节点数组，每个帧节点都有 parentCineImage 和 frameIndex
            const fixedImageIds = [];
            const fileToFramesMap = new Map(); // 用于按文件分组帧节点
            
            // 先按文件分组帧节点
            for (const child of series.children) {
              if (child.isFrame && child.parentCineImage) {
                const filePath = child.parentCineImage.fullPath || child.parentCineImage.path;
                if (filePath) {
                  if (!fileToFramesMap.has(filePath)) {
                    fileToFramesMap.set(filePath, []);
                  }
                  fileToFramesMap.get(filePath).push(child);
                }
              }
            }
            
            // 对每个文件，按 frameIndex 排序后构建 imageId
            for (const [filePath, frameNodes] of fileToFramesMap) {
              // 按 frameIndex 排序
              frameNodes.sort((a, b) => {
                const idxA = Number.isInteger(a.frameIndex) ? a.frameIndex : 0;
                const idxB = Number.isInteger(b.frameIndex) ? b.frameIndex : 0;
                return idxA - idxB;
              });
              
              // 构建该文件所有帧的 imageId
              const normalizedPath = filePath.replace(/\\/g, '/');
              const encodedPath = encodeURI(normalizedPath);
              for (const frameNode of frameNodes) {
                const frameIndex = Number.isInteger(frameNode.frameIndex) && frameNode.frameIndex >= 0
                  ? frameNode.frameIndex
                  : fixedImageIds.length; // 如果 frameIndex 无效，使用当前长度作为索引
                fixedImageIds.push(`wadouri:${encodedPath}?frame=${frameIndex}`);
              }
            }
            
            // 如果仍然无法构建，尝试使用 series.cineImagePath（仅适用于单文件动态影像）
            if (fixedImageIds.length === 0) {
              const cineImagePath = series.cineImagePath || (series.children[0] && (series.children[0].fullPath || series.children[0].path));
              if (cineImagePath && series.cineInfo && series.cineInfo.frameCount > 1) {
                const normalizedPath = cineImagePath.replace(/\\/g, '/');
                const encodedPath = encodeURI(normalizedPath);
                for (let frameIdx = 0; frameIdx < series.cineInfo.frameCount; frameIdx++) {
                  fixedImageIds.push(`wadouri:${encodedPath}?frame=${frameIdx}`);
                }
              }
            }
            
            if (fixedImageIds.length > 0) {
              imageIds = fixedImageIds;
            }
          }
        }

        // 获取当前活动的图像索引（如果当前系列是活动系列）
        const activeSeriesIndex = this.$store.state.dicom.activeSeriesIndex;
        const activeImageIndex = this.$store.state.dicom.activeImageIndex || 0;
        const currentImageIndex = (seriesIndex === activeSeriesIndex) 
          ? Math.max(0, Math.min(activeImageIndex, imageIds.length - 1))
          : 0;
        
        // 如果imageIds为空，说明没有可用的影像
        if (imageIds.length === 0) {
          return;
        }

        // 先存储视口与系列的映射关系（必须在第一时间设置）
        viewport.dataset.seriesIndex = seriesIndex;

        // 创建 stack 对象
        const stack = {
          imageIds: imageIds,
          currentImageIdIndex: currentImageIndex
        };

        // 添加或更新 stack tool state（必须在加载图像之前）
        const existingStackState = this.$cornerstoneTools.getToolState(viewport, 'stack');
        if (existingStackState && existingStackState.data && existingStackState.data.length > 0) {
          // 更新现有的 stack state（先更新索引，确保事件触发时能读取到正确值）
          existingStackState.data[0].currentImageIdIndex = currentImageIndex;
          existingStackState.data[0].imageIds = imageIds;
        } else {
          // 添加新的 stack state
          this.$cornerstoneTools.addToolState(viewport, 'stack', stack);
        }

        // 加载当前索引对应的图像
        const targetImageId = imageIds[currentImageIndex];

        let image;
        try {
          image = await this.$cornerstone.loadImage(targetImageId);
        } catch (loadError) {
          throw loadError;
        }

        // 在 displayImage 之前再次确保 stack state 正确（防止事件触发时读取到旧值）
        const preDisplayStackState = this.$cornerstoneTools.getToolState(viewport, 'stack');
        if (preDisplayStackState && preDisplayStackState.data && preDisplayStackState.data.length > 0) {
          preDisplayStackState.data[0].currentImageIdIndex = currentImageIndex;
        }
        
        // 确保视口已启用（enable 是幂等的，可以安全地多次调用）
        this.$cornerstone.enable(viewport);
        
        // 显示图像
        this.$cornerstone.displayImage(viewport, image);
        
        // 强制刷新视口（确保图像可见）
        await this.$nextTick();
        this.$cornerstone.resize(viewport);
        
        // 确保窗口级别有效（如果不是有效值，设置默认值）
        const viewportBeforeUpdate = this.$cornerstone.getViewport(viewport);
        if (viewportBeforeUpdate && viewportBeforeUpdate.voi) {
          if (!viewportBeforeUpdate.voi.windowWidth || viewportBeforeUpdate.voi.windowWidth <= 0) {
            viewportBeforeUpdate.voi.windowWidth = 400;
            viewportBeforeUpdate.voi.windowCenter = 50;
            this.$cornerstone.setViewport(viewport, viewportBeforeUpdate);
          }
        }
        
        this.$cornerstone.updateImage(viewport);

        // 更新或添加系列信息标签
        if (series) {
          const oldLabel = viewport.querySelector('.series-info-label');
          if (oldLabel) {
            oldLabel.remove();
          }
          this.addSeriesInfoLabel(viewport, series, seriesIndex);
        }
        
        // 关键修复：确保视口信息覆盖层已创建并更新
        // 检查是否已有覆盖层，如果没有则创建
        let overlay = viewport.querySelector('.grid-image-info-overlay');
        if (!overlay && typeof this.addViewportInfoOverlay === 'function') {
          this.addViewportInfoOverlay(viewport);
          overlay = viewport.querySelector('.grid-image-info-overlay');
        }
        // 如果覆盖层存在，立即更新信息
        if (overlay && typeof this.renderImageInfoToOverlay === 'function') {
          this.renderImageInfoToOverlay(overlay, viewport);
        }

        // 选中该视口
        this.selectGridViewport(viewportIndex);

        // 再次确保 stack state 同步（必须在 displayImage 之后更新，确保 currentImageIdIndex 正确）
        const finalStackState = this.$cornerstoneTools.getToolState(viewport, 'stack');
        if (finalStackState && finalStackState.data && finalStackState.data.length > 0) {
          finalStackState.data[0].currentImageIdIndex = currentImageIndex;
          // 确保 imageIds 也是最新的
          finalStackState.data[0].imageIds = imageIds;
        }

        // 确保当前视口启用了滚轮堆栈切换工具（StackScrollMouseWheel）
        try {
          const tools = this.$cornerstoneTools;
          if (tools && tools.StackScrollMouseWheelTool) {
            // 检查工具是否已添加到元素（通过临时禁用console.warn来避免警告）
            const originalWarn = console.warn;
            console.warn = function() {}; // 临时禁用警告
            try {
              tools.addToolForElement(viewport, tools.StackScrollMouseWheelTool);
            } catch (e) {
              // 可能已经添加过，静默处理
            } finally {
              console.warn = originalWarn; // 恢复警告
            }
            try {
              // 针对该视口激活滚轮切换工具（不占用鼠标按钮）
              tools.setToolActiveForElement(viewport, 'StackScrollMouseWheel', {});
            } catch (e) {
              // 激活失败，静默处理
            }
          }
        } catch (e) {
          // 配置失败，静默处理
        }

        // 等待图像渲染完成后再更新视口信息（确保 image no 正确显示）
        await this.$nextTick();
        // 使用 setTimeout 确保 Cornerstone 事件已触发
        setTimeout(() => {
          const overlay = viewport.querySelector('.viewport-info-overlay');
          if (overlay && typeof this.updateViewportInfo === 'function') {
            this.updateViewportInfo(overlay, viewport);
          }
        }, 0);

      } catch (error) {
        errorHandler.handleError(error, 'loadSeriesToGridViewport');
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
        
        // 检查是否为动态影像，如果是则显示动态播放选项
        const isDynamicSeries = this.$store.state.dicom.isDynamicSeries;
        const cineInfo = this.$store.state.dicom.cineInfo;
        const currentCineImagePath = this.$store.state.dicom.currentCineImagePath;
        
        if (isDynamicSeries && cineInfo && currentCineImagePath) {
          // 显示动态影像提示，但不自动播放
          this.$message({
            message: `检测到动态影像 (${cineInfo.frameCount}帧)，可使用播放控制进行帧播放`,
            type: 'info',
            duration: 3000
          });
        }
        
        // 确保loading状态为false
        this.$store.commit('dicom/SET_LOADING', false);
        this.localLoading = false;

        // 在首张影像加载完成后，启动后台系列加载进度（按系列顺序逐个完成）
        this.$store.dispatch('dicom/startBackgroundSeriesLoading');
      } catch (error) {
        // 发生错误时确保loading状态为false
        this.$store.commit('dicom/SET_LOADING', false);
        this.localLoading = false;
        errorHandler.handleError(error, 'loadFirstImage');
      }
    },

    /**
     * 加载当前图像 - 统一使用网格视口系统
     */
    async loadCurrentImage() {
      try {
        const currentSeries = this.$store.getters['dicom/currentSeries'];
        
        if (!currentSeries || !currentSeries.children || currentSeries.children.length === 0) {
          return;
        }

        // 确保图像加载器已注册
        await this.$cornerstoneService.ensureImageLoaderRegistered();
        
        // 使用通用工具函数查找DICOM文件
        const imageIds = findDicomFiles(currentSeries, validateDicomFile, buildImageId);
        
        if (imageIds.length === 0) {
          return;
        }
        
        // 统一使用网格视口系统
        if (!this.isGridViewActive) {
          // 如果网格未激活，先激活1x1网格
          const layout = { rows: 1, cols: 1, totalSlots: 1 };
          await this.$store.dispatch('viewer/activateGridLayout', layout);
          await this.initializeGridView();
          // initializeGridView 内部会调用 loadMultipleSeriesToGrid，已经加载了当前系列
          return;
        }
        
        // 在网格模式下，加载到第一个视口（索引0）
        const activeSeriesIndex = this.$store.state.dicom.activeSeriesIndex;
        await this.loadSeriesToGridViewport(activeSeriesIndex, 0);
        
      } catch (error) {
        // 静默处理错误
      }
    }
  }
};

