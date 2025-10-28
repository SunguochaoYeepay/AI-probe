const { contextBridge, ipcRenderer } = require('electron')

// 暴露受保护的方法，允许渲染进程使用
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取服务器状态
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  
  // 重启服务器
  restartServer: () => ipcRenderer.invoke('restart-server'),
  
  // 获取应用版本
  getVersion: () => process.versions.electron,
  
  // 获取平台信息
  getPlatform: () => process.platform
})
