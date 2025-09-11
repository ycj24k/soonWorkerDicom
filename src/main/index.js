import { app, BrowserWindow, Menu, ipcMain  } from 'electron'
import '../renderer/store'

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
      webSecurity: false,
      nodeIntegration: true,
      contextIsolation: false
    }
  })
  require("@electron/remote/main").initialize();
  require("@electron/remote/main").enable(mainWindow.webContents);
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
