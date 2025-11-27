/**
 * Cornerstone服务
 * 负责图像显示和工具管理
 */

import Vue from 'vue';

export class CornerstoneService {
  constructor() {
    this.enabledElements = new Map();
    this.imageLoaderRegistered = false;
  }

  static getInstance() {
    if (!CornerstoneService.instance) {
      CornerstoneService.instance = new CornerstoneService();
    }
    return CornerstoneService.instance;
  }

  /**
   * 获取Cornerstone实例
   */
  getCornerstone() {
    if (!Vue.prototype.$cornerstone) {
      throw new Error('Vue.prototype.$cornerstone 未初始化，请检查main.js中的配置');
    }
    return Vue.prototype.$cornerstone;
  }

  /**
   * 获取CornerstoneTools实例
   */
  getCornerstoneTools() {
    if (!Vue.prototype.$cornerstoneTools) {
      throw new Error('Vue.prototype.$cornerstoneTools 未初始化，请检查main.js中的配置');
    }
    return Vue.prototype.$cornerstoneTools;
  }

  /**
   * 确保image loader已注册
   */
  ensureImageLoaderRegistered() {
    // console.log('ensureImageLoaderRegistered 被调用, imageLoaderRegistered:', this.imageLoaderRegistered);
    
    // 强制重新注册，因为之前的注册可能不成功
    // console.log('强制重新注册image loader...');
    this.imageLoaderRegistered = false;

    try {
      const cornerstone = this.getCornerstone();
      // console.log('Cornerstone实例:', cornerstone);
      // console.log('Cornerstone.imageLoader:', cornerstone.imageLoader);
      // console.log('Cornerstone的所有属性:', Object.keys(cornerstone));
      
      // 检查是否有imageLoader属性
      if (!cornerstone.imageLoader) {
        // console.log('Cornerstone实例没有imageLoader属性，尝试直接注册image loader');
        // 即使没有imageLoader属性，也要尝试注册
        const cornerstoneWadoImageLoader = require('cornerstone-wado-image-loader');
        cornerstoneWadoImageLoader.external.cornerstone = cornerstone;
        cornerstoneWadoImageLoader.external.dicomParser = require('dicom-parser');
        
        cornerstone.registerImageLoader('wadouri', cornerstoneWadoImageLoader.wadouri.loadImage);
        // console.log('CornerstoneService: wadouri image loader注册完成（无imageLoader属性）');
        this.imageLoaderRegistered = true;
        return;
      }
      
      // 检查已注册的image loaders
      const imageLoaders = cornerstone.imageLoader.getRegisteredImageLoaders();
      // console.log('已注册的image loaders:', imageLoaders);
      
      if (imageLoaders.includes('wadouri')) {
        // console.log('wadouri image loader已经注册，无需重复注册');
        this.imageLoaderRegistered = true;
        return;
      }
      
      // console.log('wadouri image loader未注册，尝试注册...');
      
      // 如果未注册，则注册
      const cornerstoneWadoImageLoader = require('cornerstone-wado-image-loader');
      cornerstoneWadoImageLoader.external.cornerstone = cornerstone;
      cornerstoneWadoImageLoader.external.dicomParser = require('dicom-parser');
      
      cornerstone.registerImageLoader('wadouri', cornerstoneWadoImageLoader.wadouri.loadImage);
      // console.log('CornerstoneService: wadouri image loader注册完成');
      
      this.imageLoaderRegistered = true;
    } catch (error) {
      // console.error('CornerstoneService: 注册image loader失败:', error);
      // console.error('错误详情:', error.stack);
      throw error;
    }
  }

  /**
   * 启用元素 - 基于dashboard的成功模式
   */
  enableElement(element) {
    // console.log('enableElement被调用, element:', element);
    
    if (this.enabledElements.has(element)) {
      // console.log('元素已经启用，跳过');
      return;
    }

    try {
      // console.log('开始启用Cornerstone元素（使用dashboard模式）...');
      
      // 直接使用cornerstone.enable，就像dashboard一样
      this.getCornerstone().enable(element);
      this.enabledElements.set(element, true);
      
      // 添加基础工具
      this.addBasicTools();
      
      // console.log('Cornerstone元素已启用');
    } catch (error) {
      // console.error('启用Cornerstone元素失败:', error);
      throw error;
    }
  }

