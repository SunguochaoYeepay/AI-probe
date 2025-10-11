<template>
  <a-card class="chart-card" :bordered="false">
    <template #title>
      <span>分析结果</span>
    </template>
    <template #extra>
      <div v-if="hasChart" class="chart-actions">
        <a-button size="small" @click="regenerateChart">
          <ReloadOutlined />
          重新生成
        </a-button>
        <a-button size="small" @click="exportChart">
          <DownloadOutlined />
          导出图表
        </a-button>
        <a-button size="small" @click="saveConfig">
          <SaveOutlined />
          保存配置
        </a-button>
      </div>
    </template>
    
    <div class="chart-container">
      <div v-if="!hasChart" class="empty-chart">
        <a-empty description="暂无图表数据，请先描述分析需求" />
      </div>
      <div v-else id="chart-container" class="chart-content"></div>
    </div>
  </a-card>
</template>

<script setup>
import { ReloadOutlined, DownloadOutlined, SaveOutlined } from '@ant-design/icons-vue'

// Props
const props = defineProps({
  hasChart: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits([
  'regenerate-chart',
  'export-chart',
  'save-config'
])

// Methods
const regenerateChart = () => {
  emit('regenerate-chart')
}

const exportChart = () => {
  emit('export-chart')
}

const saveConfig = () => {
  emit('save-config')
}
</script>

<style scoped>
.chart-card {
  margin-bottom: 24px;
}

.chart-container {
  min-height: 400px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fff;
}

.empty-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
}

.chart-content {
  width: 100%;
  height: 400px;
}

.chart-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
