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
        <!-- 统计信息 -->
    <a-row :gutter="16" class="stats-row" v-if="stats">
      <a-col :span="6">
        <a-card>
          <a-statistic
            title="图表总数"
            :value="stats.chartCount"
            :prefix="null"
          >
            <template #suffix>
              <span class="stats-suffix">个</span>
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic
            title="激活图表"
            :value="stats.activeChartCount"
            :value-style="{ color: '#3f8600' }"
          >
            <template #suffix>
              <span class="stats-suffix">个</span>
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic
            title="数据总量"
            :value="stats.totalDataCount"
          >
            <template #suffix>
              <span class="stats-suffix">条</span>
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic
            title="平均数据"
            :value="stats.avgDataPerChart"
          >
            <template #suffix>
              <span class="stats-suffix">条/图</span>
            </template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

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

    <!-- 分类标签 -->
    <a-tabs v-model:activeKey="activeCategory" class="category-tabs">
      <a-tab-pane key="all" tab="全部">
        <template #tab>
          <span>
            <AppstoreOutlined />
            全部 ({{ chartsByCategory.all.length }})
          </span>
        </template>
      </a-tab-pane>
      <a-tab-pane key="page" tab="页面分析">
        <template #tab>
          <span>
            <FileTextOutlined />
            页面分析 ({{ chartsByCategory.page.length }})
          </span>
        </template>
      </a-tab-pane>
      <a-tab-pane key="behavior" tab="用户行为">
        <template #tab>
          <span>
            <UserOutlined />
            用户行为 ({{ chartsByCategory.behavior.length }})
          </span>
        </template>
      </a-tab-pane>
      <a-tab-pane key="conversion" tab="转化分析">
        <template #tab>
          <span>
            <FunnelPlotOutlined />
            转化分析 ({{ chartsByCategory.conversion.length }})
          </span>
        </template>
      </a-tab-pane>
      <a-tab-pane key="overview" tab="全局概览">
        <template #tab>
          <span>
            <DashboardOutlined />
            全局概览 ({{ chartsByCategory.overview.length }})
          </span>
        </template>
      </a-tab-pane>
    </a-tabs>

    <!-- 图表列表 -->
    <div class="charts-list">
      <a-empty v-if="filteredCharts.length === 0" description="暂无图表">
        <a-button type="primary" @click="goToCreate">
          <PlusOutlined /> 创建第一个图表
        </a-button>
      </a-empty>

      <a-row :gutter="[16, 16]" v-else>
        <a-col
          :xs="24"
          :sm="12"
          :md="12"
          :lg="8"
          :xl="6"
          v-for="chart in filteredCharts"
          :key="chart.id"
        >
          <chart-card
            :chart="chart"
            @view="viewChart"
            @update="updateChart"
            @delete="confirmDelete"
          />
        </a-col>
      </a-row>
    </div>

    <!-- 删除确认对话框 -->
    <a-modal
      v-model:visible="deleteModal.visible"
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
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
  MenuOutlined
} from '@ant-design/icons-vue'
import { useChartManager } from '@/composables/useChartManager'
import ChartCard from '@/components/ChartCard.vue'
import AppLayout from '@/components/AppLayout.vue'

const router = useRouter()

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
const activeCategory = ref('all')
const stats = ref(null)
const deleteModal = ref({
  visible: false,
  chart: null
})

// 计算属性
const filteredCharts = computed(() => {
  return chartsByCategory.value[activeCategory.value] || []
})

// 方法
const goToCreate = () => {
  router.push('/')
}

const handleMenuClick = (menuKey) => {
  console.log('菜单点击处理:', menuKey)
  // 可以在这里添加自定义逻辑
}

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

// 生命周期
onMounted(async () => {
  await init()
  stats.value = await getStats()
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

.charts-list {
  min-height: 400px;
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
}
</style>

