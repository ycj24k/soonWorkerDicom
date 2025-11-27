<template>
  <div class="flex_box flex_row_center container_box" v-loading="loading" element-loading-text="拼命加载中"
    element-loading-spinner="el-icon-loading" element-loading-background="rgba(0, 0, 0, 0.8)">

  </div>
</template>

<script>
let that
export default {
  name: 'loading-page',
  data() {
    return {
      loading: true
    }
  },
  mounted() {
    that = this
    setTimeout(() => {
      that.$router.push('/')
    }, 2000);
  },
  methods: {
    
  }
}
</script>

<style lang="scss" scoped>
.container_box {
  width: 600px;
  height: 300px;
}
</style>
