/**
 * Cornerstone工具管理服务
 * 负责Cornerstone工具的初始化、管理和操作
 */

import * as cornerstone from 'cornerstone-core';
import * as cornerstoneTools from 'cornerstone-tools';
import { ViewportConfig, ToolState, WindowLevelSetting } from '../types';

export class CornerstoneService {
  private static instance: CornerstoneService;
  private enabledElements: Set<HTMLElement> = new Set();
  private toolState: ToolState = {
    activeAction: 0,
    mode: '2',
    currentCursor: 'mouse2.png'
  };

  private constructor() {}

  public static getInstance(): CornerstoneService {
    if (!CornerstoneService.instance) {
      CornerstoneService.instance = new CornerstoneService();
    }
    return CornerstoneService.instance;
  }

  /**
   * 启用元素
   */
  public enableElement(element: HTMLElement): void {
    if (!this.enabledElements.has(element)) {
      cornerstone.enable(element);
      this.enabledElements.add(element);
      this.setupTools(element);
    }
  }

  /**
   * 禁用元素
   */
  public disableElement(element: HTMLElement): void {
    if (this.enabledElements.has(element)) {
      cornerstone.disable(element);
      this.enabledElements.delete(element);
    }
  }

  /**
   * 设置工具
   */
  private setupTools(element: HTMLElement): void {
    // 添加工具
    cornerstoneTools.addTool(cornerstoneTools.WwwcTool); // 窗宽窗位
    cornerstoneTools.addTool(cornerstoneTools.EllipticalRoiTool); // 椭圆ROI
    cornerstoneTools.addTool(cornerstoneTools.PanTool); // 平移
    cornerstoneTools.addTool(cornerstoneTools.ProbeTool); // 像素值
    cornerstoneTools.addTool(cornerstoneTools.ZoomTool); // 缩放
    cornerstoneTools.addTool(cornerstoneTools.LengthTool); // 测量长度
    cornerstoneTools.addTool(cornerstoneTools.AngleTool); // 测量角度
    cornerstoneTools.addTool(cornerstoneTools.RectangleRoiTool); // 矩形ROI

    // 激活默认工具
    cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 1 });
  }

  /**
   * 激活工具
   */
  public activateTool(toolName: string, options: any = { mouseButtonMask: 1 }): void {
    try {
      cornerstoneTools.setToolActive(toolName, options);
      this.updateToolState(toolName);
    } catch (error) {
      console.error(`激活工具失败: ${toolName}`, error);
    }
  }

  /**
   * 更新工具状态
   */
  private updateToolState(toolName: string): void {
    const toolModeMap: Record<string, string> = {
      'Zoom': '3',
      'Pan': '2',
      'Probe': '5',
      'Wwwc': '4',
      'Length': '1',
      'Angle': '1',
      'RectangleRoi': '1'
    };

    this.toolState.mode = toolModeMap[toolName] || '2';
    this.toolState.currentCursor = `mouse${this.toolState.mode}.png`;
  }

  /**
   * 加载并显示图像
   */
  public async loadAndViewImage(element: HTMLElement, imageId: string, stack?: any): Promise<void> {
    try {
      const image = await cornerstone.loadImage(imageId);
      cornerstone.displayImage(element, image);

      if (stack) {
        cornerstoneTools.addStackStateManager(element, ['stack']);
        cornerstoneTools.addToolState(element, 'stack', stack);
        
        // 添加滚轮工具
        const StackScrollMouseWheelTool = cornerstoneTools.StackScrollMouseWheelTool;
        cornerstoneTools.addTool(StackScrollMouseWheelTool);
        cornerstoneTools.setToolActive('StackScrollMouseWheel', {});
      }
    } catch (error) {
      console.error('加载图像失败:', error);
      throw new Error(`无法加载图像: ${imageId}`);
    }
  }

  /**
   * 重置视口
   */
  public resetViewport(element: HTMLElement, config?: Partial<ViewportConfig>): void {
    try {
      const viewport = cornerstone.getViewport(element);
      
      // 应用默认配置
      const defaultConfig: ViewportConfig = {
        scale: 1,
        translation: { x: 0, y: 0 },
        rotation: 0,
        hflip: false,
        vflip: false,
        invert: false,
        voi: { windowWidth: 400, windowCenter: 50 }
      };

      const newViewport = { ...viewport, ...defaultConfig, ...config };
      cornerstone.setViewport(element, newViewport);
      cornerstone.updateImage(element);
    } catch (error) {
      console.error('重置视口失败:', error);
    }
  }

  /**
   * 旋转图像
   */
  public rotateImage(element: HTMLElement, degrees: number): void {
    try {
      const viewport = cornerstone.getViewport(element);
      viewport.rotation = (viewport.rotation + degrees) % 360;
      cornerstone.setViewport(element, viewport);
      cornerstone.updateImage(element);
    } catch (error) {
      console.error('旋转图像失败:', error);
    }
  }

  /**
   * 翻转图像
   */
  public flipImage(element: HTMLElement, direction: 'horizontal' | 'vertical'): void {
    try {
      const viewport = cornerstone.getViewport(element);
      
      if (direction === 'horizontal') {
        viewport.hflip = !viewport.hflip;
      } else {
        viewport.vflip = !viewport.vflip;
      }
      
      cornerstone.setViewport(element, viewport);
      cornerstone.updateImage(element);
    } catch (error) {
      console.error('翻转图像失败:', error);
    }
  }

  /**
   * 适应窗口大小
   */
  public fitToWindow(element: HTMLElement): void {
    try {
      cornerstone.fitToWindow(element);
      cornerstone.updateImage(element);
    } catch (error) {
      console.error('适应窗口失败:', error);
    }
  }

  /**
   * 反转图像
   */
  public invertImage(element: HTMLElement): void {
    try {
      const viewport = cornerstone.getViewport(element);
      viewport.invert = !viewport.invert;
      cornerstone.setViewport(element, viewport);
      cornerstone.updateImage(element);
    } catch (error) {
      console.error('反转图像失败:', error);
    }
  }

  /**
   * 设置窗宽窗位
   */
  public setWindowLevel(element: HTMLElement, windowWidth: number, windowCenter: number): void {
    try {
      cornerstone.setViewport(element, {
        voi: {
          windowWidth,
          windowCenter
        }
      });
    } catch (error) {
      console.error('设置窗宽窗位失败:', error);
    }
  }

  /**
   * 清除所有测量
   */
  public clearAllMeasurements(element: HTMLElement): void {
    try {
      const toolStateManager = cornerstoneTools.globalImageIdSpecificToolStateManager;
      toolStateManager.restoreToolState({});
      cornerstone.updateImage(element);
    } catch (error) {
      console.error('清除测量失败:', error);
    }
  }

  /**
   * 获取当前工具状态
   */
  public getToolState(): ToolState {
    return { ...this.toolState };
  }

  /**
   * 获取鼠标样式路径
   */
  public getCursorPath(filename: string): string {
    if (process.env.NODE_ENV === 'development') {
      return 'static/cursors/' + filename;
    } else {
      const path = require('path');
      return path.join(process.resourcesPath, 'cursors', filename);
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.enabledElements.forEach(element => {
      this.disableElement(element);
    });
    this.enabledElements.clear();
  }
}