  /**
   * 禁用元素
   */
  disableElement(element) {
    if (!this.enabledElements.has(element)) {
      return;
    }

    try {
      this.getCornerstone().disable(element);
      this.enabledElements.delete(element);
      // console.log('Cornerstone元素已禁用');
    } catch (error) {
      // console.error('禁用Cornerstone元素失败:', error);
    }
  }

  /**
   * 添加基础工具 - 基于dashboard的成功模式
   */
  addBasicTools() {
    // console.log('添加基础工具（使用dashboard模式）...');
    try {
      const tools = this.getCornerstoneTools();
      
      // 添加工具，就像dashboard一样
      tools.addTool(tools.WwwcTool); // 窗宽窗位
      tools.addTool(tools.EllipticalRoiTool); // 椭圆ROI
      tools.addTool(tools.PanTool); // 平移
      tools.addTool(tools.ProbeTool); // 像素值
      tools.addTool(tools.ZoomTool); // 缩放
      tools.addTool(tools.LengthTool); // 测量长度
      tools.addTool(tools.AngleTool); // 测量角度
      tools.addTool(tools.RectangleRoiTool); // 矩形ROI
      
      // 激活默认工具
      tools.setToolActive('Pan', { mouseButtonMask: 1 });
      // console.log('基础工具添加完成');
    } catch (error) {
      // console.error('添加基础工具失败:', error);
    }
  }

  /**
   * 确保 StackScrollMouseWheel 工具已注册（工具已在 main.js 中全局注册，此方法仅作备用）
   */
  ensureStackScrollMouseWheelTool() {
    // StackScrollMouseWheel 工具已在 main.js 中全局注册
    // 该工具不需要全局激活，会在元素启用时自动工作
    // 如果确实需要激活，可以在这里调用 setToolActive，但通常不需要
    return true;
  }

  /**
   * 创建图像堆栈
   */
  createImageStack(imageIds, currentImageIdIndex = 0) {
    return {
      imageIds: imageIds,
      currentImageIdIndex: currentImageIdIndex
    };
  }

  /**
   * 加载堆栈到元素 - 基于dashboard的成功模式
   */
  async loadStackToElement(element, stack) {
    try {
      // console.log('loadStackToElement被调用（使用dashboard模式）');
      const imageId = stack.imageIds[stack.currentImageIdIndex];
      // console.log('准备加载图像:', imageId);
      // console.log('stack信息:', stack);
      
      // 使用dashboard的成功模式
      const StackScrollMouseWheelTool = this.getCornerstoneTools().StackScrollMouseWheelTool;
      
      // 直接使用cornerstone.loadImage和displayImage，就像dashboard一样
      this.getCornerstone().loadImage(imageId).then((image) => {
        // console.log('图像加载成功:', image);
        this.getCornerstone().displayImage(element, image);
        this.getCornerstoneTools().addStackStateManager(element, ['stack']);
        this.getCornerstoneTools().addToolState(element, 'stack', stack);
        // console.log('图像显示完成');
      }).catch((error) => { 
        // console.error('图像加载失败:', error);
      });
    } catch (error) {
      // console.error('加载图像堆栈失败:', error);
      throw error;
    }
  }

  /**
   * 设置窗口级别
   */
  setWindowLevel(element, windowWidth, windowCenter) {
    try {
      const viewport = this.getCornerstone().getViewport(element);
      viewport.voi.windowWidth = windowWidth;
      viewport.voi.windowCenter = windowCenter;
      this.getCornerstone().setViewport(element, viewport);
      // console.log('窗口级别设置完成');
    } catch (error) {
      // console.error('设置窗口级别失败:', error);
    }
  }

