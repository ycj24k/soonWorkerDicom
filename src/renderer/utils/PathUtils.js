/**
 * 跨平台路径工具类
 * 解决Windows、Linux、Mac系统间的路径兼容性问题
 */

const path = require('path');
const fs = require('fs');

export class PathUtils {
  /**
   * 标准化文件路径，确保跨平台兼容性
   * @param {string} filePath - 原始路径
   * @returns {string} - 标准化后的路径
   */
  static normalizePath(filePath) {
    if (!filePath) return '';
    return path.normalize(path.resolve(filePath));
  }

  /**
   * 检查文件是否存在，支持跨平台路径
   * @param {string} filePath - 文件路径
   * @returns {boolean} - 文件是否存在
   */
  static fileExists(filePath) {
    try {
      const normalizedPath = this.normalizePath(filePath);
      return fs.existsSync(normalizedPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取跨平台兼容的DICOM目录路径
   * @param {string} basePath - 基础路径，默认为process.cwd()
   * @returns {string|null} - 找到的DICOM目录路径，如果不存在则返回null
   */
  static findDicomDirectory(basePath = process.cwd()) {
    // 仅通过 ConfigManager 中的配置或默认值查找，不再扫描其他目录
    try {
      // 延迟导入避免循环依赖
      const { ConfigManager } = require('./ConfigManager');
      const configManager = ConfigManager.getInstance();
      const configPath = configManager.findAvailableDicomDirectory();
      if (configPath) {
        return configPath;
      }
    } catch (error) {
      // 如果配置文件读取失败，返回 null 由上层处理
    }
    
    return null;
  }

  /**
   * 获取跨平台兼容的资源路径
   * @param {string} resourcePath - 资源相对路径
   * @returns {string} - 完整的资源路径
   */
  static getResourcePath(resourcePath) {
    if (process.env.NODE_ENV === 'development') {
      return resourcePath;
    } else {
      return this.normalizePath(path.join(process.resourcesPath, resourcePath));
    }
  }

  /**
   * 检查路径是否为绝对路径
   * @param {string} filePath - 文件路径
   * @returns {boolean} - 是否为绝对路径
   */
  static isAbsolutePath(filePath) {
    return path.isAbsolute(filePath);
  }

  /**
   * 获取路径的目录名
   * @param {string} filePath - 文件路径
   * @returns {string} - 目录名
   */
  static getDirname(filePath) {
    return path.dirname(this.normalizePath(filePath));
  }

  /**
   * 获取路径的文件名
   * @param {string} filePath - 文件路径
   * @returns {string} - 文件名
   */
  static getBasename(filePath) {
    return path.basename(this.normalizePath(filePath));
  }

  /**
   * 连接路径，确保跨平台兼容性
   * @param {...string} paths - 路径片段
   * @returns {string} - 连接后的路径
   */
  static join(...paths) {
    return this.normalizePath(path.join(...paths));
  }

  /**
   * 获取当前平台信息
   * @returns {object} - 平台信息
   */
  static getPlatformInfo() {
    return {
      platform: process.platform,
      isWindows: process.platform === 'win32',
      isMac: process.platform === 'darwin',
      isLinux: process.platform === 'linux',
      separator: path.sep,
      delimiter: path.delimiter
    };
  }
}

export default PathUtils;
