<template>
  <div class="dicom-viewer-container">
    <!-- 头部标题栏 -->
    <div class="flex_box flex_row_between header_box">
      <div class="header_title">SOONDICOMER</div>
      <div class="flex_box header_btns">
        <el-button @click="closeApp" icon="el-icon-close" class="header_btn"></el-button>
      </div>
    </div>

    <!-- 工具栏 -->
    <DicomToolbar 
      @open-directory="selectPath"
      @reset-viewport="resetViewport"
      @rotate-image="rotateImage"
      @flip-image="flipImage"
      @fit-to-window="fitToWindow"
      @invert-image="invertImage"
      @activate-tool="activateTool"
      @set-window-level="setWindowLevel"
      @clear-measurements="clearMeasurements"
    />

    <!-- 主内容区 -->
    <div class="flex_box content_box">
      <!-- 侧边栏 -->
      <DicomSidebar @select-series="selectSeries" />

      <!-- 图像显示区 -->
      <div 
        ref="dicomViewer" 
        id="dicomViewer" 
        :style="{ cursor: currentCursor }"
        class="dicom-viewer"
      >
        <!-- 图像信息覆盖层 -->
        <DicomImageInfo />
      </div>
    </div>

    <!-- 图像详细信息对话框 -->
    <ImageInfo ref="imageInfo" />
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex';
import DicomToolbar from './DicomToolbar.vue';
import DicomSidebar from './DicomSidebar.vue';
import DicomImageInfo from './DicomImageInfo.vue';
import ImageInfo from '../dashboard/components/image-info.vue';
import { cornerstoneService, errorHandler } from '@/services';

const { ipcRenderer } = require('electron');
const { dialog } = require('@electron/remote');

export default {
  name: 'DicomViewer',
  components: {
    DicomToolbar,
    DicomSidebar,
    DicomImageInfo,
    ImageInfo
  },
  computed: {
    ...mapState('dicom', ['loading', 'error']),
    ...mapState('viewer', ['toolState']),
    ...mapGetters('dicom', ['currentImage', 'currentImageIds']),
    ...mapGetters('viewer', ['currentCursor'])
  },
  mounted() {
    this.initializeViewer();
  },
  beforeDestroy() {
    this.cleanupViewer();
  },
  methods: {
    ...mapActions('dicom', [
      'loadDicomDirectory', 
      'selectDicomSeries', 
      'selectImage'
    ]),
    ...mapActions('viewer', [
      'activateTool',
      'resetViewport',
      'rotateImage',
      'flipImage',
      'fitToWindow',
      'invertImage',
      'setWindowLevel',
      'clearAllMeasurements'
    ]),

    /**
     * 初始化查看器
     */
    initializeViewer() {
      try {
        ipcRenderer.send('maximize-window');
        cornerstoneService.enableElement(this.$refs.dicomViewer);
      } catch (error) {
        errorHandler.handleError(error, 'initializeViewer');
      }
    },

    /**
     * 清理查看器
     */
    cleanupViewer() {
      try {
        cornerstoneService.disableElement(this.$refs.dicomViewer);
      } catch (error) {
        console.error('清理查看器失败:', error);
      }
    },

    /**
     * 选择目录
     */
    async selectPath() {
      try {
        const result = await dialog.showOpenDialog({
          properties: ["openDirectory"],
        });
        
        if (result.filePaths[0]) {
          await this.loadDicomDirectory(result.filePaths[0]);
          await this.loadFirstImage();
        }
      } catch (error) {
        errorHandler.handleError(error, 'selectPath');
      }
    },

    /**
     * 选择序列
     */
    async selectSeries(index) {
      try {
        await this.selectDicomSeries(index);
        await this.loadCurrentImage();
      } catch (error) {
        errorHandler.handleError(error, 'selectSeries');
      }
    },

    /**
     * 加载第一张图像
     */
    async loadFirstImage() {
      if (this.currentImage) {
        await this.loadCurrentImage();
      }
    },

    /**
     * 加载当前图像
     */
    async loadCurrentImage() {
      try {
        const element = this.$refs.dicomViewer;
        const imageIds = this.currentImageIds;
        
        if (imageIds.length > 0) {
          const stack = {
            currentImageIdIndex: 0,
            imageIds
          };
          
          await cornerstoneService.loadAndViewImage(element, imageIds[0], stack);
        }
      } catch (error) {
        errorHandler.handleError(error, 'loadCurrentImage');
      }
    },

    /**
     * 工具栏事件处理
     */
    async activateTool({ toolName, actionId }) {
      try {
        await this.activateTool({ toolName, actionId });
      } catch (error) {
        errorHandler.handleError(error, 'activateTool');
      }
    },

    async resetViewport() {
      try {
        const element = this.$refs.dicomViewer;
        await this.resetViewport(element);
      } catch (error) {
        errorHandler.handleError(error, 'resetViewport');
      }
    },

    async rotateImage(degrees) {
      try {
        const element = this.$refs.dicomViewer;
        await this.rotateImage({ element, degrees });
      } catch (error) {
        errorHandler.handleError(error, 'rotateImage');
      }
    },

    async flipImage(direction) {
      try {
        const element = this.$refs.dicomViewer;
        await this.flipImage({ element, direction });
      } catch (error) {
        errorHandler.handleError(error, 'flipImage');
      }
    },

    async fitToWindow() {
      try {
        const element = this.$refs.dicomViewer;
        await this.fitToWindow(element);
      } catch (error) {
        errorHandler.handleError(error, 'fitToWindow');
      }
    },

    async invertImage() {
      try {
        const element = this.$refs.dicomViewer;
        await this.invertImage(element);
      } catch (error) {
        errorHandler.handleError(error, 'invertImage');
      }
    },

    async setWindowLevel(index) {
      try {
        const element = this.$refs.dicomViewer;
        await this.setWindowLevel({ element, index });
      } catch (error) {
        errorHandler.handleError(error, 'setWindowLevel');
      }
    },

    async clearMeasurements() {
      try {
        const element = this.$refs.dicomViewer;
        await this.clearAllMeasurements(element);
      } catch (error) {
        errorHandler.handleError(error, 'clearMeasurements');
      }
    },

    /**
     * 显示图像信息
     */
    showImageInfo() {
      this.$refs.imageInfo.show(this.$store.state.dicom.activeSeriesIndex);
    },

    /**
     * 关闭应用
     */
    closeApp() {
      ipcRenderer.send('close-window');
    }
  }
};
</script>

<style lang="scss" scoped>
.dicom-viewer-container {
  height: 100vh;
  display: flex;
  flex-direction: column;

  .header_box {
    height: 26px;
    -webkit-app-region: drag;

    .header_title {
      font-size: 14px;
      font-weight: bold;
      padding-left: 20px;
    }

    .header_btns {
      .header_btn {
        -webkit-app-region: no-drag;
        border: none;
        font-size: 18px;
        color: #333;
        font-weight: bold;
        height: 26px;
        width: 26px;
        padding: 0;
      }
    }
  }

  .content_box {
    flex: 1;
    align-items: stretch;
    padding: 0 0 0 10px;
    position: relative;

    .dicom-viewer {
      width: 80%;
      position: relative;
      background-color: #000;
    }
  }
}
</style>
