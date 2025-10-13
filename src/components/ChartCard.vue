<template>
  <a-card 
    class="chart-card" 
    :hoverable="true"
    @click="$emit('view', chart)"
  >
    <template #cover>
      <div class="card-cover">
        <component :is="getChartIcon(chart.config.chartType)" class="chart-icon" />
      </div>
    </template>
    
    <template #actions>
      <span @click.stop="$emit('view', chart)" key="view">
        <EyeOutlined /> 查看
      </span>
      <span @click.stop="$emit('update', chart)" key="update">
        <ReloadOutlined /> 更新
      </span>
      <span @click.stop="$emit('delete', chart)" key="delete" class="danger">
        <DeleteOutlined /> 删除
      </span>
    </template>
    
    <a-card-meta
      :title="chart.name"
      :description="chart.description || '暂无描述'"
    />
    
    <div class="card-info">
      <a-tag :color="getCategoryColor(chart.category)">
        {{ chart.category }}
      </a-tag>
      
      <a-tag :color="chart.status === 'active' ? 'green' : 'default'">
        {{ getStatusText(chart.status) }}
      </a-tag>
    </div>
    
    <div class="card-meta">
      <div class="meta-item">
        <CalendarOutlined />
        <span>创建于 {{ formatDate(chart.createdAt) }}</span>
      </div>
      
      <div class="meta-item" v-if="chart.lastDataUpdate">
        <ClockCircleOutlined />
        <span>更新于 {{ formatDate(chart.lastDataUpdate) }}</span>
      </div>
      
      <div class="meta-item" v-else>
        <ClockCircleOutlined />
        <span class="text-warning">待更新</span>
      </div>
    </div>
    
    <div class="card-stats" v-if="chart.config.metrics">
      <a-tag v-for="metric in chart.config.metrics" :key="metric">
        {{ getMetricText(metric) }}
      </a-tag>
    </div>
  </a-card>
</template>

<script setup>
import { h } from 'vue'
import {
  EyeOutlined,
  ReloadOutlined,
  DeleteOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  LineChartOutlined,
  BarChartOutlined,
  PieChartOutlined,
  FunnelPlotOutlined,
  HeatMapOutlined,
  DashboardOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

defineProps({
  chart: {
    type: Object,
    required: true
  }
})

defineEmits(['view', 'update', 'delete'])

// 获取图表类型图标
const getChartIcon = (chartType) => {
  const iconMap = {
    line: LineChartOutlined,
    bar: BarChartOutlined,
    pie: PieChartOutlined,
    funnel: FunnelPlotOutlined,
    conversion_funnel: FunnelPlotOutlined,
    click_heatmap: HeatMapOutlined,
    user_journey: DashboardOutlined,
    uv_pv_chart: LineChartOutlined,
    single_page_uv_pv_chart: LineChartOutlined
  }
  return iconMap[chartType] || LineChartOutlined
}

// 获取分类颜色
const getCategoryColor = (category) => {
  const colorMap = {
    '页面分析': 'blue',
    '用户行为': 'green',
    '转化分析': 'orange',
    '全局概览': 'purple'
  }
  return colorMap[category] || 'default'
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    active: '活跃',
    paused: '已暂停',
    archived: '已归档'
  }
  return statusMap[status] || status
}

// 获取指标文本
const getMetricText = (metric) => {
  const metricMap = {
    uv: 'UV',
    pv: 'PV',
    total: '总计',
    duration: '时长',
    bounce_rate: '跳出率',
    conversion_rate: '转化率'
  }
  return metricMap[metric] || metric
}

// 格式化日期
const formatDate = (dateStr) => {
  return dayjs(dateStr).fromNow()
}
</script>

<style scoped lang="less">
.chart-card {
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  .card-cover {
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    
    .chart-icon {
      font-size: 48px;
      color: white;
    }
  }
  
  .card-info {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  
  .card-meta {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #f0f0f0;
    
    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #999;
      margin-bottom: 6px;
      
      &:last-child {
        margin-bottom: 0;
      }
      
      .text-warning {
        color: #faad14;
      }
    }
  }
  
  .card-stats {
    margin-top: 12px;
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  
  :deep(.ant-card-actions) {
    li {
      .danger {
        color: #ff4d4f;
        
        &:hover {
          color: #ff7875;
        }
      }
    }
  }
}

// 深色主题适配
@media (prefers-color-scheme: dark) {
  .chart-card {
    .card-meta {
      border-top-color: #303030;
    }
  }
}
</style>

