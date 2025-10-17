<template>
  <div class="data-sync-status" v-if="showStatus">
    <!-- 预加载进度 -->
    <a-alert
      v-if="preloadStatus.isPreloading"
      type="info"
      message="数据同步中"
      :description="`正在预加载最近7天数据... (${preloadStatus.progress.current}/${preloadStatus.progress.total})`"
      show-icon
      closable
      @close="hidePreloadStatus"
      class="sync-alert"
    >
      <template #icon>
        <LoadingOutlined />
      </template>
      <a-progress
        :percent="Math.round((preloadStatus.progress.current / preloadStatus.progress.total) * 100)"
        :show-info="false"
        size="small"
      />
    </a-alert>

    <!-- 同步完成提示 -->
    <a-alert
      v-else-if="showSuccessMessage"
      type="success"
      message="数据同步完成"
      description="最近7天数据已缓存，后续操作将使用本地数据，无需重复调用接口"
      show-icon
      closable
      @close="hideSuccessMessage"
      class="sync-alert"
    >
      <template #icon>
        <CheckCircleOutlined />
      </template>
    </a-alert>

    <!-- 缓存状态信息 -->
    <a-alert
      v-if="showCacheInfo"
      type="info"
      message="使用缓存数据"
      :description="`已从本地缓存加载数据，无需调用接口。最后同步时间: ${lastSyncTime}`"
      show-icon
      closable
      @close="hideCacheInfo"
      class="sync-alert"
    >
      <template #icon>
        <DatabaseOutlined />
      </template>
    </a-alert>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import {
  LoadingOutlined,
  CheckCircleOutlined,
  DatabaseOutlined
} from '@ant-design/icons-vue'
import { dataPreloadService } from '@/services/dataPreloadService'

// 状态
const showStatus = ref(false)
const showSuccessMessage = ref(false)
const showCacheInfo = ref(false)
const preloadStatus = ref({
  isPreloading: false,
  progress: { current: 0, total: 0 },
  lastPreloadDate: null
})
const lastSyncTime = ref('')

// 用户手动关闭状态跟踪（持久化存储）
const userDismissedSuccess = ref(false)
const userDismissedCache = ref(false)

// 从localStorage恢复用户关闭状态
const loadDismissedStates = () => {
  try {
    userDismissedSuccess.value = localStorage.getItem('dataSyncSuccessDismissed') === 'true'
    userDismissedCache.value = localStorage.getItem('dataSyncCacheDismissed') === 'true'
  } catch (error) {
    console.warn('无法从localStorage恢复关闭状态:', error)
  }
}

// 保存用户关闭状态到localStorage
const saveDismissedStates = () => {
  try {
    localStorage.setItem('dataSyncSuccessDismissed', userDismissedSuccess.value.toString())
    localStorage.setItem('dataSyncCacheDismissed', userDismissedCache.value.toString())
  } catch (error) {
    console.warn('无法保存关闭状态到localStorage:', error)
  }
}

// 定时器
let statusCheckTimer = null

// 生命周期
onMounted(() => {
  loadDismissedStates()
  startStatusCheck()
})

onUnmounted(() => {
  stopStatusCheck()
})

// 方法
const startStatusCheck = () => {
  // 立即检查一次状态
  checkStatus()
  
  // 每2秒检查一次状态
  statusCheckTimer = setInterval(() => {
    checkStatus()
  }, 2000)
}

const stopStatusCheck = () => {
  if (statusCheckTimer) {
    clearInterval(statusCheckTimer)
    statusCheckTimer = null
  }
}

// 成功消息隐藏定时器
let successMessageTimer = null

const checkStatus = () => {
  const status = dataPreloadService.getStatus()
  
  // 更新预加载状态
  preloadStatus.value = status
  
  // 显示状态
  if (status.isPreloading) {
    showStatus.value = true
    showSuccessMessage.value = false
    showCacheInfo.value = false
    // 重置用户关闭状态（预加载时重新显示）
    userDismissedSuccess.value = false
    userDismissedCache.value = false
    // 清除localStorage中的关闭状态
    try {
      localStorage.removeItem('dataSyncSuccessDismissed')
      localStorage.removeItem('dataSyncCacheDismissed')
    } catch (error) {
      console.warn('无法清除localStorage中的关闭状态:', error)
    }
    // 清除成功消息定时器
    if (successMessageTimer) {
      clearTimeout(successMessageTimer)
      successMessageTimer = null
    }
  } else if (status.lastPreloadDate) {
    // 预加载完成，显示成功消息（只显示一次，且用户未手动关闭）
    if (!showSuccessMessage.value && !showCacheInfo.value && !successMessageTimer && !userDismissedSuccess.value) {
      showStatus.value = true
      showSuccessMessage.value = true
      lastSyncTime.value = formatTime(status.lastPreloadDate)
      
      // 5秒后自动隐藏成功消息（只设置一次）
      successMessageTimer = setTimeout(() => {
        hideSuccessMessage()
        successMessageTimer = null
      }, 5000)
    }
  }
}

const hidePreloadStatus = () => {
  showStatus.value = false
}

const hideSuccessMessage = () => {
  showSuccessMessage.value = false
  // 标记用户手动关闭了成功消息
  userDismissedSuccess.value = true
  // 保存到localStorage
  saveDismissedStates()
  // 清除定时器
  if (successMessageTimer) {
    clearTimeout(successMessageTimer)
    successMessageTimer = null
  }
  if (!preloadStatus.value.isPreloading) {
    showStatus.value = false
  }
}

const hideCacheInfo = () => {
  showCacheInfo.value = false
  // 标记用户手动关闭了缓存信息
  userDismissedCache.value = true
  // 保存到localStorage
  saveDismissedStates()
  if (!preloadStatus.value.isPreloading) {
    showStatus.value = false
  }
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / (1000 * 60))
  
  if (diffMins < 1) {
    return '刚刚'
  } else if (diffMins < 60) {
    return `${diffMins}分钟前`
  } else if (diffMins < 1440) {
    return `${Math.floor(diffMins / 60)}小时前`
  } else {
    return date.toLocaleDateString()
  }
}

// 暴露方法给父组件
const showCacheStatus = (message) => {
  // 如果用户已经手动关闭了缓存信息，则不显示
  if (userDismissedCache.value) {
    return
  }
  showStatus.value = true
  showCacheInfo.value = true
  lastSyncTime.value = message
}

defineExpose({
  showCacheStatus
})
</script>

<style scoped lang="less">
.data-sync-status {
  position: fixed;
  top: 80px;
  right: 24px;
  z-index: 1000;
  max-width: 400px;
  
  .sync-alert {
    margin-bottom: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

// 响应式设计
@media (max-width: 768px) {
  .data-sync-status {
    top: 70px;
    right: 16px;
    left: 16px;
    max-width: none;
  }
}

// 深色主题适配
@media (prefers-color-scheme: dark) {
  .data-sync-status {
    .sync-alert {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
  }
}
</style>
