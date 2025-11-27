/**
 * 键盘快捷键 Mixin
 * 处理键盘快捷键事件
 */

export default {
  methods: {
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
        const isGridActive = this.$store.state.viewer.gridViewState.isActive;
        
        if (isGridActive) {
          // 网格模式：切换当前选中视口的图像（使用 Cornerstone scroll）
          const element = this.getActiveElement();
          if (element) {
            const stackState = this.$cornerstoneTools.getToolState(element, 'stack');
            if (stackState && stackState.data && stackState.data.length > 0) {
              const stack = stackState.data[0];
              const nextIndex = Math.min(stack.currentImageIdIndex + 1, stack.imageIds.length - 1);
              if (nextIndex !== stack.currentImageIdIndex) {
                stack.currentImageIdIndex = nextIndex;
                const image = await this.$cornerstone.loadImage(stack.imageIds[nextIndex]);
                this.$cornerstone.displayImage(element, image);
              }
            }
          }
        } else {
          // 单视图模式：使用 store 切换
          await this.$store.dispatch('dicom/nextImage');
          await this.loadCurrentImage();
        }
      } catch (error) {
        if (this.$errorHandler) {
          this.$errorHandler.handleError(error, 'nextImage');
        } else {
          console.error('nextImage失败:', error);
        }
      }
    },

    /**
     * 上一张图像
     */
    async previousImage() {
      try {
        const isGridActive = this.$store.state.viewer.gridViewState.isActive;
        
        if (isGridActive) {
          // 网格模式：切换当前选中视口的图像（使用 Cornerstone scroll）
          const element = this.getActiveElement();
          if (element) {
            const stackState = this.$cornerstoneTools.getToolState(element, 'stack');
            if (stackState && stackState.data && stackState.data.length > 0) {
              const stack = stackState.data[0];
              const prevIndex = Math.max(stack.currentImageIdIndex - 1, 0);
              if (prevIndex !== stack.currentImageIdIndex) {
                stack.currentImageIdIndex = prevIndex;
                const image = await this.$cornerstone.loadImage(stack.imageIds[prevIndex]);
                this.$cornerstone.displayImage(element, image);
              }
            }
          }
        } else {
          // 单视图模式：使用 store 切换
          await this.$store.dispatch('dicom/previousImage');
          await this.loadCurrentImage();
        }
      } catch (error) {
        if (this.$errorHandler) {
          this.$errorHandler.handleError(error, 'previousImage');
        } else {
          console.error('previousImage失败:', error);
        }
      }
    }
  }
};

