/**
 * 全局类型定义
 */

// 导出DICOM相关类型
export * from './dicom';

// 应用状态类型
export interface AppState {
  device: 'desktop' | 'mobile';
  language: string;
  size: 'small' | 'medium' | 'large';
  directory: string;
}

// 用户状态类型
export interface UserState {
  token?: string;
  userInfo?: UserInfo;
}

// 用户信息类型
export interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

// 错误类型
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

// 通知类型
export interface NotificationConfig {
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  duration?: number;
}

// 对话框配置类型
export interface DialogConfig {
  title: string;
  content: string;
  type: 'confirm' | 'alert' | 'prompt';
  confirmText?: string;
  cancelText?: string;
}
