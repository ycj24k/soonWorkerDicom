/**
 * 服务导出入口
 */

export { DicomService } from './DicomService';
export { CornerstoneService } from './CornerstoneService';
export { ErrorHandler, ErrorCode } from './ErrorHandler';

// 创建服务实例
export const dicomService = DicomService.getInstance();
export const cornerstoneService = CornerstoneService.getInstance();
export const errorHandler = ErrorHandler.getInstance();
