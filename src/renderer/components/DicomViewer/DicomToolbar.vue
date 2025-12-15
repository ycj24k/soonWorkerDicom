<template>
  <div class="flex_box flex_col_top action_box">
    <!-- 文件操作 -->
    <div class="flex_box flex_col_top action_items">
      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 3 }" 
            @mousedown="actionClick = 3"
            @mouseup="actionClick = 0"
            @click="$emit('open-directory')"
          >
            <img class="action_img" src="@/assets/images/action3.png" />
          </div>
          <div 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 4 }" 
            @mousedown="actionClick = 4"
            @mouseup="actionClick = 0"
            @click="$emit('open-file')"
          >
            <img class="action_img" src="@/assets/images/action3.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">打开目录</div>
          <div class="action_name action_name1">打开文件</div>
        </div>
      </div>
    </div>

    <!-- 影像操作 -->
    <div class="flex_box flex_col_top action_items">
      <!-- 影像排列按钮组 -->
      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 1 }" 
            @mousedown="actionClick = 1" 
            @mouseup="actionClick = 0"
            @click="$emit('toggle-grid-layout')"
          >
            <img class="action_img action_img1" src="@/assets/images/action1.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name">影像排列</div>
        </div>
      </div>
      
      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('reset-viewport')" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 10 }"
            @mousedown="actionClick = 10" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action4.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">重新载入</div>
        </div>
      </div>
      
      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('rotate-image', -90)" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 5 }"
            @mousedown="actionClick = 5" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action5.png" />
          </div>
          <div 
            @click="$emit('rotate-image', 90)" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 6 }"
            @mousedown="actionClick = 6" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action6.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name">旋转</div>
        </div>
      </div>

      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('flip-image', 'horizontal')" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 7 }"
            @mousedown="actionClick = 7" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action7.png" />
          </div>
          <div 
            @click="$emit('flip-image', 'vertical')" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 8 }"
            @mousedown="actionClick = 8" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action8.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name">翻转</div>
        </div>
      </div>

      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('fit-to-window')" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 9 }"
            @mousedown="actionClick = 9" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action9.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">最适大小</div>
        </div>
      </div>

      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('invert-image')" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 24 }"
            @mousedown="actionClick = 24" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action10.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">黑白反转</div>
        </div>
      </div>
    </div>

    <!-- 工具操作 -->
    <div class="flex_box flex_col_top action_items">
      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('activate-tool', { toolName: 'Zoom', actionId: 11 })" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 11 || activeAction === 11 }"
            @mousedown="actionClick = 11" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img action_img1" src="@/assets/images/action11.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">缩放</div>
        </div>
      </div>

      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('activate-tool', { toolName: 'Pan', actionId: 12 })" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 12 || activeAction === 12 }"
            @mousedown="actionClick = 12" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action12.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">平移</div>
        </div>
      </div>

      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('activate-tool', { toolName: 'Probe', actionId: 13 })" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 13 || activeAction === 13 }"
            @mousedown="actionClick = 13" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action13.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name">像素值</div>
        </div>
      </div>

      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <el-popover v-model="cwShow" placement="bottom" trigger="manual" :popper-options="{ boundariesElement: 'body' }">
            <div class="flex_box" style="width: auto;gap: 10px;">
              <div v-for="(item, index) in cwImgs" :key="index">
                <img @click="cwChange(index)" style="cursor: pointer;" :src="item.img" />
              </div>
            </div>
            <div 
              slot="reference"
              class="action_btn action_btn_wwwc" 
              :class="{ 'action_btn1': actionClick === 14 || activeAction === 14 }"
              @mousedown="actionClick = 14" 
              @mouseup="actionClick = 0"
              @click="handleWwwcButtonClick"
            >
              <img class="action_img action_img1" src="@/assets/images/action14.png" />
              <img v-if="activeAction === 14 && active2 > 0 && active2 <= cwImgs.length" class="action_img action_img_overlay" :src="cwImgs[active2 - 1].img" />
            </div>
          </el-popover>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">窗宽窗位</div>
        </div>
      </div>

      <!-- <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('activate-tool', { toolName: 'Crosshairs', actionId: 15 })" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 15 || activeAction === 15 }"
            @mousedown="actionClick = 15" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action15.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">定位线</div>
        </div>
      </div> -->

      <div class="action_item playback-item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('activate-tool', { toolName: 'StackScroll', actionId: 16 })" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 16 || activeAction === 16 }"
            @mousedown="actionClick = 16" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action16.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">单张播放</div>
        </div>
        <!-- 播放控制台 -->
        <SinglePlaybackConsole
          :show="showPlaybackConsole"
          :is-playing="isPlaybackPlaying"
          :speed="playbackSpeed"
          :is-first="isPlaybackFirst"
          :is-last="isPlaybackLast"
          @close="$emit('close-playback-console')"
          @previous="$emit('playback-previous')"
          @next="$emit('playback-next')"
          @play-pause="$emit('playback-play-pause')"
          @speed-change="$emit('playback-speed-change', $event)"
        />
      </div>

      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('activate-tool', { toolName: 'Length', actionId: 17 })" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 17 || activeAction === 17 }"
            @mousedown="actionClick = 17" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action17.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">点距调整</div>
        </div>
      </div>

      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('show-image-info')" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 18 }"
            @mousedown="actionClick = 18" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action18.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">图像信息</div>
        </div>
      </div>
    </div>

    <!-- 测量工具 -->
    <div class="flex_box flex_col_top action_items">
      <!-- 选择模块已隐藏 -->
      <div class="action_item" v-if="false">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('clear-measurements')" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 19 }"
            @mousedown="actionClick = 19" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action19.png" />
          </div>
          <div 
            @click="$emit('activate-tool', { toolName: 'Pan', actionId: 20 })" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 20 || activeAction === 20 }"
            @mousedown="actionClick = 20" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action20.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name">选择</div>
        </div>
      </div>

      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('activate-tool', { toolName: 'Length', actionId: 21 })" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 21 || activeAction === 21 }"
            @mousedown="actionClick = 21" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action21.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">长度</div>
        </div>
      </div>

      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('activate-tool', { toolName: 'Angle', actionId: 22 })" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 22 || activeAction === 22 }"
            @mousedown="actionClick = 22" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action22.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">角度</div>
        </div>
      </div>

      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('activate-tool', { toolName: 'RectangleRoi', actionId: 23 })" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 23 || activeAction === 23 }"
            @mousedown="actionClick = 23" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action23.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">面积</div>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import SinglePlaybackConsole from './SinglePlaybackConsole.vue';

