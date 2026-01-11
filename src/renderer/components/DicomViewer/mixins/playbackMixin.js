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
     * 构建所有帧的二维数组（影像 × 帧）
     */
    buildAllFramesArray() {
      const currentSeries = this.$store.getters['dicom/currentSeries'];
      if (!currentSeries) {
        return { allFrames: [], frameToImageMap: [], currentFrameIndex: -1 };
      }

      const sourceNodes = currentSeries._allImageNodes || currentSeries.children || [];
      const imageFiles = sourceNodes.filter(child => child?.isFile && !child.isFrame);
      if (imageFiles.length === 0) {
        return { allFrames: [], frameToImageMap: [], currentFrameIndex: -1 };
      }

      const normalizePath = (path) => (path || '').replace(/\\/g, '/').toLowerCase();

      // 关键修复：确保 imageFiles 按 Instance Number 排序，防止播放顺序错乱
      imageFiles.sort((a, b) => {
        const numA = parseInt(a.instanceNumber, 10);
        const numB = parseInt(b.instanceNumber, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        // 如果没有 Instance Number，按文件名/路径排序
        const pathA = normalizePath(a.fullPath || a.path);
        const pathB = normalizePath(b.fullPath || b.path);
        if (pathA < pathB) return -1;
        if (pathA > pathB) return 1;
        return 0;
      });

      const allFrames = [];
      const frameToImageMap = [];

      for (let imageIndex = 0; imageIndex < imageFiles.length; imageIndex++) {
        const imageFile = imageFiles[imageIndex];
        const imagePath = imageFile.fullPath || imageFile.path;
        const cineInfo = dicomService.cineService.isCineImage(imagePath);

        if (cineInfo?.isCine && cineInfo.frameCount > 1) {
          const normalizedImagePath = normalizePath(imagePath);
          let frames = sourceNodes.filter(child =>
            child.isFrame && child.parentCineImage &&
            normalizePath(child.parentCineImage.fullPath || child.parentCineImage.path) === normalizedImagePath
          );

          if (frames.length < cineInfo.frameCount) {
            try {
              const extractedFrames = dicomService.cineService.extractFramesFromCineImage(imageFile, cineInfo);
              if (extractedFrames?.length) frames = extractedFrames;
            } catch (error) {
              console.warn('提取动态影像帧失败:', error);
            }
          }

          frames.sort((a, b) => (a.frameIndex || 0) - (b.frameIndex || 0));
          if (frames.length > 0) {
            frames.forEach(frame => {
              allFrames.push(frame);
              frameToImageMap.push(imageIndex);
            });
          } else {
            allFrames.push(imageFile);
            frameToImageMap.push(imageIndex);
          }
        } else {
          allFrames.push(imageFile);
          frameToImageMap.push(imageIndex);
        }
      }

      // 计算当前帧索引
      const currentIndex = this.$store.state.dicom.activeImageIndex || 0;
      const currentFrameNode = currentSeries.children?.[currentIndex] || currentSeries._allImageNodes?.[currentIndex];
      let currentFrameIndex = -1;

      if (currentFrameNode) {
        // 1. 优先尝试直接对象引用匹配 (最准确)
        currentFrameIndex = allFrames.indexOf(currentFrameNode);

        // 2. 如果对象匹配失败，尝试通过路径+帧索引匹配
        if (currentFrameIndex === -1) {
          const getNodePath = (node) => normalizePath(node?.fullPath || node?.path || '');
          const currentPath = getNodePath(currentFrameNode);

          if (currentPath) {
            if (currentFrameNode.isFrame) {
              // 如果是帧，需要匹配 path 和 frameIndex
              currentFrameIndex = allFrames.findIndex(frame =>
                frame.isFrame &&
                getNodePath(frame) === currentPath &&
                frame.frameIndex === currentFrameNode.frameIndex
              );
            } else {
              // 如果是普通文件
              currentFrameIndex = allFrames.findIndex(frame =>
                !frame.isFrame &&
                getNodePath(frame) === currentPath
              );
            }
          }
        }
      }

      if (currentFrameIndex === -1) {
        const { currentImageFileIndex } = this.getCurrentImageFileIndex();
        if (currentImageFileIndex >= 0 && currentImageFileIndex < frameToImageMap.length) {
          // 找到对应的第一个帧
          currentFrameIndex = frameToImageMap.findIndex(imgIdx => imgIdx === currentImageFileIndex);
        }
        if (currentFrameIndex === -1 && allFrames.length > 0) {
          currentFrameIndex = 0;
        }
      }

      return { allFrames, frameToImageMap, currentFrameIndex };
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
      let imageFiles = sourceNodes.filter(child => {
        return child.isFile && !child.isFrame;
      });

      // 关键修复：确保 imageFiles 按 Instance Number 排序，与 buildAllFramesArray 保持一致
      const normalizePath = (path) => (path || '').replace(/\\/g, '/').toLowerCase();
      imageFiles.sort((a, b) => {
        const numA = parseInt(a.instanceNumber, 10);
        const numB = parseInt(b.instanceNumber, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        const pathA = normalizePath(a.fullPath || a.path);
        const pathB = normalizePath(b.fullPath || b.path);
        if (pathA < pathB) return -1;
        if (pathA > pathB) return 1;
        return 0;
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
          const normalizePath = (path) => {
            if (!path) return null;
            return path.replace(/\\/g, '/').toLowerCase();
          };
          const normalizedImagePath = normalizePath(imagePath);

          targetIndex = currentSeries.children.findIndex(child => {
            if (child.isFrame && child.parentCineImage) {
              const parentPath = child.parentCineImage.fullPath || child.parentCineImage.path;
              return normalizePath(parentPath) === normalizedImagePath && child.frameIndex === 0;
            }
            return false;
          });

          // 如果找不到第一帧，尝试生成帧节点并添加到 children
          if (targetIndex === -1) {
            try {
              const frameNodes = dicomService.cineService.extractFramesFromCineImage(imageFile, cineInfo);
              if (frameNodes && frameNodes.length > 0) {
                // 添加第一帧到 children
                this.$store.commit('dicom/ADD_IMAGES_TO_SERIES_BATCH', {
                  seriesIndex: this.$store.state.dicom.activeSeriesIndex,
                  imageNodes: [frameNodes[0]]
                });
                // 重新获取系列（可能已经被更新）
                const updatedSeries = this.$store.getters['dicom/currentSeries'];
                if (updatedSeries && updatedSeries.children) {
                  targetIndex = updatedSeries.children.findIndex(child => {
                    if (child.isFrame && child.parentCineImage) {
                      const parentPath = child.parentCineImage.fullPath || child.parentCineImage.path;
                      return normalizePath(parentPath) === normalizedImagePath && child.frameIndex === 0;
                    }
                    return false;
                  });
                }
              }
            } catch (error) {
              console.warn('生成动态影像帧节点失败:', error);
            }
          }
        } else {
          // 普通影像：直接加载
          const normalizePath = (path) => {
            if (!path) return null;
            return path.replace(/\\/g, '/').toLowerCase();
          };
          const normalizedImagePath = normalizePath(imagePath);

          targetIndex = currentSeries.children.findIndex(child => {
            const childPath = child.fullPath || child.path;
            return normalizePath(childPath) === normalizedImagePath && child.isFile && !child.isFrame;
          });
        }

        if (targetIndex === -1) {
          console.warn('loadImageFile: 无法找到目标索引', { imagePath, loadFirstFrame });
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
     * @param {boolean} options.skipCleanup - 是否跳过清理之前的播放状态（用于无缝切换影像）
     * @param {boolean} options.skipMessage - 是否跳过显示提示消息（用于无缝切换影像）
     */
    async startCinePlayback(options = {}) {
      try {
        // 清理之前的播放状态（除非明确要求跳过，用于无缝切换）
        if (!options.skipCleanup) {
          this.cleanupPlayback();
        } else {
          // 即使跳过清理，也需要停止当前的动态影像播放（因为要切换到新的影像文件）
          if (cinePlaybackService.isPlaying() || cinePlaybackService.isPaused()) {
            cinePlaybackService.stopCinePlayback();
          }
        }

        const cineInfo = this.$store.state.dicom.cineInfo;
        const currentCineImagePath = this.$store.state.dicom.currentCineImagePath;

        // 参数验证
        if (!cineInfo || !currentCineImagePath) {
          console.error('动态影像信息不完整');
          if (!options.skipMessage) {
            this.$message.error('动态影像信息不完整，无法播放');
          }
          return;
        }

        if (!cineInfo.frameCount || cineInfo.frameCount < 1) {
          console.error('动态影像帧数无效:', cineInfo.frameCount);
          if (!options.skipMessage) {
            this.$message.error('动态影像帧数无效');
          }
          return;
        }

        // 获取正确的视口元素（优先使用网格视口，确保已启用）
        let element = null;
        try {
          // 优先从网格视口获取
          if (typeof this.getGridViewportElements === 'function') {
            const viewports = this.getGridViewportElements();
            const viewportIndex = this.isGridViewActive
              ? (this.$store.state.viewer.gridViewState?.selectedViewportIndex || 0)
              : 0;
            if (viewports && viewports[viewportIndex]) {
              element = viewports[viewportIndex];
            } else if (viewports && viewports.length > 0) {
              element = viewports[0];
            }
          }

          // 如果没有网格视口，使用 dicomViewer
          if (!element) {
            element = this.$refs.dicomViewer;
          }
        } catch (error) {
          // 获取视口元素失败，使用默认值
          element = this.$refs.dicomViewer;
        }

        if (!element) {
          console.error('找不到DICOM查看器元素');
          if (!options.skipMessage) {
            this.$message.error('找不到显示区域');
          }
          return;
        }

        // 确保图像加载器已注册
        await this.$cornerstoneService.ensureImageLoaderRegistered();

        // 确保视口已启用 Cornerstone（关键：避免 element not enabled 错误）
        const cornerstone = this.$cornerstone;
        if (cornerstone) {
          try {
            const enabledElements = cornerstone.getEnabledElements();
            const isEnabled = enabledElements.find(el => el.element === element);
            if (!isEnabled) {
              cornerstone.enable(element);
            }
          } catch (error) {
            // 启用 Cornerstone 元素失败，可能已启用或元素无效
            console.warn('启用 Cornerstone 元素失败:', error);
          }
        }

        // 构建图像ID（统一使用 file:// 前缀，避免在开发模式下被当作 http://localhost:9080 路径）
        const imageNode = { fullPath: currentCineImagePath, path: currentCineImagePath };
        const imageId = buildImageId(imageNode);

        // 设置播放参数
        const playbackOptions = {
          speed: Math.max(1, Math.min(30, options.speed || 10)),
          direction: options.direction === 'backward' ? 'backward' : 'forward',
          startFrame: Math.max(0, options.startFrame || 0),
          // 帧变化回调：同步状态
          onFrameChange: (frameIndex) => {
            // 1. 同步全局活动影像索引 (Active Image Index)
            // 对于动态影像，activeImageIndex 对应的是帧索引
            this.$store.commit('dicom/SET_ACTIVE_IMAGE', frameIndex);

            // 2. 同步 Cornerstone Tool Stack 状态
            // 确保 Tool 状态与显示的帧一致，这样 updateViewportInfo 才能获取正确的 Image No
            if (element && this.$cornerstoneTools) {
              try {
                const stackState = this.$cornerstoneTools.getToolState(element, 'stack');
                if (stackState && stackState.data && stackState.data.length > 0) {
                  const stack = stackState.data[0];
                  // 只有在 stack 包含足够数量的图像时才更新
                  // 对于动态影像，stack 可能包含多个图像ID（如果是分解帧的情况）
                  if (stack.imageIds && frameIndex < stack.imageIds.length) {
                    stack.currentImageIdIndex = frameIndex;
                  }
                }
              } catch (e) {
                // console.warn('Stack sync failed', e);
              }
            }

            // 3. 直接更新视口信息 (Image No)
            // 对于动态影像，Image No 就是帧索引 + 1
            if (element) {
              try {
                const overlay = element.querySelector('.grid-image-info-overlay') ||
                  element.querySelector('.viewport-info-overlay');
                if (overlay) {
                  const imageNoElement = overlay.querySelector('.image-no-item');
                  if (imageNoElement) {
                    imageNoElement.textContent = `Image No : ${frameIndex + 1}`;
                  }
                }
              } catch (e) { }
            }
          }
        };

        // 开始动态影像播放
        cinePlaybackService.startCinePlayback(element, imageId, cineInfo, playbackOptions);

        // 更新Vuex状态
        this.$store.dispatch('viewer/startPlayback', { type: 'cine' });

        // 显示播放控制提示（除非明确要求跳过，用于无缝切换）
        if (!options.skipMessage) {
          this.$message({
            message: `动态影像帧播放已开始 (${cineInfo.frameCount}帧, ${cineInfo.type || 'multi-frame'})`,
            type: 'success',
            duration: 3000
          });
        }

      } catch (error) {
        console.error('动态影像播放失败:', error);
        errorHandler.handleError(error, 'startCinePlayback');
        if (!options.skipMessage) {
          this.$message.error('动态影像播放启动失败: ' + (error.message || '未知错误'));
        }
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

        // 优先获取 Grid Viewport，如果找不到再退回到 dicomViewer
        // 关键修复：确保 element 始终是指向实际渲染的视口，避免操作到底层容器
        let element = null;
        if (typeof this.getGridViewportElements === 'function') {
          const viewports = this.getGridViewportElements();
          const selectedIndex = this.$store.state.viewer.gridViewState?.selectedViewportIndex || 0;
          if (viewports && viewports[selectedIndex]) {
            element = viewports[selectedIndex];
          } else if (viewports && viewports.length > 0) {
            element = viewports[0];
          }
        }

        if (!element) {
          element = this.$refs.dicomViewer;
        }

        if (!element) {
          console.error('找不到DICOM查看器元素');
          return;
        }

        // 确保图像加载器已注册
        await this.$cornerstoneService.ensureImageLoaderRegistered();

        // 确定开始帧：如果没有指定，则尝试获取当前视口的帧索引，避免每次都从头播放
        let defaultStartFrame = 0;
        if (playbackOptions.startFrame === undefined || playbackOptions.startFrame === null) {
          try {
            // 尝试通过 Stack State 获取当前显示的图像索引
            if (this.$cornerstoneTools) {
              const stackState = this.$cornerstoneTools.getToolState(element, 'stack');
              if (stackState && stackState.data && stackState.data.length > 0) {
                const currentIndex = stackState.data[0].currentImageIdIndex;
                if (typeof currentIndex === 'number') {
                  defaultStartFrame = currentIndex;
                }
              }
            }
          } catch (e) {
            // 获取失败，默认为 0
          }
        }

        // 设置播放参数
        const options = {
          speed: playbackOptions.speed || 10,
          direction: playbackOptions.direction || 'forward',
          loop: playbackOptions.loop !== false,
          startFrame: playbackOptions.startFrame !== undefined ? playbackOptions.startFrame : defaultStartFrame,
          endFrame: Math.min(imageIds.length - 1, playbackOptions.endFrame || imageIds.length - 1),
          onComplete: playbackOptions.onComplete,
          // 帧变化时，同步当前影像序号到 Vuex / stack / 视口信息栏
          onFrameChange: (frameIndex, imageId) => {
            const actualIndex = Math.max(0, Math.min(frameIndex, imageIds.length - 1));
            try {
              // 1) 同步当前影像索引（全局 Vuex）
              this.$store.commit('dicom/SET_ACTIVE_IMAGE', actualIndex);

              // 2) 同步当前播放视口的 stack.currentImageIdIndex
              // 必须直接更新正在播放的那个 element，而不是尝试获取当前获焦的元素
              if (this.$cornerstoneTools && element) {
                const tools = this.$cornerstoneTools;
                const stackState = tools.getToolState(element, 'stack');
                if (stackState && stackState.data && stackState.data.length > 0) {
                  stackState.data[0].currentImageIdIndex = actualIndex;
                }
              }

              // 3) 主动刷新当前播放视口的信息栏（Image No）
              // 直接操作 DOM 以确保性能和准确性，避开 updateViewportInfo 中的复杂计算和潜在副作用
              // 同时也避免与 Cornerstone 的被动事件冲突
              if (element) {
                // 尝试在 element 内部查找 overlay
                let overlay = element.querySelector('.grid-image-info-overlay') ||
                  element.querySelector('.viewport-info-overlay');

                // 如果直接找不到，可能 element 本身就是 overlay (不太可能) 或者结构变化
                // 兜底：更新所有可能的 Image No 显示位置（因为 element 已经是特定的视口了）
                if (overlay) {
                  // 优先使用 updateViewportInfo 更新其他信息（如 WW/WC），传入 forceIndex
                  if (typeof this.updateViewportInfo === 'function') {
                    // 注意：这里我们依然调用 updateViewportInfo 来更新其他参数，但随后我们手动覆盖 Image No
                    this.updateViewportInfo(overlay, element, actualIndex);
                  }

                  // 强制直接更新 Image No
                  const imageNoElement = overlay.querySelector('.image-no-item');
                  if (imageNoElement) {
                    // 假设 Image No 就是 index + 1。如果需要更复杂的逻辑（如 Instance Number），可以在这里扩展
                    // 但通常 index + 1 对于播放进度指示足够了
                    imageNoElement.textContent = `Image No : ${actualIndex + 1}`;
                  }
                }
              }
            } catch (e) {
              // 播放过程中信息同步失败时静默处理，避免中断播放
              console.warn('Playback info sync failed:', e);
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
     * 开始播放（统一为播放帧数：从当前帧开始，播放到最后一帧，不循环）
     * 普通影像：1个影像 = 1帧
     * 动态影像：1个影像 = 多帧
     * @param {Object} config - 播放配置选项
     * @param {boolean} config.skipCleanup - 是否跳过清理之前的播放状态（用于无缝切换影像）
     * @param {boolean} config.skipMessage - 是否跳过显示提示消息（用于无缝切换影像）
     */
    async startPlayback(config = {}) {
      try {
        // 完全清理之前的播放状态，确保重新开始（除非明确要求跳过，用于无缝切换）
        if (!config.skipCleanup) {
          this.cleanupPlayback();
        }
        // 确保播放服务状态已清理（即使跳过清理，也需要停止当前播放以切换到新影像）
        if (playbackService.isPlaying() || playbackService.isPaused()) {
          playbackService.stopPlayback();
        }
        // 停止动态影像播放（如果正在播放）
        if (cinePlaybackService.isPlaying() || cinePlaybackService.isPaused()) {
          cinePlaybackService.stopCinePlayback();
        }

        // 构建所有帧的二维数组（影像 × 帧）
        const { allFrames, frameToImageMap, currentFrameIndex } = this.buildAllFramesArray();
        if (allFrames.length === 0) {
          if (!config.skipMessage) {
            this.$message.error('没有可用的帧');
          }
          return;
        }

        // 基于所有帧构建 imageIds
        const imageIds = allFrames.map(frame => buildImageId(frame)).filter(id => id !== null);
        if (imageIds.length === 0) {
          if (!config.skipMessage) {
            this.$message.error('没有找到DICOM图像');
          }
          return;
        }

        // 统一使用网格视口系统（1x1网格）
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
          if (!config.skipMessage) {
            this.$message.error('找不到显示区域');
          }
          return;
        }

        await this.$cornerstoneService.ensureImageLoaderRegistered();

        // 确保视口已启用 Cornerstone
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

        // 获取当前帧索引（基于 allFrames）
        let startFrameIndex = currentFrameIndex >= 0 ? currentFrameIndex : 0;
        startFrameIndex = Math.max(0, Math.min(startFrameIndex, imageIds.length - 1));
        const endFrameIndex = imageIds.length - 1;
        const speed = this.$store.state.viewer.playbackControl.speed || 10;

        // --- 预计算元数据以优化性能 (解决卡顿和计数与ImageNo不一致问题) --- //
        const currentSeries = this.$store.getters['dicom/currentSeries'];
        const children = currentSeries ? (currentSeries.children || []) : [];
        const normalizePath = (p) => (p || '').replace(/\\/g, '/').toLowerCase();

        // 1. 构建路径到 Children 索引的映射
        const pathToNodesMap = new Map();
        children.forEach((child, index) => {
          const p = normalizePath(child.fullPath || child.path);
          if (p) {
            if (!pathToNodesMap.has(p)) pathToNodesMap.set(p, []);
            pathToNodesMap.get(p).push({
              node: child,
              index: index,
              frameIndex: child.frameIndex,
              isFrame: !!child.isFrame
            });
          }
        });

        // 2. 预计算每一帧的播放信息
        const frameMetadataList = new Array(allFrames.length);

        // 分组计数 (确定 Local Total)
        const keyCounts = new Map();
        const frameKeys = [];

        allFrames.forEach(frame => {
          let key = null;
          if (frame.isFrame && frame.parentCineImage) {
            key = normalizePath(frame.parentCineImage.fullPath || frame.parentCineImage.path);
          } else {
            key = normalizePath(frame.fullPath || frame.path);
          }
          frameKeys.push(key);
          keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
        });

        // 构建具体信息
        const runningCounts = new Map();
        for (let i = 0; i < allFrames.length; i++) {
          const frame = allFrames[i];
          const key = frameKeys[i];

          // 计算 Local Current
          const current = (runningCounts.get(key) || 0) + 1;
          runningCounts.set(key, current);
          const total = keyCounts.get(key) || 1;

          // 计算 Target Active Index
          let targetIndex = -1;
          // 优先直接查找
          const directIndex = children.indexOf(frame);
          if (directIndex >= 0) {
            targetIndex = directIndex;
          } else {
            // 路径查找
            const p = normalizePath(frame.fullPath || frame.path);
            const candidates = pathToNodesMap.get(p);
            if (candidates) {
              if (frame.isFrame) {
                const match = candidates.find(c => c.isFrame && c.frameIndex === frame.frameIndex);
                if (match) targetIndex = match.index;
                else targetIndex = candidates[0].index;
              } else {
                targetIndex = candidates[0].index;
              }
            }
          }
          if (targetIndex === -1 && i > 0) targetIndex = frameMetadataList[i - 1].targetIndex;
          if (targetIndex === -1) targetIndex = 0;

          frameMetadataList[i] = {
            localCurrent: current,
            localTotal: total,
            targetActiveIndex: targetIndex
          };
        }
        // ---------------------------------------------------------------- //

        const options = {
          speed: speed,
          direction: 'forward',
          loop: false,
          startFrame: startFrameIndex,
          endFrame: endFrameIndex,
          onComplete: () => {
            const mixin = this;
            mixin.cleanupPlayback();
            // 保持在最后一帧的状态
            if (endFrameIndex >= 0 && endFrameIndex < frameMetadataList.length) {
              const meta = frameMetadataList[endFrameIndex];
              mixin.$store.commit('dicom/SET_ACTIVE_IMAGE', meta.targetActiveIndex);
              mixin.$store.commit('viewer/SET_PLAYBACK_CONTROL', {
                currentFrame: meta.localCurrent - 1,
                totalFrames: meta.localTotal
              });
            }
          },
          onFrameChange: (frameIndex, imageId) => {
            // 通过预计算的元数据快速更新
            const meta = frameMetadataList[frameIndex];
            if (!meta) return;

            // 1. 更新播放器 Local 帧数显示
            this.$store.commit('viewer/SET_PLAYBACK_CONTROL', {
              currentFrame: meta.localCurrent - 1,
              totalFrames: meta.localTotal
            });

            // 2. 更新 Viewport Image No
            this.$store.commit('dicom/SET_ACTIVE_IMAGE', meta.targetActiveIndex);

            // 3. 同步 Stack 状态
            if (element && this.$cornerstoneTools) {
              try {
                const stackState = this.$cornerstoneTools.getToolState(element, 'stack');
                if (stackState && stackState.data && stackState.data.length > 0) {
                  const stack = stackState.data[0];
                  if (stack.imageIds) {
                    if (frameIndex < stack.imageIds.length) {
                      stack.currentImageIdIndex = frameIndex;
                    } else if ((meta.localCurrent - 1) < stack.imageIds.length) {
                      stack.currentImageIdIndex = meta.localCurrent - 1;
                    }
                  }
                }
              } catch (e) { }
            }

            // 4. 直接更新视口信息显示 (Image No)
            // 不依赖 updateViewportInfo，直接更新 DOM 以确保实时同步
            if (element) {
              try {
                const overlay = element.querySelector('.grid-image-info-overlay') ||
                  element.querySelector('.viewport-info-overlay');
                if (overlay) {
                  const imageNoElement = overlay.querySelector('.image-no-item');
                  if (imageNoElement) {
                    // 使用 frameToImageMap 获取正确的影像文件序号
                    const imageFileIndex = frameToImageMap[frameIndex];
                    const imageNo = (typeof imageFileIndex === 'number' ? imageFileIndex : frameIndex) + 1;
                    imageNoElement.textContent = `Image No : ${imageNo}`;
                  }
                }
              } catch (e) { }
            }
          }
        };

        playbackService.startPlayback(element, imageIds, options);

        // 初始设置状态
        if (frameMetadataList[startFrameIndex]) {
          const meta = frameMetadataList[startFrameIndex];
          this.$store.commit('viewer/SET_PLAYBACK_CONTROL', {
            currentFrame: meta.localCurrent - 1,
            totalFrames: meta.localTotal
          });
        }

        this.$store.dispatch('viewer/startPlayback', { type: 'regular' });

      } catch (error) {
        console.error('开始播放失败:', error);
        errorHandler.handleError(error, 'startPlayback');
        if (!config.skipMessage) {
          this.$message.error('播放启动失败: ' + (error.message || '未知错误'));
        }
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
     * 简化逻辑：直接调用 startPlayback，使用当前暂停帧作为起始帧
     */
    async resumePlayback() {
      try {
        const isDynamicSeries = this.$store.state.dicom.isDynamicSeries;

        if (isDynamicSeries && cinePlaybackService.isPaused()) {
          // 恢复动态影像播放
          cinePlaybackService.resumeCinePlayback();
          this.$store.dispatch('viewer/startPlayback', { type: 'cine' });
        } else {
          // 恢复普通播放：获取当前暂停的帧索引，然后调用 startPlayback 从该帧继续
          const currentFrame = playbackService.getCurrentFrame() || 0;

          // 先停止旧的播放状态
          playbackService.stopPlayback();

          // 构建帧数组以确定正确的起始位置
          const { allFrames, currentFrameIndex } = this.buildAllFramesArray();

          // 使用暂停时的帧位置，或者当前帧位置作为起始帧
          // 优先使用 playbackService 记录的 currentFrame（更准确）
          let resumeFrameIndex = currentFrame;
          if (resumeFrameIndex < 0 || resumeFrameIndex >= allFrames.length) {
            resumeFrameIndex = currentFrameIndex >= 0 ? currentFrameIndex : 0;
          }

          // 更新 Vuex 中的 activeImageIndex 以匹配恢复位置
          if (allFrames[resumeFrameIndex]) {
            const currentSeries = this.$store.getters['dicom/currentSeries'];
            if (currentSeries?.children) {
              const targetFrame = allFrames[resumeFrameIndex];
              const targetIndex = currentSeries.children.indexOf(targetFrame);
              if (targetIndex >= 0) {
                this.$store.commit('dicom/SET_ACTIVE_IMAGE', targetIndex);
              }
            }
          }

          // 调用 startPlayback，复用其完整的预计算元数据逻辑
          await this.startPlayback({ skipCleanup: true, skipMessage: true });
        }
      } catch (error) {
        console.error('恢复播放失败:', error);
        errorHandler.handleError(error, 'resumePlayback');
        this.$message.error('恢复播放失败');
      }
    },

    /**
     * 上一张影像
     */
    async previousImage() {
      await this.navigateImage(-1);
    },

    /**
     * 下一张影像
     */
    async nextImage() {
      await this.navigateImage(1);
    },

    /**
     * 切换影像（通用方法）
     */
    async navigateImage(direction) {
      try {
        const { imageFiles, currentImageFileIndex } = this.getCurrentImageFileIndex();
        if (imageFiles.length === 0 || currentImageFileIndex < 0) return;

        const targetIndex = currentImageFileIndex + direction;
        if (targetIndex < 0 || targetIndex >= imageFiles.length) return;

        const targetImageFile = imageFiles[targetIndex];
        if (!targetImageFile) return;

        await this.switchToImageFile(targetImageFile);
        await this.resumePlaybackIfNeeded();
      } catch (error) {
        errorHandler.handleError(error, direction === -1 ? 'previousImage' : 'nextImage');
      }
    },

    /**
     * 如果正在播放，继续播放
     */
    async resumePlaybackIfNeeded() {
      const wasPlaying = (playbackService.isPlaying() && !playbackService.isPaused()) ||
        (cinePlaybackService.isPlaying() && !cinePlaybackService.isPaused());
      if (wasPlaying) {
        await this.$nextTick();
        await this.startPlayback({ skipCleanup: true, skipMessage: true });
      }
    },

    /**
     * 直接切换到指定影像文件的第一帧
     */
    async switchToImageFile(imageFile) {
      if (!imageFile) return;

      const currentSeries = this.$store.getters['dicom/currentSeries'];
      if (!currentSeries?.children) return;

      const imagePath = imageFile.fullPath || imageFile.path;
      if (!imagePath) return;

      const normalizePath = (path) => (path || '').replace(/\\/g, '/').toLowerCase();
      const normalizedImagePath = normalizePath(imagePath);
      const cineInfo = dicomService.cineService.isCineImage(imagePath);

      // 查找目标帧在 children 中的索引
      let targetChildrenIndex = cineInfo?.isCine && cineInfo.frameCount > 1
        ? this.findCineFirstFrameIndex(currentSeries.children, normalizedImagePath, normalizePath)
        : currentSeries.children.findIndex(child =>
          normalizePath(child.fullPath || child.path) === normalizedImagePath &&
          child.isFile && !child.isFrame
        );

      // 动态影像找不到时生成第一帧
      if (targetChildrenIndex === -1 && cineInfo?.isCine && cineInfo.frameCount > 1) {
        try {
          const frameNodes = dicomService.cineService.extractFramesFromCineImage(imageFile, cineInfo);
          if (frameNodes?.[0]) {
            this.$store.commit('dicom/ADD_IMAGES_TO_SERIES_BATCH', {
              seriesIndex: this.$store.state.dicom.activeSeriesIndex,
              imageNodes: [frameNodes[0]]
            });
            const updatedSeries = this.$store.getters['dicom/currentSeries'];
            if (updatedSeries?.children) {
              targetChildrenIndex = this.findCineFirstFrameIndex(updatedSeries.children, normalizedImagePath, normalizePath);
            }
          }
        } catch (error) {
          console.warn('生成动态影像帧失败:', error);
        }
      }

      if (targetChildrenIndex === -1) return;

      this.$store.commit('dicom/SET_ACTIVE_IMAGE', targetChildrenIndex);

      // 切换图像
      const viewportIndex = this.isGridViewActive
        ? (this.$store.state.viewer.gridViewState.selectedViewportIndex || 0)
        : 0;
      const viewport = this.getGridViewportElements()?.[viewportIndex];
      if (!viewport) return;

      const stack = this.$cornerstoneTools.getToolState(viewport, 'stack')?.data?.[0];
      if (!stack) return;

      const targetNode = currentSeries.children[targetChildrenIndex];
      if (!targetNode) return;

      const { buildImageId } = require('../../../utils/DicomUtils');
      const targetImageId = buildImageId(targetNode);
      if (!targetImageId) return;

      // 更新 stack
      let targetStackIndex = (stack.imageIds || []).findIndex(id => id === targetImageId);
      if (targetStackIndex === -1) {
        const newImageIds = currentSeries.children.map(buildImageId).filter(id => id);
        targetStackIndex = newImageIds.findIndex(id => id === targetImageId);
        if (targetStackIndex === -1) return;
        stack.imageIds = newImageIds;
        this.$cornerstoneTools.addToolState(viewport, 'stack', stack);
      }
      stack.currentImageIdIndex = targetStackIndex;

      // 加载并显示
      try {
        const image = await this.$cornerstone.loadImage(targetImageId);
        this.$cornerstone.displayImage(viewport, image);
      } catch (error) {
        console.warn('切换图像失败:', error);
      }
    },

    /**
     * 查找动态影像第一帧的索引
     */
    findCineFirstFrameIndex(children, normalizedImagePath, normalizePath) {
      return children.findIndex(child =>
        child.isFrame && child.parentCineImage &&
        normalizePath(child.parentCineImage.fullPath || child.parentCineImage.path) === normalizedImagePath &&
        child.frameIndex === 0
      );
    },

    /**
     * 获取当前帧信息
     * @returns {Object} { isMultiFrame, currentFrame, totalFrames, isFirstFrame, isLastFrame }
     */
    /**
     * 获取当前帧信息 (基于上下文相邻节点重写，更加健壮)
     * @returns {Object} { isMultiFrame, currentFrame, totalFrames, isFirstFrame, isLastFrame }
     */
    getCurrentFrameInfo() {
      const currentSeries = this.$store.getters['dicom/currentSeries'];
      if (!currentSeries || !currentSeries.children) {
        return { isMultiFrame: false, currentFrame: 1, totalFrames: 1, isFirstFrame: true, isLastFrame: true };
      }

      // 如果正在播放，直接从 Vuex playbackControl 读取帧信息（高性能）
      const playbackControl = this.$store.state.viewer.playbackControl;
      const isPlaying = playbackControl.isPlaying;
      if (isPlaying && playbackControl.totalFrames > 0) {
        const totalFrames = playbackControl.totalFrames;
        const currentFrame = playbackControl.currentFrame + 1; // 1-based
        return {
          isMultiFrame: totalFrames > 1,
          currentFrame: Math.min(currentFrame, totalFrames),
          totalFrames: totalFrames,
          isFirstFrame: playbackControl.currentFrame === 0,
          isLastFrame: playbackControl.currentFrame >= totalFrames - 1,
          _firstIndex: 0,
          _lastIndex: totalFrames - 1
        };
      }

      const activeIndex = this.$store.state.dicom.activeImageIndex || 0;
      const currentNode = currentSeries.children[activeIndex];

      if (!currentNode || !currentNode.isFrame || !currentNode.parentCineImage) {
        return { isMultiFrame: false, currentFrame: 1, totalFrames: 1, isFirstFrame: true, isLastFrame: true };
      }

      // 获取父影像的路径用于比较
      const getParentPath = (node) => {
        if (!node || !node.isFrame || !node.parentCineImage) return null;
        return (node.parentCineImage.fullPath || node.parentCineImage.path || '').replace(/\\/g, '/').toLowerCase();
      };

      const currentParentPath = getParentPath(currentNode);
      if (!currentParentPath) {
        return { isMultiFrame: false, currentFrame: 1, totalFrames: 1, isFirstFrame: true, isLastFrame: true };
      }

      // 向前查找起始索引
      let firstIndex = activeIndex;
      while (firstIndex > 0) {
        const prevNode = currentSeries.children[firstIndex - 1];
        if (getParentPath(prevNode) === currentParentPath) {
          firstIndex--;
        } else {
          break;
        }
      }

      // 向后查找结束索引
      let lastIndex = activeIndex;
      while (lastIndex < currentSeries.children.length - 1) {
        const nextNode = currentSeries.children[lastIndex + 1];
        if (getParentPath(nextNode) === currentParentPath) {
          lastIndex++;
        } else {
          break;
        }
      }

      const totalFrames = lastIndex - firstIndex + 1;
      const currentFrame = activeIndex - firstIndex + 1; // 1-based

      return {
        isMultiFrame: totalFrames > 1,
        currentFrame: currentFrame,
        totalFrames: totalFrames,
        isFirstFrame: currentFrame === 1,
        isLastFrame: currentFrame === totalFrames,
        // 保存边界索引供 navigation 使用，避免查找
        _firstIndex: firstIndex,
        _lastIndex: lastIndex
      };
    },

    /**
     * 在当前影像的帧之间切换 (直接操作 activeIndex)
     * @param {number} direction - 方向：-1 表示上一帧，1 表示下一帧
     */
    async navigateFrame(direction) {
      try {
        const frameInfo = this.getCurrentFrameInfo();

        if (!frameInfo.isMultiFrame) return;

        // 检查业务逻辑边界
        if (direction < 0 && frameInfo.isFirstFrame) return;
        if (direction > 0 && frameInfo.isLastFrame) return;

        // 计算目标全局索引
        const activeIndex = this.$store.state.dicom.activeImageIndex || 0;
        const targetIndex = activeIndex + direction;

        // 安全检查：目标是否仍在同一组帧内
        // 利用 getCurrentFrameInfo 计算出的边界
        if (targetIndex < frameInfo._firstIndex || targetIndex > frameInfo._lastIndex) {
          return;
        }

        // 获取目标节点
        const currentSeries = this.$store.getters['dicom/currentSeries'];
        const targetNode = currentSeries.children[targetIndex];

        // 双重确认目标节点属于同一父影像
        const getParentPath = (node) => {
          if (!node || !node.isFrame || !node.parentCineImage) return null;
          return (node.parentCineImage.fullPath || node.parentCineImage.path || '').replace(/\\/g, '/').toLowerCase();
        };
        const currentParentPath = getParentPath(currentSeries.children[activeIndex]);
        if (getParentPath(targetNode) !== currentParentPath) {
          return;
        }

        // 直接更新索引
        this.$store.commit('dicom/SET_ACTIVE_IMAGE', targetIndex);

        // 获取视口并刷新显示 Active Image
        const viewportIndex = this.isGridViewActive
          ? (this.$store.state.viewer.gridViewState.selectedViewportIndex || 0)
          : 0;

        let viewport = null;
        if (typeof this.getGridViewportElements === 'function') {
          viewport = this.getGridViewportElements()[viewportIndex];
        }
        if (!viewport) viewport = this.$refs.dicomViewer;

        if (viewport) {
          // 更新 Stack 状态
          const stackState = this.$cornerstoneTools.getToolState(viewport, 'stack');
          if (stackState && stackState.data && stackState.data.length > 0) {
            const stack = stackState.data[0];
            const { buildImageId } = require('../../../utils/DicomUtils');
            const targetImageId = buildImageId(targetNode);

            // 尝试在现有 stack 中查找
            let stackIndex = -1;
            if (stack.imageIds) {
              stackIndex = stack.imageIds.indexOf(targetImageId);
            }

            if (stackIndex === -1) {
              // 如果找不到，可能需要重建 stack (虽然理论上 children 是连续的)
              // 简单起见，这里假设 stack 是同步的，如果不同步可能意味着 stack 需要刷新
              // 既然我们只是切换帧，我们直接加载图像显示即可，stack index 尽力而为

              // 尝试加载
            } else {
              stack.currentImageIdIndex = stackIndex;
            }

            // 强制加载图像
            try {
              const image = await this.$cornerstone.loadImage(targetImageId);
              this.$cornerstone.displayImage(viewport, image);
            } catch (e) {
              console.warn('Frame load failed', e);
            }
          }
        }

      } catch (error) {
        errorHandler.handleError(error, direction === -1 ? 'previousFrame' : 'nextFrame');
      }
    },

    /**
     * 上一帧
     */
    async previousFrame() {
      await this.navigateFrame(-1);
    },

    /**
     * 下一帧
     */
    async nextFrame() {
      await this.navigateFrame(1);
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



