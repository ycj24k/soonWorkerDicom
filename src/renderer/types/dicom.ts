/**
 * DICOM相关类型定义
 */

// DICOM元素类型
export interface DicomElement {
  tag: string;
  description: string;
  value: string;
}

// DICOM数据集类型
export interface DicomDataSet {
  elements: Record<string, any>;
  string: (tag: string) => string | undefined;
}

// 缩略图信息
export interface DicomThumbnail {
  modality: string;
  seriesNo: string;
  seriesDate: string;
  seriesTime: string;
  description: string;
  seriesUID: string;
  image: string; // Base64编码的图像
}

// 文件树节点
export interface FileTreeNode {
  name: string;
  path: string;
  label?: string;
  id?: string;
  isFile?: boolean;
  children: FileTreeNode[];
}

// DICOM序列信息
export interface DicomSeries {
  path: string;
  name: string;
  children: DicomImage[];
}

// DICOM图像信息
export interface DicomImage {
  name: string;
  path: string;
  isFile: boolean;
}

// 窗宽窗位设置
export interface WindowLevelSetting {
  img: string;
  ww: number; // 窗宽
  wc: number; // 窗位
}

// Cornerstone视口配置
export interface ViewportConfig {
  scale?: number;
  translation?: {
    x: number;
    y: number;
  };
  rotation?: number;
  hflip?: boolean;
  vflip?: boolean;
  invert?: boolean;
  voi?: {
    windowWidth: number;
    windowCenter: number;
  };
}

// 工具状态
export interface ToolState {
  activeAction: number;
  mode: string;
  currentCursor: string;
}

// DICOM处理结果
export interface DicomProcessResult {
  thumbnails: DicomThumbnail[];
  dicomDict: DicomElement[][];
}
