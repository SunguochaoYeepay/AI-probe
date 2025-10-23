<template>
  <a-layout-sider
    v-model:collapsed="collapsed"
    :trigger="null"
    collapsible
    :width="220"
    :collapsed-width="80"
    class="chart-sidebar"
  >
    <!-- 侧边栏头部 -->
    <div class="sidebar-header">
      <div class="logo">
        <template v-if="!collapsed">
          <BarChartOutlined class="logo-icon" />
          <span class="logo-text">我的图表</span>
        </template>
        <template v-else>
          <BarChartOutlined class="logo-icon" />
        </template>
      </div>
    </div>


    <!-- 导航菜单 -->
    <a-menu
      v-model:selectedKeys="selectedKeys"
      v-model:openKeys="openKeys"
      mode="inline"
      :inline-collapsed="collapsed"
      class="sidebar-menu"
      @click="onMenuClick"
    >
      <!-- 概览 -->
      <a-menu-item key="overview">
        <template #icon>
          <DashboardOutlined />
        </template>
        <span>概览</span>
      </a-menu-item>

      <!-- 创建图表 -->
      <a-menu-item key="create">
        <template #icon>
          <PlusOutlined />
        </template>
        <span>创建图表</span>
      </a-menu-item>

      <!-- 页面分析 -->
      <a-sub-menu key="page-analysis">
        <template #icon>
          <FileTextOutlined />
        </template>
        <template #title>页面分析</template>
        <a-menu-item key="page-visits">
          <template #icon>
            <BarChartOutlined />
          </template>
          <span>页面访问量</span>
        </a-menu-item>
        <a-menu-item key="button-clicks">
          <template #icon>
            <ThunderboltOutlined />
          </template>
          <span>按钮点击</span>
        </a-menu-item>
        <a-menu-item key="query-conditions">
          <template #icon>
            <SearchOutlined />
          </template>
          <span>查询条件分析</span>
        </a-menu-item>
      </a-sub-menu>

      <!-- 用户行为 -->
      <a-sub-menu key="user-behavior">
        <template #icon>
          <UserOutlined />
        </template>
        <template #title>用户行为</template>
        <a-menu-item key="user-journey">
          <template #icon>
            <NodeIndexOutlined />
          </template>
          <span>用户路径</span>
        </a-menu-item>
        <a-menu-item key="user-duration">
          <template #icon>
            <ClockCircleOutlined />
          </template>
          <span>停留时长</span>
        </a-menu-item>
        <a-menu-item key="device-analysis">
          <template #icon>
            <MobileOutlined />
          </template>
          <span>设备分析</span>
        </a-menu-item>
      </a-sub-menu>

      <!-- 转化分析 -->
      <a-sub-menu key="conversion-analysis">
        <template #icon>
          <SwapOutlined />
        </template>
        <template #title>转化分析</template>
        <a-menu-item key="conversion-funnel">
          <template #icon>
            <FunnelPlotOutlined />
          </template>
          <span>转化漏斗</span>
        </a-menu-item>
        <a-menu-item key="click-conversion">
          <template #icon>
            <ThunderboltOutlined />
          </template>
          <span>点击转化</span>
        </a-menu-item>
        <a-menu-item key="flow-analysis">
          <template #icon>
            <ApartmentOutlined />
          </template>
          <span>流程分析</span>
        </a-menu-item>
      </a-sub-menu>

      <!-- 设置 -->
      <a-menu-item key="settings">
        <template #icon>
          <SettingOutlined />
        </template>
        <span>系统设置</span>
      </a-menu-item>
    </a-menu>

   
  </a-layout-sider>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  BarChartOutlined,
  DashboardOutlined,
  FileTextOutlined,
  UserOutlined,
  NodeIndexOutlined,
  ClockCircleOutlined,
  MobileOutlined,
  SwapOutlined,
  FunnelPlotOutlined,
  ThunderboltOutlined,
  ApartmentOutlined,
  SettingOutlined,
  UnorderedListOutlined,
  DatabaseOutlined,
  PlusOutlined
} from '@ant-design/icons-vue'

const router = useRouter()

// Props
const props = defineProps({
  currentPage: {
    type: String,
    default: 'overview'
  }
})

// 响应式数据
const collapsed = ref(false)
const selectedKeys = ref([props.currentPage])
const openKeys = ref(['page-analysis'])

// 监听currentPage变化
watch(() => props.currentPage, (newPage) => {
  selectedKeys.value = [newPage]
}, { immediate: true })

// 方法

const emit = defineEmits(['menu-click'])

const onMenuClick = ({ key }) => {
  console.log('菜单点击:', key)
  
  // 触发事件给父组件
  emit('menu-click', key)
  
  // 根据菜单项跳转到不同页面
  switch (key) {
    case 'overview':
      router.push('/my-charts')
      break
    case 'create':
      router.push('/')
      break
    case 'page-visits':
      router.push('/my-charts?category=page-analysis&type=' + key)
      break
    case 'button-clicks':
      router.push('/my-charts?category=click-analysis&type=' + key)
      break
    case 'query-conditions':
      router.push('/my-charts?category=query-analysis&type=' + key)
      break
    case 'user-journey':
    case 'user-duration':
    case 'device-analysis':
      router.push('/my-charts?category=click-analysis&type=' + key)
      break
    case 'conversion-funnel':
    case 'click-conversion':
    case 'flow-analysis':
      router.push('/my-charts?category=conversion&type=' + key)
      break
    case 'chart-management':
      router.push('/my-charts?tab=management')
      break
    case 'data-source':
      router.push('/project-config')
      break
    case 'settings':
      router.push('/settings')
      break
  }
}

const createNewChart = () => {
  router.push('/')
}


// 暴露给父组件的方法
defineExpose({
  collapsed,
  toggleCollapsed: () => {
    collapsed.value = !collapsed.value
  }
})
</script>

<style scoped>
.chart-sidebar {
  background: var(--bg-color-light, #fff);
  box-shadow: 2px 0 8px var(--shadow-color, rgba(0, 0, 0, 0.1));
  border-right: 1px solid var(--border-color, #d9d9d9);
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color, #f0f0f0);
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1890ff;
}

.logo-icon {
  font-size: 20px;
}

.logo-text {
  white-space: nowrap;
}


.sidebar-menu {
  border-right: none;
  flex: 1;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--border-color, #f0f0f0);
  background: var(--bg-color, #fafafa);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .chart-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 1000;
  }
}
</style>