  /**
   * 重置视图
   */
  resetViewport(element) {
    try {
      const viewport = this.getCornerstone().getViewport(element);
      viewport.voi.windowWidth = 400;
      viewport.voi.windowCenter = 50;
      viewport.scale = 1;
      viewport.translation.x = 0;
      viewport.translation.y = 0;
      viewport.rotation = 0;
      viewport.hflip = false;
      viewport.vflip = false;
      this.getCornerstone().setViewport(element, viewport);
      this.getCornerstone().updateImage(element);
      // console.log('视图重置完成');
    } catch (error) {
      // console.error('重置视图失败:', error);
    }
  }

  /**
   * 缩放视图
   */
  zoom(element, factor) {
    try {
      const viewport = this.getCornerstone().getViewport(element);
      viewport.scale *= factor;
      this.getCornerstone().setViewport(element, viewport);
      this.getCornerstone().updateImage(element);
      // console.log('视图缩放完成');
    } catch (error) {
      // console.error('缩放视图失败:', error);
    }
  }

  /**
   * 平移视图
   */
  pan(element, deltaX, deltaY) {
    try {
      const viewport = this.getCornerstone().getViewport(element);
      viewport.translation.x += deltaX;
      viewport.translation.y += deltaY;
      this.getCornerstone().setViewport(element, viewport);
      this.getCornerstone().updateImage(element);
      // console.log('视图平移完成');
    } catch (error) {
      // console.error('平移视图失败:', error);
    }
  }

  /**
   * 旋转视图
   */
  rotate(element, degrees) {
    try {
      const viewport = this.getCornerstone().getViewport(element);
      viewport.rotation += degrees;
      this.getCornerstone().setViewport(element, viewport);
      this.getCornerstone().updateImage(element);
      // console.log('视图旋转完成');
    } catch (error) {
      // console.error('旋转视图失败:', error);
    }
  }

  /**
   * 水平翻转
   */
  flipHorizontal(element) {
    try {
      const viewport = this.getCornerstone().getViewport(element);
      viewport.hflip = !viewport.hflip;
      this.getCornerstone().setViewport(element, viewport);
      this.getCornerstone().updateImage(element);
      // console.log('水平翻转完成');
    } catch (error) {
      // console.error('水平翻转失败:', error);
    }
  }

  /**
   * 垂直翻转
   */
  flipVertical(element) {
    try {
      const viewport = this.getCornerstone().getViewport(element);
      viewport.vflip = !viewport.vflip;
      this.getCornerstone().setViewport(element, viewport);
      this.getCornerstone().updateImage(element);
      // console.log('垂直翻转完成');
    } catch (error) {
      // console.error('垂直翻转失败:', error);
    }
  }

  /**
   * 适应窗口
   */
  fitToWindow(element) {
    try {
      const viewport = this.getCornerstone().getViewport(element);
      const canvas = element.querySelector('canvas');
      if (canvas) {
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const image = this.getCornerstone().getImage(element);
        if (image) {
          const scaleX = canvasWidth / image.width;
          const scaleY = canvasHeight / image.height;
          const scale = Math.min(scaleX, scaleY);
          viewport.scale = scale;
          viewport.translation.x = 0;
          viewport.translation.y = 0;
          this.getCornerstone().setViewport(element, viewport);
          this.getCornerstone().updateImage(element);
          // console.log('适应窗口完成');
        }
      }
    } catch (error) {
      // console.error('适应窗口失败:', error);
    }
  }

  /**
   * 获取当前图像
   */
  getCurrentImage(element) {
    try {
      return this.getCornerstone().getImage(element);
    } catch (error) {
      // console.error('获取当前图像失败:', error);
      return null;
    }
  }

  /**
   * 获取当前视口
   */
  getCurrentViewport(element) {
    try {
      return this.getCornerstone().getViewport(element);
    } catch (error) {
      // console.error('获取当前视口失败:', error);
      return null;
    }
  }

  /**
   * 加载并查看图像
   */
  async loadAndViewImage(element, imageId) {
    try {
      this.ensureImageLoaderRegistered();
      
      const image = await this.getCornerstone().loadImage(imageId);
      this.getCornerstone().displayImage(element, image);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('加载并显示图像失败:', error);
      }
      throw error;
    }
  }
}