export default {
  name: 'DicomToolbar',
  components: {
    SinglePlaybackConsole
  },
  props: {
    activeAction: {
      type: Number,
      default: 0
    },
    active2: {
      type: Number,
      default: 0
    },
    showPlaybackConsole: {
      type: Boolean,
      default: false
    },
    isPlaybackPlaying: {
      type: Boolean,
      default: false
    },
    playbackSpeed: {
      type: Number,
      default: 10
    },
    isPlaybackFirst: {
      type: Boolean,
      default: false
    },
    isPlaybackLast: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      actionClick: 0,
      cwShow: false,
      // 窗宽窗位预设
      cwImgs: [
        { img: require('@/assets/images/action14-1.png'), ww: 80, wc: 35 },
        { img: require('@/assets/images/action14-2.png'), ww: 400, wc: 50 },
        { img: require('@/assets/images/action14-3.png'), ww: 2000, wc: 500 },
        { img: require('@/assets/images/action14-4.png'), ww: 1500, wc: -600 }
      ]
    };
  },
  computed: {
    ...mapGetters('viewer', ['isToolActive', 'currentWindowLevelPreset', 'isGridViewActive', 'isPlaying'])
  },
  methods: {
    // 处理窗宽窗位按钮点击（根据点击位置判断是左侧还是右侧）
    handleWwwcButtonClick(event) {
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const buttonWidth = rect.width;
      
      // 如果点击的是按钮右侧 1/3 区域，显示 popover
      if (clickX > buttonWidth * 2 / 3) {
        event.stopPropagation();
        this.cwShow = !this.cwShow;
        if (this.cwShow) {
          // 显示 popover 时，确保工具已激活
          this.$emit('activate-tool', { toolName: 'Wwwc', actionId: 14 });
        }
      } else {
        // 点击按钮左侧区域，激活工具并应用当前选中的窗位预设
        this.$emit('activate-tool', { toolName: 'Wwwc', actionId: 14 });
        // 如果已经选择了预设（active2 > 0），应用该预设
        if (this.active2 > 0 && this.active2 <= this.cwImgs.length) {
          const presetIndex = this.active2 - 1; // active2 从 1 开始，转换为数组索引
          this.$emit('set-window-level', presetIndex);
        }
      }
    },
    
    // 窗宽窗位切换
    cwChange(index) {
      // active2 从 1 开始（1, 2, 3, 4 对应 4 个预设），0 表示未选择预设
      const active2Value = index + 1;
      // 通知父组件更新 active2 并执行操作
      this.$emit('update:active2', active2Value);
      this.$emit('activate-tool', { toolName: 'Wwwc', actionId: 14 });
      this.$emit('set-window-level', index);
      // 关闭 popover
      this.$nextTick(() => {
        this.cwShow = false;
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.action_box {
  height: 88px;
  padding: 0 10px;
  gap: 15px;

  .action_img {
    width: 35px;
    height: 35px;
  }

  .action_img1 {
    width: 43px;
  }

  .action_btn {
    width: 43px;
    height: 43px;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    transition: all 0.2s;
    box-sizing: border-box;

    &:hover {
      background: #f5f5f5;
    }

    &.action_btn1 {
      border-color: #409eff;
      border-width: 2px;
    }

    &.action_btn_wwwc {
      position: relative;
    }
  }

  .action_img_overlay {
    position: absolute;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    width: 30px;
    height: 34px;
    z-index: 1;
    pointer-events: none;
  }

  .action_name {
    font-size: 12px;
    color: #666;
    text-align: center;
    margin-top: 2px;
  }

  .action_name1 {
    width: 43px;
    padding: 0 4px;
  }

  .action_line {
    width: 1px;
    height: 12px;
    background: #ddd;
    margin: 0 2px;
  }

  .action_items {
    gap: 10px;
  }

  .action_item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    
    &.playback-item {
      position: relative;
    }
  }

  .action_btns {
    gap: 2px;
  }

  .action_b {
    gap: 2px;
  }

  .action_img_active {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 35px;
    height: 35px;
    z-index: 11;
    pointer-events: none;
  }
}
</style>