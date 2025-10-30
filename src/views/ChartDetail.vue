<template>
  <AppLayout 
    :page-title="dynamicPageTitle"
    :current-page="dynamicCurrentPage"
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
        <!-- 分析对象 -->
        <div class="analysis-target" style="margin-bottom: 16px;">
          <h3 style="margin: 0; color: #666;">
            <FileTextOutlined style="margin-right: 8px;" />
            {{ getAnalysisTarget() }}
          </h3>
        </div>
        
        <a-row :gutter="24">
          <a-col :span="12">
            <a-descriptions :column="1" size="small">
              <a-descriptions-item label="分析类型">
                <a-tag :color="getCategoryColor(chart?.category)">
                  {{ chart?.category }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="图表类型">
                {{ getChartTypeName(chart?.config.chartType) }}
              </a-descriptions-item>
            </a-descriptions>
          </a-col>
          <a-col :span="12">
            <a-descriptions :column="1" size="small">
              <a-descriptions-item label="最后更新">
                <span v-if="chart?.lastDataUpdate">
                  {{ formatDateTime(chart?.lastDataUpdate) }}
                </span>
                <span v-else class="text-warning">待更新</span>
              </a-descriptions-item>
              <a-descriptions-item label="状态">
                <a-tag :color="chart?.status === 'active' ? 'green' : 'default'">
                  {{ getStatusText(chart?.status) }}
                </a-tag>
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
        <template #extra>
        <div class="chart-controls">
          <!-- 时间范围选择 -->
          <a-radio-group 
            v-model:value="selectedTimeRange" 
            size="small"
            @change="onTimeRangeChange"
            class="time-range-selector"
          >
            <a-radio-button value="7">7天</a-radio-button>
            <a-radio-button value="30">近30天</a-radio-button>
            <a-radio-button value="60">近60天</a-radio-button>
          </a-radio-group>
        </div>
        </template>
        <div id="chart-container" class="chart-container"></div>
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
  DeleteOutlined,
  FileTextOutlined,
  UserOutlined
} from '@ant-design/icons-vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { useChartManager } from '@/composables/useChartManager'
import AppLayout from '@/components/AppLayout.vue'
import { ChartGenerator } from '@/utils/chartGenerator'
import { backendChartService as chartDB } from '@/services/backendChartService'

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
const selectedTimeRange = ref('7') // 默认7天，会在loadData中根据图表配置更新

// 计算属性
const needUpdate = computed(() => {
  if (!chart.value) return false
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
  return chart.value.lastDataUpdate < yesterday
})

// 动态页面标题
const dynamicPageTitle = computed(() => {
  if (!chart.value) return '图表详情'
  return getAnalysisTarget()
})

