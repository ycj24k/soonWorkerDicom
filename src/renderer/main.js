import Vue from 'vue'
import Cookies from 'js-cookie'

import axios from 'axios'

import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

import App from './App'
import router from './router'
import store from './store'
import { accAdd, accSub, accMul, accDiv, filterSize, runCmd } from './utils'

import i18n from './lang' // internationalization
import './permission' // permission control

import cornerstone from "cornerstone-core";
import cornerstoneMath from "cornerstone-math";
import cornerstoneTools from "cornerstone-tools";
import Hammer from "hammerjs";
import dicomParser from 'dicom-parser';
import cornerstoneWadoImageLoader from "cornerstone-wado-image-loader";

if (!process.env.IS_WEB) Vue.use(require('vue-electron'))
Vue.http = Vue.prototype.$http = axios
Vue.config.productionTip = false

// 设置公共方法
Vue.prototype.$accAdd = accAdd
Vue.prototype.$accSub = accSub
Vue.prototype.$accMul = accMul
Vue.prototype.$accDiv = accDiv
Vue.prototype.$filterSize = filterSize
Vue.prototype.$runCmd = runCmd

Vue.use(ElementUI, { 
  size: Cookies.get('size') || 'medium', // set element-ui default size
  i18n: (key, value) => i18n.t(key, value)
})

// 设置外部依赖
cornerstoneWadoImageLoader.external.cornerstone = cornerstone;
// dicom影像数据转换
cornerstoneWadoImageLoader.external.dicomParser = dicomParser;
cornerstoneTools.external.cornerstone = cornerstone;
cornerstoneTools.external.Hammer = Hammer;
cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
// 启用所有内置工具
cornerstoneTools.init();

// 设置公共方法
Vue.prototype.$cornerstone = cornerstone
Vue.prototype.$cornerstoneTools = cornerstoneTools

/* eslint-disable no-new */
new Vue({
  components: { App },
  router,
  store,
  i18n,
  template: '<App/>'
}).$mount('#app')
