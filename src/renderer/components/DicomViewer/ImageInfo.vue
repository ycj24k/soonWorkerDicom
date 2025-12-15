<template>
  <div class="">
    <el-dialog 
      center 
      :visible.sync="dialogVisible" 
      width="75%" 
      top="10vh" 
      title="" 
      :close-on-press-escape="false"
      :close-on-click-modal="false" 
      :show-close="false"
    >
      <div class="info_box">
        <div class="flex_box title_box">
          <div class="title_icon">
            <i class="el-icon-info"></i>
          </div>
          <div>图像信息</div>
        </div>
        <div class="table_box">
          <el-table :data="tableData" style="width: 100%" height="100%" border>
            <el-table-column type="index" width="50">
            </el-table-column>
            <el-table-column prop="tag" label="Group - Element" width="150">
            </el-table-column>
            <el-table-column prop="description" label="Description" width="300">
            </el-table-column>
            <el-table-column prop="value" label="Value">
            </el-table-column>
          </el-table>
        </div>
        <div class="flex_box flex_row_end footer_box">
          <el-button size="small" type="primary" @click="handleClose">关闭</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { mapState } from 'vuex';

export default {
  name: 'ImageInfo',
  data() {
    return {
      dialogVisible: false,
      tableData: [],
      currentSeriesIndex: 0
    };
  },
  computed: {
    ...mapState('dicom', ['dicomDict', 'activeSeriesIndex'])
  },
  methods: {
    /**
     * 格式化 DICOM 日期：YYYYMMDD -> YYYY/MM/DD
     */
    formatDicomDate(value) {
      if (!value || typeof value !== 'string') {
        return value || '';
      }
      const trimmed = value.trim();
      if (/[\/\-\.]/.test(trimmed)) {
        return trimmed;
      }
      const digits = trimmed.replace(/[^\d]/g, '');
      if (digits.length === 8) {
        const y = digits.slice(0, 4);
        const m = digits.slice(4, 6);
        const d = digits.slice(6, 8);
        return `${y}/${m}/${d}`;
      }
      return trimmed;
    },

    /**
     * 格式化 DICOM 时间：HHMMSS(.ffff) -> HH:MM:SS[.ffff]
     * 保留原始的小数部分精度
     */
    formatDicomTime(value) {
      if (!value || typeof value !== 'string') {
        return value || '';
      }
      const trimmed = value.trim();
      if (/:/.test(trimmed)) {
        return trimmed;
      }
      const main = trimmed.replace(/[^\d.]/g, '');
      const fullMatch = main.match(/^(\d{2})(\d{2})(\d{2})(.*)$/);
      if (fullMatch) {
        const hh = fullMatch[1];
        const mm = fullMatch[2];
        const ss = fullMatch[3];
        const suffix = fullMatch[4] || '';
        return `${hh}:${mm}:${ss}${suffix}`;
      }
      const mmMatch = main.match(/^(\d{2})(\d{2})$/);
      if (mmMatch) {
        return `${mmMatch[1]}:${mmMatch[2]}`;
      }
      return trimmed;
    },

    /**
     * 显示图像信息对话框
     * @param {number} seriesIndex - 系列索引，可选，如果不传则使用当前活动系列
     */
    show(seriesIndex = null) {
      try {
        // 确定要显示的系列索引
        this.currentSeriesIndex = seriesIndex !== null ? seriesIndex : this.activeSeriesIndex;
        
        // 从 Vuex store 获取当前系列的 DICOM 数据，并对日期/时间标签进行格式化，仅影响展示
        if (this.dicomDict && this.dicomDict[this.currentSeriesIndex]) {
          const seriesDict = this.dicomDict[this.currentSeriesIndex];
          if (Array.isArray(seriesDict) && seriesDict.length > 0) {
            const DATE_TAGS = new Set([
              '00080020', // Study Date
              '00080021', // Series Date
              '00080022', // Acquisition Date
              '00080023', // Content Date
              '00100030'  // Patient Birth Date
            ]);
            const TIME_TAGS = new Set([
              '00080030', // Study Time
              '00080031', // Series Time
              '00080032', // Acquisition Time
              '00080033'  // Content Time
            ]);

            this.tableData = seriesDict.map(item => {
              let value = item.value;
              if (value && typeof value === 'string') {
                if (DATE_TAGS.has(item.tag)) {
                  value = this.formatDicomDate(value);
                } else if (TIME_TAGS.has(item.tag)) {
                  value = this.formatDicomTime(value);
                }
              }
              return { ...item, value };
            });
          } else {
            this.tableData = [];
          }
        } else {
          this.tableData = [];
        }
        
        this.dialogVisible = true;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('显示图像信息失败:', error);
        }
        this.tableData = [];
        this.dialogVisible = true;
      }
    },
    
    /**
     * 关闭对话框
     */
    handleClose() {
      this.dialogVisible = false;
    }
  }
};
</script>

<style lang="scss" scoped>
.info_box {
  height: calc(75vh);
  
  .title_box {
    font-size: 18px;
    color: #333;
    gap: 5px;
    padding: 0 0 12px;
    
    .title_icon {
      font-size: 30px;
      color: #bec3ff;
    }
  }
  
  .table_box {
    height: calc(100% - 100px);
    
    ::v-deep {
      td, th {
        padding: 0;
        color: #000;
        font-size: 10px;
      }
    }
  }
  
  .footer_box {
    padding: 12px 0 0;
  }
}
</style>
