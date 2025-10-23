<template>
  <a-layout class="demo-layout">
    <!-- 左侧导航 -->
    <ChartSidebar ref="sidebarRef" />
    
    <!-- 右侧内容区 -->
    <a-layout class="main-content">
      <!-- 页面头部 -->
      <a-layout-header class="page-header">
        <div class="header-left">
          <a-button 
            type="text" 
            @click="toggleSidebar"
            class="sidebar-trigger"
          >
            <MenuOutlined />
          </a-button>
          <h1>图表导航演示</h1>
        </div>
        <div class="header-right">
          <a-button @click="refreshDemo">
            <ReloadOutlined />
            刷新
          </a-button>
          <a-button type="primary" @click="goToCreate">
            <PlusOutlined />
            创建新图表
          </a-button>
        </div>
      </a-layout-header>
      
      <!-- 主要内容 -->
      <a-layout-content class="page-content">
        <a-card title="左侧导航功能演示" class="demo-card">
          <div class="demo-content">
            <a-row :gutter="24">
              <a-col :span="12">
                <h3>🎯 主要功能</h3>
                <ul class="feature-list">
                  <li>📊 图表分类导航 - 按类型组织图表</li>
                  <li>🔍 智能搜索 - 快速找到目标图表</li>
                  <li>📱 响应式设计 - 移动端友好</li>
                  <li>🌙 深色主题支持 - 护眼模式</li>
                  <li>⚡ 快速操作 - 一键创建和访问</li>
                </ul>
              </a-col>
              <a-col :span="12">
                <h3>🎨 设计特点</h3>
                <ul class="feature-list">
                  <li>🎯 Ant Design 最佳实践</li>
                  <li>📐 统一的视觉语言</li>
                  <li>🔄 流畅的交互动画</li>
                  <li>📊 直观的图标系统</li>
                  <li>🎪 优雅的悬停效果</li>
                </ul>
              </a-col>
            </a-row>
            
            <a-divider />
            
            <div class="demo-stats">
              <h3>📈 导航结构</h3>
              <a-row :gutter="16">
                <a-col :span="6">
                  <a-statistic title="一级分类" :value="4" />
                </a-col>
                <a-col :span="6">
                  <a-statistic title="二级分类" :value="12" />
                </a-col>
                <a-col :span="6">
                  <a-statistic title="搜索功能" :value="1" />
                </a-col>
                <a-col :span="6">
                  <a-statistic title="快捷操作" :value="2" />
                </a-col>
              </a-row>
            </div>
            
            <a-divider />
            
            <div class="demo-actions">
              <h3>🚀 快速体验</h3>
              <a-space wrap>
                <a-button type="primary" @click="toggleSidebar">
                  <MenuOutlined />
                  切换侧边栏
                </a-button>
                <a-button @click="simulateSearch">
                  <SearchOutlined />
                  模拟搜索
                </a-button>
                <a-button @click="showNavigation">
                  <CompassOutlined />
                  查看导航
                </a-button>
                <a-button @click="goToMyCharts">
                  <BarChartOutlined />
                  我的图表
                </a-button>
              </a-space>
            </div>
          </div>
        </a-card>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  MenuOutlined,
  ReloadOutlined,
  PlusOutlined,
  SearchOutlined,
  CompassOutlined,
  BarChartOutlined
} from '@ant-design/icons-vue'
import ChartSidebar from '@/components/ChartSidebar.vue'

const router = useRouter()
const sidebarRef = ref(null)

// 方法
const toggleSidebar = () => {
  if (sidebarRef.value) {
    sidebarRef.value.toggleCollapsed()
  }
}

const refreshDemo = () => {
  message.success('演示页面已刷新')
}

const goToCreate = () => {
  router.push('/')
}

const simulateSearch = () => {
  message.info('搜索功能演示：在左侧搜索框中输入关键词')
}

const showNavigation = () => {
  message.info('导航功能演示：点击左侧菜单项查看不同分类')
}

const goToMyCharts = () => {
  router.push('/my-charts')
}
</script>

<style scoped lang="less">
.demo-layout {
  min-height: 100vh;
  
  .main-content {
    background: #f5f5f5;
  }
  
  .page-header {
    background: #fff;
    padding: 0 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 64px;
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
      
      .sidebar-trigger {
        font-size: 16px;
      }
      
      h1 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #262626;
      }
    }
    
    .header-right {
      display: flex;
      gap: 12px;
    }
  }
  
  .page-content {
    padding: 16px;
    min-height: calc(100vh - 64px);
  }
}

.demo-card {
  .demo-content {
    .feature-list {
      list-style: none;
      padding: 0;
      
      li {
        padding: 8px 0;
        border-bottom: 1px solid #f0f0f0;
        
        &:last-child {
          border-bottom: none;
        }
      }
    }
    
    .demo-stats {
      .ant-statistic {
        text-align: center;
      }
    }
    
    .demo-actions {
      text-align: center;
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .demo-layout {
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

// 深色主题适配
@media (prefers-color-scheme: dark) {
  .demo-layout {
    .main-content {
      background: #141414;
    }
    
    .page-header {
      background: #1f1f1f;
      border-bottom: 1px solid #303030;
      
      .header-left h1 {
        color: #fff;
      }
    }
  }
}
</style>
