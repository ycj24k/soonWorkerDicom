/**
 * 动态影像播放服务
 * 专门处理DICOM动态影像（Cine/Dynamic Images）的播放
 * 基于Cornerstone.js的wadouri图像加载器
 */

const cornerstone = require('cornerstone-core');
const cornerstoneTools = require('cornerstone-tools');

class CinePlaybackService {
  constructor() {
    this.playbackTimer = null;
    this.playbackControl = {
      isPlaying: false,
      isPaused: false,
      currentFrame: 0,
      totalFrames: 0,
      speed: 10, // FPS
      direction: 'forward',
      frameTime: 50 // ms
    };
    this.cineInfo = null;
    this.imageId = null;
    this.element = null;
    this.loadedImages = new Map(); // 已加载的图像缓存
    this.frameLoadTimeout = 5000; // 帧加载超时时间（毫秒）
    this.maxRetries = 3; // 最大重试次数
  }

  /**
   * 开始播放动态影像
   * @param {HTMLElement} element - Cornerstone元素
   * @param {string} imageId - 图像ID
   * @param {Object} cineInfo - 动态影像信息
   * @param {number} cineInfo.frameCount - 帧数
   * @param {number} cineInfo.frameTime - 帧时间（毫秒）
   * @param {string} cineInfo.type - 动态影像类型
   * @param {Object} options - 播放选项
   * @param {number} options.speed - 播放速度（FPS）
   * @param {string} options.direction - 播放方向（forward/backward）
   */
  startCinePlayback(element, imageId, cineInfo, options = {}) {
    // 验证参数
    if (!element || !imageId || !cineInfo) {
      throw new Error('动态影像播放参数不完整');
    }

    if (!cineInfo.frameCount || cineInfo.frameCount < 1) {
      throw new Error('动态影像帧数无效');
    }

    // 停止之前的播放
    if (this.playbackTimer) {
      this.stopCinePlayback();
    }

    // 清理之前的资源
    this.cleanupImages();

    this.element = element;
    this.imageId = imageId;
    this.cineInfo = cineInfo;

    // 验证并设置播放参数
    const totalFrames = Math.max(1, parseInt(cineInfo.frameCount));
    const startFrame = Math.max(0, Math.min(totalFrames - 1, options.startFrame || 0));

    this.playbackControl = {
      isPlaying: true,
      isPaused: false,
      currentFrame: startFrame,
      totalFrames: totalFrames,
      speed: Math.max(1, Math.min(30, options.speed || this.calculateOptimalSpeed(cineInfo))),
      direction: options.direction === 'backward' ? 'backward' : 'forward',
      frameTime: cineInfo.frameTime || 50
    };

    this.onFrameChange = options.onFrameChange || null;

    // 加载第一帧
    this.loadCurrentFrame();

    // 开始播放循环
    this.cinePlaybackLoop();
  }

  /**
   * 计算最佳播放速度
   */
  calculateOptimalSpeed(cineInfo) {
    if (cineInfo.frameTime && cineInfo.frameTime > 0) {
      // 基于帧时间计算合适的FPS
      return Math.round(1000 / cineInfo.frameTime);
    }

    if (cineInfo.type === 'cardiac' && cineInfo.heartRate) {
      // 心脏影像基于心率
      return Math.round(cineInfo.heartRate / 60 * 2); // 每个心跳2帧
    }

    // 默认速度
    return 10;
  }

  /**
   * 动态影像播放循环
   */
  cinePlaybackLoop() {
    if (!this.playbackControl.isPlaying) {
      return;
    }

    const currentFrame = this.playbackControl.currentFrame;
    const totalFrames = this.playbackControl.totalFrames;
    const direction = this.playbackControl.direction;

    // 验证帧索引
    if (currentFrame < 0 || currentFrame >= totalFrames) {
      console.error(`帧索引超出范围: ${currentFrame}/${totalFrames}`);
      this.stopCinePlayback();
      return;
    }

    // 加载当前帧
    this.loadCurrentFrame();

    // 更新帧索引
    let nextFrame;
    if (direction === 'forward') {
      nextFrame = (currentFrame + 1) % totalFrames;
    } else {
      nextFrame = currentFrame === 0 ? totalFrames - 1 : currentFrame - 1;
    }

    this.playbackControl.currentFrame = nextFrame;

    // 设置下一帧的定时器
    const interval = 1000 / this.playbackControl.speed;
    this.playbackTimer = setTimeout(() => {
      this.cinePlaybackLoop();
    }, interval);
  }

