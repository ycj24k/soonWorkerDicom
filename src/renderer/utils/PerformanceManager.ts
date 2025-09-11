/**
 * 性能管理工具
 * 负责内存管理、缓存优化和性能监控
 */

export class PerformanceManager {
  private static instance: PerformanceManager;
  private memoryUsage: Map<string, number> = new Map();
  private performanceMetrics: Map<string, number[]> = new Map();
  private memoryThreshold = 500 * 1024 * 1024; // 500MB

  private constructor() {
    this.startMemoryMonitoring();
  }

  public static getInstance(): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager();
    }
    return PerformanceManager.instance;
  }

  /**
   * 开始内存监控
   */
  private startMemoryMonitoring(): void {
    if (typeof window !== 'undefined' && (window as any).performance) {
      setInterval(() => {
        this.checkMemoryUsage();
      }, 30000); // 每30秒检查一次
    }
  }

  /**
   * 检查内存使用情况
   */
  private checkMemoryUsage(): void {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const usedMemory = memInfo.usedJSHeapSize;
      
      console.log(`内存使用情况: ${this.formatBytes(usedMemory)}`);
      
      if (usedMemory > this.memoryThreshold) {
        console.warn('内存使用过高，建议清理缓存');
        this.triggerMemoryCleanup();
      }
    }
  }

  /**
   * 触发内存清理
   */
  private triggerMemoryCleanup(): void {
    // 触发垃圾回收建议
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
    
    // 清理过期缓存
    this.clearExpiredCache();
  }

  /**
   * 清理过期缓存
   */
  private clearExpiredCache(): void {
    // 这里可以添加具体的缓存清理逻辑
    console.log('执行缓存清理...');
  }

  /**
   * 记录性能指标
   */
  public recordMetric(name: string, value: number): void {
    if (!this.performanceMetrics.has(name)) {
      this.performanceMetrics.set(name, []);
    }
    
    const metrics = this.performanceMetrics.get(name)!;
    metrics.push(value);
    
    // 保持最近100个记录
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  /**
   * 获取性能统计
   */
  public getPerformanceStats(name: string): { avg: number; min: number; max: number } | null {
    const metrics = this.performanceMetrics.get(name);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const sum = metrics.reduce((a, b) => a + b, 0);
    return {
      avg: sum / metrics.length,
      min: Math.min(...metrics),
      max: Math.max(...metrics)
    };
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 测量函数执行时间
   */
  public measureTime<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    
    this.recordMetric(name, end - start);
    return result;
  }

  /**
   * 测量异步函数执行时间
   */
  public async measureTimeAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    
    this.recordMetric(name, end - start);
    return result;
  }

  /**
   * 防抖函数
   */
  public debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number,
    immediate: boolean = false
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
      const callNow = immediate && !timeout;
      
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        timeout = null;
        if (!immediate) func(...args);
      }, wait);
      
      if (callNow) func(...args);
    };
  }

  /**
   * 节流函数
   */
  public throttle<T extends (...args: any[]) => void>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean = false;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * 批量处理
   */
  public batch<T>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<void>,
    delay: number = 0
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let index = 0;
      
      const processBatch = async () => {
        if (index >= items.length) {
          resolve();
          return;
        }
        
        const batch = items.slice(index, index + batchSize);
        index += batchSize;
        
        try {
          await processor(batch);
          
          if (delay > 0) {
            setTimeout(processBatch, delay);
          } else {
            // 使用requestIdleCallback优化性能
            if ('requestIdleCallback' in window) {
              requestIdleCallback(processBatch);
            } else {
              setTimeout(processBatch, 0);
            }
          }
        } catch (error) {
          reject(error);
        }
      };
      
      processBatch();
    });
  }

  /**
   * 图像预加载优化
   */
  public preloadImages(urls: string[], maxConcurrent: number = 3): Promise<void> {
    return new Promise((resolve) => {
      let loaded = 0;
      let loading = 0;
      let index = 0;

      const loadNext = () => {
        while (loading < maxConcurrent && index < urls.length) {
          const url = urls[index++];
          loading++;

          const img = new Image();
          img.onload = img.onerror = () => {
            loading--;
            loaded++;
            
            if (loaded === urls.length) {
              resolve();
            } else {
              loadNext();
            }
          };
          img.src = url;
        }
      };

      loadNext();
    });
  }

  /**
   * 获取当前内存使用情况
   */
  public getMemoryInfo(): any {
    if ('memory' in performance) {
      return (performance as any).memory;
    }
    return null;
  }

  /**
   * 清理所有性能数据
   */
  public clearMetrics(): void {
    this.performanceMetrics.clear();
    this.memoryUsage.clear();
  }
}