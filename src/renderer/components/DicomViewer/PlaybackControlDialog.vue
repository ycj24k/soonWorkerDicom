<template>
  <div class="playback-control-dialog" v-show="show">
    <div class="playback-content">
      <div class="playback-title">播放控制</div>
      
      <div class="playback-options">
        <div class="option-group">
          <label class="option-label">播放速度</label>
          <el-slider
            v-model="playbackSpeed"
            :min="1"
            :max="30"
            :step="1"
            show-stops
            show-input
            :format-tooltip="formatSpeedTooltip"
          ></el-slider>
        </div>

        <div class="option-group">
          <label class="option-label">播放方向</label>
          <el-radio-group v-model="playbackDirection">
            <el-radio label="forward">正向</el-radio>
            <el-radio label="backward">反向</el-radio>
          </el-radio-group>
        </div>

        <div class="option-group">
          <label class="option-label">播放范围</label>
          <div class="range-inputs">
            <el-input-number
              v-model="startFrame"
              :min="0"
              :max="totalFrames - 1"
              :step="1"
              size="small"
              placeholder="开始帧"
            ></el-input-number>
            <span class="range-separator">-</span>
            <el-input-number
              v-model="endFrame"
              :min="startFrame"
              :max="totalFrames - 1"
              :step="1"
              size="small"
              placeholder="结束帧"
            ></el-input-number>
          </div>
        </div>

        <div class="option-group">
          <label class="option-label">循环播放</label>
          <el-switch v-model="loopPlayback"></el-switch>
        </div>
      </div>

      <div class="playback-actions">
        <el-button @click="startPlayback" type="primary" size="small">
          <i class="el-icon-video-play"></i> 开始播放
        </el-button>
        <el-button @click="cancel" size="small">取消</el-button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PlaybackControlDialog',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    totalFrames: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      playbackSpeed: 10,
      playbackDirection: 'forward',
      startFrame: 0,
      endFrame: this.totalFrames - 1,
      loopPlayback: false
    };
  },
  watch: {
    totalFrames(newVal) {
      if (newVal > 0) {
        this.endFrame = newVal - 1;
      }
    }
  },
  methods: {
    formatSpeedTooltip(val) {
      return `${val} 帧/秒`;
    },
    startPlayback() {
      const options = {
        speed: this.playbackSpeed,
        direction: this.playbackDirection,
        startFrame: this.startFrame,
        endFrame: this.endFrame,
        loop: this.loopPlayback
      };
      this.$emit('start-playback', options);
    },
    cancel() {
      this.$emit('close');
    }
  }
};
</script>

<style lang="scss" scoped>
.playback-control-dialog {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid #00C325;
  border-radius: 8px;
  padding: 20px;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  min-width: 350px;
}

.playback-content {
  .playback-title {
    color: #fff;
    font-size: 16px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 20px;
  }

  .playback-options {
    margin-bottom: 20px;

    .option-group {
      margin-bottom: 20px;

      .option-label {
        display: block;
        color: #fff;
        font-size: 14px;
        margin-bottom: 8px;
      }

      .range-inputs {
        display: flex;
        align-items: center;
        gap: 10px;

        .range-separator {
          color: #fff;
          font-size: 16px;
        }
      }
    }
  }

  .playback-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
  }
}

// Element UI 样式覆盖
::v-deep .el-slider {
  .el-slider__runway {
    background-color: #444;
  }

  .el-slider__bar {
    background-color: #00C325;
  }

  .el-slider__button {
    border-color: #00C325;
  }
}

::v-deep .el-radio {
  .el-radio__label {
    color: #fff;
  }

  .el-radio__input.is-checked .el-radio__inner {
    background-color: #00C325;
    border-color: #00C325;
  }
}

::v-deep .el-switch {
  &.is-checked .el-switch__core {
    background-color: #00C325;
    border-color: #00C325;
  }
}
</style>
