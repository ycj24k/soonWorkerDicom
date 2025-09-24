/**
 * 统一错误处理服务
 */

const { Notification, MessageBox } = require('element-ui');

export const ErrorCode = {
  // 文件相关错误
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_FORMAT_ERROR: 'FILE_FORMAT_ERROR',
  DIRECTORY_NOT_FOUND: 'DIRECTORY_NOT_FOUND',
  DIRECTORY_ACCESS_DENIED: 'DIRECTORY_ACCESS_DENIED',
  
  // 网络相关错误
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
  
  // DICOM相关错误
  DICOM_PARSE_ERROR: 'DICOM_PARSE_ERROR',
  DICOM_METADATA_ERROR: 'DICOM_METADATA_ERROR',
  DICOM_IMAGE_ERROR: 'DICOM_IMAGE_ERROR',
  
  // 图像处理相关错误
  IMAGE_LOAD_ERROR: 'IMAGE_LOAD_ERROR',
  IMAGE_DISPLAY_ERROR: 'IMAGE_DISPLAY_ERROR',
  IMAGE_PROCESS_ERROR: 'IMAGE_PROCESS_ERROR',
  
  // 内存相关错误
  MEMORY_ERROR: 'MEMORY_ERROR',
  MEMORY_LOW: 'MEMORY_LOW',
  
  // 权限相关错误
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  
  // 操作相关错误
  INVALID_OPERATION: 'INVALID_OPERATION',
  OPERATION_FAILED: 'OPERATION_FAILED',
  
  // Cornerstone相关错误
  CORNERSTONE_ERROR: 'CORNERSTONE_ERROR',
  CORNERSTONE_TOOL_ERROR: 'CORNERSTONE_TOOL_ERROR',
  
  // 未知错误
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

export class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 100;
  }

  static getInstance() {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * 处理错误
   */
  handleError(error, context = '', showNotification = true) {
    const appError = this.createAppError(error, context);
    this.logError(appError);
    
    if (showNotification) {
      this.showErrorNotification(appError);
    }
    
    // console.error(`[${context}] 错误:`, appError);
    return appError;
  }

  /**
   * 处理成功消息
   */
  handleSuccess(message, context = '') {
    // console.log(`[${context}] 成功:`, message);
    
    Notification({
      title: '成功',
      message: message,
      type: 'success',
      duration: 3000
    });
  }

  /**
   * 处理警告
   */
  handleWarning(message, context = '') {
    console.warn(`[${context}] 警告:`, message);
    
    Notification({
      title: '警告',
      message: message,
      type: 'warning',
      duration: 4000
    });
  }

  /**
   * 处理信息
   */
  handleInfo(message, context = '') {
    console.info(`[${context}] 信息:`, message);
    
    Notification({
      title: '信息',
      message: message,
      type: 'info',
      duration: 3000
    });
  }

  /**
   * 创建应用错误对象
   */
  createAppError(error, context) {
    const appError = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      context: context,
      message: '',
      code: ErrorCode.UNKNOWN_ERROR,
      stack: '',
      userMessage: ''
    };

    if (error instanceof Error) {
      appError.message = error.message;
      appError.stack = error.stack;
      appError.code = this.getErrorCode(error);
      appError.userMessage = this.getUserMessage(appError);
    } else if (typeof error === 'string') {
      appError.message = error;
      appError.userMessage = error;
    } else if (typeof error === 'object' && error !== null) {
      appError.message = error.message || '未知错误';
      appError.code = error.code || ErrorCode.UNKNOWN_ERROR;
      appError.userMessage = this.getUserMessage(appError);
    }

    return appError;
  }

  /**
   * 获取错误代码
   */
  getErrorCode(error) {
    if (error.code) {
      return error.code;
    }
    
    if (error.message) {
      const message = error.message.toLowerCase();
      
      if (message.includes('file not found') || message.includes('no such file')) {
        return ErrorCode.FILE_NOT_FOUND;
      } else if (message.includes('permission denied') || message.includes('access denied')) {
        return ErrorCode.PERMISSION_DENIED;
      } else if (message.includes('network') || message.includes('connection')) {
        return ErrorCode.NETWORK_ERROR;
      } else if (message.includes('memory') || message.includes('out of memory')) {
        return ErrorCode.MEMORY_ERROR;
      } else if (message.includes('dicom') || message.includes('parse')) {
        return ErrorCode.DICOM_PARSE_ERROR;
      } else if (message.includes('image') || message.includes('display')) {
        return ErrorCode.IMAGE_LOAD_ERROR;
      }
    }
    
    return ErrorCode.UNKNOWN_ERROR;
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserMessage(error) {
    const messageMap = {
      [ErrorCode.FILE_NOT_FOUND]: '文件未找到，请检查文件路径',
      [ErrorCode.FILE_READ_ERROR]: '文件读取失败，请检查文件权限',
      [ErrorCode.FILE_FORMAT_ERROR]: '文件格式不支持，请选择有效的文件',
      [ErrorCode.DIRECTORY_NOT_FOUND]: '目录未找到，请检查目录路径',
      [ErrorCode.DIRECTORY_ACCESS_DENIED]: '目录访问被拒绝，请检查权限',
      [ErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络设置',
      [ErrorCode.CONNECTION_TIMEOUT]: '连接超时，请稍后重试',
      [ErrorCode.SERVER_ERROR]: '服务器错误，请稍后重试',
      [ErrorCode.DICOM_PARSE_ERROR]: 'DICOM文件解析失败，文件可能损坏',
      [ErrorCode.DICOM_METADATA_ERROR]: 'DICOM元数据读取失败',
      [ErrorCode.DICOM_IMAGE_ERROR]: 'DICOM图像处理失败',
      [ErrorCode.IMAGE_LOAD_ERROR]: '图像加载失败，请检查文件格式',
      [ErrorCode.IMAGE_DISPLAY_ERROR]: '图像显示失败',
      [ErrorCode.IMAGE_PROCESS_ERROR]: '图像处理失败',
      [ErrorCode.MEMORY_ERROR]: '内存不足，请关闭其他应用程序',
      [ErrorCode.PERMISSION_DENIED]: '权限不足，请以管理员身份运行',
      [ErrorCode.INVALID_OPERATION]: '操作无效，请检查操作步骤',
      [ErrorCode.CORNERSTONE_ERROR]: '图像处理失败，请重新加载',
      [ErrorCode.UNKNOWN_ERROR]: '发生未知错误，请联系技术支持'
    };

    return messageMap[error.code] || error.message;
  }

  /**
   * 记录错误
   */
  logError(appError) {
    this.errorLog.push(appError);
    
    // 限制日志大小
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }
  }

  /**
   * 显示错误通知
   */
  showErrorNotification(appError) {
    Notification({
      title: '错误',
      message: appError.userMessage,
      type: 'error',
      duration: 5000
    });
  }

  /**
   * 显示错误对话框
   */
  async showErrorDialog(appError) {
    try {
      await MessageBox.alert(appError.userMessage, '错误', {
        confirmButtonText: '确定',
        type: 'error'
      });
    } catch (error) {
      // console.error('显示错误对话框失败:', error);
    }
  }

  /**
   * 获取错误日志
   */
  getErrorLog() {
    return [...this.errorLog];
  }

  /**
   * 清除错误日志
   */
  clearErrorLog() {
    this.errorLog = [];
  }

  /**
   * 导出错误日志
   */
  exportErrorLog() {
    const logData = {
      timestamp: new Date().toISOString(),
      errors: this.errorLog
    };
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-log-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }
}
