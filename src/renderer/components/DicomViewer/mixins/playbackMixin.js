/**
 * 播放控制 Mixin
 * 处理动态影像和普通影像的播放控制逻辑
 */

import { playbackService, errorHandler, dicomService } from '../../../services';
import { findDicomFiles, buildImageId, validateDicomFile } from '../../../utils/DicomUtils';
const cinePlaybackService = require('../../../services/CinePlaybackService');

export default {
  methods: {

    /**
     * 清理播放状态（统一入口）
     */
    cleanupPlayback() {
      try {
        // 清理动态影像播放
        if (cinePlaybackService.isPlaying() || cinePlaybackService.isPaused()) {
          cinePlaybackService.stopCinePlayback();
          cinePlaybackService.cleanup();
        }

        // 清理普通播放
        if (playbackService.isPlaying() || playbackService.isPaused()) {
          playbackService.stopPlayback();
        }

        // 更新Vuex状态
        this.$store.dispatch('viewer/stopPlayback');
      } catch (error) {
        // 清理播放状态失败，静默处理
      }
    },

    /**
     * 获取当前影像文件在影像文件列表中的索引
     * @returns {Object} { imageFiles, currentImageFileIndex }
     */
    getCurrentImageFileIndex() {
      const currentSeries = this.$store.getters['dicom/currentSeries'];
      if (!currentSeries) {
        return { imageFiles: [], currentImageFileIndex: -1 };
      }

      // 优先使用 _allImageNodes 获取所有影像文件（总数），如果没有则使用 children
      // 这样可以正确处理后台加载的情况（初始化时 children 可能只有第一个影像）
      let sourceNodes = [];
      if (currentSeries._allImageNodes && Array.isArray(currentSeries._allImageNodes) && currentSeries._allImageNodes.length > 0) {
        sourceNodes = currentSeries._allImageNodes;
      } else if (currentSeries.children && Array.isArray(currentSeries.children) && currentSeries.children.length > 0) {
        sourceNodes = currentSeries.children;
      } else {
        return { imageFiles: [], currentImageFileIndex: -1 };
      }

      // 获取所有影像文件（不是帧）
      const imageFiles = sourceNodes.filter(child => {
        return child.isFile && !child.isFrame;
      });

      if (imageFiles.length === 0) {
        return { imageFiles: [], currentImageFileIndex: -1 };
      }

      const currentIndex = this.$store.state.dicom.activeImageIndex || 0;
      // 优先从 children 获取当前节点（因为 activeImageIndex 对应的是 children 的索引）
      // 如果没有，尝试从 _allImageNodes 获取
      let currentImageNode = null;
      if (currentSeries.children && currentSeries.children[currentIndex]) {
        currentImageNode = currentSeries.children[currentIndex];
      } else if (currentSeries._allImageNodes && currentSeries._allImageNodes[currentIndex]) {
        currentImageNode = currentSeries._allImageNodes[currentIndex];
      }
      
      let currentImageFileIndex = -1;
      const getCurrentPath = (node) => {
        if (!node) return null;
        // 优先使用 fullPath，如果没有则使用 path
        return node.fullPath || node.path || null;
      };
      
      const normalizePath = (path) => {
        if (!path) return null;
        // 统一路径格式，便于比较
        return path.replace(/\\/g, '/').toLowerCase();
      };
      
      if (currentImageNode) {
        if (currentImageNode.isFrame && currentImageNode.parentCineImage) {
          // 当前是帧，找到父影像文件
          const parentPath = getCurrentPath(currentImageNode.parentCineImage);
          if (parentPath) {
            const normalizedParentPath = normalizePath(parentPath);
            currentImageFileIndex = imageFiles.findIndex(img => {
              const imgPath = getCurrentPath(img);
              return imgPath && normalizePath(imgPath) === normalizedParentPath;
            });
          }
        } else if (currentImageNode.isFile && !currentImageNode.isFrame) {
          // 当前是普通影像文件，直接匹配
          const currentPath = getCurrentPath(currentImageNode);
          if (currentPath) {
            const normalizedCurrentPath = normalizePath(currentPath);
            currentImageFileIndex = imageFiles.findIndex(img => {
              const imgPath = getCurrentPath(img);
              return imgPath && normalizePath(imgPath) === normalizedCurrentPath;
            });
          }
        }
      }

      // 如果找不到，尝试从当前索引向前或向后查找最近的影像文件
      if (currentImageFileIndex === -1) {
        // 先向前查找
        for (let i = currentIndex - 1; i >= 0; i--) {
          let node = null;
          if (currentSeries.children && currentSeries.children[i]) {
            node = currentSeries.children[i];
          } else if (currentSeries._allImageNodes && currentSeries._allImageNodes[i]) {
            node = currentSeries._allImageNodes[i];
          }
          if (node && node.isFile && !node.isFrame) {
            const nodePath = getCurrentPath(node);
            if (nodePath) {
              const normalizedNodePath = normalizePath(nodePath);
              currentImageFileIndex = imageFiles.findIndex(img => {
                const imgPath = getCurrentPath(img);
                return imgPath && normalizePath(imgPath) === normalizedNodePath;
              });
              if (currentImageFileIndex !== -1) break;
            }
          }
        }
        // 如果还是找不到，向后查找
        if (currentImageFileIndex === -1) {
          const maxLength = Math.max(
            (currentSeries.children ? currentSeries.children.length : 0),
            (currentSeries._allImageNodes ? currentSeries._allImageNodes.length : 0)
          );
          for (let i = currentIndex + 1; i < maxLength; i++) {
            let node = null;
            if (currentSeries.children && currentSeries.children[i]) {
              node = currentSeries.children[i];
            } else if (currentSeries._allImageNodes && currentSeries._allImageNodes[i]) {
              node = currentSeries._allImageNodes[i];
            }
            if (node && node.isFile && !node.isFrame) {
              const nodePath = getCurrentPath(node);
              if (nodePath) {
                const normalizedNodePath = normalizePath(nodePath);
                currentImageFileIndex = imageFiles.findIndex(img => {
                  const imgPath = getCurrentPath(img);
                  return imgPath && normalizePath(imgPath) === normalizedNodePath;
                });
                if (currentImageFileIndex !== -1) break;
              }
            }
          }
        }
      }
      
      // 如果仍然找不到，但当前节点是普通影像文件，尝试直接使用索引映射
      if (currentImageFileIndex === -1 && currentImageNode && currentImageNode.isFile && !currentImageNode.isFrame) {
        // 尝试通过索引直接映射：如果 currentIndex 对应的节点在 imageFiles 中的位置
        // 这适用于 children 和 imageFiles 顺序一致的情况
        let foundInImageFiles = false;
        for (let i = 0; i < imageFiles.length; i++) {
          if (imageFiles[i] === currentImageNode) {
            currentImageFileIndex = i;
            foundInImageFiles = true;
            break;
          }
        }
        // 如果还是找不到，尝试通过路径匹配所有可能的路径格式
        if (!foundInImageFiles) {
          const currentPath = getCurrentPath(currentImageNode);
          if (currentPath) {
            const normalizedCurrentPath = normalizePath(currentPath);
            // 尝试多种路径匹配方式
            currentImageFileIndex = imageFiles.findIndex(img => {
              const imgPath = getCurrentPath(img);
              if (!imgPath) return false;
              const normalizedImgPath = normalizePath(imgPath);
              // 完全匹配
              if (normalizedImgPath === normalizedCurrentPath) return true;
              // 文件名匹配
              const currentFileName = currentPath.split(/[/\\]/).pop();
              const imgFileName = imgPath.split(/[/\\]/).pop();
              return currentFileName && imgFileName && currentFileName.toLowerCase() === imgFileName.toLowerCase();
            });
          }
        }
      }

      return { imageFiles, currentImageFileIndex };
    },

    /**
     * 加载指定影像文件到视口
     * @param {Object} imageFile - 影像文件节点
     * @param {boolean} loadFirstFrame - 对于动态影像，是否加载第一帧
     */
    async loadImageFile(imageFile, loadFirstFrame = true) {
      try {
        const currentSeries = this.$store.getters['dicom/currentSeries'];
        if (!currentSeries || !imageFile) {
          return;
        }

        // 确保网格视图已激活（如果未激活，先激活1x1网格）
        if (!this.isGridViewActive) {
          const layout = { rows: 1, cols: 1, totalSlots: 1 };
          await this.$store.dispatch('viewer/activateGridLayout', layout);
          if (typeof this.initializeGridView === 'function') {
            await this.initializeGridView();
          }
        }

        const imagePath = imageFile.fullPath || imageFile.path;
        if (!imagePath) {
          return;
        }

        const cineInfo = dicomService.cineService.isCineImage(imagePath);
        let targetIndex = -1;

        if (cineInfo && cineInfo.isCine && cineInfo.frameCount > 1 && loadFirstFrame) {
          // 动态影像：找第一帧
          targetIndex = currentSeries.children.findIndex(child => {
            if (child.isFrame && child.parentCineImage) {
              const parentPath = child.parentCineImage.fullPath || child.parentCineImage.path;
              return parentPath === imagePath && child.frameIndex === 0;
            }
            return false;
          });
        } else {
          // 普通影像：直接加载
          targetIndex = currentSeries.children.findIndex(child => {
            const childPath = child.fullPath || child.path;
            return childPath === imagePath && child.isFile && !child.isFrame;
          });
        }

        if (targetIndex === -1) {
          return;
        }

        // 先更新 Vuex 状态
        this.$store.commit('dicom/SET_ACTIVE_IMAGE', targetIndex);
        
        // 获取当前活动系列的索引和视口索引
        const activeSeriesIndex = this.$store.state.dicom.activeSeriesIndex;
        const viewportIndex = this.isGridViewActive 
          ? (this.$store.state.viewer.gridViewState.selectedViewportIndex || 0)
          : 0;
        
        // 使用现有的 loadSeriesToGridViewport 方法，它会处理所有必要的步骤
        // 注意：loadSeriesToGridViewport 会从 Vuex 读取 activeImageIndex，所以必须先更新
        if (typeof this.loadSeriesToGridViewport === 'function') {
          await this.loadSeriesToGridViewport(activeSeriesIndex, viewportIndex);
          
          // 确保视口信息已更新（特别是 image no）
          await this.$nextTick();
          if (typeof this.getGridViewportElements === 'function') {
            const viewports = this.getGridViewportElements();
            const viewport = viewports[viewportIndex];
            if (viewport) {
              const overlay = viewport.querySelector('.viewport-info-overlay');
              if (overlay && typeof this.updateViewportInfo === 'function') {
                this.updateViewportInfo(overlay, viewport);
              }
            }
          }
        } else {
          console.error('loadImageFile: loadSeriesToGridViewport 方法不存在');
        }
      } catch (error) {
        console.error('loadImageFile 失败:', error);
        errorHandler.handleError(error, 'loadImageFile');
      }
    },

    /**
     * 开始动态影像的帧播放（单个多帧DICOM文件的帧播放）
     * @param {Object} options - 播放选项
     * @param {number} options.speed - 播放速度（FPS）
     * @param {string} options.direction - 播放方向（forward/backward）
     * @param {number} options.startFrame - 开始帧索引
     */
    async startCinePlayback(options = {}) {
      try {
        // 清理之前的播放状态
        this.cleanupPlayback();
        
        const cineInfo = this.$store.state.dicom.cineInfo;
        const currentCineImagePath = this.$store.state.dicom.currentCineImagePath;
        
        // 参数验证
        if (!cineInfo || !currentCineImagePath) {
          console.error('动态影像信息不完整');
          this.$message.error('动态影像信息不完整，无法播放');
          return;
        }

        if (!cineInfo.frameCount || cineInfo.frameCount < 1) {
          console.error('动态影像帧数无效:', cineInfo.frameCount);
          this.$message.error('动态影像帧数无效');
          return;
        }

        const element = this.$refs.dicomViewer;
        if (!element) {
          console.error('找不到DICOM查看器元素');
          this.$message.error('找不到显示区域');
          return;
        }

        // 确保图像加载器已注册
        await this.$cornerstoneService.ensureImageLoaderRegistered();
        
        // 构建图像ID（统一使用 file:// 前缀，避免在开发模式下被当作 http://localhost:9080 路径）
        const imageNode = { fullPath: currentCineImagePath, path: currentCineImagePath };
        const imageId = buildImageId(imageNode);
        
        // 设置播放参数
        const playbackOptions = {
          speed: Math.max(1, Math.min(30, options.speed || 10)),
          direction: options.direction === 'backward' ? 'backward' : 'forward',
          startFrame: Math.max(0, options.startFrame || 0)
        };

        // 开始动态影像播放
        cinePlaybackService.startCinePlayback(element, imageId, cineInfo, playbackOptions);
        
        // 更新Vuex状态
        this.$store.dispatch('viewer/startPlayback', { type: 'cine' });
        
        // 显示播放控制提示
        this.$message({
          message: `动态影像帧播放已开始 (${cineInfo.frameCount}帧, ${cineInfo.type || 'multi-frame'})`,
          type: 'success',
          duration: 3000
        });
        
      } catch (error) {
        console.error('动态影像播放失败:', error);
        errorHandler.handleError(error, 'startCinePlayback');
        this.$message.error('动态影像播放启动失败: ' + (error.message || '未知错误'));
      }
    },

    /**
     * 开始普通影像的单张播放（多个图像文件按顺序播放）
     * 用于普通影像序列或多张DICOM文件的播放
     */
    async startRegularPlayback(playbackOptions = {}) {
      try {
        const currentSeries = this.$store.getters['dicom/currentSeries'];
        if (!currentSeries || !currentSeries.children || currentSeries.children.length === 0) {
          this.$message.error('没有可用的图像');
          return;
        }

        // 使用通用工具函数构建图像ID列表
        const imageIds = findDicomFiles(currentSeries, validateDicomFile, buildImageId);

        if (imageIds.length === 0) {
          this.$message.error('没有找到DICOM图像');
          return;
        }

        let element = this.$refs.dicomViewer;
        if (!element && typeof this.getActiveElement === 'function') {
          try {
            const activeEl = this.getActiveElement();
            if (activeEl) {
              element = activeEl;
            }
          } catch (e) {
            // 忽略 getActiveElement 失败
          }
        }
        if (!element && typeof this.getGridViewportElements === 'function') {
          const viewports = this.getGridViewportElements();
          const selectedIndex = this.$store.state.viewer.gridViewState?.selectedViewportIndex || 0;
          if (viewports && viewports[selectedIndex]) {
            element = viewports[selectedIndex];
          } else if (viewports && viewports.length > 0) {
            element = viewports[0];
          }
        }

        if (!element) {
          console.error('找不到DICOM查看器元素');
          return;
        }

        // 确保图像加载器已注册
        await this.$cornerstoneService.ensureImageLoaderRegistered();

        // 设置播放参数
        const options = {
          speed: playbackOptions.speed || 10,
          direction: playbackOptions.direction || 'forward',
          loop: playbackOptions.loop !== false,
          startFrame: Math.max(0, playbackOptions.startFrame || 0),
          endFrame: Math.min(imageIds.length - 1, playbackOptions.endFrame || imageIds.length - 1),
          onComplete: playbackOptions.onComplete,
          // 帧变化时，同步当前影像序号到 Vuex / stack / 视口信息栏
          onFrameChange: (frameIndex, imageId) => {
            const actualIndex = Math.max(0, Math.min(frameIndex, imageIds.length - 1));
            try {
              // 1) 同步当前影像索引
              this.$store.commit('dicom/SET_ACTIVE_IMAGE', actualIndex);

              // 2) 尝试同步当前视口的 stack.currentImageIdIndex
              if (this.$cornerstoneTools && element) {
                const tools = this.$cornerstoneTools;
                let targetElement = element;
                if (typeof this.getActiveElement === 'function') {
                  try {
                    const activeEl = this.getActiveElement();
                    if (activeEl) {
                      targetElement = activeEl;
                    }
                  } catch (e) {
                    // 忽略 getActiveElement 失败
                  }
                }
                const stackState = tools.getToolState(targetElement, 'stack');
                if (stackState && stackState.data && stackState.data.length > 0) {
                  stackState.data[0].currentImageIdIndex = actualIndex;
                }
              }

              // 3) 主动刷新一次视口信息栏（Image No）
              if (typeof this.updateViewportInfo === 'function') {
                let targetViewport = null;
                if (typeof this.getGridViewportElements === 'function') {
                  const viewports = this.getGridViewportElements();
                  const selectedIndex = this.$store.state.viewer.gridViewState?.selectedViewportIndex || 0;
                  if (viewports && viewports[selectedIndex]) {
                    targetViewport = viewports[selectedIndex];
                  } else if (viewports && viewports.length > 0) {
                    targetViewport = viewports[0];
                  }
                }
                if (!targetViewport) {
                  targetViewport = element;
                }
                if (targetViewport) {
                  const overlay = targetViewport.querySelector('.viewport-info-overlay') ||
                    (targetViewport !== element
                      ? element.querySelector('.viewport-info-overlay')
                      : null);
                  if (overlay) {
                    this.updateViewportInfo(overlay, targetViewport);
                  }
                }
              }
            } catch (e) {
              // 播放过程中信息同步失败时静默处理，避免中断播放
            }
          }
        };

        // 开始播放
        playbackService.startPlayback(element, imageIds, options);
        this.$store.dispatch('viewer/startPlayback', { type: 'regular' });
        
      } catch (error) {
        console.error('普通影像播放失败:', error);
        errorHandler.handleError(error, 'startRegularPlayback');
        this.$message.error('播放启动失败');
      }
    },

    /**
     * 切换播放控制 - 切换控制台显示/隐藏
     */
    togglePlayback() {
      if (this.showPlaybackConsole) {
        // 如果控制台已显示，则隐藏
        this.closePlaybackConsole();
      } else {
        // 如果控制台未显示，则显示
        this.openPlaybackConsole();
      }
    },

    /**
     * 打开播放控制台
     */
    openPlaybackConsole() {
      // 完全清理之前的播放状态
      this.cleanupPlayback();
      // 确保播放服务状态已清理
      if (playbackService.isPlaying() || playbackService.isPaused()) {
        playbackService.stopPlayback();
      }
      // 重置播放状态和配置
      this.resetPlaybackState();
      // 如果当前在最后一张，重置到第一张，确保下次播放能正常开始
      const currentSeries = this.$store.getters['dicom/currentSeries'];
      if (currentSeries && currentSeries.children && currentSeries.children.length > 0) {
        const currentIndex = this.$store.state.dicom.activeImageIndex || 0;
        const maxIndex = currentSeries.children.length - 1;
        if (currentIndex >= maxIndex) {
          // 如果在最后一张，重置到第一张
          this.$store.commit('dicom/SET_ACTIVE_IMAGE', 0);
        }
      }
      // 显示控制台
      this.showPlaybackConsole = true;
    },

    /**
     * 关闭播放控制台
     */
    closePlaybackConsole() {
      // 完全停止播放并清理状态
      this.cleanupPlayback();
      // 确保播放服务状态已清理
      if (playbackService.isPlaying() || playbackService.isPaused()) {
        playbackService.stopPlayback();
      }
      // 隐藏控制台（如果组件有该属性）
      if (this.hasOwnProperty('showPlaybackConsole')) {
        this.showPlaybackConsole = false;
      }
    },

    /**
     * 重置播放状态和配置
     */
    resetPlaybackState() {
      // 停止当前播放
      this.cleanupPlayback();
      // 重置播放速度到默认值
      this.$store.dispatch('viewer/setPlaybackSpeed', 10);
    },

    /**
     * 开始播放（从当前影像索引开始，播放到最后一帧，不循环）
     */
    async startPlayback() {
      try {
        // 完全清理之前的播放状态，确保重新开始
        this.cleanupPlayback();
        // 确保播放服务状态已清理
        if (playbackService.isPlaying() || playbackService.isPaused()) {
          playbackService.stopPlayback();
        }
        
        const currentSeries = this.$store.getters['dicom/currentSeries'];
        if (!currentSeries || !currentSeries.children || currentSeries.children.length === 0) {
          this.$message.error('没有可用的图像');
          return;
        }

        const imageIds = findDicomFiles(currentSeries, validateDicomFile, buildImageId);
        if (imageIds.length === 0) {
          this.$message.error('没有找到DICOM图像');
          return;
        }

        // 统一使用网格视口系统（1x1网格）
        // 确保网格视图已激活
        if (!this.isGridViewActive) {
          const layout = { rows: 1, cols: 1, totalSlots: 1 };
          await this.$store.dispatch('viewer/activateGridLayout', layout);
          if (typeof this.initializeGridView === 'function') {
            await this.initializeGridView();
          }
        }
        
        // 获取当前活动的视口元素
        let element = null;
        try {
          if (typeof this.getActiveElement === 'function') {
            element = this.getActiveElement();
          }
        } catch (error) {
          // getActiveElement 调用失败
        }
        
        if (!element) {
          // 如果获取失败，尝试从视口列表获取
          if (typeof this.getGridViewportElements === 'function') {
            const viewports = this.getGridViewportElements();
            const selectedIndex = this.$store.state.viewer.gridViewState?.selectedViewportIndex || 0;
            if (viewports[selectedIndex]) {
              element = viewports[selectedIndex];
            } else if (viewports.length > 0) {
              element = viewports[0];
            }
          }
        }
        
        if (!element) {
          this.$message.error('找不到显示区域');
          return;
        }

        await this.$cornerstoneService.ensureImageLoaderRegistered();
        
        // 确保视口已启用 Cornerstone（在网格视口中，视口应该已经启用）
        const cornerstone = this.$cornerstone;
        if (cornerstone) {
          try {
            const enabledElements = cornerstone.getEnabledElements();
            const isEnabled = enabledElements.find(el => el.element === element);
            if (!isEnabled) {
              cornerstone.enable(element);
            }
          } catch (error) {
            // 启用 Cornerstone 元素失败，可能已启用
          }
        }

        // 获取当前影像索引，如果已经在最后一张，则从最后一张开始
        let currentImageIndex = this.$store.state.dicom.activeImageIndex || 0;
        // 确保索引在有效范围内
        currentImageIndex = Math.max(0, Math.min(currentImageIndex, imageIds.length - 1));
        const startFrame = currentImageIndex;
        const endFrame = imageIds.length - 1;
        const speed = this.$store.state.viewer.playbackControl.speed || 10;

        // 保存起始帧索引，用于播放完成后重置（如果已经在最后一张，重置到第一张）
        const savedStartFrame = startFrame === endFrame ? 0 : startFrame;
        
        // 确保当前显示的影像索引正确
        this.$store.commit('dicom/SET_ACTIVE_IMAGE', startFrame);

        const options = {
          speed: speed,
          direction: 'forward',
          loop: false,
          startFrame: startFrame,
          endFrame: endFrame,
          onComplete: () => {
            // 播放完成后重置：使用与关闭控制台相同的清理逻辑
            const mixin = this;
            // 使用统一的清理方法
            mixin.cleanupPlayback();
            // 重置到播放开始时的位置
            mixin.$store.commit('dicom/SET_ACTIVE_IMAGE', savedStartFrame);
          },
          onFrameChange: (frameIndex, imageId) => {
            const actualIndex = Math.max(0, Math.min(frameIndex, imageIds.length - 1));
            this.$store.commit('dicom/SET_ACTIVE_IMAGE', actualIndex);
          }
        };

        playbackService.startPlayback(element, imageIds, options);
        this.$store.dispatch('viewer/startPlayback', { type: 'regular' });
        
      } catch (error) {
        console.error('开始播放失败:', error);
        errorHandler.handleError(error, 'startPlayback');
        this.$message.error('播放启动失败: ' + (error.message || '未知错误'));
      }
    },

    /**
     * 播放/暂停切换
     */
    async togglePlayPause() {
      try {
        // 优先检查 Vuex 状态，确保状态同步
        const vuexIsPlaying = this.$store.getters['viewer/isPlaying'];
        const vuexIsPaused = this.$store.getters['viewer/isPaused'];
        const serviceIsPlaying = playbackService.isPlaying();
        const serviceIsPaused = playbackService.isPaused();
        
        // 如果状态不一致，以 Vuex 状态为准，并同步服务状态
        if (vuexIsPlaying !== serviceIsPlaying || vuexIsPaused !== serviceIsPaused) {
          if (!vuexIsPlaying && !vuexIsPaused) {
            // Vuex 显示已停止，但服务可能还在运行，强制停止
            playbackService.stopPlayback();
          }
        }
        
        // 使用 Vuex 状态（更可靠）
        const isPlaying = vuexIsPlaying;
        const isPaused = vuexIsPaused;
        
        if (isPlaying) {
          this.pausePlayback();
        } else if (isPaused) {
          this.resumePlayback();
        } else {
          // 播放已完成或未开始，重新开始播放
          await this.startPlayback();
        }
      } catch (error) {
        console.error('播放/暂停切换失败:', error);
        this.$message.error('操作失败: ' + (error.message || '未知错误'));
      }
    },

    /**
     * 暂停播放（统一入口）
     */
    pausePlayback() {
      try {
        const isDynamicSeries = this.$store.state.dicom.isDynamicSeries;
        
        if (isDynamicSeries && cinePlaybackService.isPlaying()) {
          // 暂停动态影像播放
          cinePlaybackService.pauseCinePlayback();
          this.$store.dispatch('viewer/pausePlayback', { type: 'cine' });
        } else {
          // 暂停普通播放
          playbackService.pausePlayback();
          this.$store.dispatch('viewer/pausePlayback', { type: 'regular' });
        }
      } catch (error) {
        console.error('暂停播放失败:', error);
        errorHandler.handleError(error, 'pausePlayback');
      }
    },

    /**
     * 恢复播放（统一入口）
     */
    resumePlayback() {
      try {
        const isDynamicSeries = this.$store.state.dicom.isDynamicSeries;
        
        if (isDynamicSeries && cinePlaybackService.isPaused()) {
          // 恢复动态影像播放
          cinePlaybackService.resumeCinePlayback();
          this.$store.dispatch('viewer/startPlayback', { type: 'cine' });
        } else {
          // 恢复普通播放
          const currentSeries = this.$store.getters['dicom/currentSeries'];
          if (!currentSeries || !currentSeries.children || currentSeries.children.length === 0) {
            this.$message.error('没有可用的图像');
            return;
          }

          // 使用通用工具函数构建图像ID列表
          const imageIds = findDicomFiles(currentSeries, validateDicomFile, buildImageId);
        
          if (imageIds.length === 0) {
            this.$message.error('没有找到DICOM图像');
            return;
          }

          // 获取活动的元素（使用 getActiveElement 方法，更安全）
          let element = null;
          try {
            if (typeof this.getActiveElement === 'function') {
              element = this.getActiveElement();
            }
          } catch (error) {
            // getActiveElement 调用失败，使用默认元素
          }
          
          // 如果获取失败，使用主容器
          if (!element) {
            element = this.$refs.dicomViewer;
          }
          
          if (!element) {
            this.$message.error('找不到显示区域');
            return;
          }

          // 获取当前播放状态
          const currentFrame = playbackService.getCurrentFrame() || 0;
          const totalFrames = imageIds.length;
          const speed = this.$store.state.viewer.playbackControl.speed || 10;
          
          
          // 恢复播放：从当前帧继续播放到最后一帧
          const options = {
            speed: speed,
            direction: 'forward',
            loop: false,
            startFrame: Math.max(0, Math.min(currentFrame, totalFrames - 1)),
            endFrame: totalFrames - 1,
            onComplete: () => {
              // 播放结束回调：重置播放状态
              this.$store.dispatch('viewer/stopPlayback', { type: 'regular' });
            },
            // 帧变化时，同步当前影像序号到 Vuex / stack / 视口信息栏
            onFrameChange: (frameIndex, imageId) => {
              const actualIndex = Math.max(0, Math.min(frameIndex, imageIds.length - 1));
              try {
                // 1) 同步当前影像索引
                this.$store.commit('dicom/SET_ACTIVE_IMAGE', actualIndex);

                // 2) 尝试同步当前视口的 stack.currentImageIdIndex
                if (this.$cornerstoneTools && element) {
                  const tools = this.$cornerstoneTools;
                  let targetElement = element;
                  if (typeof this.getActiveElement === 'function') {
                    try {
                      const activeEl = this.getActiveElement();
                      if (activeEl) {
                        targetElement = activeEl;
                      }
                    } catch (e) {
                      // 忽略 getActiveElement 失败
                    }
                  }
                  const stackState = tools.getToolState(targetElement, 'stack');
                  if (stackState && stackState.data && stackState.data.length > 0) {
                    stackState.data[0].currentImageIdIndex = actualIndex;
                  }
                }

                // 3) 主动刷新一次视口信息栏（Image No）
                if (typeof this.updateViewportInfo === 'function') {
                  let targetViewport = null;
                  if (typeof this.getGridViewportElements === 'function') {
                    const viewports = this.getGridViewportElements();
                    const selectedIndex = this.$store.state.viewer.gridViewState?.selectedViewportIndex || 0;
                    if (viewports && viewports[selectedIndex]) {
                      targetViewport = viewports[selectedIndex];
                    } else if (viewports && viewports.length > 0) {
                      targetViewport = viewports[0];
                    }
                  }
                  if (!targetViewport) {
                    targetViewport = element;
                  }
                  if (targetViewport) {
                    const overlay = targetViewport.querySelector('.viewport-info-overlay') ||
                      (targetViewport !== element
                        ? element.querySelector('.viewport-info-overlay')
                        : null);
                    if (overlay) {
                      this.updateViewportInfo(overlay, targetViewport);
                    }
                  }
                }
              } catch (e) {
                // 播放过程中信息同步失败时静默处理
              }
            }
          };

          playbackService.resumePlayback(element, imageIds, options);
          this.$store.dispatch('viewer/startPlayback', { type: 'regular' });
        }
        
      } catch (error) {
        console.error('恢复播放失败:', error);
        errorHandler.handleError(error, 'resumePlayback');
        this.$message.error('恢复播放失败');
      }
    },

    /**
     * 上一张影像
     * 普通影像：跳转到上一个影像
     * 动态影像：跳转到上一个影像的第一帧（frame=0）
     * 注意：不管播放状态还是非播放状态都应该有效
     */
    async previousImage() {
      try {
        // 如果正在播放，先暂停（不清理，只是暂停）
        const isPlaying = this.$store.getters['viewer/isPlaying'];
        const isPaused = this.$store.getters['viewer/isPaused'];
        if (isPlaying && !isPaused) {
          this.pausePlayback();
        }
        
        const { imageFiles, currentImageFileIndex } = this.getCurrentImageFileIndex();
        // 检查是否有效：必须有图像文件，且当前索引有效且大于0
        if (imageFiles.length === 0 || currentImageFileIndex < 0 || currentImageFileIndex === 0) {
          return;
        }
        
        const previousImageFile = imageFiles[currentImageFileIndex - 1];
        if (!previousImageFile) {
          return;
        }
        
        await this.loadImageFile(previousImageFile, true);
        
        // 确保计算属性能正确更新：强制触发响应式更新
        await this.$nextTick();
        this.$forceUpdate();
      } catch (error) {
        errorHandler.handleError(error, 'previousImage');
      }
    },

    /**
     * 下一张影像
     * 普通影像：跳转到下一个影像
     * 动态影像：跳转到下一个影像的第一帧（frame=0）
     * 注意：不管播放状态还是非播放状态都应该有效
     */
    async nextImage() {
      try {
        // 如果正在播放，先暂停（不清理，只是暂停）
        const isPlaying = this.$store.getters['viewer/isPlaying'];
        const isPaused = this.$store.getters['viewer/isPaused'];
        if (isPlaying && !isPaused) {
          this.pausePlayback();
        }
        
        const { imageFiles, currentImageFileIndex } = this.getCurrentImageFileIndex();
        if (imageFiles.length === 0 || currentImageFileIndex < 0 || currentImageFileIndex >= imageFiles.length - 1) {
          return;
        }
        
        const nextImageFile = imageFiles[currentImageFileIndex + 1];
        if (!nextImageFile) {
          return;
        }
        
        await this.loadImageFile(nextImageFile, true);
        
        // 确保计算属性能正确更新：强制触发响应式更新
        await this.$nextTick();
        this.$forceUpdate();
      } catch (error) {
        errorHandler.handleError(error, 'nextImage');
      }
    },

    /**
     * 停止播放（统一入口）
     */
    async stopPlayback() {
      try {
        const isDynamicSeries = this.$store.state.dicom.isDynamicSeries;
        
        if (isDynamicSeries && (cinePlaybackService.isPlaying() || cinePlaybackService.isPaused())) {
          // 停止动态影像播放
          cinePlaybackService.stopCinePlayback();
          cinePlaybackService.cleanup();
          await this.$store.dispatch('viewer/stopPlayback', { type: 'cine' });
        } else {
          // 停止普通播放
          playbackService.stopPlayback();
          await this.$store.dispatch('viewer/stopPlayback', { type: 'regular' });
        }
      } catch (error) {
        console.error('停止播放失败:', error);
        errorHandler.handleError(error, 'stopPlayback');
      }
    },

    /**
     * 暂停动态影像播放
     */
    pauseCinePlayback() {
      try {
        cinePlaybackService.pauseCinePlayback();
        // 暂停时不调用stopPlayback，保持播放状态但标记为暂停
        this.$store.dispatch('viewer/pausePlayback');
      } catch (error) {
        console.error('暂停动态影像播放失败:', error);
        errorHandler.handleError(error, 'pauseCinePlayback');
      }
    },

    /**
     * 恢复动态影像播放
     */
    resumeCinePlayback() {
      try {
        cinePlaybackService.resumeCinePlayback();
        this.$store.dispatch('viewer/startPlayback');
      } catch (error) {
        console.error('恢复动态影像播放失败:', error);
        errorHandler.handleError(error, 'resumeCinePlayback');
      }
    },

    /**
     * 停止动态影像播放
     */
    stopCinePlayback() {
      try {
        cinePlaybackService.stopCinePlayback();
        this.$store.dispatch('viewer/stopPlayback');
      } catch (error) {
        console.error('停止动态影像播放失败:', error);
        errorHandler.handleError(error, 'stopCinePlayback');
      }
    },

    /**
     * 显示动态影像设置
     */
    showCineSettings() {
      const frameInfo = cinePlaybackService.getCurrentFrameInfo();
      this.$message({
        message: `当前帧: ${frameInfo.currentFrame + 1}/${frameInfo.totalFrames}, 速度: ${frameInfo.speed} FPS`,
        type: 'info',
        duration: 2000
      });
    }
  }
};

