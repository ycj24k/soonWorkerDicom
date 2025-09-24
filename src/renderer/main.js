import 'core-js/stable'
import 'core-js/es/object/from-entries'

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

try {
  console.log('开始配置Cornerstone...');
  
  // 设置外部依赖
  cornerstoneWadoImageLoader.external.cornerstone = cornerstone;
  cornerstoneWadoImageLoader.external.dicomParser = dicomParser;
  cornerstoneTools.external.cornerstone = cornerstone;
  cornerstoneTools.external.Hammer = Hammer;
  cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
  console.log('外部依赖设置完成');

  // 配置DICOM文件加载器
  cornerstoneWadoImageLoader.configure({
    useWebWorkers: true,
    decodeConfig: {
      convertFloatPixelDataToInt: false,
    },
    beforeSend: function(xhr) {
      // 允许跨域请求
      xhr.setRequestHeader('Access-Control-Allow-Origin', '*');
    }
  });
  console.log('DICOM文件加载器配置完成');

  // 注册wadouri加载器
  console.log('开始注册wadouri image loader...');
  cornerstone.registerImageLoader('wadouri', cornerstoneWadoImageLoader.wadouri.loadImage);
  console.log('wadouri image loader注册完成');

  // 初始化web worker管理器
  console.log('开始初始化web worker管理器...');
  cornerstoneWadoImageLoader.webWorkerManager.initialize({
    maxWebWorkers: navigator.hardwareConcurrency || 1,
    startWebWorkersOnDemand: true,
    taskConfiguration: {
      decodeTask: {
        initializeCodecsOnStartup: false,
        useWebWorkers: true,
      }
    }
  });
  console.log('web worker管理器初始化完成');

  console.log('Cornerstone image loader配置完成');
} catch (error) {
  console.error('Cornerstone配置失败:', error);
}

// 启用所有内置工具
cornerstoneTools.init();

// 设置公共方法
Vue.prototype.$cornerstone = cornerstone
Vue.prototype.$cornerstoneTools = cornerstoneTools

// 初始化服务
import { dicomService, cornerstoneService, gridViewService, playbackService, errorHandler } from './services'

// 设置全局服务
Vue.prototype.$dicomService = dicomService
Vue.prototype.$cornerstoneService = cornerstoneService
Vue.prototype.$gridViewService = gridViewService
Vue.prototype.$playbackService = playbackService
Vue.prototype.$errorHandler = errorHandler

/* eslint-disable no-new */
new Vue({
  components: { App },
  router,
  store,
  i18n,
  template: '<App/>'
}).$mount('#app')
