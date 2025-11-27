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
     * 显示图像信息对话框
     * @param {number} seriesIndex - 系列索引，可选，如果不传则使用当前活动系列
     */
    show(seriesIndex = null) {
      try {
        // 确定要显示的系列索引
        this.currentSeriesIndex = seriesIndex !== null ? seriesIndex : this.activeSeriesIndex;
        
        // 从 Vuex store 获取当前系列的 DICOM 数据
        if (this.dicomDict && this.dicomDict[this.currentSeriesIndex]) {
          const seriesDict = this.dicomDict[this.currentSeriesIndex];
          if (Array.isArray(seriesDict) && seriesDict.length > 0) {
            // dicomDict 中存储的是完整的 DICOM 标签数组，包含 tag, description, value
            this.tableData = seriesDict;
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