// 动态当前页面（用于菜单高亮）
const dynamicCurrentPage = computed(() => {
  if (!chart.value?.config?.chartType) return 'chart-detail'
  
  const chartType = chart.value.config.chartType
  switch (chartType) {
    case 'query_condition_analysis':
      return 'query-conditions'
    case 'button_click_analysis':
    case 'button_click_daily':
      return 'button-clicks'
    case 'single_page_uv_pv_chart':
      return 'page-visits'
    default:
      return 'chart-detail'
  }
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
    
    // 🚀 设置默认时间范围为7天
    selectedTimeRange.value = '7'
    console.log('📅 设置默认时间范围为7天')
    
    // 计算7天的日期范围
    const endDate = dayjs()
    const startDate = endDate.subtract(7, 'day')
    
    console.log(`📊 [ChartDetail] 默认日期范围: ${startDate.format('YYYY-MM-DD')} 至 ${endDate.format('YYYY-MM-DD')}`)
    
    // 获取7天的数据
    const result = await getChartData(route.params.id, {
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD')
    })
    
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
  await new Promise(resolve => setTimeout(resolve, 200))
  
  const container = document.getElementById('chart-container')
  if (!container) {
    console.error('❌ 图表容器未找到')
    return
  }
  
  console.log('✅ 找到图表容器，开始渲染图表')
  
  // 销毁旧图表
  if (chartInstance.value) {
    console.log('🗑️ 销毁旧图表')
    chartInstance.value.dispose()
  }
  
  try {
    // 准备数据（转换格式）
    const transformedData = await transformChartData(chartData.value, chart.value.config, chart.value)
    
    console.log('🎯 准备渲染图表:', {
      chartType: chart.value.config.chartType,
      originalDataCount: chartData.value.length,
      transformedDataCount: transformedData.length,
      transformedData: transformedData
    })
    
    // 生成图表配置
    const analysisConfig = {
      chartType: chart.value.config.chartType,
      intent: chart.value.config.metrics,
      dateRange: `${dateRange.value.startDate} 至 ${dateRange.value.endDate}`,
      // 🚀 添加日期范围对象，供数据处理器使用
      dateRangeObj: {
        startDate: dateRange.value.startDate,
        endDate: dateRange.value.endDate
      }
    }
    
    // 如果是查询条件分析，需要传递页面和查询条件信息
    if (chart.value.config.chartType === 'query_condition_analysis') {
      console.log('🔍 查询条件分析 - 完整图表对象:', chart.value)
      console.log('🔍 查询条件分析 - 图表配置:', chart.value.config)
      console.log('🔍 图表配置完整结构:', JSON.stringify(chart.value.config, null, 2))
      
      // 🚀 优先使用保存的原始参数
      if (chart.value.config.queryConditionParams) {
        console.log('✅ 使用保存的查询条件参数:', chart.value.config.queryConditionParams)
        analysisConfig.parameters = {
          pageName: chart.value.config.queryConditionParams.pageName,
          queryCondition: chart.value.config.queryConditionParams.queryCondition,
          queryData: chart.value.config.queryConditionParams.queryData
        }
      } else {
        // 如果没有保存的参数，从图表描述中提取（兼容旧数据）
        console.log('⚠️ 未找到保存的参数，从描述中解析')
        const description = chart.value.description || ''
        console.log('🔍 查询条件分析 - 图表描述:', description)
        
        // 尝试多种匹配模式提取页面名称
        let pageMatch = description.match(/页面[""]([^""]+)[""]/)
        if (!pageMatch) {
          pageMatch = description.match(/页面"([^"]+)"/)
        }
        if (!pageMatch) {
          pageMatch = description.match(/页面([^的]+)的/)
        }
        if (!pageMatch && description.startsWith('#')) {
          pageMatch = description.match(/#([^ ]+)/)
        }
        
        // 尝试多种匹配模式提取查询条件
        let conditionMatch = description.match(/[""]([^""]+)[""]查询条件/)
        if (!conditionMatch) {
          conditionMatch = description.match(/"([^"]+)"查询条件/)
        }
        if (!conditionMatch) {
          conditionMatch = description.match(/的"([^"]+)"查询条件/)
        }
        
        // 设置参数
        if (pageMatch) analysisConfig.parameters = { ...analysisConfig.parameters, pageName: pageMatch[1] }
        if (conditionMatch) analysisConfig.parameters = { ...analysisConfig.parameters, queryCondition: conditionMatch[1] }
        
        console.log('🔍 匹配结果:', { pageMatch, conditionMatch })
      }
      
      console.log('🔧 查询条件分析配置:', analysisConfig)
    }
    // 如果是按钮点击分析，需要传递页面和按钮信息
    else if (chart.value.config.chartType === 'button_click_analysis' || chart.value.config.chartType === 'button_click_daily') {
      console.log('🔍 按钮点击分析 - 完整图表对象:', chart.value)
      console.log('🔍 按钮点击分析 - 图表配置:', chart.value.config)
      
      // 🚀 优先使用保存的原始参数
      if (chart.value.config.buttonParams) {
        console.log('✅ 使用保存的按钮点击分析参数:', chart.value.config.buttonParams)
        analysisConfig.pageName = chart.value.config.buttonParams.pageName
        analysisConfig.buttonName = chart.value.config.buttonParams.buttonName
        analysisConfig.buttonData = chart.value.config.buttonParams.buttonData
      } else {
        // 如果没有保存的参数，从图表描述中提取（兼容旧数据）
        console.log('⚠️ 未找到保存的参数，从描述中解析')
        const description = chart.value.description || ''
        console.log('🔍 按钮点击分析 - 图表描述:', description)
        console.log('🔍 按钮点击分析 - 图表名称:', chart.value.name)
        
        // 尝试多种匹配模式
        let pageMatch = description.match(/页面[""]([^""]+)[""]/)
        let buttonMatch = description.match(/[""]([^""]+)[""]按钮/)
        
        // 如果第一种模式没匹配到，尝试其他模式
        if (!pageMatch) {
          pageMatch = description.match(/页面"([^"]+)"/)
        }
        if (!buttonMatch) {
          buttonMatch = description.match(/"([^"]+)"按钮/)
        }
        
        // 如果还是没匹配到，尝试更宽松的匹配
        if (!pageMatch) {
          pageMatch = description.match(/页面([^的]+)的/)
        }
        if (!buttonMatch) {
          buttonMatch = description.match(/的"([^"]+)"按钮/)
        }
        
        // 特殊处理：如果描述以#开头，提取#后面的页面名称
        if (!pageMatch && description.startsWith('#')) {
          pageMatch = description.match(/#([^ ]+)/)
        }
        
        if (pageMatch) analysisConfig.pageName = pageMatch[1]
        if (buttonMatch) analysisConfig.buttonName = buttonMatch[1]
        
        console.log('🔍 匹配结果:', { pageMatch, buttonMatch })
      }
      
      console.log('🔧 按钮点击分析配置:', analysisConfig)
    }
    
    // 使用修复后的ChartGenerator
    const chartGenerator = new ChartGenerator()
    
    // 统一使用generateChart方法处理所有图表类型
    console.log('🔧 [ChartDetail] 调用generateChart:', {
      analysisConfig,
      dataLength: chartData.value?.length,
      transformedDataLength: transformedData?.length,
      containerId: 'chart-container'
    })
    
    // 🚀 修复：对于漏斗图，传递转换后的数据
    const dataToPass = (chart.value.config.chartType === 'behavior_funnel' || chart.value.config.chartType === 'conversion_funnel') 
      ? transformedData 
      : chartData.value
    
    chartInstance.value = await chartGenerator.generateChart(analysisConfig, dataToPass, 'chart-container')
    console.log('✅ [ChartDetail] generateChart调用完成')
    
    console.log('✅ 图表渲染成功')
    
  } catch (error) {
    console.error('❌ 图表渲染失败:', error)
    message.error(`图表渲染失败: ${error.message}`)
  }
  
  // 响应式
  window.addEventListener('resize', handleResize)
}

