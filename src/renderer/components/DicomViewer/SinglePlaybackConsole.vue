<template>
  <div class="single-playback-console" v-show="show">
    <div class="console-dock">
      <!-- 1. Close Button -->
      <button class="icon-btn close-btn" @click="handleClose" title="关闭">
        <i class="el-icon-close"></i>
      </button>

      <!-- Vertical Divider -->
      <div class="v-divider"></div>

      <!-- 2. Image Navigation (Primary) -->
      <div class="control-group main-controls">
        <button class="icon-btn nav-btn" @click="handlePrevious" :disabled="isFirst" title="上一张影像">
          <i class="el-icon-arrow-left"></i>
        </button>

        <button class="icon-btn play-btn" @click="handlePlayPause" :title="isPlaying ? '暂停' : '播放'">
          <i :class="isPlaying ? 'el-icon-video-pause' : 'el-icon-video-play'"></i>
        </button>

        <button class="icon-btn nav-btn" @click="handleNext" :disabled="isLast" title="下一张影像">
          <i class="el-icon-arrow-right"></i>
        </button>
      </div>

      <!-- 3. Frame Navigation (Secondary) - Conditional -->
      <template v-if="isMultiFrame">
        <div class="v-divider"></div>
        <div class="control-group frame-controls-pill">
          <button class="icon-btn sub-nav-btn" @click="handlePreviousFrame" :disabled="isFirstFrame" title="上一帧">
            <i class="el-icon-arrow-left"></i>
          </button>
          <span class="frame-counter">{{ currentFrame }} / {{ totalFrames }}</span>
          <button class="icon-btn sub-nav-btn" @click="handleNextFrame" :disabled="isLastFrame" title="下一帧">
            <i class="el-icon-arrow-right"></i>
          </button>
        </div>
      </template>

      <!-- Vertical Divider -->
      <div class="v-divider"></div>

      <!-- 4. Speed Control -->
      <div class="control-group speed-group">
        <i class="el-icon-time speed-icon"></i>
        <el-slider v-model="internalSpeed" :min="1" :max="30" :step="1" :format-tooltip="formatSpeedTooltip"
          @change="handleSpeedChange"></el-slider>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SinglePlaybackConsole',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    isPlaying: {
      type: Boolean,
      default: false
    },
    speed: {
      type: Number,
      default: 10
    },
    isFirst: {
      type: Boolean,
      default: false
    },
    isLast: {
      type: Boolean,
      default: false
    },
    // 帧导航相关props
    isMultiFrame: {
      type: Boolean,
      default: false
    },
    currentFrame: {
      type: Number,
      default: 1
    },
    totalFrames: {
      type: Number,
      default: 1
    },
    isFirstFrame: {
      type: Boolean,
      default: true
    },
    isLastFrame: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      internalSpeed: this.speed
    };
  },
  watch: {
    speed(newVal) {
      this.internalSpeed = newVal;
    }
  },
  methods: {
    formatSpeedTooltip(val) {
      return `${val} 帧/秒`;
    },
    handleClose() {
      this.$emit('close');
    },
    handlePrevious() {
      this.$emit('previous');
    },
    handleNext() {
      this.$emit('next');
    },
    handlePlayPause() {
      this.$emit('play-pause');
    },
    handleSpeedChange(value) {
      this.internalSpeed = value;
      this.$emit('speed-change', value);
    },
    // 帧导航事件处理
    handlePreviousFrame() {
      this.$emit('previous-frame');
    },
    handleNextFrame() {
      this.$emit('next-frame');
    }
  }
};
</script>

<style lang="scss" scoped>
.single-playback-console {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 16px;
  z-index: 3000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

  .console-dock {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 50px;
    padding: 6px 8px;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04);
    user-select: none;
    height: 52px;
    /* Fixed height for consistency */
    gap: 8px;
    min-width: max-content;
  }

  .control-group {
    display: flex;
    align-items: center;
  }

  .v-divider {
    width: 1px;
    height: 20px;
    background-color: #ebedf0;
    margin: 0 6px;
  }

  /* --- 1. Close Button --- */
  .close-btn {
    width: 28px;
    height: 28px;
    margin-left: 4px;
    /* Spacing from edge */
    color: #909399;
    font-size: 16px;

    &:hover {
      background-color: #fef0f0;
      color: #f56c6c;
    }
  }

  /* --- 2. Image Navigation (Primary) --- */
  .main-controls {
    gap: 6px;
  }

  .icon-btn {
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
    outline: none;
    color: #606266;
    border-radius: 50%;

    &:hover:not(:disabled) {
      background-color: #f2f6fc;
      color: #409eff;
    }

    &:active:not(:disabled) {
      transform: scale(0.92);
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;

      i {
        color: #c0c4cc;
        /* Explicit disabled color */
      }
    }
  }

  .nav-btn {
    width: 32px;
    height: 32px;
    font-size: 18px;

    &:hover:not(:disabled) {
      background-color: #ecf5ff;
    }
  }

  .play-btn {
    width: 40px;
    height: 40px;
    font-size: 20px;
    margin: 0 4px;
    background: linear-gradient(135deg, #409eff, #66b1ff);
    color: white;
    box-shadow: 0 4px 10px rgba(64, 158, 255, 0.3);

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #66b1ff, #409eff);
      color: white;
      box-shadow: 0 6px 14px rgba(64, 158, 255, 0.4);
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      transform: scale(0.95);
    }
  }

  /* --- 3. Frame Navigation (Secondary) --- */
  .frame-controls-pill {
    background-color: #f5f7fa;
    border-radius: 18px;
    /* Perfectly round for 36px height */
    padding: 0 4px;
    height: 36px;
    display: flex;
    align-items: center;
    gap: 2px;
    border: 1px solid transparent;
    transition: all 0.2s;

    &:hover {
      background-color: #eef1f6;
    }
  }

  .sub-nav-btn {
    width: 28px;
    /* Increased from 24px */
    height: 28px;
    font-size: 14px;
    color: #909399;

    &:hover:not(:disabled) {
      background-color: white;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
      color: #409eff;
    }
  }

  .frame-counter {
    font-size: 12px;
    color: #606266;
    font-weight: 500;
    min-width: 60px;
    /* Slightly wider */
    text-align: center;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.5px;
  }

  /* --- 4. Speed Control --- */
  .speed-group {
    width: 110px;
    padding: 0 8px 0 4px;
    gap: 8px;
  }

  .speed-icon {
    font-size: 15px;
    color: #c0c4cc;
  }
}

/* Slider Overrides for Compact Design */
::v-deep .el-slider {
  width: 100%;
  flex: 1;

  .el-slider__runway {
    margin: 0;
    height: 3px;
    background-color: #ebeef5;
    border-radius: 1.5px;
  }

  .el-slider__bar {
    height: 3px;
    background-color: #409eff;
    border-radius: 1.5px;
  }

  /* Center the button vertically on the runway */
  .el-slider__button-wrapper {
    top: -7px;
    width: 16px;
    height: 16px;
  }

  .el-slider__button {
    width: 10px;
    height: 10px;
    border: 2px solid #409eff;
    background-color: white;
    transition: transform 0.2s;

    &:hover,
    &.dragging {
      transform: scale(1.4);
    }
  }

  .el-slider__stop {
    display: none;
  }
}
</style>
