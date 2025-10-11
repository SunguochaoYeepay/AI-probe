import { ref, nextTick } from 'vue'
import { useStore } from 'vuex'
import { message } from 'ant-design-vue'
import { ChartGenerator } from '@/utils/chartGenerator'

export function useChart() {
  const store = useStore()
  const chartGenerator = ref(null)

  // 初始化图表生成器
  const initChartGenerator = () => {
    chartGenerator.value = new ChartGenerator()
  }

  // 从需求中提取页面名称
  const extractPageNames = (requirement) => {
    const pageNames = []
    // 匹配 #页面名 或 @页面名
    const matches = requirement.match(/(#|@)([^\s#@]+)/g)
    if (matches) {
      matches.forEach(match => {
        const pageName = match.substring(1) // 移除 # 或 @
        pageNames.push(pageName)
      })
    }
    return pageNames
  }

  // 生成图表
  const generateChart = async (analysis, data, dateRange) => {
    try {
      console.log('========== 数据查询信息 ==========')
      console.log('查询模式: 日期范围')
      console.log('用户选择的日期范围:', dateRange)
      console.log('获取到真实数据:', data.length, '条')
      
      // 显示数据的时间范围
      if (data.length > 0) {
        const dates = data.map(d => d.createdAt).filter(d => d)
        if (dates.length > 0) {
          console.log('数据时间范围:', dates[0], '至', dates[dates.length - 1])
          console.log('前3条数据样本:', data.slice(0, 3).map(d => ({
            pageName: d.pageName,
            createdAt: d.createdAt,
            type: d.type
          })))
        }
      }
      console.log('====================================')
      
      // 如果需求中指定了页面，过滤数据
      const specifiedPages = extractPageNames(analysis.originalText || analysis.description)
      if (specifiedPages.length > 0 && data.length > 0) {
        console.log('检测到指定页面:', specifiedPages)
        const filteredData = data.filter(item => 
          specifiedPages.some(page => item.pageName && item.pageName.includes(page))
        )
        console.log(`过滤前: ${data.length} 条，过滤后: ${filteredData.length} 条`)
        
        if (filteredData.length > 0) {
          data = filteredData
        } else {
          message.warning(`未找到指定页面的数据，将显示所有数据`)
        }
      }
      
      // 如果没有数据，抛出错误
      if (data.length === 0) {
        throw new Error('API返回数据为空，请检查日期范围或埋点配置')
      }

      // 构造日期范围字符串
      let dateRangeStr = null
      if (dateRange && dateRange.length === 2) {
        try {
          dateRangeStr = `${dateRange[0].format('YYYY-MM-DD')} 至 ${dateRange[1].format('YYYY-MM-DD')}`
        } catch (e) {
          console.warn('日期格式化失败:', e)
          dateRangeStr = '日期范围'
        }
      }
      console.log('生成的日期范围字符串:', dateRangeStr)
      
      // 创建包含日期范围的 analysis 对象
      const analysisWithDateRange = {
        ...analysis,
        dateRange: dateRangeStr // 传递日期范围信息
      }
      
      // 先保存图表配置，触发 hasChart 变为 true
      store.dispatch('updateChartConfig', {
        analysis: analysisWithDateRange,
        data,
        timestamp: new Date().toISOString()
      })
      
      // 等待 DOM 更新后再生成图表
      await nextTick()
      await nextTick() // 双重 nextTick 确保 DOM 完全更新
      
      // 确认容器存在
      const container = document.getElementById('chart-container')
      if (!container) {
        console.error('图表容器未找到，延迟重试')
        // 延迟一点再试
        setTimeout(() => {
          const retryContainer = document.getElementById('chart-container')
          if (retryContainer) {
            // 先销毁旧图表
            if (chartGenerator.value.chart) {
              chartGenerator.value.chart.dispose()
            }
            chartGenerator.value.generateChart(analysisWithDateRange, data, 'chart-container')
            message.success('图表生成完成', 3)
          } else {
            message.error('图表容器加载失败')
          }
        }, 100)
        return
      }
      
      // 先销毁旧图表，确保重新渲染
      if (chartGenerator.value.chart) {
        console.log('销毁旧图表，准备重新生成')
        chartGenerator.value.chart.dispose()
      }
      
      // 生成新图表
      chartGenerator.value.generateChart(analysisWithDateRange, data, 'chart-container')
      message.success(`分析完成（${data.length}条数据）`)
      
    } catch (error) {
      console.error('图表生成失败:', error)
      throw error
    }
  }

  // 重新生成图表
  const regenerateChart = async (analysisResult) => {
    if (analysisResult) {
      await generateChart(analysisResult, store.state.chartConfig?.data, null)
      message.success('图表重新生成完成')
    }
  }

  // 导出图表
  const exportChart = () => {
    if (chartGenerator.value && chartGenerator.value.chart) {
      const url = chartGenerator.value.chart.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#fff'
      })
      
      const link = document.createElement('a')
      link.download = `chart-${Date.now()}.png`
      link.href = url
      link.click()
      
      message.success('图表导出成功')
    }
  }

  return {
    chartGenerator,
    initChartGenerator,
    generateChart,
    regenerateChart,
    exportChart,
    extractPageNames
  }
}
