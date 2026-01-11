import { app, BrowserWindow, Menu, ipcMain } from 'electron'
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

function createWindow() {
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

// DogLock Verification Logic in Main Process
const koffi = require('koffi');
const path = require('path');
const fs = require('fs');

ipcMain.handle('verify-license', async () => {
  // ============================================================================
  // TEMPORARY WORKAROUND: DLL Verification Disabled
  // ============================================================================
  // REASON: The provided DLLs are Debug versions (depend on MSVCR120D.dll)
  //         which crash when called outside of a debugger environment.
  // SOLUTION: Contact SDK provider for Release version DLLs, then remove
  //           the early return below to re-enable verification.
  // ============================================================================

  console.warn('[Main] ⚠️  DLL Verification DISABLED - Running in Beta Mode');
  console.warn('[Main] To enable: Replace Debug DLLs with Release versions and remove the early return');

  // EARLY RETURN: Comment out this block to re-enable verification
  return {
    verified: false,
    systemName: 'SoonWorkerDicom Beta',
    failReason: 'DLL verification temporarily disabled (Debug runtime incompatibility)',
    dllPath: 'N/A (verification disabled)'
  };
  // END EARLY RETURN

  // Original verification code below (will not execute due to early return above)
  let dllPath = '';
  try {
    const cwd = process.cwd();
    // Resolve DLL path
    // Priority: 1. Production (resources/libs) 2. Dev (libs)
    if (process.env.NODE_ENV !== 'production') {
      dllPath = path.resolve('libs', 'DogLockAPI.dll');
    } else {
      const possiblePaths = [
        path.join(process.resourcesPath, 'libs', 'DogLockAPI.dll'),
        path.join(process.resourcesPath, '..', 'libs', 'DogLockAPI.dll'), // Fallback for unpacked
        path.join(cwd, 'libs', 'DogLockAPI.dll')
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          dllPath = p;
          break;
        }
      }
    }

    console.log('[Main] DogLock Path:', dllPath);
    console.log('[Main] Process Arch:', process.arch);

    if (!fs.existsSync(dllPath)) {
      console.error('[Main] DogLockAPI.dll not found');
      return { verified: false, systemName: 'SoonWorkerDicom Beta' };
    }

    // Load DLL with chdir strategy (safer for dependencies)
    const dllDir = path.dirname(dllPath);
    const originalCwd = process.cwd();

    // Also add to PATH for good measure (some dependencies might look there)
    let pathVar = process.env.PATH || process.env.Path || '';
    if (!pathVar.includes(dllDir)) {
      const newPath = `${dllDir}${path.delimiter}${pathVar}`;
      if (process.env.PATH) process.env.PATH = newPath;
      if (process.env.Path) process.env.Path = newPath;
    }

    // Switch to DLL directory temporarily so Windows loader finds neighbors (FCSDK, Entry, zint, etc.)
    console.log(`[Main] Switching CWD to ${dllDir} for DLL loading`);
    process.chdir(dllDir);

    let lib;
    try {
      console.log('[Main] debug: calling koffi.load...');
      lib = koffi.load(dllPath);
      console.log('[Main] debug: koffi.load success');
    } finally {
      process.chdir(originalCwd);
    }

    console.log('[Main] debug: defining getCheckInfo...');
    // Windows DLLs typically use __stdcall calling convention
    const getCheckInfo = lib.func('int __stdcall getCheckInfo(const char *letter_char, char *info_str, int info_size)');
    console.log('[Main] debug: function defined. Preparing to call...');

    // Skip A: and B: (legacy floppy drives that don't exist on modern systems)
    // Start from C: to avoid potential crashes on non-existent drives
    const drives = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const bufferSize = 1024;
    const infoBuffer = Buffer.alloc(bufferSize);

    console.log('[Main] Starting drive scan from C: to Z:...');

    for (const drive of drives) {
      try {
        console.log(`[Main] debug: checking drive ${drive}...`);
        const result = getCheckInfo(drive, infoBuffer, bufferSize);
        console.log(`[Main] debug: drive ${drive} returned: ${result}`);
        if (result === 0) {
          let nullIndex = infoBuffer.indexOf(0);
          if (nullIndex === -1) nullIndex = infoBuffer.length;
          const infoStr = infoBuffer.toString('utf8', 0, nullIndex);
          console.log(`[Main] License found on ${drive}:`, infoStr);
          return { verified: true, systemName: 'SoonWorkerDicom' };
        }
      } catch (err) {
        // ignore individual drive errors
      }
    }

    console.warn('[Main] No license found on any drive');
    return { verified: false, systemName: 'SoonWorkerDicom Beta', failReason: 'No license found on any drive', dllPath };

  } catch (e) {
    console.error('[Main] License Check Failed:', e);
    return {
      verified: false,
      systemName: 'SoonWorkerDicom Beta',
      failReason: 'Exception thrown',
      error: e.message,
      stack: e.stack,
      dllPath // Best guess for log
    };
  }
});

