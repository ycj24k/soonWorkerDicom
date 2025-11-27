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
      isPaused: false,
      speed: 10,
      currentFrame: 0,
      totalFrames: 0,
      direction: 'forward'
    };
    this.onCompleteCallback = null;
    this.onFrameChangeCallback = null; // 帧变化回调
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

    // 验证 imageIds
    if (!imageIds || imageIds.length === 0) {
      return;
    }

    const totalFrames = imageIds.length;
    
    // 验证并修正起始帧和结束帧
    let startFrame = options.startFrame !== undefined ? options.startFrame : 0;
    let endFrame = options.endFrame !== undefined ? options.endFrame : totalFrames - 1;
    
    // 确保在有效范围内
    startFrame = Math.max(0, Math.min(startFrame, totalFrames - 1));
    endFrame = Math.max(0, Math.min(endFrame, totalFrames - 1));
    
    // 确保 startFrame <= endFrame
    if (startFrame > endFrame) {
      const temp = startFrame;
      startFrame = endFrame;
      endFrame = temp;
    }

    // 设置播放参数
    this.playbackControl = {
      isPlaying: true,
      isPaused: false,
      speed: options.speed || 10,
      currentFrame: startFrame,
      totalFrames: totalFrames,
      direction: options.direction || 'forward'
    };

    // 保存播放结束回调
    this.onCompleteCallback = options.onComplete || null;
    // 保存帧变化回调
    this.onFrameChangeCallback = options.onFrameChange || null;

    const loop = options.loop !== false; // 默认循环


    // 开始播放循环
    // 先加载第一帧并触发回调
    if (startFrame >= 0 && startFrame < imageIds.length) {
      const firstImageId = imageIds[startFrame];
      if (firstImageId) {
        this.loadFrame(element, firstImageId);
        if (this.onFrameChangeCallback && typeof this.onFrameChangeCallback === 'function') {
          try {
            this.onFrameChangeCallback(startFrame, firstImageId);
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('第一帧变化回调执行失败:', error);
            }
          }
        }
      }
    }
    
    // 开始播放循环（从下一帧开始，因为第一帧已经加载）
    // 注意：playbackLoop 会从 currentFrame 开始，而 currentFrame 已经设置为 startFrame
    // 所以需要先递增一次，或者修改逻辑让第一帧不重复加载
    // 为了不重复加载，我们让播放循环从 startFrame + 1 开始（如果是向前播放）
    if (this.playbackControl.direction === 'forward' && startFrame < endFrame) {
      this.playbackControl.currentFrame = startFrame + 1;
    }
    this.playbackLoop(element, imageIds, startFrame, endFrame, loop);
  }

  /**
   * 播放循环
   */
  playbackLoop(element, imageIds, startFrame, endFrame, loop) {
    // 首先检查播放状态
    if (!this.playbackControl.isPlaying) {
      return;
    }

    // 验证参数有效性
    if (!imageIds || imageIds.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.error('🎬 图像ID列表为空，停止播放');
      }
      this.stopPlayback();
      return;
    }

    const totalFrames = imageIds.length;
    let currentFrame = this.playbackControl.currentFrame;
    const direction = this.playbackControl.direction;

    // 验证并修正边界值，确保在有效范围内
    const validStartFrame = Math.max(0, Math.min(startFrame, totalFrames - 1));
    const validEndFrame = Math.max(0, Math.min(endFrame, totalFrames - 1));
    
    // 确保 startFrame <= endFrame
    if (validStartFrame > validEndFrame) {
      this.stopPlayback();
      return;
    }

    // 验证当前帧索引是否在有效范围内
    if (currentFrame < 0 || currentFrame >= totalFrames) {
      // 重置到有效范围内的最后一帧（如果超出），或起始帧（如果小于）
      if (currentFrame >= totalFrames) {
        currentFrame = validEndFrame;
      } else {
        currentFrame = validStartFrame;
      }
      this.playbackControl.currentFrame = currentFrame;
    } else if (currentFrame < validStartFrame) {
      // 如果当前帧小于起始帧，重置到起始帧
      currentFrame = validStartFrame;
      this.playbackControl.currentFrame = currentFrame;
    } else if (currentFrame > validEndFrame) {
      // 如果当前帧大于结束帧，重置到结束帧
      currentFrame = validEndFrame;
      this.playbackControl.currentFrame = currentFrame;
    }

    // 检查是否到达边界（在加载帧之前检查）
    if (direction === 'forward' && currentFrame > validEndFrame) {
      if (loop) {
        currentFrame = validStartFrame;
        this.playbackControl.currentFrame = currentFrame;
      } else {
        // 播放结束，先保存回调，再停止播放，然后调用回调
        const callback = this.onCompleteCallback;
        this.stopPlayback();
        if (callback && typeof callback === 'function') {
          try {
            callback();
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('播放结束回调执行失败:', error);
            }
          }
        }
        return;
      }
    } else if (direction === 'backward' && currentFrame < validStartFrame) {
      if (loop) {
        currentFrame = validEndFrame;
        this.playbackControl.currentFrame = currentFrame;
      } else {
        // 播放结束，先保存回调，再停止播放，然后调用回调
        const callback = this.onCompleteCallback;
        this.stopPlayback();
        if (callback && typeof callback === 'function') {
          try {
            callback();
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('播放结束回调执行失败:', error);
            }
          }
        }
        return;
      }
    }

    // 再次验证当前帧在有效范围内（双重检查）
    if (currentFrame < 0 || currentFrame >= totalFrames) {
      this.stopPlayback();
      return;
    }

    // 获取当前帧的 imageId
    const imageId = imageIds[currentFrame];
    if (!imageId) {
      // 如果 imageId 不存在，尝试跳过这一帧
      if (direction === 'forward') {
        currentFrame++;
      } else {
        currentFrame--;
      }
      this.playbackControl.currentFrame = currentFrame;
      // 继续下一帧，但要确保不超出范围
      const interval = 1000 / this.playbackControl.speed;
      this.playbackTimer = setTimeout(() => {
        this.playbackLoop(element, imageIds, validStartFrame, validEndFrame, loop);
      }, interval);
      return;
    }

    // 加载当前帧（只有在所有验证通过后）
    this.loadFrame(element, imageId);
    
    // 通知帧变化（在加载帧之后，更新索引之前）
    if (this.onFrameChangeCallback && typeof this.onFrameChangeCallback === 'function') {
      try {
        this.onFrameChangeCallback(currentFrame, imageId);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('帧变化回调执行失败:', error);
        }
      }
    }

    // 更新帧索引
    if (direction === 'forward') {
      currentFrame++;
    } else {
      currentFrame--;
    }
    this.playbackControl.currentFrame = currentFrame;

    // 检查是否到达边界（在设置下一帧定时器之前检查）
    if (direction === 'forward' && currentFrame > validEndFrame) {
      if (loop) {
        currentFrame = validStartFrame;
        this.playbackControl.currentFrame = currentFrame;
      } else {
        // 播放结束，先保存回调，再停止播放，然后调用回调
        const callback = this.onCompleteCallback;
        this.stopPlayback();
        if (callback && typeof callback === 'function') {
          try {
            callback();
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('播放结束回调执行失败:', error);
            }
          }
        }
        return; // 不再设置定时器
      }
    } else if (direction === 'backward' && currentFrame < validStartFrame) {
      if (loop) {
        currentFrame = validEndFrame;
        this.playbackControl.currentFrame = currentFrame;
      } else {
        // 播放结束，先保存回调，再停止播放，然后调用回调
        const callback = this.onCompleteCallback;
        this.stopPlayback();
        if (callback && typeof callback === 'function') {
          try {
            callback();
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('播放结束回调执行失败:', error);
            }
          }
        }
        return; // 不再设置定时器
      }
    }

    // 设置下一帧的定时器（只有在未到达边界或循环模式下）
    const interval = 1000 / this.playbackControl.speed;
    this.playbackTimer = setTimeout(() => {
      this.playbackLoop(element, imageIds, validStartFrame, validEndFrame, loop);
    }, interval);
  }

  /**
   * 加载帧
   */
  async loadFrame(element, imageId) {
    try {
      if (!element) {
        if (process.env.NODE_ENV === 'development') {
          console.error('加载帧失败: 元素为空');
        }
        return;
      }

      if (!imageId) {
        if (process.env.NODE_ENV === 'development') {
          console.error('加载帧失败: imageId 为空');
        }
        return;
      }
      
      const image = await cornerstone.loadImage(imageId);
      cornerstone.displayImage(element, image);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('加载帧失败:', error.message || error);
      }
      // 加载失败时不停止播放，让播放循环继续处理
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
    this.playbackControl.isPaused = false;
    // 清除回调
    this.onCompleteCallback = null;
    this.onFrameChangeCallback = null;
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
    this.playbackControl.isPaused = true;
  }

  /**
   * 恢复播放
   */
  resumePlayback(element, imageIds, options = {}) {
    // 保存播放结束回调
    if (options.onComplete) {
      this.onCompleteCallback = options.onComplete;
    }
    if (this.playbackControl.isPlaying) {
      return;
    }

    // 验证 imageIds
    if (!imageIds || imageIds.length === 0) {
      return;
    }

    const totalFrames = imageIds.length;

    // 获取当前帧索引，确保在有效范围内
    let currentFrame = this.playbackControl.currentFrame || 0;
    // 如果当前帧超出范围，重置到有效范围内
    if (currentFrame < 0 || currentFrame >= totalFrames) {
      currentFrame = Math.max(0, Math.min(currentFrame, totalFrames - 1));
      this.playbackControl.currentFrame = currentFrame;
    }

    // 使用保存的播放参数或默认参数，并验证范围
    let startFrame = options.startFrame !== undefined ? options.startFrame : currentFrame;
    let endFrame = options.endFrame !== undefined ? options.endFrame : (totalFrames - 1);
    
    // 确保在有效范围内
    startFrame = Math.max(0, Math.min(startFrame, totalFrames - 1));
    endFrame = Math.max(0, Math.min(endFrame, totalFrames - 1));
    
    // 确保 startFrame <= endFrame
    if (startFrame > endFrame) {
      const temp = startFrame;
      startFrame = endFrame;
      endFrame = temp;
    }
    
    // 确保当前帧在有效范围内
    if (currentFrame < startFrame) {
      currentFrame = startFrame;
    } else if (currentFrame > endFrame) {
      currentFrame = endFrame;
    }
    this.playbackControl.currentFrame = currentFrame;

    this.playbackControl.isPlaying = true;
    this.playbackControl.isPaused = false;
    this.playbackControl.totalFrames = totalFrames;
    
    const loop = options.loop !== undefined ? options.loop : true;
    
    this.playbackLoop(element, imageIds, startFrame, endFrame, loop);
  }

  /**
   * 设置播放速度
   */
  setPlaybackSpeed(speed) {
    this.playbackControl.speed = Math.max(1, Math.min(30, speed)); // 限制在1-30帧/秒
    // console.log('播放速度已设置:', this.playbackControl.speed);
  }

  /**
   * 设置播放方向
   */
  setPlaybackDirection(direction) {
    if (direction === 'forward' || direction === 'backward') {
      this.playbackControl.direction = direction;
      // console.log('播放方向已设置:', direction);
    }
  }

  /**
   * 跳转到指定帧
   */
  jumpToFrame(frameIndex, element, imageIds) {
    if (frameIndex >= 0 && frameIndex < imageIds.length) {
      this.playbackControl.currentFrame = frameIndex;
      this.loadFrame(element, imageIds[frameIndex]);
      // console.log('跳转到帧:', frameIndex);
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
   * 检查是否已暂停
   */
  isPaused() {
    return this.playbackControl.isPaused;
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
      isPaused: false,
      speed: 10,
      currentFrame: 0,
      totalFrames: 0,
      direction: 'forward'
    };
    this.onCompleteCallback = null;
  }
}
