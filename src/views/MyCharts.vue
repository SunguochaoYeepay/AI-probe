<template>
  <AppLayout 
    page-title="我的图表"
    current-page="overview"
    @menu-click="handleMenuClick"
  >
    <template #header-actions>
      <a-button @click="refreshCharts" :loading="loading">
        <ReloadOutlined /> 刷新
      </a-button>
      <a-button type="primary" @click="goToCreate">
        <PlusOutlined /> 创建新图表
      </a-button>
    </template>

    <!-- 更新进度 -->
    <a-alert
      v-if="updating"
      type="info"
      message="图表更新中"
      :description="`正在更新图表... (${updateProgress.current}/${updateProgress.total})`"
      show-icon
      closable
      class="update-alert"
    >
      <template #icon>
        <LoadingOutlined />
      </template>
      <a-progress
        :percent="Math.round((updateProgress.current / updateProgress.total) * 100)"
        :show-info="false"
        size="small"
      />
    </a-alert>

    <!-- 筛选区域 -->
    <div class="filter-section">
      <a-row :gutter="16" align="middle">
        <!-- 页面筛选 -->
        <a-col :span="6" v-if="activeType === 'page-visits' || activeType === 'button-clicks' || activeType === 'query-conditions'">
          <a-input
            v-model:value="pageFilter"
            placeholder="所属页面...."
            allow-clear
          >
            <template #prefix>
              <FileTextOutlined />
            </template>
          </a-input>
        </a-col>
        
        <!-- 按钮筛选 -->
        <a-col :span="6" v-if="activeType === 'button-clicks'">
          <a-input
            v-model:value="buttonFilter"
            placeholder="筛选按钮..."
            allow-clear
          >
            <template #prefix>
              <ThunderboltOutlined />
            </template>
          </a-input>
        </a-col>
        
        <!-- 查询条件筛选 -->
        <a-col :span="6" v-if="activeType === 'query-conditions'">
          <a-input
            v-model:value="queryConditionFilter"
            placeholder="筛选查询条件..."
            allow-clear
          >
            <template #prefix>
              <SearchOutlined />
            </template>
          </a-input>
        </a-col>
        
        
      </a-row>
    </div>

    <!-- 图表列表 -->
    <div class="charts-list">
      <a-empty v-if="displayCharts.length === 0" description="暂无图表">
        <a-button type="primary" @click="goToCreate">
          <PlusOutlined /> 创建第一个图表
        </a-button>
      </a-empty>

      <a-table
        v-else
        :columns="tableColumns"
        :data-source="displayCharts"
        :loading="loading"
        :pagination="paginationConfig"
        row-key="id"
        :scroll="{ x: getTableScrollWidth() }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="chart-name-cell">
              <div class="chart-title" @click="viewChart(record)">
                {{ getDisplayChartName(record) }}
              </div>
              <div class="chart-subtitle" v-if="record.name !== record.description && record.name !== getDisplayChartName(record)">
                {{ record.name }}
              </div>
            </div>
          </template>
          
          <template v-else-if="column.key === 'category'">
            <a-tag :color="getCategoryColor(record.category)">
              {{ getCategoryText(record.category) }}
            </a-tag>
          </template>
          
          <template v-else-if="column.key === 'pageName'">
            <span class="page-name">
              {{ getPageName(record) }}
            </span>
          </template>
          
          <template v-else-if="column.key === 'buttonName'">
            <span class="button-name">
              {{ getButtonName(record) }}
            </span>
          </template>
          
          <template v-else-if="column.key === 'queryCondition'">
            <span class="query-condition">
              {{ getQueryCondition(record) }}
            </span>
          </template>
          
          
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
          
          <template v-else-if="column.key === 'lastUpdate'">
            {{ getLastUpdateTime(record) }}
          </template>
          
          <template v-else-if="column.key === 'actions'">
            <a-space>
              <a-button size="small" @click="viewChart(record)">
                <EyeOutlined /> 查看
              </a-button>
              <a-button size="small" @click="updateChart(record)">
                <ReloadOutlined /> 更新
              </a-button>
              <a-popconfirm
                title="确定要删除这个图表吗？"
                @confirm="confirmDelete(record)"
              >
                <a-button size="small" danger>
                  <DeleteOutlined /> 删除
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 删除确认对话框 -->
    <a-modal
      v-model:open="deleteModal.visible"
      title="确认删除"
      @ok="handleDelete"
      @cancel="deleteModal.visible = false"
    >
      <p>确定要删除图表"{{ deleteModal.chart?.name }}"吗？</p>
      <p class="text-warning">此操作将同时删除该图表的所有历史数据，且不可恢复。</p>
    </a-modal>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  LineChartOutlined,
  PlusOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  UserOutlined,
  FunnelPlotOutlined,
  DashboardOutlined,
  LoadingOutlined,
  MenuOutlined,
  SearchOutlined,
  ClearOutlined,
  EyeOutlined,
  DeleteOutlined,
  ThunderboltOutlined
} from '@ant-design/icons-vue'
import { useChartManager } from '@/composables/useChartManager'
import ChartCard from '@/components/ChartCard.vue'
import AppLayout from '@/components/AppLayout.vue'
import dayjs from 'dayjs'

