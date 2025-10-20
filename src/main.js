import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import router from './router'
import store from './store'
import * as echarts from 'echarts'

// 配置ECharts以减少性能警告
echarts.registerTheme('default', {
  // 配置主题以减少事件监听器警告
})

// 全局配置ECharts
const originalAddEventListener = EventTarget.prototype.addEventListener
EventTarget.prototype.addEventListener = function(type, listener, options) {
  // 对于mousewheel和wheel事件，自动添加passive选项
  if (type === 'mousewheel' || type === 'wheel') {
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

const app = createApp(App)

app.use(Antd)
app.use(router)
app.use(store)

app.mount('#app')