const transformChartData = async (data, config, chartInfo = null) => {
  console.log('🔄 转换图表数据:', { 
    dataCount: data.length, 
    config: config,
    chartInfo: chartInfo,
    sampleData: data.slice(0, 2)
  })
  
  // 🚀 使用统一的数据处理器
  try {
    const { dataProcessorFactory } = await import('@/utils/dataProcessorFactory.js')
    
    // 判断数据格式 - 修复判断逻辑
    const isAggregated = data && data.length > 0 && (
      // 情况1：数据项包含 uv 和 pv 字段
      (data[0].hasOwnProperty('uv') && data[0].hasOwnProperty('pv')) ||
      // 情况2：数据项包含 metrics 字段（已聚合的图表数据）
      (data[0].hasOwnProperty('metrics') && data[0].hasOwnProperty('date')) ||
      // 情况3：数据项包含 chartId 字段（保存的图表数据）
      data[0].hasOwnProperty('chartId')
    )
    const format = isAggregated ? 'aggregated' : 'raw'
    
    console.log('🔍 [ChartDetail] 数据格式判断:', {
      dataLength: data.length,
      firstItemKeys: data.length > 0 ? Object.keys(data[0]) : [],
      isAggregated: isAggregated,
      format: format,
      sampleItem: data.length > 0 ? data[0] : null
    })
    
    console.log(`📊 [ChartDetail] 使用统一数据处理器工厂，分析类型: ${config.chartType}，数据格式: ${format}`)
    
    // 🚀 修复：构建正确的分析参数
    let analysisParameters = {}
    
    if (config.queryConditionParams) {
      // 查询条件分析
      analysisParameters = {
        pageName: config.queryConditionParams.pageName,
        queryCondition: config.queryConditionParams.queryCondition,
        queryData: config.queryConditionParams.queryData
      }
    } else if (config.buttonParams) {
      // 按钮点击分析
      analysisParameters = {
        pageName: config.buttonParams.pageName,
        buttonName: config.buttonParams.buttonName,
        buttonData: config.buttonParams.buttonData
      }
    } else {
      // 页面访问分析 - 优先从保存的参数中获取页面名称
      let pageName = null
      
      // 🚀 修复：优先从保存的参数中获取页面名称
      if (config.pageAccessParams?.pageName) {
        pageName = config.pageAccessParams.pageName
        console.log('🔍 [ChartDetail] 从保存的参数中获取页面名称:', pageName)
      } else {
        // 降级：从图表描述中提取页面名称
        const description = chartInfo?.description || config.description || ''
        console.log('🔍 [ChartDetail] 从描述中提取页面名称:', description)
        
        if (description.includes('分析页面"')) {
          const match = description.match(/分析页面"([^"]+)"/)
          if (match) {
            pageName = match[1]
          }
        } else if (description.includes('页面"')) {
          const match = description.match(/页面"([^"]+)"/)
          if (match) {
            pageName = match[1]
          }
        } else if (description.startsWith('#') && description.includes('页面访问量')) {
          // 处理 #页面名称 页面访问量 格式
          const match = description.match(/#([^ ]+)/)
          if (match) {
            pageName = match[1]
          }
        }
        
        console.log('🔍 [ChartDetail] 从描述中提取的页面名称:', pageName)
      }
      
      analysisParameters = {
        pageName: pageName
      }
      
      console.log('🔍 [ChartDetail] 最终使用的页面名称:', pageName)
    }
    
    // 🚀 关键修复：在详情时也进行页面数据过滤，与创建时保持一致
    let filteredData = data
    if (analysisParameters.pageName && config.chartType === 'single_page_uv_pv_chart') {
      console.log('🔍 [ChartDetail] 开始页面数据过滤，目标页面:', analysisParameters.pageName)
      
      // 使用与创建时相同的智能匹配逻辑
      const smartMatch = (target, source) => {
        if (!source) return false
        
        // 1. 精确匹配
        if (target === source) return true
        
        // 2. 去除常见后缀后的精确匹配
        const cleanTarget = target.replace(/(的访问|访问|页面|page)$/gi, '').trim()
        const cleanSource = source.replace(/(的访问|访问|页面|page)$/gi, '').trim()
        if (cleanTarget === cleanSource) return true
        
        // 3. 去除横线字符后的精确匹配
        const normalizedTarget = target.replace(/[—_\-]/g, '')
        const normalizedSource = source.replace(/[—_\-]/g, '')
        if (normalizedTarget === normalizedSource) return true
        
        // 4. 简单的包含匹配
        if (source.includes(target) || target.includes(source)) {
          return true
        }
        
        // 5. 关键词匹配
        const targetKeywords = target.split(/[—_\-的访问页面page]/gi).filter(k => k.trim().length > 1)
        const sourceKeywords = source.split(/[—_\-的访问页面page]/gi).filter(k => k.trim().length > 1)
        
        let matchCount = 0
        for (const targetKeyword of targetKeywords) {
          if (sourceKeywords.some(sourceKeyword => 
            sourceKeyword.includes(targetKeyword) || targetKeyword.includes(sourceKeyword)
          )) {
            matchCount++
          }
        }
        
        if (targetKeywords.length > 0 && matchCount === targetKeywords.length) {
          return true
        }
        
        return matchCount > 0
      }
      
      // 🚀 修复：增强调试日志，显示实际的数据结构
      const sampleData = data.slice(0, 3).map(item => ({
        pageName: item.pageName,
        url: item.url,
        path: item.path,
        title: item.title,
        content: item.content,
        allKeys: Object.keys(item)
      }))
      
      console.log('🔍 [ChartDetail] 页面过滤调试信息:')
      console.log('  目标页面:', analysisParameters.pageName)
      console.log('  原始数据样本:', sampleData)
      
      // 详细显示每个数据项的匹配过程
      data.slice(0, 3).forEach((item, index) => {
        const itemPageName = item.pageName || item.url || item.path || item.title
        const matchResult = smartMatch(analysisParameters.pageName, itemPageName)
        console.log(`  数据项 ${index} 匹配检查:`, {
          itemPageName: itemPageName,
          targetPageName: analysisParameters.pageName,
          matchResult: matchResult,
          itemKeys: Object.keys(item)
        })
        
        // 🚀 关键：显示完整的数据项内容
        console.log(`  数据项 ${index} 完整内容:`, item)
      })
      
      // 过滤数据
      if (format === 'raw') {
        // 原始数据格式：按页面名称过滤
        filteredData = data.filter(item => {
          const itemPageName = item.pageName || item.url || item.path || item.title
          return smartMatch(analysisParameters.pageName, itemPageName)
        })
      } else if (format === 'aggregated') {
        // 聚合数据格式：检查数据是否已经按页面过滤过
        // 如果数据中包含了页面信息，进行过滤
        if (data.some(item => item.pageName || item.url || item.path || item.title)) {
          filteredData = data.filter(item => {
            const itemPageName = item.pageName || item.url || item.path || item.title
            return smartMatch(analysisParameters.pageName, itemPageName)
          })
        } else {
          // 如果聚合数据中没有页面信息，说明数据已经是按页面过滤过的
          console.log('🔍 [ChartDetail] 聚合数据中无页面信息，使用原始数据')
          filteredData = data
        }
      }
      
      console.log('🔍 [ChartDetail] 页面数据过滤结果:', {
        原始数据: data.length,
        过滤后数据: filteredData.length,
        目标页面: analysisParameters.pageName
      })
      
      // 如果过滤后没有数据，使用原始数据
      if (filteredData.length === 0) {
        console.warn('⚠️ [ChartDetail] 页面过滤后无数据，使用原始数据')
        filteredData = data
      }
    }
    
    // 🚀 修复：为漏斗图提供正确的数据格式
    let processedData = filteredData
    let processedOptions = {
      format: format,
      analysis: {
        chartType: config.chartType,
        parameters: analysisParameters
      },
      queryCondition: config.queryConditionParams?.queryCondition || '',
      queryData: config.queryConditionParams?.queryData,
      // 🚀 传递用户选择的日期范围
      dateRange: {
        startDate: dateRange.value?.startDate,
        endDate: dateRange.value?.endDate
      },
      // 🚀 为查询条件分析传递原始数据
      rawData: format === 'raw' ? data : null,
      // 🚀 修复：传递漏斗步骤配置
      funnelSteps: config.funnelSteps || null
    }

    // 🚀 特殊处理：漏斗图直接使用保存的数据
    if (config.chartType === 'behavior_funnel' || config.chartType === 'conversion_funnel') {
      console.log('🔧 [ChartDetail] 漏斗图特殊处理：直接使用保存的漏斗图数据')
      
      // 检查是否有保存的漏斗图数据
      if (format === 'aggregated' && filteredData.length > 0) {
        // 从保存的数据中提取漏斗图数据
        const firstDataItem = filteredData[0]
        
        console.log('🔍 [ChartDetail] 检查保存的数据结构:', {
          hasDimensions: !!firstDataItem.dimensions,
          hasMetadata: !!firstDataItem.metadata,
          dimensionsKeys: firstDataItem.dimensions ? Object.keys(firstDataItem.dimensions) : [],
          metadataKeys: firstDataItem.metadata ? Object.keys(firstDataItem.metadata) : [],
          hasByStep: !!firstDataItem.dimensions?.byStep,
          hasFunnelId: !!firstDataItem.metadata?.funnelId,
          firstDataItem: firstDataItem
        })
        
        if (firstDataItem.dimensions?.byStep && firstDataItem.metadata?.funnelId) {
          console.log('🔍 [ChartDetail] 找到保存的漏斗图数据，直接使用')
          
          // 直接返回保存的漏斗图数据
          const funnelData = {
            funnelId: firstDataItem.metadata.funnelId,
            funnelName: firstDataItem.metadata.funnelName || '用户行为转化漏斗',
            steps: firstDataItem.dimensions.byStep || [],
            totalParticipants: firstDataItem.metrics?.totalParticipants || 0,
            overallConversionRate: firstDataItem.metrics?.overallConversionRate || 0,
            averageTotalDuration: firstDataItem.metrics?.averageTotalDuration || 0,
            funnelSteps: firstDataItem.metadata?.funnelSteps || null
          }
          
          console.log('✅ [ChartDetail] 直接使用保存的漏斗图数据:', funnelData)
          return funnelData
        } else {
          console.log('🔍 [ChartDetail] 数据格式不匹配，尝试其他格式')
          
          // 尝试其他可能的数据格式
          if (firstDataItem.steps && firstDataItem.funnelId) {
            console.log('🔍 [ChartDetail] 找到直接格式的漏斗图数据')
            return firstDataItem
          }
        }
      }
      
      // 如果没有保存的漏斗图数据，提示用户
      console.warn('⚠️ [ChartDetail] 没有找到保存的漏斗图数据')
      console.log('🔍 [ChartDetail] 建议：请重新生成漏斗图以保存数据')
      
      // 返回空的漏斗图数据
      return {
        funnelId: 'empty_funnel',
        funnelName: '用户行为转化漏斗',
        steps: [],
        totalParticipants: 0,
        overallConversionRate: 0,
        averageTotalDuration: 0,
        funnelSteps: null
      }
    }

    // 使用统一的数据处理逻辑
    const result = dataProcessorFactory.process(config.chartType, processedData, processedOptions)
    
    console.log('✅ [ChartDetail] 统一数据处理完成:', result)
    
    // 🚀 修复：漏斗图数据特殊处理
    if (config.chartType === 'behavior_funnel' || config.chartType === 'conversion_funnel') {
      // 漏斗图数据需要从保存的格式中提取原始数据
      console.log('✅ 漏斗图数据，提取原始格式:', result)
      
      // 🚀 修复：直接使用 BehaviorAnalysisDataProcessor 返回的数据结构
      const funnelData = {
        funnelId: result.funnelId || 'empty_funnel',
        funnelName: result.funnelName || '用户行为转化漏斗',
        steps: result.steps || [],
        totalParticipants: result.totalParticipants || 0,
        overallConversionRate: result.overallConversionRate || 0,
        averageTotalDuration: result.averageTotalDuration || 0,
        // 🚀 修复：恢复漏斗步骤配置
        funnelSteps: result.funnelSteps || null
      }
      
      console.log('✅ 重建的漏斗图数据:', funnelData)
      return funnelData
    }
    
    // 转换为 ChartDetail 期望的格式
    const transformed = result.categories.map((date, index) => ({
      createdAt: date,
      date: date,
      uv: result.uvData[index] || 0,
      pv: result.pvData[index] || 0
    }))
    
    console.log('✅ 转换后的数据:', { count: transformed.length, sample: transformed.slice(0, 2) })
    return transformed
    
  } catch (error) {
    console.error('❌ [ChartDetail] 统一数据处理失败，使用旧逻辑:', error)
    
    // 降级到旧的数据处理逻辑
    return transformChartDataLegacy(data, config, chartInfo)
  }
}

