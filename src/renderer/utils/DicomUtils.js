/**
 * DICOM 工具函数
 * 提供通用的 DICOM 文件处理和图像ID构建功能
 */

/**
 * 验证节点是否为DICOM文件
 * @param {Object} node - 节点对象
 * @param {string} node.name - 文件名
 * @param {string} node.path - 文件路径
 * @returns {boolean} 是否为DICOM文件
 */
export function validateDicomFile(node) {
  if (!node || !node.path) {
    return false;
  }

  const lowerPath = node.path.toLowerCase();
  const name = node.name || '';

  // 检查常见DICOM扩展名
  const dicomExtensions = ['.dcm', '.dicom', '.dic', '.ima'];
  if (dicomExtensions.some(ext => lowerPath.endsWith(ext))) {
    return true;
  }

  // 对于没有扩展名的文件，检查是否符合DICOM命名模式
  // IMG001, IMG002 等格式且在SER目录中
  if (/^IMG\d+$/i.test(name) && lowerPath.includes('ser')) {
    return true;
  }

  // UID格式文件名（如 1.2.840.113619...）
  if (/^\d+\.\d+\.\d+.*$/i.test(name)) {
    return true;
  }

  // 8位以上字母数字组合（不区分大小写）
  if (/^[A-Z0-9]{8,}$/i.test(name)) {
    return true;
  }

  return false;
}

/**
 * 递归查找DICOM文件并构建图像ID列表
 * @param {Object} node - 节点对象（可能是文件或目录）
 * @param {Function} validator - 验证函数，默认为 validateDicomFile
 * @param {Function} imageIdBuilder - 图像ID构建函数，默认为 buildImageId
 * @returns {Array<string>} 图像ID数组
 */
export function findDicomFiles(node, validator = validateDicomFile, imageIdBuilder = buildImageId) {
  const imageIds = [];

  if (!node) {
    return imageIds;
  }

  const traverse = (n) => {
    // 兼容 isFile 标记为空的情况：如果没有子节点，则认为是文件
    const isFile = n.isFile || (!n.children || !Array.isArray(n.children));
    
    if (isFile && validator(n)) {
      const imageId = imageIdBuilder(n);
      if (imageId) {
        imageIds.push(imageId);
      }
    } else if (n.children && Array.isArray(n.children)) {
      n.children.forEach(child => traverse(child));
    }
  };

  traverse(node);
  return imageIds;
}

/**
 * 构建 Cornerstone 图像ID
 * 统一使用本地文件 URI：wadouri:file://...，避免在开发模式下被当作 http://localhost:9080 路径请求
 * @param {Object} node - 节点对象
 * @param {boolean} node.isFrame - 是否为帧图像
 * @param {Object} node.parentCineImage - 父动态影像节点（帧图像时使用）
 * @param {string} node.path - 文件路径
 * @param {string} node.fullPath - 完整路径
 * @param {number} node.frameIndex - 帧索引（帧图像时使用）
 * @returns {string|null} 图像ID，格式为 wadouri:file://... 或 wadouri:file://...?frame=N
 */
export function buildImageId(node) {
  if (!node) {
    return null;
  }

  // 辅助函数：标准化路径（将反斜杠转换为正斜杠）
  const normalizePath = (path) => {
    if (!path) return path;
    // 将 Windows 路径的反斜杠转换为正斜杠
    return path.replace(/\\/g, '/');
  };

  /**
   * 将标准化后的本地路径转换为 file:// URI
   * 说明：
   * - Windows 绝对路径示例：E:/DICOM/xxx.dcm -> file:///E:/DICOM/xxx.dcm
   * - POSIX 绝对路径示例：/Users/xxx/DICOM/xxx.dcm -> file:///Users/xxx/DICOM/xxx.dcm
   * - 已经是 file:// 前缀时，直接返回，避免重复包裹
   */
  const toFileUri = (normalizedPath) => {
    if (!normalizedPath) return normalizedPath;
    if (normalizedPath.startsWith('file://')) {
      return normalizedPath;
    }

    // Windows 盘符路径：例如 E:/ 或 C:/ 开头
    if (/^[A-Za-z]:\//.test(normalizedPath)) {
      return `file:///${normalizedPath}`;
    }

    // 其它情况统一按 POSIX 路径处理（/ 开头）
    if (normalizedPath.startsWith('/')) {
      return `file://${normalizedPath}`;
    }

    // 相对路径兜底处理：仍然作为 file:// 资源暴露
    return `file://${normalizedPath}`;
  };

  // 帧图像：使用 wadouri:path?frame=N 格式
  if (node.isFrame && node.parentCineImage) {
    const basePath = node.parentCineImage.fullPath || node.parentCineImage.path;
    // 检查 frameIndex 的合法性：必须是整数且非负
    if (basePath && Number.isInteger(node.frameIndex) && node.frameIndex >= 0) {
      // 标准化路径（反斜杠转正斜杠），转换为 file:// URI，然后进行 URL 编码
      const fileUri = toFileUri(normalizePath(basePath));
      const encodedPath = encodeURI(fileUri);
      return `wadouri:${encodedPath}?frame=${node.frameIndex}`;
    }
    return null;
  }

  // 普通图像：使用 wadouri:path 格式
  const imagePath = node.fullPath || node.path;
  if (imagePath) {
    // 标准化路径（反斜杠转正斜杠），转换为 file:// URI，然后进行 URL 编码
    const fileUri = toFileUri(normalizePath(imagePath));
    const encodedPath = encodeURI(fileUri);
    return `wadouri:${encodedPath}`;
  }

  return null;
}

/**
 * 从系列节点获取所有图像ID
 * @param {Object} series - 系列节点对象
 * @returns {Array<string>} 图像ID数组
 */
export function getSeriesImageIds(series) {
  if (!series || !series.children) {
    return [];
  }

  return findDicomFiles(series);
}

/**
 * 从多个系列节点获取所有图像ID
 * @param {Array<Object>} seriesList - 系列节点数组
 * @returns {Array<string>} 图像ID数组
 */
export function getAllSeriesImageIds(seriesList) {
  if (!Array.isArray(seriesList)) {
    return [];
  }

  return seriesList.flatMap(series => getSeriesImageIds(series));
}



