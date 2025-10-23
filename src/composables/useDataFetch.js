import { ref, computed } from 'vue'
import { useStore } from 'vuex'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { dataPreloadService } from '@/services/dataPreloadService'

/**
 * 数据获取相关的逻辑
 */
export function useDataFetch() {
  const store = useStore()
  
  // 响应式状态
  const isLoading = ref(false)
  const error = ref(null)
  const availablePages = ref([])
  const isPreloading = ref(false)

  /**
   * 验证API连接
   */
  const validateConnection = async () => {
    try {
      const { yeepayAPI } = await import('@/api')
      const response = await yeepayAPI.validateToken()
      return response && response.success !== false
    } catch (error) {
      console.error('API连接验证失败:', error)
      return false
    }
  }

  /**
   * 获取多天数据
   */
  const fetchMultiDayData = async (mode, dateRange) => {
    try {
      isLoading.value = true
      const [startDate, endDate] = dateRange
      const startDateStr = startDate.format('YYYY-MM-DD')
      const endDateStr = endDate.format('YYYY-MM-DD')
      
      console.log(`📡 获取数据: ${startDateStr} 至 ${endDateStr}`)
      
      // 使用数据预加载服务获取数据
      // 如果mode是数字，直接使用；否则使用store中配置的埋点ID
      const pointId = typeof mode === 'number' ? mode : store.state.apiConfig.selectedPointId
      console.log(`🔍 使用埋点ID: ${pointId} (传入mode: ${mode})`)
      const data = await dataPreloadService.getMultiDayCachedData(dateRange, pointId)
      
      return {
        data,
        dateRange: [startDateStr, endDateStr]
      }
    } catch (error) {
      console.error('获取多天数据失败:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 根据日期范围获取数据
   */
  const fetchDataForDateRange = async (dateRange) => {
    const [startDate, endDate] = dateRange
    const startDateStr = startDate.format('YYYY-MM-DD')
    const endDateStr = endDate.format('YYYY-MM-DD')
    
    console.log(`📡 [Home] 获取数据: ${startDateStr} 至 ${endDateStr}`)
    
    // 获取日期范围内的所有数据
    const allData = []
    let currentDate = startDate
    
    while (currentDate.isSameOrBefore(endDate)) {
      const dateStr = currentDate.format('YYYY-MM-DD')
      console.log(`📅 [Home] 获取 ${dateStr} 的数据...`)
      
      try {
        const dayData = await fetchDayData({
          date: dateStr,
          projectId: store.state.apiConfig.projectId,
          selectedPointId: store.state.apiConfig.selectedPointId
        })
        
        allData.push(...dayData)
        console.log(`✅ [Home] ${dateStr}: ${dayData.length} 条数据`)
        
      } catch (error) {
        console.warn(`⚠️ [Home] ${dateStr} 数据获取失败:`, error)
        // 即使某天数据获取失败，也继续处理其他天
      }
      
      currentDate = currentDate.add(1, 'day')
    }
    
    console.log(`📊 [Home] 总计获取 ${allData.length} 条数据`)
    return allData
  }

  /**
   * 获取单天数据的辅助函数
   */
  const fetchDayData = async ({ date, projectId, selectedPointId }) => {
    const { yeepayAPI } = await import('@/api')
    
    const response = await yeepayAPI.searchBuryPointData({
      date: date,
      pageSize: store.state.apiConfig.pageSize || 1000,
      projectId: projectId,
      selectedPointId: selectedPointId
    })
    
    return response.data?.dataList || []
  }

  /**
   * 手动触发数据预加载
   */
  const triggerManualPreload = async () => {
    try {
      isPreloading.value = true
      console.log('🔄 手动触发数据预加载...')
      
      // 不显示loading消息，让右侧状态组件处理
      await dataPreloadService.triggerPreload()
      
      // 不显示success消息，让右侧状态组件处理
      console.log('✅ 手动数据预加载完成')
    } catch (error) {
      console.error('手动数据预加载失败:', error)
      message.error('数据预加载失败: ' + error.message)
    } finally {
      isPreloading.value = false
    }
  }

  /**
   * 处理日期范围变化
   */
  const onDateRangeChange = async (dates, dateStrings) => {
    console.log('====================================')
    console.log('Home: onDateRangeChange 被调用')
    console.log('传入的 dates:', dates)
    console.log('传入的 dateStrings:', dateStrings)
    console.log('====================================')
    
    if (!dates || dates.length !== 2) {
      console.log('日期范围无效，退出')
      return
    }
    
    // 使用 dateStrings 如果存在，否则从 dates 中提取日期字符串
    let start, end
    if (dateStrings && dateStrings.length === 2) {
      [start, end] = dateStrings
      console.log('使用 dateStrings:', start, '至', end)
    } else {
      // 从 dayjs 对象中提取日期字符串
      start = dates[0].format('YYYY-MM-DD')
      end = dates[1].format('YYYY-MM-DD')
      console.log('从 dates 提取:', start, '至', end)
    }
    
    console.log('最终日期范围:', start, '至', end)
    
    // 清空缓存，确保使用新的日期范围重新获取数据
    clearCache()
    console.log('已清空数据缓存，准备重新加载数据')
    
    // 注释掉自动重新加载页面列表，避免调用API
    // await loadAvailablePages(dateRange.value)
    console.log('⏸️ 跳过自动重新加载页面列表')
    
    message.success(`日期范围已设置为 ${start} 至 ${end}`)
  }

  /**
   * 刷新数据
   */
  const refreshData = async () => {
    try {
      await validateConnection()
      message.success('数据刷新成功')
    } catch (error) {
      message.error('数据刷新失败')
    }
  }

  /**
   * 清空缓存
   */
  const clearCache = () => {
    dataPreloadService.clearCache()
  }

  /**
   * 加载可用页面
   */
  const loadAvailablePages = async (dateRange) => {
    try {
      isLoading.value = true
      const data = await fetchMultiDayData('single', dateRange)
      
      // 从数据中提取页面名称
      const pages = [...new Set(data.data.map(item => item.pageName).filter(Boolean))]
      availablePages.value = pages
      
      return pages
    } catch (error) {
      console.error('加载可用页面失败:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  return {
    // 状态
    isLoading,
    error,
    availablePages,
    isPreloading,
    
    // 方法
    validateConnection,
    fetchMultiDayData,
    fetchDataForDateRange,
    fetchDayData,
    triggerManualPreload,
    onDateRangeChange,
    refreshData,
    clearCache,
    loadAvailablePages
  }
}