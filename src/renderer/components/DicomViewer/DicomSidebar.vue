<template>
  <div class="left_box">
    <!-- 目录树 -->
    <div class="tree_box">
      <div class="flex_box tree_title">
        <div>浏览</div>
      </div>
      <div class="tree_list">
        <el-tree :data="directoryTree" :loading="loading"></el-tree>
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
              {{ getSeriesImageCount(index) }}/{{ getSeriesImageCount(index) }}
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
    getSeriesImageCount(index) {
      const series = this.$store.state.dicom.dicomSeries[index];
      return series ? series.children.length : 0;
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