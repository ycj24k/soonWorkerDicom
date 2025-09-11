<template>
  <div v-if="showImageInfo && currentDicomDict.length" class="image-info-overlay">
    <!-- 患者信息 -->
    <div class="top_info top_info1">
      <div class="top_info_item" style="margin-bottom: 20px;">{{ getDicomValue('00100010') }}</div>
      <div class="top_info_item">({{ getDicomValue('00101010') }}/{{ getDicomValue('00100040') }})</div>
      <div class="top_info_item">{{ getDicomValue('00100030') }}</div>
      <div class="top_info_item">{{ getDicomValue('00100020') }}</div>
      <div class="top_info_item">{{ getDicomValue('00080050') }}</div>
    </div>

    <!-- 检查信息 -->
    <div class="top_info top_info2">
      <div class="top_info_item">Study Date : {{ getDicomValue('00080020') }}</div>
      <div class="top_info_item">Study Time : {{ getDicomValue('00080030') }}</div>
      <div class="top_info_item">{{ getDicomValue('00080080') }}</div>
      <div class="top_info_item">{{ getDicomValue('00081030') }}</div>
      <div class="top_info_item">Series No : {{ getDicomValue('00200011') }}</div>
      <div class="top_info_item">Image No : {{ activeImageIndex + 1 }}</div>
      <div class="top_info_item">Acq Time : {{ getDicomValue('00080032') }}</div>
    </div>

    <!-- 技术参数 -->
    <div class="top_info top_info3">
      <div class="top_info_item">{{ imageSize }}</div>
      <div class="top_info_item">{{ zoomLevel }}%</div>
      <div class="top_info_item">{{ getDicomValue('00081090') }}</div>
      <div class="top_info_item">{{ getDicomValue('00081010') }}</div>
      <div class="top_info_item">{{ getDicomValue('00080070') }}</div>
      <div class="top_info_item" style="margin-top: 20px;">
        W= {{ currentWindowLevel.ww }} L= {{ currentWindowLevel.wc }}
      </div>
    </div>

    <!-- 方向指示 -->
    <div class="top_x">
      <div class="flex_box flex_col_bottom top_x_lines">
        <div 
          class="top_x_line" 
          :class="{'top_x_line1': index % 5 === 0}" 
          v-for="(item, index) in xData" 
          :key="index"
        ></div>
      </div>
      <div class="top_x_text">P</div>
    </div>

    <div class="flex_box top_y">
      <div class="flex_box flex_col flex_col_bottom top_y_lines">
        <div 
          class="top_y_line" 
          :class="{'top_y_line1': index % 5 === 0}" 
          v-for="(item, index) in yData" 
          :key="index"
        ></div>
      </div>
      <div class="top_y_text">L</div>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex';

export default {
  name: 'DicomImageInfo',
  data() {
    return {
      xData: Array.from({ length: 33 }, (_, i) => i),
      yData: Array.from({ length: 20 }, (_, i) => i),
      imageSize: '11cm'
    };
  },
  computed: {
    ...mapState('dicom', ['activeImageIndex']),
    ...mapState('viewer', ['showImageInfo', 'zoomLevel']),
    ...mapGetters('dicom', ['currentDicomDict', 'getDicomValue']),
    ...mapGetters('viewer', ['currentWindowLevelPreset']),
    
    currentWindowLevel() {
      return {
        ww: this.currentWindowLevelPreset?.ww || 400,
        wc: this.currentWindowLevelPreset?.wc || 50
      };
    }
  }
};
</script>

<style lang="scss" scoped>
.image-info-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 999;

  .top_info {
    position: absolute;
    
    .top_info_item {
      color: #fff;
      font-size: 13px;
      line-height: 20px;
    }
  }

  .top_info1 {
    top: 0px;
    left: calc(20% + 14px);
  }

  .top_info2 {
    top: 0px;
    right: 4px;
    text-align: right;
  }

  .top_info3 {
    bottom: 15px;
    right: 4px;
    text-align: right;
  }

  .top_x {
    position: absolute;
    left: 50%;
    bottom: 0;
    
    .top_x_lines {
      border-bottom: 1px solid #fff;
      gap: 10px;
      
      .top_x_line {
        width: 1px;
        height: 4px;
        background-color: #fff;
      }
      
      .top_x_line1 {
        height: 8px;
      }
    }
    
    .top_x_text {
      color: #fff;
      font-size: 13px;
      padding-top: 6px;
      text-align: center;
    }
  }

  .top_y {
    position: absolute;
    top: 50%;
    right: 4px;
    transform: translateY(-50%);
    
    .top_y_lines {
      border-right: 1px solid #fff;
      gap: 10px;
      
      .top_y_line {
        width: 4px;
        height: 1px;
        background-color: #fff;
      }
      
      .top_y_line1 {
        width: 8px;
      }
    }
    
    .top_y_text {
      color: #fff;
      font-size: 13px;
      padding-left: 10px;
      text-align: center;
    }
  }
}
</style>