<template>
  <a-card 
    class="chart-card" 
    :bordered="true" 
    :title="hasChart ? chartTitle : '图表分析'"
  >
    <template #extra>
      <a-space>
        <!-- 时间选择器 -->
        <a-radio-group 
          v-if="hasChart && showTimeRangeSelector" 
          v-model:value="selectedTimeRange" 
          size="small"
          @change="onTimeRangeChange"
          class="time-range-selector"
        >
          <a-radio-button value="7">7天</a-radio-button>
          <a-radio-button value="30">近30天</a-radio-button>
          <a-radio-button value="60">近60天</a-radio-button>
        </a-radio-group>
        
        <!-- 编辑漏斗配置按钮 -->
        <a-button 
          v-if="hasChart && isFunnelChart" 
          size="small" 
          @click="editFunnelConfig"
        >
          <EditOutlined />
          编辑配置
        </a-button>
        
        <!-- 保存图表按钮 -->
        <a-button v-if="hasChart" size="small" type="primary" @click="() => { console.log('🟦 [ChartSection] 点击保存图表按钮'); saveChart(); }">
          <SaveOutlined />
          保存图表
        </a-button>
      </a-space>
    </template>
    
    <!-- 生成中状态 -->
    <div v-if="isGenerating" class="generating-chart">
      <a-spin size="large" :tip="generationTip">
        <div class="generating-content">
          <div class="generating-icon">
            <BarChartOutlined />
          </div>
          <div class="generating-text">
            <h3>正在生成图表</h3>
          </div>
        </div>
      </a-spin>
    </div>
    
    <!-- 空状态 -->
    <div v-else-if="!hasChart" class="empty-chart">
      <a-empty description="暂无图表数据，请先描述分析需求" />
    </div>
    
    <!-- 图表视图 -->
    <div v-else-if="hasChart" id="chart-container" class="chart-content">
    </div>
  </a-card>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { SaveOutlined, BarChartOutlined, EditOutlined } from '@ant-design/icons-vue'
import { useStore } from 'vuex'
import dayjs from 'dayjs'

// Store
const store = useStore()

// Props
const props = defineProps({
  hasChart: {
    type: Boolean,
    default: false
  },
  showTimeRangeSelector: {
    type: Boolean,
    default: true // 默认显示时间选择器
  }
})

// Emits
const emit = defineEmits([
  'save-chart',
  'time-range-change',
  'edit-funnel-config'
])

// 时间范围选择
const selectedTimeRange = ref('7') // 默认7天


// 调试：监听hasChart变化
watch(() => props.hasChart, (newVal) => {
  console.log('🔍 ChartSection hasChart变化:', newVal)
}, { immediate: true })

// 调试：监听chartConfig变化
watch(() => store.state.chartConfig, (newVal) => {
  console.log('🔍 ChartSection chartConfig变化:', newVal)
  if (newVal) {
    console.log('📊 图表配置详情:', {
      hasAnalysis: !!newVal.analysis,
      hasData: !!newVal.data,
      dataLength: newVal.data?.length || 0,
      chartType: newVal.analysis?.chartType,
      timestamp: newVal.timestamp
    })
  }
}, { immediate: true })

// 监听hasChart变化，确保图表容器渲染后生成图表
watch(() => props.hasChart, (newVal) => {
  if (newVal) {
    console.log('🔍 hasChart变为true，检查图表容器')
    // 延迟检查，确保DOM已渲染
    nextTick(() => {
      setTimeout(() => {
        const container = document.getElementById('chart-container')
        if (container) {
          console.log('✅ 图表容器已渲染，图表应该已经生成')
        } else {
          console.log('⚠️ 图表容器仍未找到')
        }
      }, 100)
    })
  }
}, { immediate: true })


// 生成状态
const isGenerating = computed(() => store.state.chartGeneration.isGenerating)
const generationStep = computed(() => store.state.chartGeneration.currentStep || '正在分析数据...')
const generationTip = computed(() => {
  const step = store.state.chartGeneration.currentStep
  return step || '正在生成图表，请稍候...'
})

// 判断是否为漏斗图
const isFunnelChart = computed(() => {
  const chartConfig = store.state.chartConfig
  if (!chartConfig || !chartConfig.analysis) {
    return false
  }
  
  const analysis = chartConfig.analysis
  return analysis.chartType === 'behavior_funnel' || analysis.intent === 'behavior_funnel'
})

