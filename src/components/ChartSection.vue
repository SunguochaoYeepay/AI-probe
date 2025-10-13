<template>
  <div class="chart-section">
    <!-- 操作按钮区域 -->
    <div v-if="hasChart" class="chart-actions">
      <a-button size="small" @click="regenerateChart">
        <ReloadOutlined />
        重新生成
      </a-button>
      <a-button size="small" @click="exportChart">
        <DownloadOutlined />
        导出图表
      </a-button>
      <a-button size="small" type="primary" @click="saveChart">
        <SaveOutlined />
        保存图表
      </a-button>
    </div>
    
    <div class="chart-container">
      <!-- 生成中状态 -->
      <div v-if="isGenerating" class="generating-chart">
        <a-spin size="large" :tip="generationTip">
          <div class="generating-content">
            <div class="generating-icon">
              <BarChartOutlined />
            </div>
            <div class="generating-text">
              <h3>正在生成图表</h3>
              <p>{{ generationStep }}</p>
            </div>
          </div>
        </a-spin>
      </div>
      
      <!-- 空状态 -->
      <div v-else-if="!hasChart" class="empty-chart">
        <a-empty description="暂无图表数据，请先描述分析需求" />
      </div>
      
      <!-- 有图表时的内容 -->
      <div v-else>
        <a-card class="chart-card" :bordered="true">
          <!-- 图表标题和视图切换 -->
          <div class="chart-header">
            <div class="chart-title">
              <h3>{{ chartTitle }}</h3>
            </div>
            <div class="view-switcher">
              <!-- 视图切换按钮 -->
              <a-radio-group v-model:value="viewMode" size="small" button-style="solid">
                <a-radio-button value="chart">
                  <BarChartOutlined />
                  图表
                </a-radio-button>
                <a-radio-button value="table">
                  <TableOutlined />
                  表格
                </a-radio-button>
              </a-radio-group>
            </div>
          </div>
          
          <!-- 图表视图 -->
          <div v-if="viewMode === 'chart'" id="chart-container" class="chart-content"></div>
          
          <!-- 表格视图 -->
          <div v-else-if="viewMode === 'table'" class="table-content">
            <a-table
              :columns="tableColumns"
              :data-source="tableData"
              :pagination="paginationConfig"
              size="small"
              :scroll="{ x: 800 }"
              bordered
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'date'">
                  {{ formatDate(record.date) }}
                </template>
                <template v-else-if="column.dataIndex === 'pv'">
                  <a-tag color="blue">{{ record.pv }}</a-tag>
                </template>
                <template v-else-if="column.dataIndex === 'uv'">
                  <a-tag color="green">{{ record.uv }}</a-tag>
                </template>
              </template>
            </a-table>
          </div>
        </a-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ReloadOutlined, DownloadOutlined, SaveOutlined, BarChartOutlined, TableOutlined } from '@ant-design/icons-vue'
import { useStore } from 'vuex'
import dayjs from 'dayjs'

// Store
const store = useStore()

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
  'save-chart'
])

// 视图模式
const viewMode = ref('chart')

// 生成状态
const isGenerating = computed(() => store.state.chartGeneration.isGenerating)
const generationStep = computed(() => store.state.chartGeneration.currentStep || '正在分析数据...')
const generationTip = computed(() => {
  const step = store.state.chartGeneration.currentStep
  return step || '正在生成图表，请稍候...'
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
      // 如果有页面名称，显示"分析XXX页面"
      const pageName = analysis.parameters?.pageName
      if (pageName) {
        return `分析${pageName}页面`
      }
      return '页面访问量分析'
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

// 表格配置
const tableColumns = computed(() => {
  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      fixed: 'left'
    }
  ]
  
  // 根据分析结果动态添加列
  const chartConfig = store.state.chartConfig
  if (chartConfig && chartConfig.analysis) {
    const config = chartConfig.analysis
    
    // 如果是UV/PV图表，添加UV和PV列
    if (config.chartType === 'uv_pv_chart' || config.chartType === 'single_page_uv_pv_chart') {
      columns.push(
        {
          title: 'PV',
          dataIndex: 'pv',
          key: 'pv',
          width: 100,
          align: 'right'
        },
        {
          title: 'UV',
          dataIndex: 'uv',
          key: 'uv',
          width: 100,
          align: 'right'
        }
      )
    }
    
    // 如果是单页面分析，添加页面名称列
    if (config.chartType === 'single_page_uv_pv_chart' && config.pageName) {
      columns.splice(1, 0, {
        title: '页面',
        dataIndex: 'pageName',
        key: 'pageName',
        width: 200
      })
    }
  }
  
  return columns
})