const router = useRouter()
const route = useRoute()

// 使用图表管理器
const {
  savedCharts,
  loading,
  updating,
  updateProgress,
  chartsByCategory,
  init,
  loadCharts,
  deleteChart,
  updateSingleChart,
  getStats
} = useChartManager()

// 本地状态
const activeCategory = ref('page')
const activeType = ref('')
const stats = ref(null)
const deleteModal = ref({
  visible: false,
  chart: null
})

// 筛选相关状态
const pageFilter = ref('')
const buttonFilter = ref('')
const queryConditionFilter = ref('')

// 基础列配置
const baseColumns = [
  {
    title: '所属页面',
    key: 'pageName',
    width: 150,
    filters: []
  },
  {
    title: '点击按钮',
    key: 'buttonName',
    width: 150,
    filters: []
  },
  {
    title: '查询条件',
    key: 'queryCondition',
    width: 150,
    filters: []
  },
  {
    title: '图表名称',
    key: 'name',
    width: 300,
    sorter: true
  },
  {
    title: '类型',
    key: 'category',
    width: 120,
    filters: [
      { text: '页面分析', value: '页面分析' },
      { text: '用户行为', value: '用户行为' },
      { text: '查询条件分析', value: '查询条件分析' },
      { text: '转化分析', value: '转化分析' },
      { text: '全局概览', value: '全局概览' }
    ]
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 150,
    sorter: true
  },
  {
    title: '最后更新',
    key: 'lastUpdate',
    width: 150,
    sorter: true
  },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    fixed: 'right'
  }
]

// 动态列配置
const tableColumns = computed(() => {
  const columns = [...baseColumns]
  
  // 根据当前分类和类型过滤显示的列
  if (activeType.value === 'page-visits') {
    // 页面访问量：只显示页面名称，隐藏按钮和查询条件列
    return columns.filter(col => !['buttonName', 'queryCondition'].includes(col.key))
  } else if (activeType.value === 'button-clicks') {
    // 按钮点击：显示页面名称和按钮名称，隐藏查询条件列
    return columns.filter(col => col.key !== 'queryCondition')
  } else if (activeType.value === 'query-conditions') {
    // 查询条件分析：显示页面名称和查询条件，隐藏按钮列
    return columns.filter(col => col.key !== 'buttonName')
  } else {
    // 默认显示所有列
    return columns
  }
})

// 分页配置
const paginationConfig = {
  pageSize: 10,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
}

// 计算属性
const filteredCharts = computed(() => {
  return chartsByCategory.value[activeCategory.value] || []
})

// 监听路由参数变化
watch(() => route.query, (newQuery) => {
  activeCategory.value = newQuery.category || 'page'
  activeType.value = newQuery.type || ''
  console.log('路由参数变化:', { category: activeCategory.value, type: activeType.value })
}, { immediate: true })

// 筛选后的图表列表
const displayCharts = computed(() => {
  let charts = filteredCharts.value

  // 根据类型筛选图表
  if (activeType.value) {
    charts = charts.filter(chart => {
      const config = chart.config || {}
      switch (activeType.value) {
        case 'page-visits':
          return config.chartType === 'single_page_uv_pv_chart'
        case 'button-clicks':
          return config.chartType === 'button_click_analysis' || config.chartType === 'button_click_daily'
        case 'query-conditions':
          return config.chartType === 'query_condition_analysis'
        default:
          return true
      }
    })
  }

  // 移除图表名称搜索筛选，只保留分类筛选

  // 页面筛选
  if (pageFilter.value) {
    charts = charts.filter(chart => {
      const pageName = getPageName(chart)
      return pageName.toLowerCase().includes(pageFilter.value.toLowerCase())
    })
  }

  // 按钮筛选
  if (buttonFilter.value) {
    charts = charts.filter(chart => {
      const buttonName = getButtonName(chart)
      return buttonName.toLowerCase().includes(buttonFilter.value.toLowerCase())
    })
  }

  // 查询条件筛选
  if (queryConditionFilter.value) {
    charts = charts.filter(chart => {
      const queryCondition = getQueryCondition(chart)
      return queryCondition.toLowerCase().includes(queryConditionFilter.value.toLowerCase())
    })
  }


  // 按创建时间排序（最新的在前）
  charts.sort((a, b) => {
    const aValue = new Date(a.createdAt)
    const bValue = new Date(b.createdAt)
    return bValue > aValue ? 1 : -1
  })

  return charts
})

