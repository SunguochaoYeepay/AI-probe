<template>
  <a-card title="配置同步状态" class="config-sync-status">
    <template #extra>
      <a-space>
        <a-button size="small" @click="refreshStatus" :loading="loading">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
        <a-button size="small" @click="performFullCheck" :loading="checking">
          <template #icon><CheckCircleOutlined /></template>
          完整检查
        </a-button>
      </a-space>
    </template>

    <!-- 连接状态 -->
    <a-descriptions :column="2" size="small" bordered>
      <a-descriptions-item label="后端连接">
        <a-tag :color="status.backendConnection ? 'green' : 'red'">
          {{ status.backendConnection ? '正常' : '失败' }}
        </a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="数据库访问">
        <a-tag :color="status.databaseAccess ? 'green' : 'red'">
          {{ status.databaseAccess ? '正常' : '失败' }}
        </a-tag>
      </a-descriptions-item>
    </a-descriptions>

    <!-- 配置同步状态 -->
    <div class="config-types" style="margin-top: 16px;">
      <h4>配置类型同步状态</h4>
      <a-row :gutter="16">
        <a-col :span="12" v-for="(synced, type) in status.configTypes" :key="type">
          <div class="config-type-item">
            <a-tag :color="synced ? 'green' : 'orange'">
              {{ synced ? '已同步' : '未同步' }}
            </a-tag>
            <span class="config-type-name">{{ getConfigTypeName(type) }}</span>
          </div>
        </a-col>
      </a-row>
    </div>

    <!-- 总体状态 -->
    <div class="overall-status" style="margin-top: 16px;">
      <a-alert
        :type="overallStatus.type"
        :message="overallStatus.message"
        :description="overallStatus.description"
        show-icon
      />
    </div>

    <!-- 最后检查时间 -->
    <div class="last-check" style="margin-top: 16px; text-align: right; color: #999; font-size: 12px;">
      最后检查: {{ status.lastCheckTime ? formatTime(status.lastCheckTime) : '未检查' }}
    </div>
  </a-card>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons-vue'
import configSyncChecker from '../utils/configSyncChecker.js'

// 状态
const loading = ref(false)
const checking = ref(false)
const status = ref({
  backendConnection: false,
  databaseAccess: false,
  configTypes: {
    projectConfig: false,
    apiConfig: false,
    aiConfig: false,
    pageMenuData: false,
    cacheConfig: false
  },
  lastCheckTime: null
})

// 计算总体状态
const overallStatus = computed(() => {
  const allConfigsSynced = Object.values(status.value.configTypes).every(synced => synced)
  const isHealthy = status.value.backendConnection && 
                   status.value.databaseAccess && 
                   allConfigsSynced

  if (isHealthy) {
    return {
      type: 'success',
      message: '配置同步完全正常',
      description: '所有配置都已正确同步到数据库'
    }
  } else if (status.value.backendConnection && status.value.databaseAccess) {
    return {
      type: 'warning',
      message: '部分配置未同步',
      description: '后端和数据库正常，但部分配置类型未同步到数据库'
    }
  } else {
    return {
      type: 'error',
      message: '连接异常',
      description: '后端服务或数据库连接异常，请检查服务状态'
    }
  }
})

// 获取配置类型中文名称
const getConfigTypeName = (type) => {
  const names = {
    projectConfig: '项目配置',
    apiConfig: 'API配置',
    aiConfig: 'AI配置',
    pageMenuData: '页面菜单',
    cacheConfig: '缓存管理'
  }
  return names[type] || type
}

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return '未知'
  return new Date(timeStr).toLocaleString('zh-CN')
}

// 刷新状态
const refreshStatus = async () => {
  loading.value = true
  try {
    const results = await configSyncChecker.performFullCheck()
    status.value = results
  } catch (error) {
    console.error('刷新状态失败:', error)
  } finally {
    loading.value = false
  }
}

// 执行完整检查
const performFullCheck = async () => {
  checking.value = true
  try {
    const results = await configSyncChecker.performFullCheck()
    status.value = results
  } catch (error) {
    console.error('完整检查失败:', error)
  } finally {
    checking.value = false
  }
}

// 组件挂载时自动检查
onMounted(() => {
  refreshStatus()
})
</script>

<style scoped lang="less">
.config-sync-status {
  .config-types {
    h4 {
      margin-bottom: 12px;
      color: #333;
    }
    
    .config-type-item {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      
      .config-type-name {
        margin-left: 8px;
        font-size: 14px;
      }
    }
  }
  
  .overall-status {
    margin-top: 16px;
  }
  
  .last-check {
    margin-top: 16px;
    text-align: right;
    color: #999;
    font-size: 12px;
  }
}
</style>
