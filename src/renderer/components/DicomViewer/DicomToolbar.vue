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
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">打开</div>
        </div>
      </div>
    </div>

    <!-- 影像排列 -->
    <div class="flex_box flex_col_top action_items">
      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div class="action_btn" :class="{ 'action_btn1': actionClick === 1 }" @mousedown="actionClick = 1" @mouseup="actionClick = 0">
            <img class="action_img action_img1" src="@/assets/images/action1.png" />
          </div>
          <div class="action_btn" :class="{ 'action_btn1': actionClick === 2 }" @mousedown="actionClick = 2" @mouseup="actionClick = 0">
            <img class="action_img action_img1" src="@/assets/images/action2.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name">影像排列</div>
          <div class="action_line"></div>
        </div>
      </div>
    </div>

    <!-- 基本操作 -->
    <div class="flex_box flex_col_top action_items">
      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('reset-viewport')" 
            class="action_btn" 
            :class="{ 'action_btn1': actionClick === 4 }"
            @mousedown="actionClick = 4" 
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
          <div class="action_line"></div>
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
          <div class="action_line"></div>
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
            :class="{ 'action_btn1': actionClick === 10 }"
            @mousedown="actionClick = 10" 
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

    <!-- 交互工具 -->
    <div class="flex_box flex_col_top action_items">
      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('activate-tool', { toolName: 'Zoom', actionId: 11 })" 
            class="action_btn" 
            :class="{ 'action_btn1': isToolActive(11) }"
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
            :class="{ 'action_btn1': isToolActive(12) }"
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
            :class="{ 'action_btn1': isToolActive(13) }"
            @mousedown="actionClick = 13" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action13.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">像素值</div>
        </div>
      </div>

      <!-- 窗宽窗位 -->
      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div class="action_btn" :class="{ 'action_btn1': actionClick === 14 || isToolActive(14) }" @mousedown="actionClick = 14" @mouseup="actionClick = 0">
            <img class="action_img action_img1" src="@/assets/images/action14.png" />
            <img v-if="isToolActive(14)" class="action_img_active" :src="currentWindowLevelPreset.img" />
            <div @click="$emit('activate-tool', { toolName: 'Wwwc', actionId: 14 })" class="action_btn_content"></div>
            <el-popover v-model="cwShow" placement="bottom" trigger="click">
              <div class="flex_box" style="width: auto;gap: 10px;">
                <div v-for="(item, index) in windowLevelPresets" :key="index">
                  <img @click="$emit('set-window-level', index)" style="cursor: pointer;" :src="item.img" />
                </div>
              </div>
              <div slot="reference" class="action_btn_r"></div>
            </el-popover>
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name action_name1">窗宽窗位</div>
        </div>
      </div>
    </div>

    <!-- 测量工具 -->
    <div class="flex_box flex_col_top action_items">
      <div class="action_item">
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
            :class="{ 'action_btn1': isToolActive(20) }"
            @mousedown="actionClick = 20" 
            @mouseup="actionClick = 0"
          >
            <img class="action_img" src="@/assets/images/action20.png" />
          </div>
        </div>
        <div class="flex_box flex_row_center action_b">
          <div class="action_name">选择</div>
          <div class="action_line"></div>
        </div>
      </div>

      <div class="action_item">
        <div class="flex_box flex_col_top action_btns">
          <div 
            @click="$emit('activate-tool', { toolName: 'Length', actionId: 21 })" 
            class="action_btn" 
            :class="{ 'action_btn1': isToolActive(21) }"
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
            :class="{ 'action_btn1': isToolActive(22) }"
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
            :class="{ 'action_btn1': isToolActive(23) }"
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

export default {
  name: 'DicomToolbar',
  data() {
    return {
      actionClick: 0,
      cwShow: false
    };
  },
  computed: {
    ...mapGetters('viewer', ['isToolActive', 'currentWindowLevelPreset']),
    ...mapGetters('viewer', { windowLevelPresets: 'state' })
  },
  methods: {
    // 工具栏事件处理都通过emit传递给父组件
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

  .action_img_active {
    position: absolute;
    top: 0;
    left: 0;
    width: 35px;
    height: 35px;
    z-index: 2;
  }

  .action_items {
    .action_item {
      .action_btns {
        .action_btn {
          border-radius: 4px;
          padding: 1px;
          margin: 2px;
          position: relative;
          cursor: pointer;
          height: 37px;

          .action_btn_content {
            position: absolute;
            z-index: 3;
            top: 0;
            left: 0;
            width: 35px;
            height: 35px;
          }

          .action_btn_r {
            position: absolute;
            z-index: 3;
            top: 0;
            right: 0;
            width: 8px;
            height: 35px;
          }
        }

        .action_btn1 {
          border: 1px solid #333;
          padding: 0;
        }
      }

      .action_b {
        position: relative;
        padding-top: 2px;

        .action_name {
          position: relative;
          font-size: 12px;
          color: #4D4D4D;
          padding: 0 6px;
          background-color: #fff;
          text-align: center;
          z-index: 9;
        }

        .action_name1 {
          width: 35px;
          padding: 0;
        }

        .action_line {
          position: absolute;
          width: 96%;
          height: 8px;
          border-width: 0 1px 1px 1px;
          border-color: #444;
          border-style: solid;
          top: 4px;
          left: 2%;
          z-index: 1;
        }
      }
    }
  }
}
</style>