// 移除hasActiveFilters计算属性，不再需要

// 方法
const goToCreate = () => {
  router.push('/')
}

const handleMenuClick = (menuKey) => {
  console.log('菜单点击处理:', menuKey)
  // 可以在这里添加自定义逻辑
}


// 获取表格滚动宽度
const getTableScrollWidth = () => {
  let width = 1400 // 基础宽度（包含所有列，移除状态列）
  
  if (activeType.value === 'page-visits') {
    width = 1100 // 基础宽度 - 按钮列 - 查询条件列
  } else if (activeType.value === 'button-clicks') {
    width = 1250 // 基础宽度 - 查询条件列
  } else if (activeType.value === 'query-conditions') {
    width = 1250 // 基础宽度 - 按钮列
  } else {
    width = 1400 // 显示所有列
  }
  
  return width
}

// 移除resetFilters函数，不再需要

const viewChart = (chart) => {
  router.push(`/chart/${chart.id}`)
}

const refreshCharts = async () => {
  await loadCharts()
  stats.value = await getStats()
}

const updateChart = async (chart) => {
  try {
    await updateSingleChart(chart.id)
    await refreshCharts()
  } catch (error) {
    console.error('更新图表失败:', error)
  }
}

const confirmDelete = (chart) => {
  deleteModal.value = {
    visible: true,
    chart
  }
}

const handleDelete = async () => {
  try {
    await deleteChart(deleteModal.value.chart.id)
    await refreshCharts()
  } catch (error) {
    console.error('删除图表失败:', error)
  } finally {
    deleteModal.value = {
      visible: false,
      chart: null
    }
  }
}

// 工具函数
const getCategoryColor = (category) => {
  const colors = {
    '页面分析': 'blue',
    '用户行为': 'green',
    '查询条件分析': 'cyan',
    '转化分析': 'orange',
    '全局概览': 'purple'
  }
  return colors[category] || 'default'
}

const getCategoryText = (category) => {
  // 直接返回分类名称，因为已经是中文了
  return category || '未知'
}


const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm')
}

const getLastUpdateTime = (chart) => {
  if (chart.lastDataUpdate) {
    return dayjs(chart.lastDataUpdate).format('YYYY-MM-DD HH:mm')
  }
  return '-'
}

