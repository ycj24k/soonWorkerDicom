/**
 * 统一错误处理服务
 */

import { Notification, MessageBox } from 'element-ui';
import { AppError, NotificationConfig } from '../types';

export enum ErrorCode {
  // 文件相关错误
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  INVALID_DICOM_FORMAT = 'INVALID_DICOM_FORMAT',
  
  // 网络相关错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
  
  // 系统相关错误
  MEMORY_ERROR = 'MEMORY_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // 业务逻辑错误
  INVALID_OPERATION = 'INVALID_OPERATION',
  CORNERSTONE_ERROR = 'CORNERSTONE_ERROR',
  
  // 未知错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];
  private maxLogSize = 100;

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * 处理错误
   */
  public handleError(error: Error | AppError | string, context?: string): void {
    const appError = this.normalizeError(error, context);
    this.logError(appError);
    this.showErrorNotification(appError);
  }

  /**
   * 处理警告
   */
  public handleWarning(message: string, title?: string): void {
    Notification({
      title: title || '警告',
      message,
      type: 'warning',
      duration: 5000
    });
  }

  /**
   * 处理成功消息
   */
  public handleSuccess(message: string, title?: string): void {
    Notification({
      title: title || '成功',
      message,
      type: 'success',
      duration: 3000
    });
  }

  /**
   * 显示确认对话框
   */
  public async showConfirm(message: string, title?: string): Promise<boolean> {
    try {
      await MessageBox.confirm(message, title || '确认', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 标准化错误
   */
  private normalizeError(error: Error | AppError | string, context?: string): AppError {
    if (typeof error === 'string') {
      return {
        code: ErrorCode.UNKNOWN_ERROR,
        message: error,
        timestamp: Date.now(),
        details: { context }
      };
    }

    if ('code' in error && 'message' in error) {
      return error as AppError;
    }

    // 根据错误类型和消息推断错误代码
    const errorCode = this.inferErrorCode(error);
    
    return {
      code: errorCode,
      message: error.message || '未知错误',
      timestamp: Date.now(),
      details: {
        context,
        stack: error.stack,
        name: error.name
      }
    };
  }

  /**
   * 推断错误代码
   */
  private inferErrorCode(error: Error): ErrorCode {
    const message = error.message.toLowerCase();
    
    if (message.includes('file') || message.includes('文件')) {
      if (message.includes('not found') || message.includes('不存在')) {
        return ErrorCode.FILE_NOT_FOUND;
      }
      return ErrorCode.FILE_READ_ERROR;
    }
    
    if (message.includes('dicom') || message.includes('format')) {
      return ErrorCode.INVALID_DICOM_FORMAT;
    }
    
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorCode.NETWORK_ERROR;
    }
    
    if (message.includes('memory') || message.includes('内存')) {
      return ErrorCode.MEMORY_ERROR;
    }
    
    if (message.includes('permission') || message.includes('权限')) {
      return ErrorCode.PERMISSION_DENIED;
    }
    
    if (message.includes('cornerstone')) {
      return ErrorCode.CORNERSTONE_ERROR;
    }
    
    return ErrorCode.UNKNOWN_ERROR;
  }

  /**
   * 记录错误
   */
  private logError(error: AppError): void {
    this.errorLog.unshift(error);
    
    // 限制日志大小
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }
    
    // 输出到控制台
    console.error(`[${error.code}] ${error.message}`, error.details);
  }

  /**
   * 显示错误通知
   */
  private showErrorNotification(error: AppError): void {
    const config: NotificationConfig = {
      title: '错误',
      message: this.getUserFriendlyMessage(error),
      type: 'error',
      duration: 0 // 不自动关闭
    };

    Notification(config);
  }

  /**
   * 获取用户友好的错误消息
   */
  private getUserFriendlyMessage(error: AppError): string {
    const messageMap: Record<ErrorCode, string> = {
      [ErrorCode.FILE_NOT_FOUND]: '文件未找到，请检查文件路径',
      [ErrorCode.FILE_READ_ERROR]: '文件读取失败，请检查文件权限',
      [ErrorCode.INVALID_DICOM_FORMAT]: 'DICOM文件格式无效，请检查文件',
      [ErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络状态',
      [ErrorCode.REQUEST_TIMEOUT]: '请求超时，请重试',
      [ErrorCode.MEMORY_ERROR]: '内存不足，请关闭其他应用程序',
      [ErrorCode.PERMISSION_DENIED]: '权限不足，请以管理员身份运行',
      [ErrorCode.INVALID_OPERATION]: '操作无效，请检查操作步骤',
      [ErrorCode.CORNERSTONE_ERROR]: '图像处理失败，请重新加载',
      [ErrorCode.UNKNOWN_ERROR]: '发生未知错误，请联系技术支持'
    };

    return messageMap[error.code] || error.message;
  }

  /**
   * 获取错误日志
   */
  public getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  /**
   * 清空错误日志
   */
  public clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * 导出错误日志
   */
  public exportErrorLog(): string {
    return JSON.stringify(this.errorLog, null, 2);
  }
}
