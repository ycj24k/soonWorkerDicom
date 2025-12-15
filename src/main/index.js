import { app, BrowserWindow, Menu, ipcMain  } from 'electron'
// 使用 require 兼容 CommonJS 导出形式
const remoteMain = require('@electron/remote/main')

// 确保 @electron/remote 只在主进程中初始化一次，避免多次调用导致异常（兼容热重载场景）
if (!global.__REMOTE_MAIN_INITIALIZED__) {
  if (remoteMain && typeof remoteMain.initialize === 'function') {
    remoteMain.initialize()
  }
  global.__REMOTE_MAIN_INITIALIZED__ = true
}

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let mainWindow
const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:9080`
  : `file://${__dirname}/index.html`

function createWindow () {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    width: 600,
    height: 300,
    useContentSize: true, // 确保宽高设置基于内容区域
    frame: false, // 隐藏顶部边框
    center: true, // 窗口初始居中
    show: false,
    fullscreen: false,
    webPreferences: {
      // 注意：以下配置降低了安全性，但DICOM查看器需要访问本地文件系统
      // 在生产环境中，建议考虑使用 IPC 通信和 contextIsolation 来提高安全性
      webSecurity: false, // 禁用同源策略，允许加载本地文件
      nodeIntegration: true, // 启用 Node.js API 访问，用于文件系统操作
      contextIsolation: false // 禁用上下文隔离，与 nodeIntegration 配合使用
      // 未来改进建议：
      // 1. 启用 contextIsolation: true
      // 2. 禁用 nodeIntegration: false
      // 3. 通过 preload 脚本暴露必要的 API
      // 4. 使用 IPC 通信处理文件系统操作
    }
  })

  // 为当前窗口启用 @electron/remote（initialize 已在模块加载时全局执行一次）
  remoteMain.enable(mainWindow.webContents);
  // 禁用默认菜单
  Menu.setApplicationMenu(null);
  mainWindow.maximize();
  mainWindow.show()
  mainWindow.loadURL(winURL)
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  // 主进程中监听关闭窗口的请求
  ipcMain.on('close-window', () => {
    mainWindow.close();
  });
  // 最小化
  ipcMain.on('minimize-window', () => {
    mainWindow.minimize();
  });
  // 最大化
  ipcMain.on('maximize-window', () => {
    mainWindow.maximize();
  });
  // 设置窗口大小
  ipcMain.on('resize-window', (event, width, height) => {
    mainWindow.setContentSize(width, height, true); // 根据内容宽高调整窗口大小
    mainWindow.center(); // 确保窗口居中
  });
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

/**
 * Auto Updater
 *
 * Uncomment the following code below and install `electron-updater` to
 * support auto updating. Code Signing with a valid certificate is required.
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
 */

/*
import { autoUpdater } from 'electron-updater'

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})

app.on('ready', () => {
  if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
})
 */
