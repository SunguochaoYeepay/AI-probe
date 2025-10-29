/**
 * 图表管理服务
 * 负责图表的创建、更新、删除和数据同步
 */

import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { chartDB } from '@/utils/indexedDBManager'
import { aggregationService } from '@/utils/aggregationService'
import { yeepayAPI } from '@/api'
import { useStore } from 'vuex'

/**
 * 格式化最后更新时间
 * @param {string} date - 日期字符串 (YYYY-MM-DD)
 * @returns {string} - 格式化的时间戳 (YYYY-MM-DD HH:mm:ss)
 */
function formatLastUpdateTime(date) {
  return dayjs(date).endOf('day').format('YYYY-MM-DD HH:mm:ss')
}

export function useChartManager() {
  const store = useStore()
  
  // 状态
  const savedCharts = ref([])
  const loading = ref(false)
  const updating = ref(false)
  const updateProgress = ref({ current: 0, total: 0 })

  // 计算属性
  const chartsByCategory = computed(() => {
    const categories = {
      all: savedCharts.value,
      page: savedCharts.value.filter(c => c.category === '页面分析'),
      behavior: savedCharts.value.filter(c => c.category === '用户行为'),
      query: savedCharts.value.filter(c => c.category === '查询条件分析'),
      conversion: savedCharts.value.filter(c => c.category === '转化分析'),
      overview: savedCharts.value.filter(c => c.category === '全局概览')
    }
    return categories
  })

  const activeCharts = computed(() => {
    return savedCharts.value.filter(c => c.status === 'active')
  })

  /**
   * 初始化
   */
  const init = async (autoUpdate = false) => {
    try {
      console.log('🚀 初始化图表管理器...')
      await chartDB.init()
      await loadCharts()
      
      // 清理过期缓存
      await chartDB.cleanExpiredCache()
      
      // 只在明确要求时自动更新数据
      if (autoUpdate) {
        console.log('🔄 启用自动更新...')
        await checkAndUpdate()
      } else {
        console.log('⏸️ 跳过自动更新（避免重复请求）')
      }
      
      console.log('✅ 图表管理器初始化完成')
    } catch (error) {
      console.error('❌ 图表管理器初始化失败:', error)
      message.error('图表管理器初始化失败')
    }
  }

  /**
   * 加载所有图表
   */
  const loadCharts = async () => {
    try {
      savedCharts.value = await chartDB.getAllCharts()
      console.log(`📊 加载图表: ${savedCharts.value.length}个`)
    } catch (error) {
      console.error('加载图表失败:', error)
      throw error
    }
  }

  /**
   * 保存新图表
   * @param {Object} chartConfig - 图表配置
   * @param {Object} initialData - 初始数据 { '2025-10-01': {...}, '2025-10-02': {...} }
   */
  const saveChart = async (chartConfig, initialData) => {
    try {
      loading.value = true
      
      // 生成图表ID
      const chartId = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // 构造完整的图表对象
      const chart = {
        id: chartId,
        name: chartConfig.name || '未命名图表',
        description: chartConfig.description || '',
        category: chartConfig.category || '页面分析',
        config: {
          chartType: chartConfig.chartType,
          dataSource: {
            mode: chartConfig.mode || 'single',
            projectId: store.state.projectConfig.projectId || store.state.apiConfig.projectId,
            selectedPointId: chartConfig.selectedPointId || store.state.apiConfig.selectedPointId,
            埋点类型: chartConfig.埋点类型 || '访问'
          },
          filters: chartConfig.filters || {},
          dimensions: chartConfig.dimensions || ['date'],
          metrics: chartConfig.metrics || ['uv', 'pv'],
          dateRangeStrategy: chartConfig.dateRangeStrategy || 'last_30_days',
          customDateRange: chartConfig.customDateRange || null,
          // 🚀 修复：保存查询条件分析参数
          queryConditionParams: chartConfig.queryConditionParams || null,
          // 🚀 修复：保存按钮点击分析参数
          buttonParams: chartConfig.buttonParams || null,
          // 🚀 修复：保存漏斗步骤配置
          funnelSteps: chartConfig.funnelSteps || null
        },
        updateStrategy: {
          enabled: true,
          frequency: 'daily',
          autoUpdate: true
        },
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastDataUpdate: null
      }
      
      // 保存图表配置
      await chartDB.saveChart(chart)
      console.log(`✅ 图表配置已保存: ${chart.name}`)
      
      // 批量保存初始数据
      if (initialData && Object.keys(initialData).length > 0) {
        const dataList = Object.entries(initialData).map(([key, data]) => {
          // 🚀 修复：处理多条件数据的键格式
          let date, conditionName
          if (key.startsWith('temp_')) {
            // 多条件数据格式：temp_2025-10-17_全部
            const parts = key.split('_')
            if (parts.length >= 3) {
              date = parts[1]
              conditionName = parts.slice(2).join('_')
            } else {
              console.warn('⚠️ 多条件数据键格式异常:', key)
              date = key
              conditionName = null
            }
          } else {
            // 单条件数据格式：2025-10-17
            date = key
            conditionName = null
          }
          
          return {
            chartId: chart.id,
            date: date,
            conditionName: conditionName,
            ...data
          }
        })
        
        console.log('🔍 [ChartManager] 准备保存的数据列表:', {
          dataListLength: dataList.length,
          sampleData: dataList.slice(0, 2),
          allKeys: dataList.map(d => ({ chartId: d.chartId, date: d.date, conditionName: d.conditionName })),
          sampleDataKeys: dataList.length > 0 ? Object.keys(dataList[0]) : []
        })
        
        await chartDB.batchSaveChartData(dataList)
        console.log(`✅ 初始数据已保存: ${dataList.length}天`)
        
        // 更新最后数据更新时间
        const allDates = Object.keys(initialData).map(key => {
          if (key.startsWith('temp_')) {
            return key.split('_')[1]
          }
          return key
        }).filter((date, index, arr) => arr.indexOf(date) === index) // 去重
        
        const latestDate = allDates.sort().pop()
        await chartDB.updateChart(chart.id, {
          lastDataUpdate: formatLastUpdateTime(latestDate)
        })
      }
      
      // 刷新列表
      await loadCharts()
      
      return chart
      
    } catch (error) {
      console.error('保存图表失败:', error)
      message.error('保存图表失败')
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新图表配置
   */
  const updateChartConfig = async (chartId, updates) => {
    try {
      await chartDB.updateChart(chartId, updates)
      await loadCharts()
      message.success('图表已更新')
    } catch (error) {
      console.error('更新图表失败:', error)
      message.error('更新图表失败')
      throw error
    }
  }

  /**
   * 删除图表
   */
  const deleteChart = async (chartId) => {
    try {
      await chartDB.deleteChart(chartId)
      await loadCharts()
      message.success('图表已删除')
    } catch (error) {
      console.error('删除图表失败:', error)
      message.error('删除图表失败')
      throw error
    }
  }

  /**
   * 检查并更新所有图表
   */
  const checkAndUpdate = async () => {
    try {
      const charts = activeCharts.value
      if (charts.length === 0) {
        console.log('📊 无需更新（没有激活的图表）')
        return
      }
      
      const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
      const today = dayjs().format('YYYY-MM-DD')
      
      console.log(`🔄 检查图表更新需求（目标日期: ${yesterday}）`)
      
      const needUpdateCharts = []
      for (const chart of charts) {
        const hasYesterday = await chartDB.hasChartData(chart.id, yesterday)
        const hasToday = await chartDB.hasChartData(chart.id, today)
        
        if (!hasYesterday || !hasToday) {
          needUpdateCharts.push(chart)
        }
      }
      
      if (needUpdateCharts.length === 0) {
        console.log('✅ 所有图表数据已是最新')
        return
      }
      
      console.log(`🔄 需要更新 ${needUpdateCharts.length} 个图表`)
      
      // 批量更新（优化：按项目分组）
      await batchUpdateCharts(needUpdateCharts, yesterday)
      
    } catch (error) {
      console.error('检查更新失败:', error)
    }
  }

  /**
   * 批量更新图表（按项目分组优化）
   */
  const batchUpdateCharts = async (charts, targetDate) => {
    updating.value = true
    updateProgress.value = { current: 0, total: charts.length }
    
    try {
      // 按项目ID分组
      const chartsByProject = {}
      charts.forEach(chart => {
        const projectId = chart.config.dataSource.projectId
        if (!chartsByProject[projectId]) {
          chartsByProject[projectId] = []
        }
        chartsByProject[projectId].push(chart)
      })
      
      console.log(`📦 按项目分组: ${Object.keys(chartsByProject).length}个项目`)
      
      // 逐个项目更新
      for (const [projectId, projectCharts] of Object.entries(chartsByProject)) {
        console.log(`🔄 更新项目 ${projectId} 的 ${projectCharts.length} 个图表`)
        
        // 获取该项目当天的原始数据（只获取一次）
        const rawData = await fetchDayData({
          date: targetDate,
          projectId: projectId,
          selectedPointId: projectCharts[0].config.dataSource.selectedPointId
        })
        
        // 为每个图表聚合数据
        for (const chart of projectCharts) {
          try {
            const aggregated = aggregationService.aggregateForChart(
              rawData,
              chart.config,
              targetDate
            )
            
            await chartDB.saveChartData({
              chartId: chart.id,
              date: targetDate,
              ...aggregated
            })
            
            // 设置合理的最后更新时间
            await chartDB.updateChart(chart.id, {
              lastDataUpdate: formatLastUpdateTime(targetDate)
            })
            
            updateProgress.value.current++
            console.log(`  ✅ ${chart.name} 已更新`)
            
          } catch (error) {
            console.error(`  ❌ ${chart.name} 更新失败:`, error)
            updateProgress.value.current++
          }
        }
      }
      
      message.success(`已更新 ${charts.length} 个图表`)
      await loadCharts()
      
    } catch (error) {
      console.error('批量更新失败:', error)
      message.error('部分图表更新失败')
    } finally {
      updating.value = false
      updateProgress.value = { current: 0, total: 0 }
    }
  }

  /**
   * 更新单个图表（手动刷新）
   */
  const updateSingleChart = async (chartId, targetDate = null, forceUpdate = false) => {
    try {
      loading.value = true
      
      const chart = await chartDB.getChart(chartId)
      if (!chart) {
        throw new Error('图表不存在')
      }
      
      // 如果没有指定日期，则更新昨天和今天的数据
      let datesToUpdate = []
      if (targetDate) {
        datesToUpdate = [targetDate]
      } else {
        const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
        const today = dayjs().format('YYYY-MM-DD')
        datesToUpdate = [yesterday, today]
      }
      
      let updatedCount = 0
      for (const date of datesToUpdate) {
        // 检查是否已有数据（除非强制更新）
        if (!forceUpdate) {
          const hasData = await chartDB.hasChartData(chartId, date)
          if (hasData) {
            console.log(`📊 ${date} 的数据已存在，跳过`)
            continue
          }
        }
        
        message.loading(`正在更新图表 ${date}...`, 0)
        
        try {
          // 获取原始数据
          const rawData = await fetchDayData({
            date: date,
            projectId: chart.config.dataSource.projectId,
            selectedPointId: chart.config.dataSource.selectedPointId
          })
          
          // 聚合
          const aggregated = aggregationService.aggregateForChart(rawData, chart.config, date)
          
          // 保存
          await chartDB.saveChartData({
            chartId: chartId,
            date: date,
            ...aggregated
          })
          
          updatedCount++
          console.log(`✅ ${date} 数据更新成功`)
          
        } catch (error) {
          console.error(`❌ ${date} 数据更新失败:`, error)
          // 继续处理其他日期，不中断整个流程
        }
      }
      
      // 更新图表的最后更新时间
      if (updatedCount > 0) {
        const latestDate = datesToUpdate[datesToUpdate.length - 1]
        await chartDB.updateChart(chartId, {
          lastDataUpdate: formatLastUpdateTime(latestDate)
        })
      }
      
      message.destroy()
      
      if (updatedCount > 0) {
        message.success(`图表已更新，共更新 ${updatedCount} 天的数据`)
      } else {
        message.info('所有数据都是最新的')
      }
      
      await loadCharts()
      
    } catch (error) {
      message.destroy()
      console.error('更新图表失败:', error)
      message.error('更新图表失败: ' + error.message)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取图表数据
   */
  const getChartData = async (chartId, options = {}) => {
    try {
      const chart = await chartDB.getChart(chartId)
      if (!chart) {
        throw new Error('图表不存在')
      }
      
      // 根据图表的日期范围策略确定查询范围
      let startDate, endDate
      
      if (options.startDate && options.endDate) {
        startDate = options.startDate
        endDate = options.endDate
      } else {
        const range = getDateRangeFromStrategy(chart.config.dateRangeStrategy)
        startDate = range.startDate
        endDate = range.endDate
      }
      
      // 从数据库加载数据
      const data = await chartDB.getChartData(chartId, {
        startDate,
        endDate
      })
      
      return {
        chart,
        data,
        dateRange: { startDate, endDate }
      }
      
    } catch (error) {
      console.error('获取图表数据失败:', error)
      throw error
    }
  }

  /**
   * 获取某天的原始数据
   */
  const fetchDayData = async ({ date, projectId, selectedPointId }) => {
    try {
      console.log(`📡 从后端SQLite获取 ${date} 的原始数据...`)
      
      // 🚀 修复：使用后端SQLite缓存，不再直接调用API
      const { dataPreloadService } = await import('@/services/dataPreloadService')
      const response = await dataPreloadService.getBackendCachedData(date, selectedPointId)
      
      const data = response || []
      console.log(`✅ 从后端SQLite获取到 ${data.length} 条数据`)
      
      return data
      
    } catch (error) {
      console.error(`获取 ${date} 数据失败:`, error)
      throw error
    }
  }

  /**
   * 根据策略获取日期范围
   */
  const getDateRangeFromStrategy = (strategy) => {
    const today = dayjs()
    
    switch (strategy) {
      case 'last_7_days':
        return {
          startDate: today.subtract(6, 'day').format('YYYY-MM-DD'),
          endDate: today.format('YYYY-MM-DD')
        }
      case 'last_30_days':
        return {
          startDate: today.subtract(29, 'day').format('YYYY-MM-DD'),
          endDate: today.format('YYYY-MM-DD')
        }
      case 'last_90_days':
        return {
          startDate: today.subtract(89, 'day').format('YYYY-MM-DD'),
          endDate: today.format('YYYY-MM-DD')
        }
      default:
        return {
          startDate: today.subtract(29, 'day').format('YYYY-MM-DD'),
          endDate: today.format('YYYY-MM-DD')
        }
    }
  }

  /**
   * 获取数据库统计信息
   * 🚀 简化架构：不再使用前端IndexedDB
   */
  const getStats = async () => {
    try {
      // 返回后端服务统计信息
      const response = await fetch('http://localhost:3004/api/preload/status')
      if (response.ok) {
        const data = await response.json()
        return {
          backendStatus: data.data.isRunning ? 'running' : 'stopped',
          lastUpdate: data.timestamp,
          message: '数据由后端服务统一管理'
        }
      }
      return null
    } catch (error) {
      console.error('获取统计信息失败:', error)
      return null
    }
  }

  /**
   * 清空所有数据（慎用）
   * 🚀 简化架构：触发后端数据刷新
   */
  const clearAll = async () => {
    try {
      // 触发后端数据预加载服务刷新
      const response = await fetch('http://localhost:3004/api/preload/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        savedCharts.value = []
        message.success('已触发后端数据刷新')
      } else {
        message.error('后端服务不可用')
      }
    } catch (error) {
      console.error('清空数据失败:', error)
      message.error('清空数据失败')
    }
  }

  return {
    // 状态
    savedCharts,
    loading,
    updating,
    updateProgress,
    
    // 计算属性
    chartsByCategory,
    activeCharts,
    
    // 方法
    init,
    loadCharts,
    saveChart,
    updateChartConfig,
    deleteChart,
    checkAndUpdate,
    updateSingleChart,
    getChartData,
    getStats,
    clearAll
  }
}

