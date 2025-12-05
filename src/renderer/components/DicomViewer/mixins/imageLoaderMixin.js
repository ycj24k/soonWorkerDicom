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
                console.error('加载DICOM目录失败:', error);
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
            console.error('配置读取过程发生错误:', error);
            // 发生错误时确保loading状态为false
            this.$store.commit('dicom/SET_LOADING', false);
            this.localLoading = false;
            clearTimeout(timeoutId);
          }
        }, 50); // 50ms延迟确保UI完全更新
      } catch (error) {
        console.error('自动加载过程发生错误:', error);
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
        console.error('选择文件失败:', error);
        errorHandler.handleError(error, 'selectFile');
      }
    },

    /**
     * 选择序列
     */
    async selectSeries(index) {
      try {
        console.log('[imageLoaderMixin][selectSeries] 开始选择系列', {
          seriesIndex: index,
          isGridViewActive: this.isGridViewActive
        });

        // 清理之前的播放状态
        this.cleanupPlayback();

        await this.selectDicomSeries(index);
        
        // 获取系列信息用于日志
        const availableSeries = this.$store.state.dicom.dicomSeries;
        const series = availableSeries && availableSeries[index];
        const isDynamicSeries = series && series.cineInfo && series.cineInfo.isCine && series.cineInfo.frameCount > 1;
        console.log('[imageLoaderMixin][selectSeries] 系列选择完成', {
          seriesIndex: index,
          isDynamicSeries,
          cineInfo: series && series.cineInfo,
          childrenLength: series && Array.isArray(series.children) ? series.children.length : 0,
          isGridViewActive: this.isGridViewActive
        });
        
        if (this.isGridViewActive) {
          // 在网格模式下，先检查该系列是否已经在某个视口中
          const viewports = typeof this.getGridViewportElements === 'function'
            ? this.getGridViewportElements()
            : [];
          let foundViewportIndex = -1;
          
          console.log('[imageLoaderMixin][selectSeries] 检查系列是否已在视口中', {
            seriesIndex: index,
            viewportCount: viewports.length
          });
          
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
            // 如果系列已经在某个视口中，直接选中该视口
            console.log('[imageLoaderMixin][selectSeries] 系列已在视口中，直接选中', {
              seriesIndex: index,
              viewportIndex: foundViewportIndex
            });
            this.selectGridViewport(foundViewportIndex);
          } else {
            // 如果系列不在任何视口中，加载到当前选中的视口
            const selectedViewportIndex = this.$store.state.viewer.gridViewState.selectedViewportIndex;
            console.log('[imageLoaderMixin][selectSeries] 系列不在视口中，加载到当前选中视口', {
              seriesIndex: index,
              selectedViewportIndex,
              isDynamicSeries
            });
            await this.loadSeriesToGridViewport(index, selectedViewportIndex);
          }
        } else {
          // 在单视图模式下，正常加载
          console.log('[imageLoaderMixin][selectSeries] 单视图模式，加载当前图像', {
            seriesIndex: index
          });
          await this.loadCurrentImage();
        }
      } catch (error) {
        console.error('[imageLoaderMixin][selectSeries] 选择系列失败', {
          seriesIndex: index,
          error: error.message || error.toString(),
          errorStack: error.stack
        });
        errorHandler.handleError(error, 'selectSeries');
      }
    },

    /**
     * 加载系列到指定网格视口（完整加载，包括 stack state）
     */
    async loadSeriesToGridViewport(seriesIndex, viewportIndex) {
      try {
        console.log('[imageLoaderMixin][loadSeriesToGridViewport] 开始加载系列到视口', {
          seriesIndex,
          viewportIndex
        });
        const viewports = typeof this.getGridViewportElements === 'function'
          ? this.getGridViewportElements()
          : [];
        
        if (!viewports[viewportIndex]) {
          console.error('[imageLoaderMixin][loadSeriesToGridViewport] 无效的视口索引', {
            viewportIndex,
            viewportCount: viewports.length
          });
          return;
        }
        
        const viewport = viewports[viewportIndex];
        const availableSeries = this.$store.state.dicom.dicomSeries;
        const series = availableSeries[seriesIndex];

        if (!series || !series.children || series.children.length === 0) {
          console.error('[imageLoaderMixin][loadSeriesToGridViewport] 无效的系列或系列无图像', {
            seriesIndex,
            hasSeries: !!series,
            childrenLength: series && Array.isArray(series.children) ? series.children.length : 0
          });
          return;
        }

        // 检查是否为动态影像系列
        const isDynamicSeries = series.cineInfo && series.cineInfo.isCine && series.cineInfo.frameCount > 1;
        console.log('[imageLoaderMixin][loadSeriesToGridViewport] 系列信息检查', {
          seriesIndex,
          isDynamicSeries,
          cineInfo: series.cineInfo,
          childrenLength: series.children.length,
          firstChildType: series.children[0] ? {
            isFrame: series.children[0].isFrame,
            isFile: series.children[0].isFile,
            hasParentCineImage: !!series.children[0].parentCineImage,
            frameIndex: series.children[0].frameIndex,
            path: series.children[0].path || series.children[0].fullPath
          } : null
        });

        // 构建系列的图像ID列表
        // 优化：初始阶段只构建已加载的影像（children中只有第一张），后台加载时会逐步添加
        const imageIdsWithDetails = series.children.map((img, idx) => {
          const imageId = buildImageId(img);
          return {
            index: idx,
            imageId,
            isFrame: img.isFrame,
            frameIndex: img.frameIndex,
            path: img.path || img.fullPath,
            hasParentCineImage: !!img.parentCineImage
          };
        });
        const imageIds = imageIdsWithDetails.map(item => item.imageId).filter(id => id !== null);
        const failedBuilds = imageIdsWithDetails.filter(item => !item.imageId);

        console.log('[imageLoaderMixin][loadSeriesToGridViewport] 构建 imageIds 完成', {
          seriesIndex,
          viewportIndex,
          childrenLength: series.children.length,
          imageIdsLength: imageIds.length,
          failedBuildsCount: failedBuilds.length,
          isDynamicSeries,
          firstImageId: imageIds[0] ? imageIds[0].substring(0, 150) : null,
          firstImageIdHasFrame: imageIds[0] ? imageIds[0].includes('?frame=') : false,
          firstChildDetails: imageIdsWithDetails[0],
          failedBuildsDetails: failedBuilds.slice(0, 3) // 只显示前3个失败的
        });

        if (failedBuilds.length > 0) {
          console.warn('[imageLoaderMixin][loadSeriesToGridViewport] 部分节点构建 imageId 失败', {
            totalFailed: failedBuilds.length,
            samples: failedBuilds.slice(0, 5)
          });
        }

        // 关键修复：如果是动态影像系列，但第一个 imageId 没有 ?frame= 参数，说明帧节点可能没有正确构建
        // 尝试从 cineImagePath 和 cineInfo 手动构建所有帧的 imageId
        if (isDynamicSeries && imageIds.length > 0 && !imageIds[0].includes('?frame=')) {
          const cineImagePath = series.cineImagePath || (series.children[0] && (series.children[0].fullPath || series.children[0].path));
          if (cineImagePath) {
            console.warn('[imageLoaderMixin][loadSeriesToGridViewport] 检测到动态影像系列但 imageId 缺少 frame 参数，尝试修复', {
              seriesIndex,
              cineImagePath: cineImagePath.substring(0, 100),
              originalFirstImageId: imageIds[0].substring(0, 100),
              childrenLength: series.children.length,
              expectedFrameCount: series.cineInfo.frameCount
            });
            // 重新构建所有帧的 imageId
            // 使用 children.length 作为帧数（因为动态影像已经分解为帧节点）
            const normalizedPath = cineImagePath.replace(/\\/g, '/');
            const encodedPath = encodeURI(normalizedPath);
            const frameCount = series.children.length; // 使用 children 数量作为帧数
            const fixedImageIds = [];
            for (let frameIdx = 0; frameIdx < frameCount; frameIdx++) {
              fixedImageIds.push(`wadouri:${encodedPath}?frame=${frameIdx}`);
            }
            console.log('[imageLoaderMixin][loadSeriesToGridViewport] 已修复动态影像帧 imageIds', {
              seriesIndex,
              oldLength: imageIds.length,
              newLength: fixedImageIds.length,
              firstFixedImageId: fixedImageIds[0].substring(0, 150),
              lastFixedImageId: fixedImageIds[fixedImageIds.length - 1].substring(0, 150)
            });
            // 更新 imageIds 数组（但保持引用，因为后面还要用）
            imageIds.length = 0;
            imageIds.push(...fixedImageIds);
          } else {
            console.error('[imageLoaderMixin][loadSeriesToGridViewport] 动态影像系列缺少 cineImagePath，无法修复 imageIds', {
              seriesIndex,
              cineImagePath: series.cineImagePath,
              firstChildPath: series.children[0] ? (series.children[0].fullPath || series.children[0].path) : null
            });
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
          console.warn(`系列 ${seriesIndex} 没有可用的影像`);
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
          console.log('[imageLoaderMixin][loadSeriesToGridViewport] 更新现有 stackState', {
            currentImageIdIndex: currentImageIndex,
            imageIdsLength: imageIds.length
          });
        } else {
          // 添加新的 stack state
          this.$cornerstoneTools.addToolState(viewport, 'stack', stack);
          console.log('[imageLoaderMixin][loadSeriesToGridViewport] 添加新的 stackState', {
            currentImageIdIndex: currentImageIndex,
            imageIdsLength: imageIds.length
          });
        }

        // 加载当前索引对应的图像
        const targetImageId = imageIds[currentImageIndex];
        console.log('[imageLoaderMixin][loadSeriesToGridViewport] 准备加载图像', {
          seriesIndex,
          viewportIndex,
          currentImageIndex,
          targetImageId: targetImageId ? targetImageId.substring(0, 150) : null,
          targetImageIdFull: targetImageId, // 完整 imageId，用于调试
          isDynamicSeries,
          isFrameImage: targetImageId && targetImageId.includes('?frame='),
          frameParam: targetImageId && targetImageId.includes('?frame=') 
            ? targetImageId.match(/\?frame=(\d+)/)?.[1] 
            : null
        });

        let image;
        try {
          image = await this.$cornerstone.loadImage(targetImageId);
          console.log('[imageLoaderMixin][loadSeriesToGridViewport] 图像加载成功', {
            seriesIndex,
            viewportIndex,
            currentImageIndex,
            imageWidth: image ? image.width : null,
            imageHeight: image ? image.height : null,
            imageRows: image ? image.rows : null,
            imageColumns: image ? image.columns : null
          });
        } catch (loadError) {
          console.error('[imageLoaderMixin][loadSeriesToGridViewport] 图像加载失败', {
            seriesIndex,
            viewportIndex,
            currentImageIndex,
            targetImageId: targetImageId ? targetImageId.substring(0, 100) : null,
            error: loadError.message || loadError.toString(),
            errorStack: loadError.stack
          });
          throw loadError; // 重新抛出错误，让调用者知道加载失败
        }

        // 在 displayImage 之前再次确保 stack state 正确（防止事件触发时读取到旧值）
        const preDisplayStackState = this.$cornerstoneTools.getToolState(viewport, 'stack');
        if (preDisplayStackState && preDisplayStackState.data && preDisplayStackState.data.length > 0) {
          preDisplayStackState.data[0].currentImageIdIndex = currentImageIndex;
        }

        try {
          this.$cornerstone.displayImage(viewport, image);
          console.log('[imageLoaderMixin][loadSeriesToGridViewport] 图像显示成功', {
            seriesIndex,
            viewportIndex,
            currentImageIndex
          });
        } catch (displayError) {
          console.error('[imageLoaderMixin][loadSeriesToGridViewport] 图像显示失败', {
            seriesIndex,
            viewportIndex,
            currentImageIndex,
            error: displayError.message || displayError.toString(),
            errorStack: displayError.stack
          });
          throw displayError; // 重新抛出错误
        }

        // 更新或添加系列信息标签
        // 先移除旧标签
        const oldLabel = viewport.querySelector('.series-info-label');
        if (oldLabel) {
          oldLabel.remove();
        }
        // 添加新标签（此时 seriesIndex 已设置）
        this.addSeriesInfoLabel(viewport, series, seriesIndex);

        // 选中该视口
        this.selectGridViewport(viewportIndex);

        // 再次确保 stack state 同步（必须在 displayImage 之后更新，确保 currentImageIdIndex 正确）
        const finalStackState = this.$cornerstoneTools.getToolState(viewport, 'stack');
        if (finalStackState && finalStackState.data && finalStackState.data.length > 0) {
          finalStackState.data[0].currentImageIdIndex = currentImageIndex;
          // 确保 imageIds 也是最新的
          finalStackState.data[0].imageIds = imageIds;
          console.log('[imageLoaderMixin][loadSeriesToGridViewport] 最终 stackState 同步完成', {
            currentImageIdIndex: currentImageIndex,
            imageIdsLength: imageIds.length
          });
        }

        // 确保当前视口启用了滚轮堆栈切换工具（StackScrollMouseWheel）
        try {
          const tools = this.$cornerstoneTools;
          if (tools && tools.StackScrollMouseWheelTool) {
            try {
              // 为该视口注册滚轮工具（如果已经注册会抛异常，忽略即可）
              tools.addToolForElement(viewport, tools.StackScrollMouseWheelTool);
            } catch (e) {
              // 可能已经添加过，静默处理
            }
            try {
              // 针对该视口激活滚轮切换工具（不占用鼠标按钮）
              tools.setToolActiveForElement(viewport, 'StackScrollMouseWheel', {});
              console.log('[imageLoaderMixin][loadSeriesToGridViewport] 已为视口激活 StackScrollMouseWheel 工具', {
                seriesIndex,
                viewportIndex
              });
            } catch (e) {
              console.warn('[imageLoaderMixin][loadSeriesToGridViewport] 激活 StackScrollMouseWheel 工具失败', e);
            }
          } else {
            console.warn('[imageLoaderMixin][loadSeriesToGridViewport] StackScrollMouseWheelTool 不可用，无法启用滚轮切换');
          }
        } catch (e) {
          console.error('[imageLoaderMixin][loadSeriesToGridViewport] 配置滚轮切换工具时出错', e);
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
        console.error('[imageLoaderMixin][loadSeriesToGridViewport] 加载系列到视口失败', {
          seriesIndex,
          viewportIndex,
          error: error.message || error.toString(),
          errorStack: error.stack,
          errorName: error.name,
          seriesInfo: {
            hasSeries: !!series,
            childrenLength: series && Array.isArray(series.children) ? series.children.length : 0,
            isDynamicSeries: series && series.cineInfo && series.cineInfo.isCine,
            cineInfo: series && series.cineInfo
          }
        });
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
        console.error('加载第一个图像失败:', error);
        // 发生错误时确保loading状态为false
        this.$store.commit('dicom/SET_LOADING', false);
        this.localLoading = false;
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
        if (process.env.NODE_ENV === 'development') {
          console.error('loadCurrentImage失败:', error);
        }
      }
    }
  }
};