const transformChartDataLegacy = (data, config, chartInfo = null) => {
  // 🚀 关键修复：生成完整的时间轴，确保显示所有天数
  const transformed = []
  
  console.log('🔄 [ChartDetail] 使用旧的数据处理逻辑')
  
  // 生成完整的时间轴
  let fullDateRange = []
  
  // 🚀 修复：对于查询条件分析，优先使用保存的数据日期范围，避免填充过多0值
  if (config.chartType === 'query_condition_analysis' && data.length > 0) {
    // 查询条件分析：只使用有数据的日期，不填充0值
    const dates = data.map(item => item.date).sort()
    fullDateRange = dates
    console.log(`📅 查询条件分析：使用实际数据日期范围: ${fullDateRange.length}天，从 ${fullDateRange[0]} 到 ${fullDateRange[fullDateRange.length - 1]}`)
  } else if (dateRange.value && dateRange.value.startDate && dateRange.value.endDate) {
    const startDate = dayjs(dateRange.value.startDate)
    const endDate = dayjs(dateRange.value.endDate)
    
    let currentDate = startDate
    while (currentDate.isSameOrBefore(endDate)) {
      fullDateRange.push(currentDate.format('YYYY-MM-DD'))
      currentDate = currentDate.add(1, 'day')
    }
    
    console.log(`📅 生成完整时间轴: ${fullDateRange.length}天，从 ${fullDateRange[0]} 到 ${fullDateRange[fullDateRange.length - 1]}`)
  } else {
    // 如果没有日期范围信息，使用现有数据的日期范围
    const dates = data.map(item => item.date).sort()
    if (dates.length > 0) {
      const startDate = dayjs(dates[0])
      const endDate = dayjs(dates[dates.length - 1])
      
      let currentDate = startDate
      while (currentDate.isSameOrBefore(endDate)) {
        fullDateRange.push(currentDate.format('YYYY-MM-DD'))
        currentDate = currentDate.add(1, 'day')
      }
    }
  }
  
  // 创建数据映射
  const dataMap = new Map()
  data.forEach(item => {
    dataMap.set(item.date, item)
  })
  
  // 为每个日期生成数据点（包括无数据的天）
  fullDateRange.forEach(date => {
    const existingData = dataMap.get(date)
    
    if (existingData) {
      // 有数据的天，使用现有数据
      const { date: itemDate, metrics, dimensions } = existingData
      
      if (dimensions && dimensions.byPage) {
        dimensions.byPage.forEach(page => {
        transformed.push({
          createdAt: itemDate,
          date: itemDate,  // 🚀 修复：添加date字段
          pageName: page.page,
          weCustomerKey: `dummy_${page.uv}`,
          ...metrics,
          ...page
        })
        })
      } else {
        const transformedItem = {
          createdAt: itemDate,
          date: itemDate  // 🚀 修复：添加date字段
        }
        
        // 处理查询条件分析
        if (config.chartType === 'query_condition_analysis') {
          const description = (chartInfo && chartInfo.description) || config.description || ''
          
          // 提取页面名称
          let pageMatch = description.match(/页面[""]([^""]+)[""]/)
          if (!pageMatch) {
            pageMatch = description.match(/页面"([^"]+)"/)
          }
          if (!pageMatch) {
            pageMatch = description.match(/页面([^的]+)的/)
          }
          if (!pageMatch && description.startsWith('#')) {
            pageMatch = description.match(/#([^ ]+)/)
          }
          
          // 提取查询条件
          let conditionMatch = description.match(/[""]([^""]+)[""]查询条件/)
          if (!conditionMatch) {
            conditionMatch = description.match(/"([^"]+)"查询条件/)
          }
          if (!conditionMatch) {
            conditionMatch = description.match(/的"([^"]+)"查询条件/)
          }
          
          transformedItem.type = 'query'
          transformedItem.pageName = pageMatch ? pageMatch[1] : '未知页面'
          transformedItem.content = conditionMatch ? conditionMatch[1] : '查询条件'
          
          // 从metrics中提取UV和PV数据
          if (metrics && typeof metrics === 'object') {
            transformedItem.uv = metrics.uv || 0
            transformedItem.pv = metrics.pv || 0
          } else {
            transformedItem.uv = existingData.uv || 0
            transformedItem.pv = existingData.pv || 0
          }
        }
        // 处理按钮点击分析
        else if (config.chartType === 'button_click_analysis' || config.chartType === 'button_click_daily') {
          const description = (chartInfo && chartInfo.description) || config.description || ''
          
          let pageMatch = description.match(/页面[""]([^""]+)[""]/)
          if (!pageMatch) {
            pageMatch = description.match(/页面"([^"]+)"/)
          }
          if (!pageMatch) {
            pageMatch = description.match(/页面([^的]+)的/)
          }
          if (!pageMatch && description.startsWith('#')) {
            pageMatch = description.match(/#([^ ]+)/)
          }
          
          let buttonMatch = description.match(/[""]([^""]+)[""]按钮/)
          if (!buttonMatch) {
            buttonMatch = description.match(/"([^"]+)"按钮/)
          }
          if (!buttonMatch) {
            buttonMatch = description.match(/的"([^"]+)"按钮/)
          }
          
          transformedItem.type = 'click'
          transformedItem.pageName = pageMatch ? pageMatch[1] : '未知页面'
          transformedItem.content = buttonMatch ? buttonMatch[1] : '未知按钮'
          
          // 从metrics中提取UV和PV数据
          if (metrics && typeof metrics === 'object') {
            transformedItem.uv = metrics.uv || 0
            transformedItem.pv = metrics.pv || 0
          } else {
            transformedItem.uv = existingData.uv || 0
            transformedItem.pv = existingData.pv || 0
          }
        }
        // 处理UV/PV图表
        else if (config.chartType === 'single_page_uv_pv_chart' || config.chartType === 'uv_pv_chart') {
          if (metrics && typeof metrics === 'object') {
            transformedItem.uv = metrics.uv || 0
            transformedItem.pv = metrics.pv || 0
            Object.keys(metrics).forEach(key => {
              if (key !== 'uv' && key !== 'pv') {
                transformedItem[key] = metrics[key]
              }
            })
          } else {
            transformedItem.uv = existingData.uv || 0
            transformedItem.pv = existingData.pv || 0
          }
        } else {
          // 其他图表类型
          if (metrics && typeof metrics === 'object') {
            Object.assign(transformedItem, metrics)
          } else {
            Object.keys(existingData).forEach(key => {
              if (key !== 'date' && key !== 'metrics' && key !== 'dimensions' && key !== 'metadata') {
                transformedItem[key] = existingData[key]
              }
            })
          }
        }
        
        transformed.push(transformedItem)
      }
    } else {
      // 无数据的天，生成默认数据点（值为0）
      const transformedItem = {
        createdAt: date,
        date: date,  // 🚀 修复：添加date字段
        uv: 0,
        pv: 0
      }
      
      // 如果是查询条件分析，需要添加页面和查询条件信息
      if (config.chartType === 'query_condition_analysis') {
        const description = (chartInfo && chartInfo.description) || config.description || ''
        
        let pageMatch = description.match(/页面[""]([^""]+)[""]/)
        if (!pageMatch) {
          pageMatch = description.match(/页面"([^"]+)"/)
        }
        if (!pageMatch) {
          pageMatch = description.match(/页面([^的]+)的/)
        }
        if (!pageMatch && description.startsWith('#')) {
          pageMatch = description.match(/#([^ ]+)/)
        }
        
        let conditionMatch = description.match(/[""]([^""]+)[""]查询条件/)
        if (!conditionMatch) {
          conditionMatch = description.match(/"([^"]+)"查询条件/)
        }
        if (!conditionMatch) {
          conditionMatch = description.match(/的"([^"]+)"查询条件/)
        }
        
        transformedItem.type = 'query'
        transformedItem.pageName = pageMatch ? pageMatch[1] : '未知页面'
        transformedItem.content = conditionMatch ? conditionMatch[1] : '查询条件'
      }
      // 如果是按钮点击分析，需要添加页面和按钮信息
      else if (config.chartType === 'button_click_analysis' || config.chartType === 'button_click_daily') {
        const description = (chartInfo && chartInfo.description) || config.description || ''
        
        let pageMatch = description.match(/页面[""]([^""]+)[""]/)
        if (!pageMatch) {
          pageMatch = description.match(/页面"([^"]+)"/)
        }
        if (!pageMatch) {
          pageMatch = description.match(/页面([^的]+)的/)
        }
        if (!pageMatch && description.startsWith('#')) {
          pageMatch = description.match(/#([^ ]+)/)
        }
        
        let buttonMatch = description.match(/[""]([^""]+)[""]按钮/)
        if (!buttonMatch) {
          buttonMatch = description.match(/"([^"]+)"按钮/)
        }
        if (!buttonMatch) {
          buttonMatch = description.match(/的"([^"]+)"按钮/)
        }
        
        transformedItem.type = 'click'
        transformedItem.pageName = pageMatch ? pageMatch[1] : '未知页面'
        transformedItem.content = buttonMatch ? buttonMatch[1] : '未知按钮'
      }
      
      transformed.push(transformedItem)
      console.log(`  📅 无数据天: ${date}，生成默认数据点 (UV=0, PV=0)`)
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
    // 强制更新，包括今天的数据
    await updateSingleChart(route.params.id, null, true)
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
    single_page_uv_pv_chart: '单页面UV/PV分析',
    button_click_analysis: '按钮点击分析',
    button_click_daily: '按钮点击按天分析'
  }
  return typeMap[type] || type
}

