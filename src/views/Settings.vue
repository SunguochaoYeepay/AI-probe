<template>
  <AppLayout page-title="系统设置" current-page="settings">
    <div class="settings-page">
      <a-tabs v-model:activeKey="activeTab" type="card">
        <!-- 项目配置 -->
        <a-tab-pane key="project" tab="项目配置">
          <ProjectConfigTab />
        </a-tab-pane>
        
        <!-- API配置 -->
        <a-tab-pane key="api" tab="API配置">
          <ApiConfigTab />
        </a-tab-pane>
        
        <!-- AI配置 -->
        <a-tab-pane key="ai" tab="AI配置">
          <AiConfigTab />
        </a-tab-pane>
        
        <!-- 定时更新管理 -->
        <a-tab-pane key="scheduled" tab="定时更新">
          <ScheduledUpdatePanel />
        </a-tab-pane>
        
        <!-- 缓存管理 -->
        <a-tab-pane key="cache" tab="缓存管理">
          <CacheManagementPanel />
        </a-tab-pane>
        
        <!-- 图表管理 -->
        <a-tab-pane key="charts" tab="图表管理">
          <ChartManagementTab />
        </a-tab-pane>
      </a-tabs>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import ScheduledUpdatePanel from '@/components/ScheduledUpdatePanel.vue'
import CacheManagementPanel from '@/components/CacheManagementPanel.vue'
import ProjectConfigTab from '@/components/settings/ProjectConfigTab.vue'
import ApiConfigTab from '@/components/settings/ApiConfigTab.vue'
import AiConfigTab from '@/components/settings/AiConfigTab.vue'
import ChartManagementTab from '@/components/settings/ChartManagementTab.vue'

const activeTab = ref('project')
</script>

<style scoped lang="less">
.settings-page {
  padding: 24px;
  
  :deep(.ant-tabs-content-holder) {
    padding-top: 16px;
  }
}
</style>
