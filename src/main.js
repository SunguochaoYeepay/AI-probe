import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import router from './router'
import store from './store'
import * as echarts from 'echarts'
import './services/scheduledUpdateService' // 启动定时更新服务
import './utils/consoleFilter' // 过滤控制台警告
import './utils/databaseDebugger' // 数据库调试工具
import './utils/configSyncChecker' // 配置同步检查工具
import './utils/configValidator' // 配置验证工具
import './utils/configDebugger' // 配置调试工具
import './utils/dataSyncConfigValidator' // 数据同步配置验证工具
import './utils/dataSyncDebugger' // 数据同步调试工具
import './utils/configForceSync' // 配置强制同步工具
import './utils/configMismatchFixer' // 配置不匹配修复工具
import { configSyncService } from './services/configSyncService.js'

// 配置ECharts以减少性能警告
echarts.registerTheme('default', {
  // 配置主题以减少事件监听器警告
})

// 全局配置事件监听器，解决passive事件监听器警告
const originalAddEventListener = EventTarget.prototype.addEventListener
EventTarget.prototype.addEventListener = function(type, listener, options) {
  // 对于滚动相关事件，自动添加passive选项
  if (type === 'mousewheel' || type === 'wheel' || type === 'touchstart' || type === 'touchmove') {
    if (typeof options === 'boolean') {
      options = { capture: options, passive: true }
    } else if (typeof options === 'object') {
      options = { ...options, passive: true }
    } else {
      options = { passive: true }
    }
  }
  return originalAddEventListener.call(this, type, listener, options)
}

// 配置Ant Design Vue，减少控制台警告
const originalConsoleWarn = console.warn
const originalConsoleError = console.error

console.warn = function(...args) {
  // 过滤掉passive事件监听器相关的警告
  const message = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg)
      } catch (error) {
        // 处理循环引用，返回对象的类型信息
        return `[${arg.constructor?.name || 'Object'}]`
      }
    }
    return String(arg)
  }).join(' ')
  if (message.includes('Unable to preventDefault inside passive event listener') ||
      message.includes('useFrameWheel')) {
    return
  }
  originalConsoleWarn.apply(console, args)
}

console.error = function(...args) {
  // 过滤掉passive事件监听器相关的错误
  const message = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg)
      } catch (error) {
        // 处理循环引用，返回对象的类型信息
        return `[${arg.constructor?.name || 'Object'}]`
      }
    }
    return String(arg)
  }).join(' ')
  if (message.includes('Unable to preventDefault inside passive event listener') ||
      message.includes('useFrameWheel')) {
    return
  }
  originalConsoleError.apply(console, args)
}

const app = createApp(App)

app.use(Antd)
app.use(router)
app.use(store)

// 初始化配置同步服务
configSyncService.init(store)

app.mount('#app')

// 🚀 修复：应用启动时立即从数据库获取配置，不使用localStorage
console.log('🔄 应用启动，立即从数据库获取配置...')
configSyncService.loadConfigFromDatabase().then(() => {
  console.log('✅ 配置加载完成')
}).catch(error => {
  console.error('❌ 配置加载失败，使用默认配置:', error)
})
