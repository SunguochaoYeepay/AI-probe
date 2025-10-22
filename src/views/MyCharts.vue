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
        <a-col :span="12">
          <a-input
            v-model:value="searchKeyword"
            placeholder="搜索图表名称或描述..."
            allow-clear
            @input="handleSearch"
          >
            <template #prefix>
              <SearchOutlined />
            </template>
          </a-input>
        </a-col>
        <a-col :span="4">
          <a-button type="primary" @click="handleSearch">
            <SearchOutlined /> 查询
          </a-button>
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
        :scroll="{ x: 1200 }"
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
          
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 'active' ? 'green' : 'default'">
              {{ getStatusText(record.status) }}
            </a-tag>
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
  DeleteOutlined
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
const stats = ref(null)
const deleteModal = ref({
  visible: false,
  chart: null
})

// 筛选相关状态
const searchKeyword = ref('')

// 表格列配置
const tableColumns = [
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
      { text: '转化分析', value: '转化分析' },
      { text: '全局概览', value: '全局概览' }
    ]
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    filters: [
      { text: '活跃', value: 'active' },
      { text: '已停用', value: 'inactive' }
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

// 筛选后的图表列表
const displayCharts = computed(() => {
  let charts = filteredCharts.value

  // 搜索筛选
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    charts = charts.filter(chart => 
      (chart.name && chart.name.toLowerCase().includes(keyword)) ||
      (chart.description && chart.description.toLowerCase().includes(keyword))
    )
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

// 筛选相关方法
const handleSearch = () => {
  // 搜索逻辑在计算属性中处理
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
    '转化分析': 'orange',
    '全局概览': 'purple'
  }
  return colors[category] || 'default'
}

const getCategoryText = (category) => {
  // 直接返回分类名称，因为已经是中文了
  return category || '未知'
}

const getStatusText = (status) => {
  return status === 'active' ? '活跃' : '已停用'
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
  // 从路由查询参数同步分类，例如 ?category=page-analysis|click-analysis|conversion|overview|all
  const categoryMap = {
    'page-analysis': 'page',
    'click-analysis': 'behavior',
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

