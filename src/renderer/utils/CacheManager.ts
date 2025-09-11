/**
 * 缓存管理器
 * 实现LRU缓存策略，优化内存使用
 */

interface CacheItem<T> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  size: number;
}

export class CacheManager<T> {
  private cache: Map<string, CacheItem<T>> = new Map();
  private maxSize: number;
  private maxItems: number;
  private currentSize: number = 0;
  private ttl: number; // 生存时间（毫秒）

  constructor(maxSize: number = 100 * 1024 * 1024, maxItems: number = 1000, ttl: number = 30 * 60 * 1000) {
    this.maxSize = maxSize; // 100MB
    this.maxItems = maxItems;
    this.ttl = ttl; // 30分钟

    // 定期清理过期缓存
    setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000); // 每5分钟清理一次
  }

  /**
   * 设置缓存项
   */
  public set(key: string, value: T, size?: number): void {
    const itemSize = size || this.estimateSize(value);
    const now = Date.now();

    // 如果键已存在，先删除旧的
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // 检查是否需要清理空间
    this.ensureCapacity(itemSize);

    const item: CacheItem<T> = {
      key,
      value,
      timestamp: now,
      accessCount: 1,
      size: itemSize
    };

    this.cache.set(key, item);
    this.currentSize += itemSize;
  }

  /**
   * 获取缓存项
   */
  public get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // 检查是否过期
    if (this.isExpired(item)) {
      this.delete(key);
      return null;
    }

    // 更新访问信息
    item.accessCount++;
    item.timestamp = Date.now();

    return item.value;
  }

  /**
   * 删除缓存项
   */
  public delete(key: string): boolean {
    const item = this.cache.get(key);
    if (item) {
      this.cache.delete(key);
      this.currentSize -= item.size;
      return true;
    }
    return false;
  }

  /**
   * 检查是否存在
   */
  public has(key: string): boolean {
    const item = this.cache.get(key);
    if (item && !this.isExpired(item)) {
      return true;
    }
    if (item && this.isExpired(item)) {
      this.delete(key);
    }
    return false;
  }

  /**
   * 清空缓存
   */
  public clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * 获取缓存统计信息
   */
  public getStats(): {
    itemCount: number;
    currentSize: number;
    maxSize: number;
    hitRate: number;
  } {
    const totalAccess = Array.from(this.cache.values())
      .reduce((sum, item) => sum + item.accessCount, 0);
    
    return {
      itemCount: this.cache.size,
      currentSize: this.currentSize,
      maxSize: this.maxSize,
      hitRate: totalAccess > 0 ? (totalAccess - this.cache.size) / totalAccess : 0
    };
  }

  /**
   * 确保有足够的容量
   */
  private ensureCapacity(newItemSize: number): void {
    // 按访问频率和时间排序，优先删除最少使用的
    while (
      (this.currentSize + newItemSize > this.maxSize || this.cache.size >= this.maxItems) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }
  }

  /**
   * 驱逐最少使用的项
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruScore = Infinity;

    for (const [key, item] of this.cache) {
      // 综合考虑访问次数和时间
      const score = item.accessCount / (Date.now() - item.timestamp + 1);
      if (score < lruScore) {
        lruScore = score;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
    }
  }

  /**
   * 清理过期项
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, item] of this.cache) {
      if (now - item.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.delete(key));
  }

  /**
   * 检查项是否过期
   */
  private isExpired(item: CacheItem<T>): boolean {
    return Date.now() - item.timestamp > this.ttl;
  }

  /**
   * 估算对象大小
   */
  private estimateSize(obj: any): number {
    if (obj === null || obj === undefined) {
      return 0;
    }

    if (typeof obj === 'string') {
      return obj.length * 2; // 每个字符约2字节
    }

    if (typeof obj === 'number') {
      return 8;
    }

    if (typeof obj === 'boolean') {
      return 4;
    }

    if (obj instanceof ArrayBuffer) {
      return obj.byteLength;
    }

    if (obj instanceof Uint8Array) {
      return obj.length;
    }

    if (typeof obj === 'object') {
      // 简单估算对象大小
      const jsonStr = JSON.stringify(obj);
      return jsonStr.length * 2;
    }

    return 100; // 默认估算
  }

  /**
   * 获取所有键
   */
  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取缓存项数量
   */
  public size(): number {
    return this.cache.size;
  }

  /**
   * 设置TTL
   */
  public setTTL(ttl: number): void {
    this.ttl = ttl;
  }

  /**
   * 获取最近访问的项
   */
  public getRecentlyUsed(count: number = 10): Array<{ key: string; value: T; accessCount: number }> {
    return Array.from(this.cache.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count)
      .map(item => ({
        key: item.key,
        value: item.value,
        accessCount: item.accessCount
      }));
  }

  /**
   * 预热缓存
   */
  public async preload(dataLoader: (key: string) => Promise<T>, keys: string[]): Promise<void> {
    const promises = keys.map(async key => {
      if (!this.has(key)) {
        try {
          const value = await dataLoader(key);
          this.set(key, value);
        } catch (error) {
          console.warn(`预加载缓存项失败: ${key}`, error);
        }
      }
    });

    await Promise.all(promises);
  }
}