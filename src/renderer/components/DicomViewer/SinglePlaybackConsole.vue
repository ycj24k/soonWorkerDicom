<template>
  <div class="single-playback-console" v-show="show">
    <div class="console-content">
      <!-- 关闭按钮 -->
      <button class="console-btn close-btn" @click="handleClose" title="关闭">
        <i class="el-icon-close"></i>
      </button>
      
      <!-- 上一张按钮 -->
      <button 
        class="console-btn prev-btn" 
        @click="handlePrevious"
        :disabled="isFirst"
        title="上一张"
      >
        <i class="el-icon-arrow-left"></i>
      </button>
      
      <!-- 播放/暂停按钮 -->
      <button 
        class="console-btn play-btn" 
        @click="handlePlayPause"
        :title="isPlaying ? '暂停' : '播放'"
      >
        <i :class="isPlaying ? 'el-icon-video-pause' : 'el-icon-video-play'"></i>
      </button>
      
      <!-- 下一张按钮 -->
      <button 
        class="console-btn next-btn" 
        @click="handleNext"
        :disabled="isLast"
        title="下一张"
      >
        <i class="el-icon-arrow-right"></i>
      </button>
      
      <!-- 速度控制滑块 -->
      <div class="speed-control">
        <el-slider
          v-model="internalSpeed"
          :min="1"
          :max="30"
          :step="1"
          :format-tooltip="formatSpeedTooltip"
          @change="handleSpeedChange"
        ></el-slider>
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
  margin-top: 8px;
  z-index: 1000;
  
  .console-content {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 10px 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(10px);
    min-width: 400px;
    
    .console-btn {
      width: 36px;
      height: 36px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      padding: 0;
      
      i {
        font-size: 18px;
        color: #333;
      }
      
      &:hover:not(:disabled) {
        background: #f5f5f5;
        border-color: #409eff;
        
        i {
          color: #409eff;
        }
      }
      
      &:active:not(:disabled) {
        background: #e6f7ff;
        transform: scale(0.95);
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      &.close-btn {
        i {
          font-size: 16px;
        }
      }
      
      &.play-btn {
        background: #409eff;
        border-color: #409eff;
        
        i {
          color: #fff;
        }
        
        &:hover:not(:disabled) {
          background: #66b1ff;
          border-color: #66b1ff;
          
          i {
            color: #fff;
          }
        }
      }
    }
    
    .speed-control {
      flex: 1;
      min-width: 150px;
      margin-left: 8px;
    }
  }
}

// Element UI 滑块样式覆盖
::v-deep .el-slider {
  .el-slider__runway {
    background-color: #e4e7ed;
    height: 4px;
  }

  .el-slider__bar {
    background-color: #409eff;
    height: 4px;
  }

  .el-slider__button {
    width: 14px;
    height: 14px;
    border: 2px solid #409eff;
    background-color: #fff;
    
    &:hover {
      transform: scale(1.2);
    }
  }
  
  .el-slider__stop {
    background-color: #c0c4cc;
    width: 4px;
    height: 4px;
  }
}
</style>

