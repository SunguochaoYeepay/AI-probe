<template>
  <AppLayout 
    page-title="图表详情"
    current-page="chart-detail"
    @menu-click="handleMenuClick"
  >
    <template #header-actions>
      <a-button @click="goBack" type="text">
        <ArrowLeftOutlined /> 返回
      </a-button>
      <a-button @click="refreshData" :loading="refreshing">
        <ReloadOutlined /> 刷新数据
      </a-button>
      <a-button @click="exportChart">
        <DownloadOutlined /> 导出
      </a-button>
      <a-button danger @click="confirmDelete">
        <DeleteOutlined /> 删除
      </a-button>
    </template>
    
    <div class="chart-detail">
    <a-spin :spinning="loading" tip="加载中...">

      <!-- 信息栏 -->
      <a-card class="info-card" :bordered="false">
        <a-row :gutter="24">
          <a-col :span="12">
            <a-descriptions :column="2" size="small">
              <a-descriptions-item label="分类">
                <a-tag :color="getCategoryColor(chart?.category)">
                  {{ chart?.category }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="状态">
                <a-tag :color="chart?.status === 'active' ? 'green' : 'default'">
                  {{ getStatusText(chart?.status) }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="图表类型">
                {{ getChartTypeName(chart?.config.chartType) }}
              </a-descriptions-item>
              <a-descriptions-item label="分析指标">
                <a-tag v-for="metric in chart?.config.metrics" :key="metric" size="small">
                  {{ getMetricText(metric) }}
                </a-tag>
              </a-descriptions-item>
            </a-descriptions>
          </a-col>
          <a-col :span="12">
            <a-descriptions :column="2" size="small">
              <a-descriptions-item label="创建时间">
                {{ formatDateTime(chart?.createdAt) }}
              </a-descriptions-item>
              <a-descriptions-item label="最后更新">
                <span v-if="chart?.lastDataUpdate">
                  {{ formatDateTime(chart?.lastDataUpdate) }}
                </span>
                <span v-else class="text-warning">待更新</span>
              </a-descriptions-item>
              <a-descriptions-item label="数据范围">
                {{ chart?.config.dateRangeStrategy }}
              </a-descriptions-item>
              <a-descriptions-item label="数据条数">
                <a-statistic 
                  :value="chartData.length" 
                  suffix="条"
                  :value-style="{ fontSize: '14px' }"
                />
              </a-descriptions-item>
            </a-descriptions>
          </a-col>
        </a-row>
        
        <a-alert
          v-if="needUpdate"
          type="warning"
          message="有新数据可更新"
          show-icon
          closable
          style="margin-top: 12px"
        >
          <template #description>
            昨天的数据尚未更新，
            <a @click="updateNow">点击立即更新</a>
          </template>
        </a-alert>
      </a-card>

      <!-- 图表区域 -->
      <a-card class="chart-card" :bordered="false" title="数据可视化">
        <div id="chart-detail-container" class="chart-container"></div>
      </a-card>

      <!-- 关键指标 -->
      <a-card class="metrics-card" :bordered="false" title="关键指标">
        <a-row :gutter="16">
          <a-col :span="6" v-for="(value, key) in keyMetrics" :key="key">
            <a-statistic
              :title="getMetricText(key)"
              :value="value"
              :precision="key.includes('rate') ? 2 : 0"
              :suffix="key.includes('rate') ? '%' : ''"
            />
          </a-col>
        </a-row>
      </a-card>

      <!-- 数据表格（可选） -->
      <a-card class="data-table-card" :bordered="false">
        <template #title>
          <span>数据明细</span>
        </template>
        <template #extra>
          <a-button size="small" @click="exportData">
            <DownloadOutlined /> 导出CSV
          </a-button>
        </template>
        
        <a-table
          :columns="tableColumns"
          :data-source="chartData"
          :pagination="{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }"
          size="small"
          :scroll="{ x: 800 }"
        />
      </a-card>
    </a-spin>

    <!-- 删除确认对话框 -->
    <a-modal
      v-model:open="deleteModal"
      title="确认删除"
      @ok="handleDelete"
    >
      <p>确定要删除图表"{{ chart?.name }}"吗？</p>
      <p class="text-danger">此操作将同时删除该图表的所有历史数据，且不可恢复。</p>
    </a-modal>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  DownloadOutlined,
  DeleteOutlined
} from '@ant-design/icons-vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { useChartManager } from '@/composables/useChartManager'
import AppLayout from '@/components/AppLayout.vue'
import { ChartGenerator } from '@/utils/chartGenerator'
import { chartDB } from '@/utils/indexedDBManager'

const router = useRouter()
const route = useRoute()

const {
  getChartData,
  updateSingleChart,
  deleteChart
} = useChartManager()

// 状态
const loading = ref(false)
const refreshing = ref(false)
const chart = ref(null)
const chartData = ref([])
const dateRange = ref(null)
const chartInstance = ref(null)
const deleteModal = ref(false)

// 计算属性
const needUpdate = computed(() => {
  if (!chart.value) return false
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
  return chart.value.lastDataUpdate < yesterday
})

const keyMetrics = computed(() => {
  if (!chartData.value || chartData.value.length === 0) {
    return {}
  }
  
  // 计算最新一天的指标
  const latestData = chartData.value[chartData.value.length - 1]
  return latestData.metrics || {}
})

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
  
  // 根据指标添加列
  if (chart.value?.config.metrics) {
    chart.value.config.metrics.forEach(metric => {
      columns.push({
        title: getMetricText(metric),
        dataIndex: ['metrics', metric],
        key: metric,
        width: 100,
        align: 'right'
      })
    })
  }
  
  return columns
})