  /**
   * 加载当前帧（带重试机制和超时处理）
   */
  async loadCurrentFrame() {
    const frameIndex = this.playbackControl.currentFrame;
    const totalFrames = this.playbackControl.totalFrames;

    // 验证帧索引
    if (frameIndex < 0 || frameIndex >= totalFrames) {
      console.error(`帧索引超出范围: ${frameIndex}/${totalFrames}`);
      return;
    }

    if (!this.element || !this.imageId) {
      console.error('动态影像播放元素或图像ID为空');
      return;
    }

    // 构建当前帧的图像ID
    const frameImageId = `${this.imageId}?frame=${frameIndex}`;

    // 检查缓存
    if (this.loadedImages.has(frameImageId)) {
      const cachedImage = this.loadedImages.get(frameImageId);
      try {
        cornerstone.displayImage(this.element, cachedImage);
        return;
      } catch (error) {
        // 缓存失效，重新加载
        this.loadedImages.delete(frameImageId);
      }
    }

    // 加载图像（带重试和超时）
    let lastError = null;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // 创建超时Promise
        const loadPromise = cornerstone.loadImage(frameImageId);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('帧加载超时')), this.frameLoadTimeout);
        });

        // 使用Promise.race实现超时控制
        const image = await Promise.race([loadPromise, timeoutPromise]);

        // 显示图像
        cornerstone.displayImage(this.element, image);

        // 缓存图像（限制缓存大小）
        // 缓存图像（限制缓存大小）
        this.loadedImages.set(frameImageId, image);
        if (this.loadedImages.size > 50) {
          // 移除最旧的缓存
          const firstKey = this.loadedImages.keys().next().value;
          this.loadedImages.delete(firstKey);
        }

        // 触发帧变化回调
        if (typeof this.onFrameChange === 'function') {
          this.onFrameChange(frameIndex);
        }

        return; // 成功加载，退出重试循环

      } catch (error) {
        lastError = error;

        // 最后一次尝试失败
        if (attempt === this.maxRetries - 1) {
          console.error(`加载动态影像帧失败 (帧 ${frameIndex}/${totalFrames - 1}):`, error);
          // 不停止播放，继续下一帧
        } else {
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        }
      }
    }
  }

  /**
   * 暂停播放
   */
  pauseCinePlayback() {
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    this.playbackControl.isPlaying = false;
    this.playbackControl.isPaused = true;
  }

  /**
   * 恢复播放
   */
  resumeCinePlayback() {
    this.playbackControl.isPlaying = true;
    this.playbackControl.isPaused = false;
    this.cinePlaybackLoop();
  }

  /**
   * 停止播放
   */
  stopCinePlayback() {
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    this.playbackControl.isPlaying = false;
    this.playbackControl.isPaused = false;
    this.playbackControl.currentFrame = 0;
  }

  /**
   * 设置播放速度
   */
  setPlaybackSpeed(speed) {
    this.playbackControl.speed = speed;
  }

  /**
   * 跳转到指定帧（带验证）
   * @param {number} frameIndex - 目标帧索引
   * @returns {boolean} 是否成功跳转
   */
  goToFrame(frameIndex) {
    const totalFrames = this.playbackControl.totalFrames;

    // 验证帧索引
    if (frameIndex < 0 || frameIndex >= totalFrames) {
      console.error(`跳转帧索引超出范围: ${frameIndex}/${totalFrames}`);
      return false;
    }

    // 如果正在播放，暂停以便跳转
    const wasPlaying = this.playbackControl.isPlaying;
    if (wasPlaying) {
      this.pauseCinePlayback();
    }

    this.playbackControl.currentFrame = frameIndex;
    this.loadCurrentFrame();

    // 如果之前正在播放，恢复播放
    if (wasPlaying) {
      this.resumeCinePlayback();
    }

    return true;
  }

  /**
   * 获取播放状态
   */
  isPlaying() {
    return this.playbackControl.isPlaying;
  }

  /**
   * 获取暂停状态
   */
  isPaused() {
    return this.playbackControl.isPaused;
  }

  /**
   * 获取当前帧信息
   */
  getCurrentFrameInfo() {
    return {
      currentFrame: this.playbackControl.currentFrame,
      totalFrames: this.playbackControl.totalFrames,
      speed: this.playbackControl.speed,
      frameTime: this.playbackControl.frameTime,
      direction: this.playbackControl.direction,
      isPlaying: this.playbackControl.isPlaying,
      isPaused: this.playbackControl.isPaused
    };
  }

  /**
   * 同步播放状态（供外部调用以同步状态）
   * @returns {Object} 当前播放状态
   */
  syncState() {
    return {
      isPlaying: this.playbackControl.isPlaying,
      isPaused: this.playbackControl.isPaused,
      currentFrame: this.playbackControl.currentFrame,
      totalFrames: this.playbackControl.totalFrames,
      speed: this.playbackControl.speed,
      direction: this.playbackControl.direction,
      type: 'cine'
    };
  }

  /**
   * 清理已加载的图像缓存
   */
  cleanupImages() {
    if (this.element && this.loadedImages.size > 0) {
      // 释放Cornerstone中的图像缓存
      this.loadedImages.forEach((image, imageId) => {
        try {
          cornerstone.removeImage(imageId);
        } catch (error) {
          // 忽略清理错误
        }
      });
    }
    this.loadedImages.clear();
  }

  /**
   * 清理资源（完整清理）
   */
  cleanup() {
    // 停止播放
    this.stopCinePlayback();

    // 清理图像缓存
    this.cleanupImages();

    // 清理引用
    this.element = null;
    this.imageId = null;
    this.cineInfo = null;

    // 重置播放控制
    this.playbackControl = {
      isPlaying: false,
      isPaused: false,
      currentFrame: 0,
      totalFrames: 0,
      speed: 10,
      direction: 'forward',
      frameTime: 50
    };
  }
}

// 创建单例实例
const cinePlaybackService = new CinePlaybackService();

module.exports = cinePlaybackService;
