<template>
  <a-layout class="app-layout">
    <!-- 左侧导航 -->
    <ChartSidebar 
      ref="sidebarRef" 
      :current-page="currentPage"
      @menu-click="handleMenuClick"
    />
    
    <!-- 右侧内容区 -->
    <a-layout class="main-content">
      <!-- 页面头部 -->
      <a-layout-header class="page-header" v-if="showHeader">
        <div class="header-left">
          <a-button 
            type="text" 
            @click="toggleSidebar"
            class="sidebar-trigger"
          >
            <MenuOutlined />
          </a-button>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="header-right">
          <slot name="header-actions">
            <!-- 默认操作按钮 -->
            <a-button @click="refreshPage">
              <ReloadOutlined />
              刷新
            </a-button>
            <a-button type="primary" @click="goToCreate">
              <PlusOutlined />
              创建新图表
            </a-button>
          </slot>
        </div>
      </a-layout-header>
      
      <!-- 主要内容 -->
      <a-layout-content class="page-content" :class="{ 'no-header': !showHeader }">
        <slot />
      </a-layout-content>
    </a-layout>
    
    <!-- 数据同步状态 -->
    <DataSyncStatus />
  </a-layout>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  MenuOutlined,
  ReloadOutlined,
  PlusOutlined
} from '@ant-design/icons-vue'
import ChartSidebar from '@/components/ChartSidebar.vue'
import DataSyncStatus from '@/components/DataSyncStatus.vue'

const router = useRouter()

// Props
const props = defineProps({
  pageTitle: {
    type: String,
    default: '我的图表'
  },
  currentPage: {
    type: String,
    default: 'overview'
  },
  showHeader: {
    type: Boolean,
    default: true
  }
})

// 响应式数据
const sidebarRef = ref(null)

// 方法
const toggleSidebar = () => {
  if (sidebarRef.value) {
    sidebarRef.value.toggleCollapsed()
  }
}

const refreshPage = () => {
  window.location.reload()
}

const goToCreate = () => {
  router.push('/')
}

const handleMenuClick = (menuKey) => {
  // 处理菜单点击事件，可以在这里添加自定义逻辑
  console.log('菜单点击:', menuKey)
}

// 暴露方法给父组件
defineExpose({
  toggleSidebar,
  refreshPage,
  goToCreate
})
</script>

<style scoped lang="less">
.app-layout {
  min-height: 100vh;
  
  .main-content {
    background: var(--bg-color, #f5f5f5);
  }
  
  .page-header {
    background: var(--bg-color-light, #ffffff);
    padding: 0 24px;
    box-shadow: 0 2px 8px var(--shadow-color, rgba(0, 0, 0, 0.1));
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 64px;
    border-bottom: 1px solid var(--border-color, #d9d9d9);
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
      
      .sidebar-trigger {
        font-size: 16px;
        color: var(--text-color, #262626);
        
        &:hover {
          color: var(--primary-color, #1890ff);
        }
      }
      
      h1 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: var(--text-color, #262626);
      }
    }
    
    .header-right {
      display: flex;
      gap: 12px;
      align-items: center;
    }
  }
  
  .page-content {
    padding: 24px;
    min-height: calc(100vh - 64px);
    background: var(--bg-color, #f5f5f5);
    
    &.no-header {
      min-height: 100vh;
      padding-top: 24px;
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .app-layout {
    .page-header {
      padding: 0 16px;
      
      .header-left h1 {
        font-size: 18px;
      }
    }
    
    .page-content {
      padding: 16px;
    }
  }
}
</style>
