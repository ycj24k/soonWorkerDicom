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
          @node-click="handleNodeClick"
        >
          <span class="custom-tree-node" slot-scope="{ node, data }" @contextmenu.prevent="handleNodeContextMenu($event, data, node)">
            <span class="node-content">
              <i :class="getNodeIcon(node, data)" class="node-icon"></i>
              <span class="node-label">{{ node.label }}</span>
              <i 
                v-if="!data.isFile && data.children && data.children.length > 0"
                class="el-icon-plus add-series-icon"
                @click.stop="handleAddSeriesClick(data, node)"
                title="添加到系列列表"
              ></i>
            </span>
          </span>
        </el-tree>
      </div>
    </div>

    <!-- 系列列表 -->
    <div class="list_box">
      <div class="flex_box list_title">
        <div>系列</div>
        <el-button 
          type="text" 
          icon="el-icon-delete" 
          class="clear-btn"
          @click="handleClearSeries"
          title="清空系列列表"
        ></el-button>
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
    /**
     * 清空系列列表
     */
    handleClearSeries() {
      // 清空系列列表并重置视口
      this.$store.dispatch('dicom/clearSeries');
      // 通知父组件清空视口
      this.$emit('clear-viewports');
    },

    /**
     * 右键菜单 - 添加系列到列表
     */
    handleNodeContextMenu(event, data, node) {
      if (!data || data.isFile) {
        return; // 跳过文件节点
      }
      
      // 右键直接添加系列（简化处理，不使用复杂菜单）
      this.handleAddSeries(data, node);
    },

    /**
     * 点击添加图标 - 加载系列并自动显示影像
     */
    async handleAddSeriesClick(data, node) {
      await this.handleAddSeries(data, node);
    },

    /**
     * 添加系列 - 加载系列并自动显示影像
     */
    async handleAddSeries(data, node) {
      console.log('[DicomSidebar][handleAddSeries] 开始', { 
        name: data?.name || data?.label, 
        path: data?.path,
        isFile: data?.isFile 
      });
      if (!data || data.isFile) {
        console.log('[DicomSidebar][handleAddSeries] 跳过文件节点');
        return; // 跳过文件节点
      }
      
      // 加载系列
      const result = await this.$store.dispatch('dicom/loadSeriesFromNode', data).catch(error => {
        console.error('[DicomSidebar][handleAddSeries] 加载系列失败', error);
        // 错误已在 action 中处理
        return null;
      });
      
      console.log('[DicomSidebar][handleAddSeries] 加载结果', result);
      
      // 如果有新系列添加，自动加载影像
      if (result && result.newSeriesIndex !== undefined) {
        console.log('[DicomSidebar][handleAddSeries] 等待 nextTick 后发送 select-series 事件', { newSeriesIndex: result.newSeriesIndex });
        // 等待下一个tick，确保系列已经添加到store
        await this.$nextTick();
        // 通知父组件加载新系列
        this.$emit('select-series', result.newSeriesIndex);
        console.log('[DicomSidebar][handleAddSeries] 已发送 select-series 事件');
      } else {
        console.warn('[DicomSidebar][handleAddSeries] 没有新系列添加，不发送 select-series 事件');
      }
    },

    /**
     * 单击节点 - 展开/折叠树节点
     */
    handleNodeClick(data, node) {
      // 单击用于展开/折叠树节点（el-tree 默认行为）
    },

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
      if (!series) return 0;
      // 优先使用_totalImageCount（总数），如果没有则使用children.length
      return series._totalImageCount || series.imageCount || series.children.length || 0;
    },
    getSeriesLoadedCount(index) {
      const series = this.$store.state.dicom.dicomSeries[index];
      if (!series || !series.children) return 0;
      
      const isDynamicSeries = series.cineInfo && series.cineInfo.isCine && series.cineInfo.frameCount > 1;
      
      if (isDynamicSeries) {
        // 统计动态影像已加载的文件数
        // 重构后：后台加载会覆盖初始化数据，直接统计不同的 parentCineImage 路径即可
        const normalizePath = (path) => {
          if (!path) return null;
          return path.replace(/\\/g, '/');
        };
        
        const fileSet = new Set();
        
        // 从 children 中统计不同的文件路径
        for (const child of series.children) {
          if (child.isFrame && child.parentCineImage) {
            const rawPath = child.parentCineImage.fullPath || child.parentCineImage.path;
            const normalizedPath = normalizePath(rawPath);
            if (normalizedPath) {
              fileSet.add(normalizedPath);
            }
          } else if (child.isFile && !child.isFrame) {
            const rawPath = child.fullPath || child.path;
            const normalizedPath = normalizePath(rawPath);
            if (normalizedPath) {
              fileSet.add(normalizedPath);
            }
          }
        }
        
        return fileSet.size;
      } else {
        return series.children.length;
      }
    },
    getSeriesTotalCount(index) {
      const series = this.$store.state.dicom.dicomSeries[index];
      if (!series) {
        return 0;
      }
      
      // 检查是否为动态影像系列
      const isDynamicSeries = series.cineInfo && series.cineInfo.isCine && series.cineInfo.frameCount > 1;
      
      if (isDynamicSeries) {
        // 动态影像：显示影像文件数，而不是帧数
        // 优先使用_totalImageCount（影像文件数）
        if (series._totalImageCount !== undefined && series._totalImageCount !== null) {
          return series._totalImageCount;
        }
        // 如果没有_totalImageCount，从_allImageNodes计算实际文件数
        if (series._allImageNodes && Array.isArray(series._allImageNodes)) {
          // 统计实际文件数（排除帧节点）
          let fileCount = 0;
          for (const node of series._allImageNodes) {
            if (node.isFile && !node.isFrame) {
              fileCount++;
            }
          }
          return fileCount || 0;
        }
        // 最后回退：如果无法获取文件数，返回0
        return 0;
      } else {
        // 普通影像：使用_totalImageCount（文件数）或children.length
        return series._totalImageCount || series.imageCount || (Array.isArray(series.children) ? series.children.length : 0) || 0;
      }
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

          .add-series-icon {
            margin-left: 8px;
            font-size: 14px;
            color: #409EFF;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s;
            
            &:hover {
              color: #66b1ff;
            }
          }
        }
        
        /* 悬停时显示添加图标 */
        ::v-deep .el-tree-node__content:hover .add-series-icon {
          opacity: 1;
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
      justify-content: space-between;
      align-items: center;

      .clear-btn {
        padding: 0;
        font-size: 14px;
        color: #7E7E7E;
        
        &:hover {
          color: #409EFF;
        }
      }
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
