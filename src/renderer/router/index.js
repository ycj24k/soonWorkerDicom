import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

export default new Router({
  routes: [
    { path: '/', component: () => import('@/components/DicomViewer/index'), name: '首页' },
    { path: '/404', component: () => import('@/views/404') },
  ]
})