// 图表标题
const chartTitle = computed(() => {
  const chartConfig = store.state.chartConfig
  if (!chartConfig || !chartConfig.analysis) {
    return '图表'
  }
  
  const analysis = chartConfig.analysis
  
  // 如果是单页面分析，提取页面名称
  if (analysis.intent === 'single_page_uv_pv_analysis' && analysis.pageName) {
    return `${analysis.pageName}访问量`
  }
  
  // 如果是整站分析
  if (analysis.intent === 'uv_pv_analysis') {
    return '整站UV/PV趋势'
  }
  
  // 根据图表类型生成标题
  switch (analysis.chartType) {
    case 'single_page_uv_pv_chart':
      // 如果有页面名称，显示"XXX页面访问量"
      const pageName = analysis.parameters?.pageName
      if (pageName) {
        return `${pageName}页面访问量`
      }
      return '页面访问量分析'
    case 'button_click_analysis':
      // 按钮点击分析 - 显示页面和按钮名称
      if (analysis.pageName && analysis.buttonName) {
        return `"${analysis.pageName}" 的 "${analysis.buttonName}" 按钮点击分析`
      } else if (analysis.pageName) {
        return `"${analysis.pageName}" 页面按钮点击分析`
      }
      return '按钮点击分析'
    case 'button_click_daily':
      // 按钮点击按天分析
      if (analysis.pageName && analysis.buttonName) {
        return `"${analysis.pageName}" 的 "${analysis.buttonName}" 按钮按天分析`
      } else if (analysis.pageName) {
        return `"${analysis.pageName}" 页面按钮按天分析`
      }
      return '按钮点击按天分析'
    case 'uv_pv_chart':
      return 'UV/PV分析'
    case 'line':
      return '趋势分析'
    case 'bar':
      return '柱状图分析'
    case 'pie':
      return '分布分析'
    default:
      return analysis.description || '图表分析'
  }
})




// Methods
const saveChart = () => {
  // 调试：确保按钮点击事件已触发
  console.log('🟦 [ChartSection] 保存图表按钮被点击')
  // 1) 向父组件派发
  emit('save-chart')
}

// 时间范围变化处理
// 编辑漏斗配置
const editFunnelConfig = () => {
  
  // 向父组件发送编辑漏斗配置事件
  emit('edit-funnel-config')
}

const onTimeRangeChange = (e) => {
  const newTimeRange = e.target.value
  console.log('🕒 [ChartSection] 时间范围变化:', newTimeRange)
  
  // 向父组件发送时间范围变化事件
  emit('time-range-change', {
    days: parseInt(newTimeRange),
    timeRange: newTimeRange
  })
}
</script>

<style scoped>
.chart-card {
  width: 100%;
  /* 确保卡片有足够的高度 */
  min-height:100vh;
}

/* 卡片标题栏样式优化 */
.chart-card :deep(.ant-card-head) {
  border-bottom: 1px solid #f0f0f0;
  padding: 0 24px;
  min-height: 56px;
}

.chart-card :deep(.ant-card-head-title) {
  font-size: 16px;
  font-weight: 600;
  color: #262626;
}

.chart-card :deep(.ant-card-extra) {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 时间选择器样式 */
.time-range-selector {
  margin-right: 8px;
}

.time-range-selector :deep(.ant-radio-button-wrapper) {
  font-size: 12px;
  padding: 2px 8px;
  height: 24px;
  line-height: 20px;
}

/* 卡片内容区域样式 */
.chart-card :deep(.ant-card-body) {
  padding: 0;
  height: calc(100% - 56px);
  display: flex;
  flex-direction: column;
}

.empty-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height:100vh;
}

.chart-content {
  width: 100%;
  height: 100%;
  min-height: 600px;
  flex: 1;
  /* 确保图表容器有足够的空间 */
  overflow: hidden;
}


/* 响应式设计 */
@media (max-width: 768px) {
  .chart-card {
    min-height: 600px;
  }
  
  .chart-card :deep(.ant-card-head) {
    padding: 0 16px;
    min-height: 48px;
  }
  
  .chart-card :deep(.ant-card-body) {
    height: calc(100% - 48px);
  }
  
  .chart-content {
    min-height: 500px;
  }
  
  
  .empty-chart {
    min-height: 100vh;
  }
}



/* 生成中状态样式 */
.generating-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  background: #fafafa;
  border-radius: 8px;
}

.generating-content {
  text-align: center;
  padding: 20px;
}

.generating-icon {
  font-size: 48px;
  color: #1890ff;
  margin-bottom: 16px;
}

.generating-text h3 {
  margin: 0 0 8px 0;
  color: #262626;
  font-size: 18px;
  font-weight: 600;
}

.generating-text p {
  margin: 0;
  color: #8c8c8c;
  font-size: 14px;
}
</style>
