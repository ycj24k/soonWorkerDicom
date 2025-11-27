<template>
  <div class="left_box">
    <!-- 目录树 -->
    <div class="tree_box">
      <div class="flex_box tree_title">
        <div>浏览</div>
      </div>
      <div class="tree_list">
        <el-tree 
          :data="directoryTree" 
          :loading="loading"
          :indent="16"
          class="dicom-tree"
          highlight-current
        >
          <span class="custom-tree-node" slot-scope="{ node, data }">
            <span class="node-content">
              <i :class="getNodeIcon(node, data)" class="node-icon"></i>
              <span class="node-label">{{ node.label }}</span>
            </span>
          </span>
        </el-tree>
      </div>
    </div>

    <!-- 系列列表 -->
    <div class="list_box">
      <div class="flex_box list_title">
        <div>系列</div>
      </div>
      <div class="dicom_container">
        <div 
          class="dicom_item" 
          :class="{ 'dicom_item1': activeSeriesIndex === index }" 
          v-for="(item, index) in thumbnails"
          :key="index" 
          @click="$emit('select-series', index)"
        >
          <el-popover placement="right" trigger="hover">
            <div class="dicom_content">
              <div class="dicom_content_item">Modality : {{ item.modality }}</div>
              <div class="dicom_content_item">Series No : {{ item.seriesNo }}</div>
              <div class="dicom_content_item">Series Date : {{ item.seriesDate }}</div>
              <div class="dicom_content_item">Series Time : {{ item.seriesTime }}</div>
              <div class="dicom_content_item">Description : {{ item.description }}</div>
              <div class="dicom_content_item">SeriesUID : {{ item.seriesUID }}</div>
            </div>
            <img slot="reference" class="dicom_img" :src="item.image" />
          </el-popover>
          <div class="dicom_info">
            <div class="dicom_info_item">S : {{ item.seriesNo }}</div>
            <div class="dicom_info_item">[{{ index + 1 }}]</div>
            <div class="dicom_info_item">
              {{ getSeriesLoadedCount(index) }}/{{ getSeriesTotalCount(index) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex';

export default {
  name: 'DicomSidebar',
  computed: {
    ...mapState('dicom', ['directoryTree', 'thumbnails', 'activeSeriesIndex', 'loading']),
    ...mapGetters('dicom', ['currentSeries'])
  },
  methods: {
    getNodeIcon(node, data) {
      // 根节点 (Level 1) - 通常是患者或根目录
      if (node.level === 1) {
        return 'el-icon-user-solid';
      }
      
      // 叶子节点 (没有子节点) - 通常是图像文件
      if (node.isLeaf || !data.children || data.children.length === 0) {
        return 'el-icon-document'; // 或者 el-icon-picture-outline
      }
      
      // 中间节点 (有子节点) - 文件夹/Study/Series
      // 根据展开状态显示不同图标
      return node.expanded ? 'el-icon-folder-opened' : 'el-icon-folder';
    },
    getSeriesImageCount(index) {
      const series = this.$store.state.dicom.dicomSeries[index];
      return series ? series.children.length : 0;
    },
    getSeriesLoadedCount(index) {
      const series = this.$store.state.dicom.dicomSeries[index];
      if (!series || !series.children) {
        return 0;
      }
      const progress = this.$store.state.dicom.seriesProgress;
      if (progress && progress.isActive && progress.currentSeriesIndex === index) {
        return progress.currentLoaded;
      }
      return series.children.length;
    },
    getSeriesTotalCount(index) {
      const series = this.$store.state.dicom.dicomSeries[index];
      return series && Array.isArray(series.children) ? series.children.length : 0;
    }
  }
};
</script>

<style lang="scss" scoped>
.left_box {
  width: 20%;
  padding-right: 4px;

  .tree_box {
    border: 1px solid #B1B1B1;
    height: 260px;

    .tree_title {
      height: 28px;
      background: linear-gradient(180deg, #EBEADB 0%, #EBEADB 89%, #CBC7B8 100%);
      padding: 0 14px;
      font-size: 12px;
      color: #7E7E7E;
    }

    .tree_list {
      height: calc(100% - 28px);
      overflow: auto;
      background-color: #fff;
      
      /* 树形结构样式优化 */
      .dicom-tree {
        font-size: 12px;
        color: #333;
        background: transparent;
        
        /* 节点内容样式 */
        ::v-deep .el-tree-node__content {
          height: 22px;
          line-height: 22px;
          
          &:hover {
            background-color: #e6f7ff;
          }
        }

        /* 选中节点样式 */
        ::v-deep .el-tree-node.is-current > .el-tree-node__content {
          background-color: #0078d7; /* Windows 风格蓝色 */
          color: #fff;
          
          .node-icon {
            color: #fff;
          }
        }

        /* 自定义节点内容布局 */
        .custom-tree-node {
          display: flex;
          align-items: center;
          width: 100%;
          overflow: hidden;
          
          .node-content {
            display: flex;
            align-items: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .node-icon {
            margin-right: 4px;
            font-size: 14px;
            color: #f0c040; /* 文件夹黄色 */
            
            &.el-icon-user-solid {
              color: #666;
            }
            
            &.el-icon-document {
              color: #999;
            }
          }
          
          .node-label {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
        
        /* 尝试添加层级连接线 (简化版) */
        ::v-deep .el-tree-node__children {
          position: relative;
          
          &::before {
            content: "";
            position: absolute;
            left: 23px; /* 根据 indent 调整 */
            top: 0;
            bottom: 0;
            width: 1px;
            border-left: 1px dotted #ccc;
            z-index: 1;
          }
        }
        
        /* 展开图标样式调整 */
        ::v-deep .el-tree-node__expand-icon {
          font-size: 12px;
          color: #666;
          
          &.is-leaf {
            color: transparent;
          }
        }
      }
    }
  }

  .list_box {
    height: calc(100% - 260px);

    .list_title {
      height: 28px;
      background: linear-gradient(180deg, #F8F8F8 0%, #BFBFBF 100%);
      padding: 0 14px;
      font-size: 12px;
      color: #7E7E7E;
    }

    .dicom_container {
      height: calc(100% - 28px);
      overflow-y: scroll;
    }

    .dicom_item {
      background-color: #000;
      cursor: pointer;
      text-align: center;
      position: relative;

      .dicom_img {
        height: 120px;
        width: 100%;
        object-fit: cover;
      }

      .dicom_info {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 2;
        padding: 5px;

        .dicom_info_item {
          font-size: 12px;
          color: #fff;
          line-height: 16px;
        }
      }

      .dicom_content {
        padding: 5px;
        background-color: #deffdb;
        text-align: left;

        .dicom_content_item {
          font-size: 12px;
          color: #333;
          line-height: 18px;
          white-space: nowrap;
        }
      }
    }

    .dicom_item1 {
      color: #ffffff;
      border: 3px solid #00C325;
    }
  }
}
</style>
