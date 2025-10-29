/**
 * 配置文件管理器
 * 负责读取和管理DICOM查看器的配置信息
 */

const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.config = null;
    this.configPath = null;
    this.defaultConfig = {
      DICOM_PATH: './DICOM',
      BACKUP_PATHS: ['./PATS', './dicom', './Dicom', './data', './Data'],
      AUTO_LOAD: true,
      DICOM_EXTENSIONS: ['.dcm', '.dicom', '.dic', '.ima'],
      MAX_SCAN_DEPTH: 10
    };
  }

  static getInstance() {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 标准化文件路径，确保跨平台兼容性
   */
  normalizePath(filePath) {
    if (!filePath) return '';
    return path.normalize(path.resolve(filePath));
  }

  /**
   * 获取配置文件路径
   */
  getConfigFilePath() {
    if (this.configPath) {
      return this.configPath;
    }

    // 在项目根目录查找配置文件
    const possibleConfigFiles = [
      'dicom-config.txt',
      'dicom-config.cfg',
      'config.txt',
      'config.cfg'
    ];

    const rootPath = process.cwd();
    
    for (const configFile of possibleConfigFiles) {
      const configPath = path.join(rootPath, configFile);
      if (fs.existsSync(configPath)) {
        this.configPath = this.normalizePath(configPath);
        return this.configPath;
      }
    }

    // 如果没找到配置文件，使用默认路径
    this.configPath = this.normalizePath(path.join(rootPath, 'dicom-config.txt'));
    return this.configPath;
  }

  /**
   * 读取配置文件
   */
  loadConfig() {
    try {
      const configPath = this.getConfigFilePath();
      
      if (!fs.existsSync(configPath)) {
        // 如果配置文件不存在，创建默认配置文件
        this.createDefaultConfig(configPath);
        this.config = { ...this.defaultConfig };
        return this.config;
      }

      const configContent = fs.readFileSync(configPath, 'utf8');
      this.config = this.parseConfigContent(configContent);
      
      return this.config;
    } catch (error) {
      console.warn('读取配置文件失败，使用默认配置:', error.message);
      this.config = { ...this.defaultConfig };
      return this.config;
    }
  }

  /**
   * 解析配置文件内容
   */
  parseConfigContent(content) {
    const config = { ...this.defaultConfig };
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 跳过空行和注释行
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // 解析键值对
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex).trim();
        const value = trimmedLine.substring(equalIndex + 1).trim();
        
        // 处理不同类型的配置值
        if (key === 'AUTO_LOAD') {
          config[key] = value.toLowerCase() === 'true';
        } else if (key === 'MAX_SCAN_DEPTH') {
          config[key] = parseInt(value) || this.defaultConfig.MAX_SCAN_DEPTH;
        } else if (key === 'BACKUP_PATHS') {
          config[key] = value.split(';').map(p => p.trim()).filter(p => p);
        } else if (key === 'DICOM_EXTENSIONS') {
          config[key] = value.split(',').map(e => e.trim()).filter(e => e);
        } else {
          config[key] = value;
        }
      }
    }

    return config;
  }

  /**
   * 创建默认配置文件
   */
  createDefaultConfig(configPath) {
    try {
      const defaultContent = `# DICOM Viewer 配置文件
# 此文件用于设置默认的DICOM目录路径
# 支持Windows、Linux、Mac跨平台路径格式

# 默认DICOM目录路径（相对于项目根目录）
# 可以设置为绝对路径或相对路径
# 示例：
# Windows: C:\\Users\\Username\\Documents\\DICOM
# Linux: /home/username/Documents/DICOM  
# Mac: /Users/username/Documents/DICOM
# 相对路径: ./DICOM 或 DICOM

DICOM_PATH=./DICOM

# 备用路径（如果主路径不存在，将尝试这些路径）
# 用分号分隔多个路径
BACKUP_PATHS=./PATS;./dicom;./Dicom;./data;./Data

# 自动加载设置
# true: 启动时自动加载默认目录
# false: 需要手动选择目录
AUTO_LOAD=true

# 文件过滤设置
# 支持的DICOM文件扩展名，用逗号分隔
DICOM_EXTENSIONS=.dcm,.dicom,.dic,.ima

# 目录扫描深度限制
# 防止扫描过深的目录结构
MAX_SCAN_DEPTH=10`;

      fs.writeFileSync(configPath, defaultContent, 'utf8');
      console.log('已创建默认配置文件:', configPath);
    } catch (error) {
      console.error('创建默认配置文件失败:', error.message);
    }
  }

  /**
   * 获取配置值
   */
  get(key) {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config[key] || this.defaultConfig[key];
  }

  /**
   * 设置配置值
   */
  set(key, value) {
    if (!this.config) {
      this.loadConfig();
    }
    this.config[key] = value;
  }

  /**
   * 获取默认DICOM目录路径
   */
  getDefaultDicomPath() {
    const config = this.getConfig();
    const mainPath = config.DICOM_PATH;
    
    // 如果是相对路径，转换为绝对路径
    if (mainPath.startsWith('./') || mainPath.startsWith('../') || !path.isAbsolute(mainPath)) {
      return this.normalizePath(path.resolve(process.cwd(), mainPath));
    }
    
    return this.normalizePath(mainPath);
  }

  /**
   * 获取备用DICOM目录路径列表
   */
  getBackupDicomPaths() {
    const config = this.getConfig();
    const backupPaths = config.BACKUP_PATHS || [];
    
    return backupPaths.map(backupPath => {
      if (backupPath.startsWith('./') || backupPath.startsWith('../') || !path.isAbsolute(backupPath)) {
        return this.normalizePath(path.resolve(process.cwd(), backupPath));
      }
      return this.normalizePath(backupPath);
    });
  }

  /**
   * 查找可用的DICOM目录
   */
  findAvailableDicomDirectory() {
    console.log('🔍 ConfigManager: 开始查找可用的DICOM目录...');
    
    // 首先尝试主路径
    const mainPath = this.getDefaultDicomPath();
    console.log('📁 主路径:', mainPath);
    if (fs.existsSync(mainPath)) {
      console.log('✅ 主路径存在，使用:', mainPath);
      return mainPath;
    }
    console.log('❌ 主路径不存在');

    // 尝试备用路径
    const backupPaths = this.getBackupDicomPaths();
    console.log('🔍 尝试备用路径:', backupPaths);
    for (const backupPath of backupPaths) {
      if (fs.existsSync(backupPath)) {
        console.log('✅ 备用路径存在，使用:', backupPath);
        return backupPath;
      }
    }
    console.log('❌ 所有备用路径都不存在');

    // 如果都没找到，使用默认的目录查找逻辑
    console.log('🔄 使用默认目录查找逻辑...');
    const defaultPath = this.findDicomDirectory();
    console.log('📁 默认查找结果:', defaultPath);
    return defaultPath;
  }

  /**
   * 检查是否启用自动加载
   */
  isAutoLoadEnabled() {
    return this.get('AUTO_LOAD');
  }

  /**
   * 获取DICOM文件扩展名列表
   */
  getDicomExtensions() {
    return this.get('DICOM_EXTENSIONS');
  }

  /**
   * 获取最大扫描深度
   */
  getMaxScanDepth() {
    return this.get('MAX_SCAN_DEPTH');
  }

  /**
   * 获取完整配置对象
   */
  getConfig() {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config;
  }

  /**
   * 保存配置到文件
   */
  saveConfig() {
    try {
      const configPath = this.getConfigFilePath();
      const config = this.getConfig();
      
      let content = '# DICOM Viewer 配置文件\n';
      content += '# 此文件用于设置默认的DICOM目录路径\n';
      content += '# 支持Windows、Linux、Mac跨平台路径格式\n\n';
      
      content += `DICOM_PATH=${config.DICOM_PATH}\n`;
      content += `BACKUP_PATHS=${config.BACKUP_PATHS.join(';')}\n`;
      content += `AUTO_LOAD=${config.AUTO_LOAD}\n`;
      content += `DICOM_EXTENSIONS=${config.DICOM_EXTENSIONS.join(',')}\n`;
      content += `MAX_SCAN_DEPTH=${config.MAX_SCAN_DEPTH}\n`;
      
      fs.writeFileSync(configPath, content, 'utf8');
      return true;
    } catch (error) {
      console.error('保存配置文件失败:', error.message);
      return false;
    }
  }

  /**
   * 查找DICOM目录（默认逻辑）
   */
  findDicomDirectory(basePath = process.cwd()) {
    const possiblePaths = [
      path.join(basePath, 'DICOM'),
      path.join(basePath, 'dicom'),
      path.join(basePath, 'Dicom'),
      path.join(basePath, 'PATS'),
      path.join(basePath, 'pats'),
      path.join(basePath, 'Pats'),
      path.join(basePath, 'data'),
      path.join(basePath, 'Data'),
      path.join(basePath, 'DATA')
    ];
    
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        return this.normalizePath(testPath);
      }
    }
    
    return null;
  }
}

module.exports = { ConfigManager };