// 表格数据
const tableData = computed(() => {
  const chartConfig = store.state.chartConfig
  console.log('🔍 表格数据计算 - chartConfig:', chartConfig)
  
  if (!chartConfig || !chartConfig.analysis) {
    console.log('❌ 表格数据为空 - 缺少chartConfig或analysis')
    return []
  }
  
  const config = chartConfig.analysis
  const rawData = chartConfig.data || []
  
  console.log('📊 表格数据处理 - config:', config, 'rawData type:', typeof rawData, 'isArray:', Array.isArray(rawData))
  
  // 根据图表类型处理数据
  if (config.chartType === 'uv_pv_chart' || config.chartType === 'single_page_uv_pv_chart') {
    // 安全地处理数据样本
    if (Array.isArray(rawData)) {
      console.log('🔍 原始数据样本 (数组):', rawData.slice(0, 3))
      console.log('🔍 数据字段:', rawData.length > 0 ? Object.keys(rawData[0]) : [])
    } else if (rawData && typeof rawData === 'object') {
      console.log('🔍 原始数据样本 (对象):', rawData)
    } else {
      console.log('🔍 原始数据样本 (其他):', rawData)
    }
    
    // 检查数据格式：如果是图表生成器处理后的格式
    if (rawData && typeof rawData === 'object' && rawData.hasOwnProperty('categories')) {
      // 这是图表生成器返回的格式：{categories, uvData, pvData}
      console.log('📊 检测到图表生成器格式数据')
      const processedData = rawData.categories.map((date, index) => ({
        key: index,
        date: date,
        pv: rawData.pvData[index] || 0,
        uv: rawData.uvData[index] || 0,
        pageName: config.pageName
      }))
      console.log('✅ 图表生成器格式数据处理完成:', processedData.length, '条')
      console.log('📊 处理后的数据样本:', processedData.slice(0, 3))
      return processedData
    } else {
      // 这是原始数据格式
      console.log('📊 检测到原始数据格式')
      if (!Array.isArray(rawData)) {
        console.log('❌ 原始数据不是数组，无法处理:', rawData)
        return []
      }
      const processedData = rawData.map((item, index) => {
        console.log(`🔍 处理第${index}条数据:`, item)
        
        const result = {
          key: index,
          date: item.date || item.name || item.category || '-',
          pv: item.pv || item.value || item.pvData || 0,
          uv: item.uv || item.value2 || item.uvData || 0,
          pageName: config.pageName || item.pageName
        }
        
        console.log(`✅ 处理结果:`, result)
        return result
      })
      
      console.log('✅ 原始数据格式处理完成:', processedData.length, '条')
      return processedData
    }
  }
  
  // 其他图表类型的通用处理
  const processedData = data.map((item, index) => ({
    key: index,
    date: item.date || item.name,
    value: item.value || 0,
    ...item
  }))
  console.log('✅ 通用表格数据处理完成:', processedData.length, '条')
  return processedData
})

// 分页配置
const paginationConfig = computed(() => {
  return {
    pageSize: 10,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
  }
})

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return dayjs(dateStr).format('YYYY-MM-DD')
}

// 监听图表配置变化，重置视图模式
watch(() => store.state.chartConfig, () => {
  viewMode.value = 'chart'
}, { deep: true })

// Methods
const regenerateChart = () => {
  emit('regenerate-chart')
}

const exportChart = () => {
  emit('export-chart')
}

const saveChart = () => {
  emit('save-chart')
}
</script>

<style scoped>
.chart-section {
  width: 100%;
}

.chart-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 16px;
}

.chart-container {
  min-height: 400px;
}

.chart-card {
  margin-bottom: 24px;
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

.table-content {
  width: 100%;
  min-height: 400px;
  padding: 16px;
}

.chart-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .chart-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .chart-actions .ant-radio-group {
    width: 100%;
  }
  
  .chart-actions .ant-radio-button-wrapper {
    flex: 1;
    text-align: center;
  }
}

/* 表格样式优化 */
.table-content :deep(.ant-table-thead > tr > th) {
  background-color: #fafafa;
  font-weight: 600;
}

.table-content :deep(.ant-table-tbody > tr:hover > td) {
  background-color: #f5f5f5;
}

.table-content :deep(.ant-tag) {
  margin: 0;
  border-radius: 4px;
}

/* 图表头部 */
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.chart-title {
  flex: 1;
}

.chart-title h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #262626;
  line-height: 1.4;
}

.view-switcher {
  flex-shrink: 0;
}

/* 生成中状态样式 */
.generating-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
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