// 方法
const loadData = async () => {
  try {
    loading.value = true
    
    // 等待数据库初始化完成
    await waitForDatabaseInit()
    
    const result = await getChartData(route.params.id)
    
    chart.value = result.chart
    chartData.value = result.data
    dateRange.value = result.dateRange
    
    console.log('✅ 加载图表数据:', {
      chart: chart.value.name,
      dataCount: chartData.value.length
    })
    
    // 渲染图表
    await renderChart()
    
  } catch (error) {
    console.error('加载图表数据失败:', error)
    message.error('加载图表数据失败')
  } finally {
    loading.value = false
  }
}

// 等待数据库初始化完成
const waitForDatabaseInit = async () => {
  const maxRetries = 10
  const retryDelay = 100
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 尝试访问数据库，如果成功则说明已初始化
      await chartDB.getStats()
      return
    } catch (error) {
      if (error.message.includes('数据库未初始化')) {
        // 数据库未初始化，等待后重试
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        continue
      } else {
        // 其他错误，直接抛出
        throw error
      }
    }
  }
  
  throw new Error('数据库初始化超时')
}

const renderChart = async () => {
  // 等待DOM更新
  await new Promise(resolve => setTimeout(resolve, 100))
  
  const container = document.getElementById('chart-detail-container')
  if (!container) {
    console.error('图表容器未找到')
    return
  }
  
  // 销毁旧图表
  if (chartInstance.value) {
    chartInstance.value.dispose()
  }
  
  // 初始化新图表，配置passive事件监听器
  chartInstance.value = echarts.init(container, null, {
    renderer: 'canvas',
    useDirtyRect: false
  })
  
  // 生成配置
  const chartGenerator = new ChartGenerator()
  chartGenerator.chart = chartInstance.value
  
  // 准备数据（转换格式）
  const transformedData = transformChartData(chartData.value, chart.value.config)
  
  console.log('🎯 准备渲染图表:', {
    chartType: chart.value.config.chartType,
    originalDataCount: chartData.value.length,
    transformedDataCount: transformedData.length,
    transformedData: transformedData
  })
  
  // 生成图表配置
  const option = chartGenerator.generateOption(
    {
      chartType: chart.value.config.chartType,
      intent: chart.value.config.metrics,
      dateRange: `${dateRange.value.startDate} 至 ${dateRange.value.endDate}`
    },
    transformedData
  )
  
  console.log('📊 生成的图表配置:', option)
  
  chartInstance.value.setOption(option)
  
  // 响应式
  window.addEventListener('resize', handleResize)
}

const transformChartData = (data, config) => {
  // 根据图表类型转换数据格式，使其兼容现有的ChartGenerator
  const transformed = []
  
  console.log('🔄 转换图表数据:', { 
    dataCount: data.length, 
    config: config,
    sampleData: data.slice(0, 2) // 显示前两条数据作为样本
  })
  
  data.forEach((item, index) => {
    console.log(`📊 处理数据项 ${index}:`, item)
    
    // 从数据库加载的数据格式：{ date, metrics, dimensions, metadata }
    const { date, metrics, dimensions } = item
    
    // 如果有维度数据（如按页面分组），展开为多条记录
    if (dimensions && dimensions.byPage) {
      dimensions.byPage.forEach(page => {
        transformed.push({
          createdAt: date,
          pageName: page.page,
          weCustomerKey: `dummy_${page.uv}`, // 模拟用户ID
          ...metrics,
          ...page
        })
      })
    } else {
      // 否则直接使用指标数据
      const transformedItem = {
        createdAt: date
      }
      
      // 如果是UV/PV图表，确保有正确的字段名
      if (config.chartType === 'single_page_uv_pv_chart' || config.chartType === 'uv_pv_chart') {
        // 检查metrics中是否有uv和pv字段
        if (metrics && typeof metrics === 'object') {
          transformedItem.uv = metrics.uv || 0
          transformedItem.pv = metrics.pv || 0
          
          // 如果metrics中还有其他字段，也添加进去
          Object.keys(metrics).forEach(key => {
            if (key !== 'uv' && key !== 'pv') {
              transformedItem[key] = metrics[key]
            }
          })
        } else {
          // 如果没有metrics对象，尝试从item的其他字段推断
          console.warn('⚠️ 未找到metrics对象，尝试从其他字段推断')
          transformedItem.uv = item.uv || 0
          transformedItem.pv = item.pv || 0
        }
        
        console.log(`  ✓ UV/PV数据: UV=${transformedItem.uv}, PV=${transformedItem.pv}`)
      } else {
        // 其他图表类型，直接使用metrics
        if (metrics && typeof metrics === 'object') {
          Object.assign(transformedItem, metrics)
        } else {
          // 如果没有metrics对象，使用item的其他字段
          Object.keys(item).forEach(key => {
            if (key !== 'date' && key !== 'metrics' && key !== 'dimensions' && key !== 'metadata') {
              transformedItem[key] = item[key]
            }
          })
        }
      }
      
      transformed.push(transformedItem)
    }
  })
  
  console.log('✅ 转换后的数据:', {
    count: transformed.length,
    sample: transformed.slice(0, 2)
  })
  
  return transformed
}

