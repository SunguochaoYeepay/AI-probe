import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import router from './router'
import store from './store'
import * as echarts from 'echarts'
import './services/scheduledUpdateService' // 启动定时更新服务

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
console.warn = function(...args) {
  // 过滤掉passive事件监听器相关的警告
  const message = args.join(' ')
  if (message.includes('Unable to preventDefault inside passive event listener') ||
      message.includes('useFrameWheel')) {
    return
  }
  originalConsoleWarn.apply(console, args)
}

const app = createApp(App)

app.use(Antd)
app.use(router)
app.use(store)

app.mount('#app')
