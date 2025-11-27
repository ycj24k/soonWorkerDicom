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
  // 设置外部依赖
  cornerstoneWadoImageLoader.external.cornerstone = cornerstone;
  cornerstoneWadoImageLoader.external.dicomParser = dicomParser;
  cornerstoneTools.external.cornerstone = cornerstone;
  cornerstoneTools.external.Hammer = Hammer;
  cornerstoneTools.external.cornerstoneMath = cornerstoneMath;

  // 配置DICOM文件加载器
  cornerstoneWadoImageLoader.configure({
    useWebWorkers: true,
    decodeConfig: {
      convertFloatPixelDataToInt: false,
    },
    beforeSend: function(xhr) {
      // 允许跨域请求
      xhr.setRequestHeader('Access-Control-Allow-Origin', '*');
      // XA/US Cine 多帧 DICOM 必须设置此 Accept 头
      // 否则服务器可能不返回 multi-frame 正确序列
      xhr.setRequestHeader('Accept', 'multipart/related; type="application/dicom"');
    }
  });

  // 注册wadouri加载器
  cornerstone.registerImageLoader('wadouri', cornerstoneWadoImageLoader.wadouri.loadImage);

  // 初始化web worker管理器
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

} catch (error) {
  console.error('Cornerstone配置失败:', error);
}

// 启用所有内置工具
cornerstoneTools.init();

// 全局标志：确保 StackScrollMouseWheel 工具只注册一次
let stackScrollMouseWheelToolRegistered = false;

// 注册 StackScrollMouseWheel 工具（全局注册一次）
if (!stackScrollMouseWheelToolRegistered && cornerstoneTools.StackScrollMouseWheelTool) {
  try {
    cornerstoneTools.addTool(cornerstoneTools.StackScrollMouseWheelTool);
    stackScrollMouseWheelToolRegistered = true;
  } catch (error) {
    // 工具已注册，设置标志
    stackScrollMouseWheelToolRegistered = true;
  }
}

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
