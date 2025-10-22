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

// 表格列配置
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
