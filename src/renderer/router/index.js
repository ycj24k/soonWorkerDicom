import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

export default new Router({
  routes: [
    { path: '/', component: () => import('@/views/dashboard/index'), name: '首页' },
    // { path: '/home', component: () => import('@/views/home/index'), name: '首页' },
    // { path: '/dashboard', component: () => import('@/views/dashboard/index'), name: '工作台' },
    { path: '/404', component: () => import('@/views/404') },
  ]
})
