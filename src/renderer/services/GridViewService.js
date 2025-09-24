/**
 * 网格视图管理服务
 * 负责多视口网格布局的管理和操作
 */

const cornerstone = require('cornerstone-core');

export class GridViewService {
  constructor() {
    this.gridState = {
      isActive: false,
      layout: { rows: 3, cols: 3, totalSlots: 9 },
      viewports: [],
      selectedViewportIndex: 0
    };
  }

  static getInstance() {
    if (!GridViewService.instance) {
      GridViewService.instance = new GridViewService();
    }
    return GridViewService.instance;
  }

  /**
   * 初始化视口
   */
  initializeViewports() {
    this.gridState.viewports = [];
    const { rows, cols } = this.gridState.layout;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const viewport = {
          id: `viewport-${row}-${col}`,
          row,
          col,
          isActive: row === 0 && col === 0 // 默认激活第一个视口
        };
        this.gridState.viewports.push(viewport);
      }
    }
  }

  /**
   * 激活网格视图
   */
  activateGridLayout(rows = 3, cols = 3) {
    this.gridState.isActive = true;
    this.gridState.layout = { rows, cols, totalSlots: rows * cols };
    this.initializeViewports();
    console.log('网格布局已激活:', { rows, cols });
  }

  /**
   * 停用网格视图
   */
  deactivateGridLayout() {
    this.gridState.isActive = false;
    this.gridState.viewports = [];
    this.gridState.selectedViewportIndex = 0;
    console.log('网格布局已停用');
  }

  /**
   * 应用网格样式
   */
  applyGridStyles(container) {
    if (this.gridState.isActive) {
      const { rows, cols } = this.gridState.layout;
      container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
      console.log('网格样式已应用:', { rows, cols });
    }
  }

  /**
   * 清除网格样式
   */
  clearGridStyles(container) {
    container.style.gridTemplateColumns = '';
    container.style.gridTemplateRows = '';
    console.log('网格样式已清除');
  }

  /**
   * 加载图像到视口
   */
  async loadImageToViewport(viewportIndex, imageId, element, seriesIndex, imageIndex) {
    if (!this.gridState.isActive || viewportIndex >= this.gridState.viewports.length) {
      throw new Error('无效的视口索引');
    }

    const viewport = this.gridState.viewports[viewportIndex];
    const { row, col } = viewport;

    try {
      // 创建视口元素
      const viewportElement = this.createViewportElement(viewportIndex, row, col);
      
      // 将视口元素添加到容器
      element.appendChild(viewportElement);

      // 启用Cornerstone
      cornerstone.enable(viewportElement);

      // 加载图像
      await cornerstone.loadImage(imageId);
      cornerstone.displayImage(viewportElement, await cornerstone.loadImage(imageId));

      // 更新视口状态
      viewport.imageId = imageId;
      viewport.seriesIndex = seriesIndex;
      viewport.imageIndex = imageIndex;
      viewport.isActive = true;

      console.log('图像已加载到视口:', { viewportIndex, row, col, imageId });
    } catch (error) {
      console.error('加载图像到视口失败:', error);
      throw error;
    }
  }

  /**
   * 创建视口元素
   */
  createViewportElement(viewportIndex, row, col) {
    const viewportElement = document.createElement('div');
    viewportElement.className = 'grid-viewport';
    viewportElement.id = `viewport-${viewportIndex}`;
    viewportElement.style.gridColumn = `${col + 1}`;
    viewportElement.style.gridRow = `${row + 1}`;
    viewportElement.style.border = '1px solid #ccc';
    viewportElement.style.backgroundColor = '#f5f5f5';
    viewportElement.style.cursor = 'pointer';
    
    // 添加点击事件
    viewportElement.addEventListener('click', () => {
      this.selectViewport(viewportIndex);
    });

    return viewportElement;
  }

  /**
   * 选择视口
   */
  selectViewport(index) {
    if (index >= 0 && index < this.gridState.viewports.length) {
      this.gridState.selectedViewportIndex = index;
      
      // 更新视口样式
      this.updateViewportStyles();
      
      console.log('视口已选择:', index);
    }
  }

  /**
   * 更新视口样式
   */
  updateViewportStyles() {
    const viewports = document.querySelectorAll('.grid-viewport');
    viewports.forEach((viewport, index) => {
      if (index === this.gridState.selectedViewportIndex) {
        viewport.style.borderColor = '#409eff';
        viewport.style.borderWidth = '2px';
      } else {
        viewport.style.borderColor = '#ccc';
        viewport.style.borderWidth = '1px';
      }
    });
  }

  /**
   * 获取下一个空视口
   */
  getNextEmptyViewport() {
    return this.gridState.viewports.find(viewport => !viewport.imageId) || null;
  }

  /**
   * 清除所有视口
   */
  clearAllViewports(container) {
    const viewports = container.querySelectorAll('.grid-viewport');
    viewports.forEach(viewport => {
      try {
        cornerstone.disable(viewport);
      } catch (error) {
        console.warn('禁用视口失败:', error);
      }
      viewport.remove();
    });

    // 重置视口状态
    this.gridState.viewports.forEach(viewport => {
      viewport.imageId = undefined;
      viewport.seriesIndex = undefined;
      viewport.imageIndex = undefined;
      viewport.isActive = false;
    });

    console.log('所有视口已清除');
  }

  /**
   * 获取网格状态
   */
  getGridState() {
    return { ...this.gridState };
  }

  /**
   * 设置网格状态
   */
  setGridState(newState) {
    this.gridState = { ...this.gridState, ...newState };
  }

  /**
   * 获取视口信息
   */
  getViewportInfo(index) {
    if (index >= 0 && index < this.gridState.viewports.length) {
      return { ...this.gridState.viewports[index] };
    }
    return null;
  }

  /**
   * 获取所有视口信息
   */
  getAllViewports() {
    return [...this.gridState.viewports];
  }

  /**
   * 检查视口是否为空
   */
  isViewportEmpty(index) {
    const viewport = this.gridState.viewports[index];
    return !viewport || !viewport.imageId;
  }

  /**
   * 获取当前选中的视口
   */
  getCurrentViewport() {
    return this.gridState.viewports[this.gridState.selectedViewportIndex] || null;
  }

  /**
   * 获取网格布局信息
   */
  getLayoutInfo() {
    return { ...this.gridState.layout };
  }

  /**
   * 检查网格是否激活
   */
  isGridActive() {
    return this.gridState.isActive;
  }
}
