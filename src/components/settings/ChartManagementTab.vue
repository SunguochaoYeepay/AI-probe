<template>
  <div class="chart-management-tab">
    <a-row :gutter="24">
      <!-- 图表统计 -->
      <a-col :span="24">
        <a-card title="图表统计" class="stats-card">
          <a-row :gutter="16">
            <a-col :span="6">
              <a-statistic title="总图表数" :value="stats.totalCharts" />
            </a-col>
            <a-col :span="6">
              <a-statistic title="活跃图表" :value="stats.activeCharts" />
            </a-col>
            <a-col :span="6">
              <a-statistic title="页面分析" :value="stats.pageAnalysis" />
            </a-col>
            <a-col :span="6">
              <a-statistic title="用户行为" :value="stats.userBehavior" />
            </a-col>
          </a-row>
        </a-card>
      </a-col>

      <!-- 图表列表 -->
      <a-col :span="24">
        <a-card title="图表管理" class="charts-card">
          <template #extra>
            <a-space>
              <a-button @click="refreshCharts" :loading="loading">
                <template #icon><ReloadOutlined /></template>
                刷新
              </a-button>
              <a-button type="primary" @click="goToCreate">
                <template #icon><PlusOutlined /></template>
                创建图表
              </a-button>
            </a-space>
          </template>

          <a-table
            :columns="columns"
            :data-source="charts"
            :loading="loading"
            :pagination="{ pageSize: 10 }"
            row-key="id"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                  {{ record.status === 'active' ? '活跃' : '已停用' }}
                </a-tag>
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
              
              <template v-else-if="column.key === 'lastUpdate'">
                {{ formatDate(record.lastDataUpdate) }}
              </template>
              
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-button size="small" @click="viewChart(record)">
                    查看
                  </a-button>
                  <a-button size="small" @click="updateChart(record)">
                    更新
                  </a-button>
                  <a-popconfirm
                    title="确定要删除这个图表吗？"
                    @confirm="deleteChart(record)"
                  >
                    <a-button size="small" danger>
                      删除
                    </a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined,
  PlusOutlined
} from '@ant-design/icons-vue'
import { useChartManager } from '@/composables/useChartManager'
import dayjs from 'dayjs'

const router = useRouter()

// 使用图表管理器
const {
  savedCharts,
  loading,
  loadCharts,
  deleteChart: deleteChartAction,
  updateSingleChart,
  getStats
} = useChartManager()

// 数据
const charts = ref([])
const stats = ref({
  totalCharts: 0,
  activeCharts: 0,
  pageAnalysis: 0,
  userBehavior: 0
})

// 表格列配置 - 调整列顺序，将页面名称、按钮、查询条件放在类型之后
const columns = [
  {
    title: '图表名称',
    dataIndex: 'name',
    key: 'name',
    width: 200
  },
  {
    title: '类型',
    dataIndex: 'category',
    key: 'category',
    width: 120
  },
  {
    title: '所属页面',
    dataIndex: 'pageName',
    key: 'pageName',
    width: 150
  },
  {
    title: '点击按钮',
    dataIndex: 'buttonName',
    key: 'buttonName',
    width: 150
  },
  {
    title: '查询条件',
    dataIndex: 'queryCondition',
    key: 'queryCondition',
    width: 150
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
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 150
  },
  {
    title: '操作',
    key: 'actions',
    width: 200
  }
]

// 初始化
onMounted(() => {
  loadData()
})

// 加载数据
const loadData = async () => {
  await loadCharts()
  charts.value = savedCharts.value
  stats.value = await getStats()
}

// 刷新图表
const refreshCharts = async () => {
  await loadData()
  message.success('图表列表已刷新')
}

// 查看图表
const viewChart = (chart) => {
  router.push(`/chart/${chart.id}`)
}

// 更新图表
const updateChart = async (chart) => {
  try {
    await updateSingleChart(chart.id)
    message.success('图表更新成功')
    await loadData()
  } catch (error) {
    console.error('更新图表失败:', error)
    message.error('更新图表失败: ' + error.message)
  }
}

// 删除图表
const deleteChart = async (chart) => {
  try {
    await deleteChartAction(chart.id)
    message.success('图表删除成功')
    await loadData()
  } catch (error) {
    console.error('删除图表失败:', error)
    message.error('删除图表失败: ' + error.message)
  }
}

// 创建图表
const goToCreate = () => {
  router.push('/')
}

// 获取分类颜色
const getCategoryColor = (category) => {
  const colors = {
    'page': 'blue',
    'user': 'green',
    'conversion': 'orange',
    'click': 'purple'
  }
  return colors[category] || 'default'
}

// 获取分类文本
const getCategoryText = (category) => {
  const texts = {
    'page': '页面分析',
    'user': '用户行为',
    'conversion': '转化分析',
    'click': '点击分析'
  }
  return texts[category] || category
}

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm')
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
    // 如果是多条件，只显示前几个条件
    if (condition.startsWith('多条件:')) {
      const conditions = condition.replace('多条件:', '').split(/[、，]/)
      if (conditions.length > 2) {
        return `${conditions.slice(0, 2).join('、')}等${conditions.length}个条件`
      }
      return conditions.join('、')
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
</script>

<style scoped lang="less">
.chart-management-tab {
  .stats-card {
    margin-bottom: 24px;
  }
  
  .charts-card {
    :deep(.ant-card-body) {
      padding: 16px;
    }
  }
}
</style>
