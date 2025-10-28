const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

// 保持对窗口对象的全局引用
let mainWindow
let serverProcess

// 启动本地服务器
function startServer() {
  const serverPath = path.join(__dirname, 'server', 'app.js')
  console.log('🚀 启动本地服务器:', serverPath)
  
  serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  })
  
  serverProcess.on('error', (err) => {
    console.error('❌ 服务器启动失败:', err)
  })
  
  serverProcess.on('exit', (code) => {
    console.log(`📊 服务器进程退出，代码: ${code}`)
  })
}

// 创建主窗口
function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    icon: path.join(__dirname, '..', 'public', 'icon.png')
  })

  // 加载应用
  const isDev = process.env.NODE_ENV === 'development'
  
  if (isDev) {
    // 开发环境：加载Vite开发服务器
    mainWindow.loadURL('http://localhost:3000')
    // 打开开发者工具
    mainWindow.webContents.openDevTools()
  } else {
    // 生产环境：加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // 设置CSP头部
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      /* 添加安全样式 */
    `)
  })

  // 当窗口被关闭时触发
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 当 Electron 完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  // 启动本地服务器
  startServer()
  
  // 等待服务器启动
  setTimeout(() => {
    createWindow()
  }, 2000)

  app.on('activate', () => {
    // 在 macOS 上，当单击 dock 图标并且没有其他窗口打开时，
    // 通常在应用程序中重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 当所有窗口都被关闭时退出应用
app.on('window-all-closed', () => {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 应用退出时清理服务器进程
app.on('before-quit', () => {
  if (serverProcess) {
    console.log('🛑 关闭本地服务器...')
    serverProcess.kill()
  }
})

// IPC 通信处理
ipcMain.handle('get-server-status', async () => {
  return {
    status: 'running',
    port: 3004
  }
})

ipcMain.handle('restart-server', async () => {
  if (serverProcess) {
    serverProcess.kill()
  }
  startServer()
  return { status: 'restarted' }
})
