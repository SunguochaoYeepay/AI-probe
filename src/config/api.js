// API配置管理
export const API_CONFIG = {
  // 环境配置
  environments: {
    development: {
      projectId: "event1021",
      selectedPointId: 110,
      baseUrl: "https://probe.yeepay.com",
      accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1MzVjYzQ1MC04MjVkLTExZWItYjhjZC0zOWUwNTJhNjY2ZGMiLCJjb21wYW55SWQiOiIxIiwidXNlclR5cGUiOiJzdXBlckFkbWluIiwiZW1haWxOYW1lIjoiZ3VvY2hhby5zdW5AeWVlcGF5LmNvbSIsIm5pY2tuYW1lIjoi566h55CG5ZGYIiwiaWF0IjoxNzU5OTk1NjMxLCJleHAiOjQ2MTExOTU2MzF9.L-h9sF_6Cm6J6akCmy2pzHHK-UgkHnzu5LsAvgT99ZA",
      defaultDate: "2025-01-10",
      pageSize: 30
    },
    production: {
      projectId: "event1021",
      selectedPointId: 110,
      baseUrl: "https://probe.yeepay.com",
      accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1MzVjYzQ1MC04MjVkLTExZWItYjhjZC0zOWUwNTJhNjY2ZGMiLCJjb21wYW55SWQiOiIxIiwidXNlclR5cGUiOiJzdXBlckFkbWluIiwiZW1haWxOYW1lIjoiZ3VvY2hhby5zdW5AeWVlcGF5LmNvbSIsIm5pY2tuYW1lIjoi566h55CG5ZGYIiwiaWF0IjoxNzU5OTk1NjMxLCJleHAiOjQ2MTExOTU2MzF9.L-h9sF_6Cm6J6akCmy2pzHHK-UgkHnzu5LsAvgT99ZA",
      defaultDate: "today",
      pageSize: 100
    }
  },
  
  // 默认配置
  defaults: {
    currentEnvironment: "development",
    autoRefresh: true,
    refreshInterval: 30000,
    timeout: 10000
  },
  
  // 数据源配置
  dataSources: {
    primary: {
      type: "yeepay_api",
      endpoint: "/tracker/buryPointTest/search",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "*/*"
      }
    }
  }
}

// 需求理解映射配置
export const REQUIREMENT_MAPPING = {
  // 漏斗分析类
  funnel: {
    keywords: ['转化', '漏斗', '流程', '步骤', '转化率', '流失', '支付流程'],
    chartType: 'funnel',
    description: '展示用户在各步骤的转化情况'
  },
  
  // 趋势分析类
  trend: {
    keywords: ['趋势', '变化', '时间', '历史', '走势', '增长', '下降'],
    chartType: 'line',
    description: '展示数据随时间的变化趋势'
  },
  
  // 对比分析类
  comparison: {
    keywords: ['对比', '比较', '差异', '排名', '高低', '大小'],
    chartType: 'bar',
    description: '展示不同维度的数据对比'
  },
  
  // 分布分析类
  distribution: {
    keywords: ['分布', '占比', '比例', '构成', '组成'],
    chartType: 'pie',
    description: '展示数据的分布情况'
  },
  
  // 概览分析类
  overview: {
    keywords: ['总体', '概览', '汇总', '统计', '总数', '平均'],
    chartType: 'value_card',
    description: '展示关键指标的总体情况'
  },
  
  // 成功失败分析
  success_failure: {
    keywords: ['成功', '失败', '通过', '不通过', '完成', '未完成', '错误率'],
    chartType: 'stacked_bar',
    description: '展示成功失败对比情况'
  },
  
  // 按钮点击分析
  button_click: {
    keywords: ['按钮', '点击', '操作', '交互'],
    chartType: 'bar',
    description: '展示按钮点击情况'
  }
}