const getAnalysisTarget = () => {
  // 🚀 修复：优先使用 description，如果为空则使用 name
  let description = chart.value?.description
  if (!description && chart.value?.name) {
    description = chart.value.name
    console.log('🔍 [ChartDetail] 使用 chartName 作为描述:', description)
  }
  
  if (!description) {
    console.log('🔍 [ChartDetail] 图表描述和名称都为空:', {
      hasChart: !!chart.value,
      description: chart.value?.description,
      chartName: chart.value?.name,
      chartConfig: chart.value?.config
    })
    return '未知分析对象'
  }
  
  console.log('🔍 [ChartDetail] 使用描述:', description)
  
  // 提取页面名称
  let pageName = ''
  if (description.startsWith('#')) {
    const pageMatch = description.match(/#([^ ]+)/)
    if (pageMatch) {
      pageName = pageMatch[1]
    }
  }
  
  // 提取按钮名称
  let buttonName = ''
  const buttonMatch = description.match(/"([^"]+)"按钮/)
  if (buttonMatch) {
    buttonName = buttonMatch[1]
  }
  
  // 🚀 修复：处理查询条件分析的描述格式
  // 格式：分析页面"${pageName}"的"${queryCondition}"查询条件使用情况
  const queryConditionMatch = description.match(/分析页面"([^"]+)"的"([^"]+)"查询条件使用情况/)
  if (queryConditionMatch) {
    const extractedPageName = queryConditionMatch[1]
    const queryCondition = queryConditionMatch[2]
    return `${extractedPageName} 页面的 "${queryCondition}" 查询条件`
  }
  
  // 🚀 修复：处理按钮点击分析的描述格式
  // 格式：分析页面"${pageName}"的"${buttonName}"按钮点击情况
  const buttonClickMatch = description.match(/分析页面"([^"]+)"的"([^"]+)"按钮点击情况/)
  if (buttonClickMatch) {
    const extractedPageName = buttonClickMatch[1]
    const extractedButtonName = buttonClickMatch[2]
    console.log('🔍 [ChartDetail] 按钮点击分析匹配成功:', {
      pageName: extractedPageName,
      buttonName: extractedButtonName
    })
    return `${extractedPageName} 页面的 "${extractedButtonName}" 按钮`
  }
  
  // 根据是否有按钮名称决定显示内容
  if (buttonName) {
    return `${pageName} 页面的 "${buttonName}" 按钮`
  } else if (pageName) {
    return `${pageName} 页面`
  } else {
    return '页面分析'
  }
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

// 时间范围变化处理
const onTimeRangeChange = async (e) => {
  const newTimeRange = e.target.value
  console.log('🕒 [ChartDetail] 时间范围变化:', newTimeRange)
  
  try {
    const days = parseInt(newTimeRange)
    console.log(`📅 [ChartDetail] 切换到${days}天数据范围`)
    
    // 显示加载状态
    message.loading(`正在加载${days}天数据...`, 0)
    
    // 计算新的日期范围
    const endDate = dayjs()
    const startDate = endDate.subtract(days, 'day')
    
    console.log(`📊 [ChartDetail] 新日期范围: ${startDate.format('YYYY-MM-DD')} 至 ${endDate.format('YYYY-MM-DD')}`)
    
    // 获取新时间范围的数据
    const result = await getChartData(route.params.id, {
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD')
    })
    
    chartData.value = result.data
    dateRange.value = result.dateRange
    
    // 重新渲染图表
    await renderChart()
    
    message.destroy()
    
    // 🚀 修复：显示实际数据天数而不是选择的天数
    const actualDataDays = chartData.value.length
    if (actualDataDays === days) {
      message.success(`已切换到${days}天数据视图`)
    } else {
      message.success(`已切换到${days}天数据视图（实际数据：${actualDataDays}天）`)
    }
    
  } catch (error) {
    message.destroy()
    console.error('❌ [ChartDetail] 时间范围切换失败:', error)
    message.error(`切换时间范围失败: ${error.message}`)
  }
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
  
  /* 图表控件样式 */
  .chart-controls {
    display: flex;
    align-items: center;
    gap: 12px;
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
}
</style>