// 提取页面名称
const getPageName = (chart) => {
  const config = chart.config || {}
  
  // 1. 优先从保存的参数中获取页面名称
  if (config.queryConditionParams?.pageName) {
    return config.queryConditionParams.pageName
  }
  
  if (config.buttonParams?.pageName) {
    return config.buttonParams.pageName
  }
  
  if (config.pageAccessParams?.pageName) {
    return config.pageAccessParams.pageName
  }
  
  // 2. 从图表描述中提取页面名称
  const description = chart.description || chart.name || ''
  
  // 匹配 "分析页面'XXX'的..." 格式
  const pageMatch = description.match(/分析页面["'](.+?)["']/)
  if (pageMatch) {
    return pageMatch[1]
  }
  
  // 匹配 "页面'XXX'的..." 格式
  const pageMatch2 = description.match(/页面["'](.+?)["']/)
  if (pageMatch2) {
    return pageMatch2[1]
  }
  
  // 匹配 "#XXX 页面的..." 格式
  if (description.startsWith('#')) {
    const pageMatch3 = description.match(/#(.+?)\s+页面的/)
    if (pageMatch3) {
      return pageMatch3[1]
    }
  }
  
  // 3. 根据图表类型返回默认值
  switch (config.chartType) {
    case 'single_page_uv_pv_chart':
      return '单页面分析'
    case 'button_click_analysis':
    case 'button_click_daily':
      return '按钮点击分析'
    case 'query_condition_analysis':
      return '查询条件分析'
    case 'uv_pv_chart':
      return '整站分析'
    default:
      return '-'
  }
}

// 提取按钮名称
const getButtonName = (chart) => {
  const config = chart.config || {}
  
  // 1. 优先从保存的参数中获取按钮名称
  if (config.buttonParams?.buttonName) {
    return config.buttonParams.buttonName
  }
  
  // 2. 从图表描述中提取按钮名称
  const description = chart.description || chart.name || ''
  
  // 匹配 "的'XXX'按钮..." 格式
  const buttonMatch = description.match(/的["'](.+?)["']按钮/)
  if (buttonMatch) {
    return buttonMatch[1]
  }
  
  // 匹配 "'XXX'按钮..." 格式
  const buttonMatch2 = description.match(/["'](.+?)["']按钮/)
  if (buttonMatch2) {
    return buttonMatch2[1]
  }
  
  // 3. 根据图表类型返回默认值
  switch (config.chartType) {
    case 'button_click_analysis':
    case 'button_click_daily':
      return '按钮点击'
    default:
      return '-'
  }
}

// 提取查询条件
const getQueryCondition = (chart) => {
  const config = chart.config || {}
  
  // 1. 优先从保存的参数中获取查询条件
  if (config.queryConditionParams?.queryCondition) {
    const condition = config.queryConditionParams.queryCondition
    // 🚀 只支持新格式 "条件类型:条件值1、条件值2"
    if (condition.includes(':') && (condition.includes('、') || condition.includes('，'))) {
      // 新格式：状态:全部、待复核
      const parts = condition.split(':')
      if (parts.length === 2) {
        const conditions = parts[1].split(/[、，]/)
        if (conditions.length > 2) {
          return `${conditions.slice(0, 2).join('、')}等${conditions.length}个条件`
        }
        return conditions.join('、')
      }
    }
    return condition
  }
  
  // 2. 从图表描述中提取查询条件
  const description = chart.description || chart.name || ''
  
  // 匹配 "的'XXX'查询条件..." 格式
  const conditionMatch = description.match(/的["'](.+?)["']查询条件/)
  if (conditionMatch) {
    return conditionMatch[1]
  }
  
  // 匹配 "'XXX'查询条件..." 格式
  const conditionMatch2 = description.match(/["'](.+?)["']查询条件/)
  if (conditionMatch2) {
    return conditionMatch2[1]
  }
  
  // 3. 根据图表类型返回默认值
  switch (config.chartType) {
    case 'query_condition_analysis':
      return '查询条件'
    default:
      return '-'
  }
}

// 提取用户标识
const getWeUserId = (chart) => {
  const config = chart.config || {}
  
  // 1. 优先从冗余字段中获取用户标识
  if (config.redundantFields?.weUserId) {
    const weUserId = config.redundantFields.weUserId
    if (weUserId === 'multiple') {
      return '多用户'
    }
    return weUserId
  }
  
  // 2. 从保存的参数中获取用户标识
  if (config.weUserId) {
    return config.weUserId
  }
  
  // 3. 从图表描述中提取用户标识
  const description = chart.description || chart.name || ''
  
  // 匹配 "用户'XXX'的..." 格式
  const userMatch = description.match(/用户["'](.+?)["']/)
  if (userMatch) {
    return userMatch[1]
  }
  
  // 4. 根据图表类型返回默认值
  switch (config.chartType) {
    case 'single_page_uv_pv_chart':
    case 'button_click_analysis':
    case 'button_click_daily':
    case 'query_condition_analysis':
      return '全部用户'
    default:
      return '-'
  }
}

// 生成显示用的图表名称
const getDisplayChartName = (record) => {
  // 如果已经有具体的名称，直接使用
  if (record.name && !record.name.includes('UV/PV时间趋势分析') && !record.name.includes('页面访问UV/PV分析')) {
    return record.name
  }
  
  // 尝试从描述中提取页面名称
  const description = record.description || record.name || ''
  
  // 匹配 "分析页面'XXX'的访问量数据" 格式
  const pageAnalysisMatch = description.match(/分析页面["'](.+?)["']的访问量数据/)
  if (pageAnalysisMatch) {
    return `分析页面"${pageAnalysisMatch[1]}"的访问量数据`
  }
  
  // 匹配 "分析页面'XXX'的点击行为" 格式
  const clickAnalysisMatch = description.match(/分析页面["'](.+?)["']的点击行为/)
  if (clickAnalysisMatch) {
    return `分析页面"${clickAnalysisMatch[1]}"的点击行为`
  }
  
  // 匹配 "分析页面'XXX'的用户行为" 格式
  const behaviorAnalysisMatch = description.match(/分析页面["'](.+?)["']的用户行为/)
  if (behaviorAnalysisMatch) {
    return `分析页面"${behaviorAnalysisMatch[1]}"的用户行为`
  }
  
  // 匹配 "分析页面'XXX'的'YYY'按钮点击情况" 格式
  const buttonClickMatch = description.match(/分析页面["'](.+?)["']的["'](.+?)["']按钮点击情况/)
  if (buttonClickMatch) {
    return `分析页面"${buttonClickMatch[1]}"的"${buttonClickMatch[2]}"按钮点击情况`
  }
  
  // 尝试从filters中提取页面名称
  if (record.config && record.config.filters && record.config.filters.pageName) {
    const pageName = record.config.filters.pageName
    if (pageName && pageName !== '__ALL__') {
      // 根据分类生成不同的名称
      let generatedName = ''
      if (record.category === '页面分析') {
        generatedName = `分析页面"${pageName}"的访问量数据`
      } else if (record.category === '用户行为') {
        generatedName = `分析页面"${pageName}"的用户行为`
      } else if (record.category === '转化分析') {
        generatedName = `分析页面"${pageName}"的转化数据`
      }
      return generatedName
    }
  }
  
  // 如果都无法提取，使用原始名称或描述
  return record.description || record.name || '数据分析'
}

// 生命周期
onMounted(async () => {
  await init()
  stats.value = await getStats()
  // 从路由查询参数同步分类，例如 ?category=page-analysis|click-analysis|query-analysis|conversion|overview|all
  const categoryMap = {
    'page-analysis': 'page',
    'click-analysis': 'behavior',
    'query-analysis': 'query',
    'conversion': 'conversion',
    'overview': 'overview',
    'all': 'all'
  }
  const incoming = route.query.category
  if (typeof incoming === 'string' && categoryMap[incoming]) {
    activeCategory.value = categoryMap[incoming]
  }
})

// 监听路由参数变化，确保从左侧菜单切换时即时更新分类
watch(() => route.query.category, (val) => {
  const categoryMap = {
    'page-analysis': 'page',
    'click-analysis': 'behavior',
    'query-analysis': 'query',
    'conversion': 'conversion',
    'overview': 'overview',
    'all': 'all'
  }
  if (typeof val === 'string' && categoryMap[val]) {
    activeCategory.value = categoryMap[val]
  }
})
</script>

<style scoped lang="less">
.stats-row {
  margin-bottom: 24px;
  
  .stats-suffix {
    font-size: 14px;
    color: #999;
  }
}

.update-alert {
  margin-bottom: 16px;
}

.category-tabs {
  margin-bottom: 24px;
}

.filter-section {
  margin-bottom: 24px;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
}

.charts-list {
  min-height: 400px;
}

.chart-name-cell {
  .chart-title {
    font-weight: 500;
    color: #1890ff;
    margin-bottom: 4px;
    cursor: pointer;
    transition: color 0.3s ease;
    
    &:hover {
      color: #40a9ff;
      text-decoration: underline;
    }
  }
  
  .chart-subtitle {
    font-size: 12px;
    color: #8c8c8c;
  }
}

.text-warning {
  color: #ff4d4f;
  font-size: 12px;
}

// 深色主题适配
@media (prefers-color-scheme: dark) {
  .stats-suffix {
    color: #666;
  }
  
  .filter-section {
    background: #1f1f1f;
    border-color: #303030;
  }
  
  .chart-name-cell {
    .chart-title {
      color: #262626 !important; // 强制使用深色文字，确保在表格中可见
    }
    
    .chart-subtitle {
      color: #8c8c8c !important; // 强制使用灰色文字
    }
  }
}

// 修复表格头部主题问题
:deep(.ant-table-thead > tr > th) {
  background-color: #fafafa !important;
  color: #262626 !important;
  border-bottom: 1px solid #f0f0f0 !important;
}

:deep(.ant-table-thead > tr > th:hover) {
  background-color: #f5f5f5 !important;
}

// 修复筛选条件区域主题问题
.filter-section {
  background-color: #fafafa !important;
  border: 1px solid #f0f0f0 !important;
}

// 修复筛选区域内的输入框和按钮样式
:deep(.filter-section .ant-input) {
  background-color: #fff !important;
  color: #262626 !important;
  border-color: #d9d9d9 !important;
}

:deep(.filter-section .ant-select-selector) {
  background-color: #fff !important;
  color: #262626 !important;
  border-color: #d9d9d9 !important;
}

:deep(.filter-section .ant-btn) {
  background-color: #fff !important;
  color: #262626 !important;
  border-color: #d9d9d9 !important;
}
</style>

