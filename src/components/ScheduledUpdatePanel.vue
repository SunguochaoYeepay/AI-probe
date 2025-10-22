<template>
  <a-card title="定时更新管理" class="scheduled-update-panel">
    <template #extra>
      <a-space>
        <a-button 
          size="small" 
          :type="serviceStatus.isRunning ? 'danger' : 'primary'"
          @click="toggleService"
        >
          {{ serviceStatus.isRunning ? '停止服务' : '启动服务' }}
        </a-button>
        <a-button size="small" @click="manualUpdate" :loading="isUpdating">
          手动更新
        </a-button>
        <a-button size="small" @click="refreshStatus">
          <ReloadOutlined />
        </a-button>
      </a-space>
    </template>

    <!-- 服务状态 -->
    <a-descriptions :column="2" size="small" bordered>
      <a-descriptions-item label="服务状态">
        <a-tag :color="serviceStatus.isRunning ? 'green' : 'red'">
          {{ serviceStatus.isRunning ? '运行中' : '已停止' }}
        </a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="最后更新">
        {{ serviceStatus.lastUpdateTime ? formatTime(serviceStatus.lastUpdateTime) : '从未更新' }}
      </a-descriptions-item>
      <a-descriptions-item label="待处理任务">
        {{ serviceStatus.updateQueueSize }} 个
      </a-descriptions-item>
      <a-descriptions-item label="下次检查">
        {{ nextCheckTime }}
      </a-descriptions-item>
    </a-descriptions>

    <!-- 更新日志 -->
    <div class="update-logs" v-if="updateLogs.length > 0">
      <h4>更新日志</h4>
      <a-timeline>
        <a-timeline-item 
          v-for="log in updateLogs.slice(-10)" 
          :key="log.id"
          :color="log.type === 'success' ? 'green' : log.type === 'error' ? 'red' : 'blue'"
        >
          <template #dot>
            <ClockCircleOutlined v-if="log.type === 'info'" />
            <CheckCircleOutlined v-if="log.type === 'success'" />
            <CloseCircleOutlined v-if="log.type === 'error'" />
          </template>
          <div class="log-content">
            <div class="log-message">{{ log.message }}</div>
            <div class="log-time">{{ formatTime(log.timestamp) }}</div>
          </div>
        </a-timeline-item>
      </a-timeline>
    </div>

    <!-- 图表更新状态 -->
    <div class="chart-status" v-if="chartUpdateStatus.length > 0">
      <h4>图表更新状态</h4>
      <a-table 
        :columns="chartStatusColumns" 
        :data-source="chartUpdateStatus"
        :pagination="false"
        size="small"
        :scroll="{ y: 200 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
            </a-tag>
          </template>
          <template v-if="column.key === 'lastUpdate'">
            {{ record.lastUpdate ? formatTime(record.lastUpdate) : '从未更新' }}
          </template>
          <template v-if="column.key === 'pendingDays'">
            <a-tag v-if="record.pendingDays > 0" color="orange">
              {{ record.pendingDays }} 天待补充
            </a-tag>
            <a-tag v-else color="green">数据完整</a-tag>
          </template>
        </template>
      </a-table>
    </div>
  </a-card>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import { 
  ReloadOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined 
} from '@ant-design/icons-vue'
import { scheduledUpdateService } from '@/services/scheduledUpdateService'
import { chartDB } from '@/utils/indexedDBManager'
import dayjs from 'dayjs'

// 响应式数据
const serviceStatus = ref({
  isRunning: false,
  lastUpdateTime: null,
  updateQueueSize: 0
})

const isUpdating = ref(false)
const updateLogs = ref([])
const chartUpdateStatus = ref([])

// 计算属性
const nextCheckTime = computed(() => {
  if (!serviceStatus.value.isRunning) {
    return '服务未运行'
  }
  // 假设每小时检查一次，计算下次检查时间
  const now = dayjs()
  const nextHour = now.add(1, 'hour').startOf('hour')
  return nextHour.format('HH:mm')
})

