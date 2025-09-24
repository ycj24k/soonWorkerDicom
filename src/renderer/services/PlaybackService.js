/**
 * 播放控制服务
 * 负责DICOM图像的逐帧播放功能
 */

const cornerstone = require('cornerstone-core');
const cornerstoneTools = require('cornerstone-tools');

export class PlaybackService {
  constructor() {
    this.playbackTimer = null;
    this.playbackControl = {
      isPlaying: false,
      speed: 10,
      currentFrame: 0,
      totalFrames: 0,
      direction: 'forward'
    };
  }

  static getInstance() {
    if (!PlaybackService.instance) {
      PlaybackService.instance = new PlaybackService();
    }
    return PlaybackService.instance;
  }

  /**
   * 开始播放
   */
  startPlayback(element, imageIds, options = {}) {
    if (this.playbackTimer) {
      this.stopPlayback();
    }

    // 设置播放参数
    this.playbackControl = {
      isPlaying: true,
      speed: options.speed || 10,
      currentFrame: options.startFrame || 0,
      totalFrames: imageIds.length,
      direction: options.direction || 'forward'
    };

    const startFrame = options.startFrame || 0;
    const endFrame = options.endFrame || imageIds.length - 1;
    const loop = options.loop !== false; // 默认循环

    console.log('开始播放:', {
      totalFrames: imageIds.length,
      speed: this.playbackControl.speed,
      direction: this.playbackControl.direction,
      startFrame,
      endFrame,
      loop
    });

    // 开始播放循环
    this.playbackLoop(element, imageIds, startFrame, endFrame, loop);
  }

  /**
   * 播放循环
   */
  playbackLoop(element, imageIds, startFrame, endFrame, loop) {
    if (!this.playbackControl.isPlaying) {
      return;
    }

    const currentFrame = this.playbackControl.currentFrame;
    const direction = this.playbackControl.direction;

    // 检查是否到达边界
    if (direction === 'forward' && currentFrame >= endFrame) {
      if (loop) {
        this.playbackControl.currentFrame = startFrame;
      } else {
        this.stopPlayback();
        return;
      }
    } else if (direction === 'backward' && currentFrame <= startFrame) {
      if (loop) {
        this.playbackControl.currentFrame = endFrame;
      } else {
        this.stopPlayback();
        return;
      }
    }

    // 加载当前帧
    this.loadFrame(element, imageIds[currentFrame]);

    // 更新帧索引
    if (direction === 'forward') {
      this.playbackControl.currentFrame++;
    } else {
      this.playbackControl.currentFrame--;
    }

    // 设置下一帧的定时器
    const interval = 1000 / this.playbackControl.speed;
    this.playbackTimer = setTimeout(() => {
      this.playbackLoop(element, imageIds, startFrame, endFrame, loop);
    }, interval);
  }

  /**
   * 加载帧
   */
  async loadFrame(element, imageId) {
    try {
      await cornerstone.loadImage(imageId);
      cornerstone.displayImage(element, await cornerstone.loadImage(imageId));
    } catch (error) {
      console.error('加载帧失败:', error);
    }
  }

  /**
   * 停止播放
   */
  stopPlayback() {
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    this.playbackControl.isPlaying = false;
    console.log('播放已停止');
  }

  /**
   * 暂停播放
   */
  pausePlayback() {
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }

    this.playbackControl.isPlaying = false;
    console.log('播放已暂停');
  }

  /**
   * 恢复播放
   */
  resumePlayback(element, imageIds) {
    if (this.playbackControl.isPlaying) {
      return;
    }

    this.playbackControl.isPlaying = true;
    this.playbackLoop(element, imageIds, 0, imageIds.length - 1, true);
    console.log('播放已恢复');
  }

  /**
   * 设置播放速度
   */
  setPlaybackSpeed(speed) {
    this.playbackControl.speed = Math.max(1, Math.min(30, speed)); // 限制在1-30帧/秒
    console.log('播放速度已设置:', this.playbackControl.speed);
  }

  /**
   * 设置播放方向
   */
  setPlaybackDirection(direction) {
    if (direction === 'forward' || direction === 'backward') {
      this.playbackControl.direction = direction;
      console.log('播放方向已设置:', direction);
    }
  }

  /**
   * 跳转到指定帧
   */
  jumpToFrame(frameIndex, element, imageIds) {
    if (frameIndex >= 0 && frameIndex < imageIds.length) {
      this.playbackControl.currentFrame = frameIndex;
      this.loadFrame(element, imageIds[frameIndex]);
      console.log('跳转到帧:', frameIndex);
    }
  }

  /**
   * 下一帧
   */
  nextFrame(element, imageIds) {
    if (this.playbackControl.currentFrame < imageIds.length - 1) {
      this.playbackControl.currentFrame++;
      this.loadFrame(element, imageIds[this.playbackControl.currentFrame]);
    }
  }

  /**
   * 上一帧
   */
  previousFrame(element, imageIds) {
    if (this.playbackControl.currentFrame > 0) {
      this.playbackControl.currentFrame--;
      this.loadFrame(element, imageIds[this.playbackControl.currentFrame]);
    }
  }

  /**
   * 检查是否正在播放
   */
  isPlaying() {
    return this.playbackControl.isPlaying;
  }

  /**
   * 获取播放控制状态
   */
  getPlaybackControl() {
    return { ...this.playbackControl };
  }

  /**
   * 设置播放控制状态
   */
  setPlaybackControl(control) {
    this.playbackControl = { ...this.playbackControl, ...control };
  }

  /**
   * 获取当前帧索引
   */
  getCurrentFrame() {
    return this.playbackControl.currentFrame;
  }

  /**
   * 获取总帧数
   */
  getTotalFrames() {
    return this.playbackControl.totalFrames;
  }

  /**
   * 获取播放速度
   */
  getPlaybackSpeed() {
    return this.playbackControl.speed;
  }

  /**
   * 获取播放方向
   */
  getPlaybackDirection() {
    return this.playbackControl.direction;
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.stopPlayback();
    this.playbackControl = {
      isPlaying: false,
      speed: 10,
      currentFrame: 0,
      totalFrames: 0,
      direction: 'forward'
    };
    console.log('播放服务已清理');
  }
}
