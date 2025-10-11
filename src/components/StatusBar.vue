<template>
  <a-card class="status-card" :bordered="false">
    <div class="status-bar">
      <div class="status-item analysis-mode-item">
        <BarChartOutlined />
        <a-radio-group v-model:value="analysisMode" size="small" style="margin-right: 8px;">
          <a-radio-button value="single">单埋点</a-radio-button>
          <a-radio-button value="dual">双埋点</a-radio-button>
        </a-radio-group>
      </div>
      <div class="status-item date-picker-item">
        <CalendarOutlined />
        <span style="margin-right: 8px; font-size: 12px; color: #666;">日期范围：</span>
        <a-range-picker
          v-model:value="dateRange"
          style="width: 250px;"
          size="small"
          :disabled-date="disabledDate"
          @change="onDateRangeChange"
        />
      </div>
      <div class="status-actions">
        <a-button type="primary" size="small" @click="refreshData">
          <ReloadOutlined />
          数据刷新
        </a-button>
        <a-button size="small" @click="showConfigModal">
          <SettingOutlined />
          配置管理
        </a-button>
      </div>
    </div>
  </a-card>
</template>

<script setup>
import { computed } from 'vue'
import { BarChartOutlined, CalendarOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons-vue'

// Props
const props = defineProps({
  analysisMode: {
    type: String,
    default: 'single'
  },
  dateRange: {
    type: Array,
    default: () => []
  }
})

// Emits
const emit = defineEmits([
  'update:analysisMode',
  'update:dateRange',
  'date-range-change',
  'refresh-data',
  'show-config-modal'
])

// Computed
const analysisMode = computed({
  get: () => props.analysisMode,
  set: (value) => emit('update:analysisMode', value)
})

const dateRange = computed({
  get: () => props.dateRange,
  set: (value) => emit('update:dateRange', value)
})

// Methods
const disabledDate = (current) => {
  if (!dateRange.value || dateRange.value.length === 0) {
    return false
  }
  
  const [start] = dateRange.value
  if (!start) {
    return false
  }
  
  const tooLate = start && current.diff(start, 'days') > 30
  const tooEarly = start && start.diff(current, 'days') > 30
  return tooEarly || tooLate
}

const onDateRangeChange = (dates, dateStrings) => {
  emit('date-range-change', dates, dateStrings)
}

const refreshData = () => {
  emit('refresh-data')
}

const showConfigModal = () => {
  emit('show-config-modal')
}
</script>

<style scoped>
.status-card {
  margin-bottom: 24px;
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
}

.date-picker-item {
  flex-wrap: nowrap;
  white-space: nowrap;
}

.status-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 768px) {
  .status-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .status-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
