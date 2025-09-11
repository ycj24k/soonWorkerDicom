<template>
  <div id="app">
    <router-view></router-view>
  </div>
</template>

<script>
const dayjs = require('dayjs')

export default {
  name: 'App',
  mounted() {
    let that = this
    // if (that.$store.getters.token) {
    //   that.$store.dispatch('chat/initWebSocket') // 初始化websocket
    // }
  },
  watch: {
    '$store.state.chat.printer_error': {
      handler(val) {
        let that = this
        const currentTime = dayjs().format('HH:mm:ss');
        if (val.message) {
          that.$message({
            message: val.message,
            type: val.type,
          })
        }
        if (val.notify) {
          that.$notify({
            title: '温馨提示：' + currentTime,
            message: val.notify,
            type: val.type,
            duration: 0
          })
        }
        if (val.confirm) {
          that.$notify({
            title: '温馨提示：' + currentTime,
            duration: 0,
            dangerouslyUseHTMLString: true,
            message: `<div class="notify_text">${val.confirm}</div><div class="notify_btns"><div class="notify_btn notify_btn2" id="notifyAgain" data-type="continue_task">重试</div></div>`,
            onClick(event) {
              if (val.req && val.req === 'continue_task') {
                // 下一个任务
                that.$store.dispatch('chat/websocketsend', {
                  req_name: 'continue_task',
                  req_type: 1,
                  req_info: {}
                }).then(() => {
                  
                }).catch(() => {
                  
                })
              }
              this.close()
            }
          });
        }
      },
      deep: true,
      immediate: true
    }
  },
  methods: {}
}
</script>
<style lang="scss">
@use './styles/index.scss'; // 全局自定义的css样式
.el-notification__group {
  width: 100%;
}
.el-notification__content {
  margin: 0;
  line-height: 24PX;
}
.notify_btns{
  display: flex;
  align-items: center;
  justify-content: end;
  padding: 10px 0 0;
  gap: 14px;
  .notify_btn {
    width: 60px;
    height: 30px;
    line-height: 30px;
    text-align: center;
    font-size: 14px;
    border-radius: 4px;
    cursor: pointer;
  }
  .notify_btn1 {
    border: 1px solid #ccc;
  }
  .notify_btn2 {
    background-color: #409EFF;
    color: #fff;
  }
}
</style>
