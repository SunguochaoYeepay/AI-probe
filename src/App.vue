<template>
  <div id="app">
    <a-config-provider :locale="locale">
      <router-view />
    </a-config-provider>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { useChartManager } from '@/composables/useChartManager'
import { useTheme } from '@/composables/useTheme'
import { dataPreloadService } from '@/services/dataPreloadService'

const locale = ref(zhCN)

// 图表管理器
const { init: initChartManager } = useChartManager()

// 主题管理
const { initTheme } = useTheme()

// 应用启动时初始化
onMounted(async () => {
  console.log('🚀 应用启动，初始化系统...')
  
  // 初始化主题系统
  initTheme()
  console.log('✅ 主题系统初始化完成')
  
  // 初始化图表管理器
  try {
    await initChartManager(false) // 不启用自动更新
    console.log('✅ 图表管理器初始化完成')
  } catch (error) {
    console.error('❌ 图表管理器初始化失败:', error)
  }
  
  // 初始化数据预加载服务
  try {
    await dataPreloadService.init()
    console.log('✅ 数据预加载服务初始化完成')
  } catch (error) {
    console.error('❌ 数据预加载服务初始化失败:', error)
  }
})
</script>

<style>
:root {
  /* 默认亮色主题变量 */
  --bg-color: #f5f5f5;
  --bg-color-light: #ffffff;
  --text-color: #262626;
  --text-color-secondary: #999999;
  --border-color: #d9d9d9;
  --card-bg: #ffffff;
  --shadow-color: rgba(0, 0, 0, 0.1);
  --primary-color: #1890ff;
}

/* 暗黑主题变量 */
.dark-theme {
  --bg-color: #141414;
  --bg-color-light: #1f1f1f;
  --text-color: #ffffff;
  --text-color-secondary: #cccccc;
  --border-color: #303030;
  --card-bg: #1f1f1f;
  --shadow-color: rgba(0, 0, 0, 0.3);
  --primary-color: #1890ff;
}

#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--text-color, #262626);
  min-height: 100vh;
  background: var(--bg-color, #f5f5f5);
  transition: background-color 0.3s ease, color 0.3s ease;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background: var(--bg-color, #f5f5f5);
  color: var(--text-color, #262626);
  transition: background-color 0.3s ease, color 0.3s ease;
}
</style>
