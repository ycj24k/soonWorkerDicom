<template>
  <div class="grid-layout-selector" v-show="show">
    <div class="grid-preview">
      <div class="grid-title">选择网格布局</div>
      <div class="single-grid-container">
        <div 
          class="single-grid"
          @mouseenter="showHoverGrid = true"
          @mouseleave="showHoverGrid = false"
          @click="selectCurrentLayout"
        >
          <div 
            v-for="n in 9" 
            :key="n"
            class="grid-cell"
            :class="{ 
              'active': currentLayout >= n,
              'hover': showHoverGrid && hoverLayout >= n
            }"
          ></div>
        </div>
      </div>
      <div class="grid-actions">
        <el-button @click="applyLayout" type="primary" size="small">应用</el-button>
        <el-button @click="cancel" size="small">取消</el-button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GridLayoutSelector',
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      currentLayout: 1, // 当前选择的布局（1-9个格子）
      hoverLayout: 1, // 鼠标悬浮时显示的布局
      showHoverGrid: false,
      gridLayouts: [
        { rows: 1, cols: 1, totalSlots: 1 },
        { rows: 1, cols: 2, totalSlots: 2 },
        { rows: 2, cols: 2, totalSlots: 4 },
        { rows: 2, cols: 3, totalSlots: 6 },
        { rows: 3, cols: 3, totalSlots: 9 }
      ]
    };
  },
  mounted() {
    // 监听鼠标移动来更新hoverLayout
    this.$el.addEventListener('mousemove', this.handleMouseMove);
  },
  beforeDestroy() {
    if (this.$el) {
      this.$el.removeEventListener('mousemove', this.handleMouseMove);
    }
  },
  methods: {
    handleMouseMove(event) {
      if (!this.showHoverGrid) return;
      
      const rect = this.$el.querySelector('.single-grid').getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // 计算鼠标在哪个格子位置
      const cellWidth = rect.width / 3;
      const cellHeight = rect.height / 3;
      const col = Math.floor(x / cellWidth);
      const row = Math.floor(y / cellHeight);
      
      // 计算应该激活的格子数量
      if (row === 0 && col === 0) {
        this.hoverLayout = 1; // 1x1
      } else if (row === 0 && col <= 1) {
        this.hoverLayout = 2; // 1x2
      } else if (row <= 1 && col <= 1) {
        this.hoverLayout = 4; // 2x2
      } else if (row <= 1 && col <= 2) {
        this.hoverLayout = 6; // 2x3
      } else {
        this.hoverLayout = 9; // 3x3
      }
    },
    selectCurrentLayout() {
      this.currentLayout = this.hoverLayout;
    },
    applyLayout() {
      // 根据currentLayout找到对应的布局配置
      const layoutIndex = this.gridLayouts.findIndex(layout => layout.totalSlots === this.currentLayout);
      const layout = this.gridLayouts[layoutIndex] || this.gridLayouts[2]; // 默认2x2
      this.$emit('apply-layout', layout);
      this.$emit('close');
    },
    cancel() {
      this.$emit('close');
    }
  }
};
</script>

<style lang="scss" scoped>
.grid-layout-selector {
  position: absolute;
  top: 60px;
  left: 10px;
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid #00C325;
  border-radius: 8px;
  padding: 15px;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.grid-preview {
  .grid-title {
    color: #fff;
    font-size: 16px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 20px;
  }

  .single-grid-container {
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
  }

  .single-grid {
    width: 120px;
    height: 120px;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr 1fr;
    gap: 2px;
    border: 2px solid #666;
    padding: 4px;
    background-color: #222;
    cursor: pointer;
    transition: border-color 0.2s ease;

    &:hover {
      border-color: #00C325;
    }
  }

  .grid-cell {
    background-color: #444;
    border: 1px solid #555;
    transition: all 0.2s ease;

    &.active {
      background-color: #00C325;
      border-color: #00C325;
    }

    &.hover {
      background-color: rgba(0, 195, 37, 0.6);
      border-color: rgba(0, 195, 37, 0.6);
    }
  }

  .grid-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
  }
}
</style>