const handleResize = () => {
  chartInstance.value?.resize()
}

const refreshData = async () => {
  await loadData()
  message.success('数据已刷新')
}

const updateNow = async () => {
  try {
    refreshing.value = true
    await updateSingleChart(route.params.id)
    await loadData()
  } catch (error) {
    console.error('更新失败:', error)
  } finally {
    refreshing.value = false
  }
}

const exportChart = () => {
  if (!chartInstance.value) return
  
  const url = chartInstance.value.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: '#fff'
  })
  
  const link = document.createElement('a')
  link.download = `${chart.value.name}-${dayjs().format('YYYY-MM-DD')}.png`
  link.href = url
  link.click()
  
  message.success('图表导出成功')
}

const exportData = () => {
  // 导出CSV
  const csv = convertToCSV(chartData.value)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${chart.value.name}-${dayjs().format('YYYY-MM-DD')}.csv`
  link.click()
  
  message.success('数据导出成功')
}

const convertToCSV = (data) => {
  if (!data || data.length === 0) return ''
  
  // 表头
  const headers = ['日期', ...Object.keys(data[0].metrics || {})]
  
  // 数据行
  const rows = data.map(item => {
    const values = [item.date]
    Object.values(item.metrics || {}).forEach(v => values.push(v))
    return values.join(',')
  })
  
  return [headers.join(','), ...rows].join('\n')
}

const confirmDelete = () => {
  deleteModal.value = true
}

const handleDelete = async () => {
  try {
    await deleteChart(route.params.id)
    message.success('图表已删除')
    router.push('/my-charts')
  } catch (error) {
    console.error('删除失败:', error)
  }
}

const goBack = () => {
  router.back()
}

const handleMenuClick = (menuKey) => {
  console.log('菜单点击处理:', menuKey)
  // 可以在这里添加自定义逻辑
}

// 工具方法
const getCategoryColor = (category) => {
  const colorMap = {
    '页面分析': 'blue',
    '用户行为': 'green',
    '转化分析': 'orange',
    '全局概览': 'purple'
  }
  return colorMap[category] || 'default'
}

const getStatusText = (status) => {
  const statusMap = {
    active: '活跃',
    paused: '已暂停',
    archived: '已归档'
  }
  return statusMap[status] || status
}

const getChartTypeName = (type) => {
  const typeMap = {
    line: '折线图',
    bar: '柱状图',
    pie: '饼图',
    funnel: '漏斗图',
    conversion_funnel: '转化漏斗',
    click_heatmap: '点击热力图',
    user_journey: '用户行为路径',
    uv_pv_chart: 'UV/PV分析',
    single_page_uv_pv_chart: '单页面UV/PV分析'
  }
  return typeMap[type] || type
}

const getMetricText = (metric) => {
  const metricMap = {
    uv: 'UV',
    pv: 'PV',
    total: '总计',
    duration: '平均时长',
    bounce_rate: '跳出率',
    conversion_rate: '转化率'
  }
  return metricMap[metric] || metric
}

const formatDateTime = (dateStr) => {
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm')
}

// 生命周期
onMounted(async () => {
  await loadData()
})

onUnmounted(() => {
  if (chartInstance.value) {
    chartInstance.value.dispose()
  }
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped lang="less">
.chart-detail {
  padding: 24px;
  
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      
      h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
      }
    }
    
    .header-actions {
      display: flex;
      gap: 12px;
    }
  }
  
  .info-card,
  .chart-card,
  .metrics-card,
  .data-table-card {
    margin-bottom: 24px;
  }
  
  .chart-container {
    width: 100%;
    height: 500px;
  }
  
  .text-warning {
    color: #faad14;
  }
  
  .text-danger {
    color: #ff4d4f;
  }
}
</style>