// 表格列配置
const chartStatusColumns = [
  {
    title: '图表名称',
    dataIndex: 'name',
    key: 'name',
    width: 200
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100
  },
  {
    title: '最后更新',
    dataIndex: 'lastUpdate',
    key: 'lastUpdate',
    width: 150
  },
  {
    title: '待补充数据',
    dataIndex: 'pendingDays',
    key: 'pendingDays',
    width: 120
  }
]

// 方法
const refreshStatus = async () => {
  try {
    serviceStatus.value = scheduledUpdateService.getStatus()
    await loadChartUpdateStatus()
    addLog('info', '状态已刷新')
  } catch (error) {
    console.error('刷新状态失败:', error)
    addLog('error', '刷新状态失败: ' + error.message)
  }
}

const toggleService = () => {
  if (serviceStatus.value.isRunning) {
    scheduledUpdateService.stop()
    addLog('info', '定时更新服务已停止')
  } else {
    scheduledUpdateService.start()
    addLog('info', '定时更新服务已启动')
  }
  refreshStatus()
}

const manualUpdate = async () => {
  if (isUpdating.value) return
  
  try {
    isUpdating.value = true
    addLog('info', '开始手动更新...')
    
    await scheduledUpdateService.manualUpdate()
    
    addLog('success', '手动更新完成')
    await refreshStatus()
    
  } catch (error) {
    console.error('手动更新失败:', error)
    addLog('error', '手动更新失败: ' + error.message)
  } finally {
    isUpdating.value = false
  }
}

const loadChartUpdateStatus = async () => {
  try {
    const charts = await chartDB.getAllCharts({ status: 'active' })
    const status = []
    
    for (const chart of charts) {
      const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
      const today = dayjs().format('YYYY-MM-DD')
      const hasYesterdayData = await chartDB.hasChartData(chart.id, yesterday)
      const hasTodayData = await chartDB.hasChartData(chart.id, today)
      
      // 如果昨天或今天的数据缺失，标记为需要更新
      const needsUpdate = !hasYesterdayData || !hasTodayData
      
      status.push({
        id: chart.id,
        name: chart.name,
        status: needsUpdate ? 'needs_update' : 'up_to_date',
        lastUpdate: chart.dataRange?.lastDataUpdate,
        pendingDays: chart.dataRange?.pendingDays || 0
      })
    }
    
    chartUpdateStatus.value = status
  } catch (error) {
    console.error('加载图表状态失败:', error)
  }
}

const addLog = (type, message) => {
  updateLogs.value.push({
    id: Date.now(),
    type,
    message,
    timestamp: new Date().toISOString()
  })
  
  // 限制日志数量
  if (updateLogs.value.length > 50) {
    updateLogs.value = updateLogs.value.slice(-50)
  }
}

const formatTime = (timeStr) => {
  return dayjs(timeStr).format('MM-DD HH:mm:ss')
}

const getStatusColor = (status) => {
  const colors = {
    'up_to_date': 'green',
    'needs_update': 'orange',
    'error': 'red'
  }
  return colors[status] || 'default'
}

const getStatusText = (status) => {
  const texts = {
    'up_to_date': '最新',
    'needs_update': '需更新',
    'error': '错误'
  }
  return texts[status] || status
}

// 生命周期
onMounted(() => {
  refreshStatus()
  
  // 定期刷新状态
  const refreshInterval = setInterval(refreshStatus, 30000) // 30秒
  
  onUnmounted(() => {
    clearInterval(refreshInterval)
  })
})
</script>

<style scoped>
.scheduled-update-panel {
  margin-bottom: 24px;
}

.update-logs {
  margin-top: 24px;
}

.update-logs h4 {
  margin-bottom: 16px;
  color: #333;
}

.log-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.log-message {
  flex: 1;
}

.log-time {
  color: #999;
  font-size: 12px;
  margin-left: 16px;
}

.chart-status {
  margin-top: 24px;
}

.chart-status h4 {
  margin-bottom: 16px;
  color: #333;
}
</style>
