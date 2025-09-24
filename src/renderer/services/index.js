/**
 * 服务导出入口
 */

// 导入服务类
import { DicomService } from './DicomService';
import { CornerstoneService } from './CornerstoneService';
import { GridViewService } from './GridViewService';
import { PlaybackService } from './PlaybackService';
import { ErrorHandler, ErrorCode } from './ErrorHandler';

// 导出服务类
export { DicomService } from './DicomService';
export { CornerstoneService } from './CornerstoneService';
export { GridViewService } from './GridViewService';
export { PlaybackService } from './PlaybackService';
export { ErrorHandler, ErrorCode } from './ErrorHandler';

// 创建服务实例
export const dicomService = DicomService.getInstance();
export const cornerstoneService = CornerstoneService.getInstance();
export const gridViewService = GridViewService.getInstance();
export const playbackService = PlaybackService.getInstance();
export const errorHandler = ErrorHandler.getInstance();
