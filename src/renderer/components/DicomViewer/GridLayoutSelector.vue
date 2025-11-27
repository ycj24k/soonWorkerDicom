<template>
  <div class="grid-layout-selector" v-show="show">
    <div class="grid-content">
      <div class="grid-title">影像排列</div>
      
      <div class="grid-matrix" @mouseleave="handleMouseLeave">
        <div 
          class="grid-row" 
          v-for="row in maxRows" 
          :key="row"
        >
          <div 
            class="grid-cell" 
            v-for="col in maxCols" 
            :key="col"
            :class="{ 
              'highlight': isHighlighted(row, col),
              'selected': isSelected(row, col)
            }"
            @mouseenter="handleMouseEnter(row, col)"
            @click="handleSelect(row, col)"
          ></div>
        </div>
      </div>
      
      <div class="grid-info">
        {{ currentRows }} x {{ currentCols }} 网格
      </div>
      
      <div class="grid-actions">
        <el-button @click="confirmLayout" type="primary" size="small" :disabled="currentRows === 0">确定</el-button>
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
      maxRows: 4, // 最大行数
      maxCols: 4, // 最大列数
      hoverRow: 0,
      hoverCol: 0,
      selectedRow: 0,
      selectedCol: 0
    };
  },
  computed: {
    currentRows() {
      return this.hoverRow > 0 ? this.hoverRow : this.selectedRow;
    },
    currentCols() {
      return this.hoverCol > 0 ? this.hoverCol : this.selectedCol;
    }
  },
  methods: {
    handleMouseEnter(row, col) {
      this.hoverRow = row;
      this.hoverCol = col;
    },
    handleMouseLeave() {
      this.hoverRow = 0;
      this.hoverCol = 0;
    },
    isHighlighted(row, col) {
      // 鼠标悬浮时的高亮逻辑：小于等于悬浮位置的格子
      if (this.hoverRow > 0 && this.hoverCol > 0) {
        return row <= this.hoverRow && col <= this.hoverCol;
      }
      return false;
    },
    isSelected(row, col) {
      // 选中状态的逻辑（当鼠标未悬浮时显示）
      if (this.hoverRow === 0 && this.selectedRow > 0) {
        return row <= this.selectedRow && col <= this.selectedCol;
      }
      return false;
    },
    handleSelect(row, col) {
      this.selectedRow = row;
      this.selectedCol = col;
      // 也可以选择后直接应用，或者要求点击确定
      // 这里我们只更新选中状态，用户需点击确定
    },
    confirmLayout() {
      const rows = this.selectedRow || 1; // 默认至少1x1
      const cols = this.selectedCol || 1;
      
      const layout = {
        rows,
        cols,
        totalSlots: rows * cols
      };
      
      this.$emit('apply-layout', layout);
      this.reset();
    },
    cancel() {
      this.$emit('close');
      this.reset();
    },
    reset() {
      this.hoverRow = 0;
      this.hoverCol = 0;
      // selectedRow/Col 可以保留或重置，视需求而定，这里选择保留上次的选择方便调整
    }
  },
  watch: {
    show(val) {
      if (val) {
        // 每次显示时，如果不希望保留上次选择，可以在这里重置
        // this.reset();
      }
    }
  }
};
</script>

<style lang="scss" scoped>
.grid-layout-selector {
  position: absolute;
  top: 60px;
  left: 60px; /* 调整位置以对齐工具栏按钮 */
  background: rgba(30, 30, 30, 0.95);
  border: 1px solid #444;
  border-radius: 4px;
  padding: 15px;
  z-index: 2000;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  min-width: 200px;
}

.grid-content {
  display: flex;
  flex-direction: column;
  align-items: center;

  .grid-title {
    color: #fff;
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 12px;
    width: 100%;
    text-align: left;
    border-bottom: 1px solid #555;
    padding-bottom: 8px;
  }

  .grid-matrix {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
    padding: 4px;
    border: 1px solid transparent; /* 占位防止抖动 */
  }

  .grid-row {
    display: flex;
    gap: 4px;
  }

  .grid-cell {
    width: 30px;
    height: 30px;
    background-color: #333;
    border: 1px solid #555;
    cursor: pointer;
    transition: all 0.1s ease;
    border-radius: 2px;

    &:hover {
      border-color: #888;
    }

    &.highlight {
      background-color: rgba(0, 195, 37, 0.6); /* 主题绿色半透明 */
      border-color: #00C325;
    }

    &.selected {
      background-color: rgba(0, 195, 37, 0.3);
      border-color: #00C325;
    }
  }

  .grid-info {
    color: #ccc;
    font-size: 13px;
    margin-bottom: 15px;
    font-family: monospace;
  }

  .grid-actions {
    display: flex;
    gap: 10px;
    width: 100%;
    justify-content: flex-end;
  }
}
</style>