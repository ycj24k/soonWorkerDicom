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

    // 注意：nextImage 和 previousImage 方法在 playbackMixin 中已实现（按影像切换）
    // 这里不再重复定义，使用 playbackMixin 中的实现
  }
};

