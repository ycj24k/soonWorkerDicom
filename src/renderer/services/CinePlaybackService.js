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
  }

  /**
   * 开始播放动态影像
   */
  startCinePlayback(element, imageId, cineInfo, options = {}) {
    if (this.playbackTimer) {
      this.stopCinePlayback();
    }

    this.element = element;
    this.imageId = imageId;
    this.cineInfo = cineInfo;

    // 设置播放参数
    this.playbackControl = {
      isPlaying: true,
      isPaused: false,
      currentFrame: 0,
      totalFrames: cineInfo.frameCount || 1,
      speed: options.speed || this.calculateOptimalSpeed(cineInfo),
      direction: options.direction || 'forward',
      frameTime: cineInfo.frameTime || 50
    };


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


    // 加载当前帧
    this.loadCurrentFrame();

    // 更新帧索引
    if (direction === 'forward') {
      this.playbackControl.currentFrame = (currentFrame + 1) % totalFrames;
    } else {
      this.playbackControl.currentFrame = currentFrame === 0 ? totalFrames - 1 : currentFrame - 1;
    }

    // 设置下一帧的定时器
    const interval = 1000 / this.playbackControl.speed;
    this.playbackTimer = setTimeout(() => {
      this.cinePlaybackLoop();
    }, interval);
  }

  /**
   * 加载当前帧
   */
  async loadCurrentFrame() {
    try {
      if (!this.element || !this.imageId) {
        console.error('动态影像播放元素或图像ID为空');
        return;
      }

      // 构建当前帧的图像ID
      const frameImageId = `${this.imageId}?frame=${this.playbackControl.currentFrame}`;
      
      
      // 加载图像
      const image = await cornerstone.loadImage(frameImageId);
      
      // 显示图像
      cornerstone.displayImage(this.element, image);
      
      
    } catch (error) {
      console.error('加载动态影像帧失败:', error);
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
   * 跳转到指定帧
   */
  goToFrame(frameIndex) {
    if (frameIndex >= 0 && frameIndex < this.playbackControl.totalFrames) {
      this.playbackControl.currentFrame = frameIndex;
      this.loadCurrentFrame();
    }
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
   * 清理资源
   */
  cleanup() {
    this.stopCinePlayback();
    this.element = null;
    this.imageId = null;
    this.cineInfo = null;
  }
}

// 创建单例实例
const cinePlaybackService = new CinePlaybackService();

module.exports = cinePlaybackService;
