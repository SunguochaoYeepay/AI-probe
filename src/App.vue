<template>
  <div id="app">
    <a-config-provider :locale="locale" :theme="antdTheme">
      <router-view />
    </a-config-provider>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { theme } from 'ant-design-vue'
import { useChartManager } from '@/composables/useChartManager'
import { useTheme } from '@/composables/useTheme'
import { dataPreloadService } from '@/services/dataPreloadService'

const locale = ref(zhCN)

// 主题管理
const { isDark } = useTheme()

// Ant Design 主题配置
const antdTheme = computed(() => ({
  algorithm: isDark.value ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorBgContainer: isDark.value ? '#1f1f1f' : '#ffffff',
    colorBgElevated: isDark.value ? '#1f1f1f' : '#ffffff',
    colorBgLayout: isDark.value ? '#141414' : '#f5f5f5',
    colorText: isDark.value ? '#ffffff' : '#262626',
    colorTextSecondary: isDark.value ? '#cccccc' : '#999999',
    colorBorder: isDark.value ? '#303030' : '#d9d9d9',
    colorBorderSecondary: isDark.value ? '#303030' : '#d9d9d9',
  }
}))

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

/* 暗色主题下的 Ant Design 组件样式覆盖 */
.dark-theme {
  /* 卡片组件 */
  .ant-card {
    background: #1f1f1f !important;
    border-color: #303030 !important;
  }
  
  .ant-card-head {
    background: #1f1f1f !important;
    border-bottom-color: #303030 !important;
    color: #ffffff !important;
  }
  
  .ant-card-body {
    background: #1f1f1f !important;
    color: #ffffff !important;
  }
  
  /* 标签页组件 */
  .ant-tabs {
    .ant-tabs-tab {
      color: #cccccc !important;
      background: transparent !important;
    }
    
    .ant-tabs-tab:hover {
      color: #ffffff !important;
      background: rgba(255, 255, 255, 0.05) !important;
    }
    
    .ant-tabs-tab-active {
      color: #1890ff !important;
      background: rgba(24, 144, 255, 0.1) !important;
    }
    
    .ant-tabs-tab-btn {
      color: inherit !important;
    }
    
    .ant-tabs-ink-bar {
      background: #1890ff !important;
    }
  }
  
  .ant-tabs-content-holder {
    background: #141414 !important;
  }
  
  .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab {
    background: #1f1f1f !important;
    border-color: #303030 !important;
    color: #cccccc !important;
  }
  
  .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab-active {
    background: #1890ff !important;
    border-color: #1890ff !important;
    color: #ffffff !important;
  }
  
  .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab:hover {
    color: #ffffff !important;
  }
  
  /* 表单组件 */
  .ant-form-item-label > label {
    color: #ffffff !important;
  }
  
  .ant-input {
    background: #1f1f1f !important;
    border-color: #303030 !important;
    color: #ffffff !important;
  }
  
  .ant-input:hover,
  .ant-input:focus {
    border-color: #1890ff !important;
  }
  
  .ant-select-selector {
    background: #1f1f1f !important;
    border-color: #303030 !important;
    color: #ffffff !important;
  }
  
  .ant-select-selection-item {
    color: #ffffff !important;
  }
  
  /* 按钮组件 */
  .ant-btn {
    border-color: #303030 !important;
  }
  
  .ant-btn-default {
    background: #1f1f1f !important;
    color: #ffffff !important;
  }
  
  .ant-btn-default:hover {
    background: #303030 !important;
    border-color: #1890ff !important;
  }
  
  /* 标签组件 */
  .ant-tag {
    background: #303030 !important;
    border-color: #303030 !important;
    color: #ffffff !important;
  }
  
  /* 描述列表 */
  .ant-descriptions-item-label {
    color: #cccccc !important;
  }
  
  .ant-descriptions-item-content {
    color: #ffffff !important;
  }
  
  .ant-descriptions-bordered .ant-descriptions-item-label {
    background: #1f1f1f !important;
    border-color: #303030 !important;
  }
  
  .ant-descriptions-bordered .ant-descriptions-item-content {
    background: #1f1f1f !important;
    border-color: #303030 !important;
  }
  
  /* 单选框组件 */
  .ant-radio-wrapper {
    color: #ffffff !important;
  }
  
  .ant-radio-wrapper:hover .ant-radio-inner {
    border-color: #1890ff !important;
  }
  
  .ant-radio-checked .ant-radio-inner {
    background-color: #1890ff !important;
    border-color: #1890ff !important;
  }
  
  .ant-radio-button-wrapper {
    background: #1f1f1f !important;
    border-color: #303030 !important;
    color: #ffffff !important;
  }
  
  .ant-radio-button-wrapper:hover {
    color: #1890ff !important;
  }
  
  .ant-radio-button-wrapper-checked {
    background: #1890ff !important;
    border-color: #1890ff !important;
    color: #ffffff !important;
  }
  
  /* 数字输入框 */
  .ant-input-number {
    background: #1f1f1f !important;
    border-color: #303030 !important;
    color: #ffffff !important;
  }
  
  .ant-input-number:hover,
  .ant-input-number:focus {
    border-color: #1890ff !important;
  }
  
  .ant-input-number-input {
    background: transparent !important;
    color: #ffffff !important;
  }
  
  /* 下拉选择器 */
  .ant-select-dropdown {
    background: #1f1f1f !important;
    border-color: #303030 !important;
  }
  
  .ant-select-item {
    color: #ffffff !important;
  }
  
  .ant-select-item:hover {
    background: #303030 !important;
  }
  
  .ant-select-item-option-selected {
    background: #1890ff !important;
    color: #ffffff !important;
  }
  
  /* 开关组件 */
  .ant-switch {
    background: #303030 !important;
  }
  
  .ant-switch-checked {
    background: #1890ff !important;
  }
  
  /* 表格组件 */
  .ant-table {
    background: #1f1f1f !important;
    color: #ffffff !important;
  }
  
  .ant-table-thead > tr > th {
    background: #1f1f1f !important;
    border-bottom-color: #303030 !important;
    color: #ffffff !important;
  }
  
  .ant-table-tbody > tr > td {
    background: #1f1f1f !important;
    border-bottom-color: #303030 !important;
    color: #ffffff !important;
  }
  
  .ant-table-tbody > tr:hover > td {
    background: #303030 !important;
  }
  
  /* 分页组件 */
  .ant-pagination-item {
    background: #1f1f1f !important;
    border-color: #303030 !important;
  }
  
  .ant-pagination-item a {
    color: #ffffff !important;
  }
  
  .ant-pagination-item:hover {
    border-color: #1890ff !important;
  }
  
  .ant-pagination-item-active {
    background: #1890ff !important;
    border-color: #1890ff !important;
  }
  
  .ant-pagination-item-active a {
    color: #ffffff !important;
  }
  
  /* 抽屉组件 */
  .ant-drawer {
    background: #1f1f1f !important;
  }
  
  .ant-drawer-header {
    background: #1f1f1f !important;
    border-bottom-color: #303030 !important;
  }
  
  .ant-drawer-title {
    color: #ffffff !important;
  }
  
  .ant-drawer-close {
    color: #ffffff !important;
  }
  
  .ant-drawer-body {
    background: #1f1f1f !important;
    color: #ffffff !important;
  }
  
  /* 空状态组件 */
  .ant-empty {
    color: #cccccc !important;
  }
  
  .ant-empty-description {
    color: #cccccc !important;
  }
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
