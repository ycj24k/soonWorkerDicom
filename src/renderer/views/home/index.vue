<template>
  <div class="container_box">
    <div class="header_box"></div>
    <div class="title_box">卡树影像浏览器</div>
    <div class="dicom_box"></div>
    <div class="flex_box flex_row_end btn_box">
      <el-button @click="selectPath" class="btn_item" type="primary">打开</el-button>
      <el-button @click="close" class="btn_item" type="danger">退出</el-button>
    </div>
  </div>
</template>

<script>
let that
const { ipcRenderer } = require('electron');
const { dialog } = require('@electron/remote')
export default {
  name: 'Home',
  data() {
    return {
      targetDirectory: '',
    }
  },
  mounted() {
    that = this
    that.updateWindowSize()
  },
  methods: {
    // 选择路径
    selectPath() {
      if (that.$store.state.app.directory) {
        that.$router.push('/')
        return
      }
      dialog
        .showOpenDialog({
          properties: ["openDirectory"],
        })
        .then((res) => {
          if (res.filePaths[0]) {
            that.targetDirectory = res.filePaths[0]
            that.$store.dispatch('setDirectory', that.targetDirectory)
            that.$router.push('/')
          }
        });
    },
    updateWindowSize() {
      const contentWidth = document.body.scrollWidth; // 页面内容宽度
      const contentHeight = document.body.scrollHeight; // 页面内容高度
      ipcRenderer.send('resize-window', contentWidth, contentHeight);
    },
    close() {
      ipcRenderer.send('close-window');
    }
  }
}
</script>

<style lang="scss" scoped>
  .container_box {
    width: 880px;
    height: 640px;
    .header_box {
      height: 36px;
      -webkit-app-region: drag;
    }
    .title_box {
      font-size: 26px;
      line-height: 30px;
      font-weight: bold;
      padding: 0 20px;
    }
    .dicom_box {
      height: 500px;
    }
    .btn_box {
      padding: 0 60px;
      height: 60px;
      .btn_item {
        height: 35px;
        padding: 0 30px;
        margin-left: 60px;
      }
    }
  }
</style>
