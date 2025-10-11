import { ref } from 'vue'
import { useStore } from 'vuex'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { yeepayAPI } from '@/api'

export function useDataFetch() {
  const store = useStore()
  const fetchProgress = ref({ current: 0, total: 0, visible: false })
  const availablePages = ref([])

  // 生成日期范围数组
  const generateDateRange = (start, end) => {
    const dates = []
    let current = dayjs(start)
    const endDate = dayjs(end)
    
    while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
      dates.push(current.format('YYYY-MM-DD'))
      current = current.add(1, 'day')
    }
    
    return dates
  }

  // 单埋点数据获取
  const fetchSingleBuryPointData = async (dateRange) => {
    if (!dateRange || dateRange.length !== 2) {
      throw new Error('请选择有效的日期范围')
    }
      
    const [start, end] = dateRange
    const dates = generateDateRange(start, end)
    
    console.log(`========== 批量获取数据 (${dates.length}天) ==========`)
    
    // 显示全局Loading
    const hideLoading = message.loading(`正在获取数据... (0/${dates.length}天)`, 0)
    
    const allData = []
    const currentPageSize = store.state.apiConfig.pageSize || 1000
    
    for (let i = 0; i < dates.length; i++) {
      try {
        console.log(`正在获取第 ${i + 1}/${dates.length} 天数据: ${dates[i]}`)
        
        // 更新Loading消息
        hideLoading()
        const newHideLoading = message.loading(`正在获取数据... (${i + 1}/${dates.length}天)`, 0)
        
        const response = await yeepayAPI.searchBuryPointData({
          pageSize: currentPageSize,
          date: dates[i]
        })
        
        const dayData = response.data?.dataList || []
        allData.push(...dayData)
        console.log(`  ${dates[i]}: 获取 ${dayData.length} 条数据`)
        
        // 短暂延迟，避免请求过快
        if (i < dates.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        newHideLoading()
      } catch (error) {
        console.error(`获取 ${dates[i]} 数据失败:`, error)
        hideLoading()
        // 继续获取其他天的数据
      }
    }
    
    // 隐藏Loading
    hideLoading()
    
    console.log(`批量获取完成，共 ${allData.length} 条数据`)
    console.log('====================================')
    
    return {
      data: allData,
      total: allData.length,
      dateRange: `${dates[0]} 至 ${dates[dates.length - 1]}`,
      mode: 'single'
    }
  }

  // 双埋点数据获取
  const fetchDualBuryPointData = async (dateRange) => {
    console.log('========== 双埋点数据获取 ==========')
    
    if (!dateRange || dateRange.length !== 2) {
      throw new Error('请选择有效的日期范围')
    }
      
    const [start, end] = dateRange
    const dates = generateDateRange(start, end)
    
    console.log(`获取日期范围双埋点数据: ${dates.length}天`)
    
    // 显示全局Loading
    const hideLoading = message.loading(`正在获取双埋点数据... (0/${dates.length}天)`, 0)
    
    const allVisitData = []
    const allClickData = []
    const currentPageSize = store.state.apiConfig.pageSize || 1000
    
    for (let i = 0; i < dates.length; i++) {
      try {
        const date = dates[i]
        console.log(`正在获取第 ${i + 1}/${dates.length} 天双埋点数据: ${date}`)
        
        // 更新Loading消息
        hideLoading()
        const newHideLoading = message.loading(`正在获取双埋点数据... (${i + 1}/${dates.length}天)`, 0)
        
        // 获取访问数据
        const visitResponse = await yeepayAPI.searchBuryPointData({
          pageSize: currentPageSize,
          date: date,
          selectedPointId: 110
        })
        const dayVisitData = visitResponse.data?.dataList || []
        allVisitData.push(...dayVisitData)
        console.log(`  ${date} 访问数据: ${dayVisitData.length} 条`)
        
        // 获取点击数据
        const clickResponse = await yeepayAPI.searchBuryPointData({
          pageSize: currentPageSize,
          date: date,
          selectedPointId: 109
        })
        const dayClickData = clickResponse.data?.dataList || []
        allClickData.push(...dayClickData)
        console.log(`  ${date} 点击数据: ${dayClickData.length} 条`)
        
        // 短暂延迟，避免请求过快
        if (i < dates.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
        
        newHideLoading()
      } catch (error) {
        console.error(`获取 ${dates[i]} 双埋点数据失败:`, error)
        hideLoading()
        // 继续获取其他天的数据
      }
    }
    
    // 隐藏Loading
    hideLoading()
    
    // 关联所有数据
    const correlatedData = correlateVisitAndClickData(allVisitData, allClickData)
    
    console.log(`双埋点批量获取完成: 访问${allVisitData.length}条 + 点击${allClickData.length}条 = 关联${correlatedData.length}条`)
    console.log('====================================')
    
    return {
      data: correlatedData,
      visitData: allVisitData,
      clickData: allClickData,
      total: correlatedData.length,
      dateRange: `${dates[0]} 至 ${dates[dates.length - 1]}`,
      mode: 'dual'
    }
  }

  // 关联访问和点击数据
  const correlateVisitAndClickData = (visitData, clickData) => {
    const correlatedData = []
    
    // 为访问数据添加点击信息
    visitData.forEach(visit => {
      const visitTime = new Date(visit.createdAt)
      const visitCustomerKey = visit.weCustomerKey
      const visitPageName = visit.pageName
      
      // 查找同一用户在同一页面的点击行为（时间窗口：前后5分钟）
      const relatedClicks = clickData.filter(click => {
        const clickTime = new Date(click.createdAt)
        const timeDiff = Math.abs(clickTime - visitTime) / (1000 * 60) // 分钟
        return click.weCustomerKey === visitCustomerKey && 
               click.pageName === visitPageName && 
               timeDiff <= 5
      })
      
      // 创建关联数据
      const correlatedItem = {
        ...visit,
        dataType: 'visit',
        relatedClicks: relatedClicks,
        clickCount: relatedClicks.length,
        hasClicks: relatedClicks.length > 0
      }
      
      correlatedData.push(correlatedItem)
    })
    
    // 为点击数据添加访问信息
    clickData.forEach(click => {
      const clickTime = new Date(click.createdAt)
      const clickCustomerKey = click.weCustomerKey
      const clickPageName = click.pageName
      
      // 查找同一用户在同一页面的访问行为（时间窗口：前后5分钟）
      const relatedVisits = visitData.filter(visit => {
        const visitTime = new Date(visit.createdAt)
        const timeDiff = Math.abs(visitTime - clickTime) / (1000 * 60) // 分钟
        return visit.weCustomerKey === clickCustomerKey && 
               visit.pageName === clickPageName && 
               timeDiff <= 5
      })
      
      // 创建关联数据
      const correlatedItem = {
        ...click,
        dataType: 'click',
        relatedVisits: relatedVisits,
        visitCount: relatedVisits.length,
        hasVisits: relatedVisits.length > 0
      }
      
      correlatedData.push(correlatedItem)
    })
    
    // 按时间排序
    correlatedData.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    
    return correlatedData
  }

  // 批量获取多天数据
  const fetchMultiDayData = async (analysisMode, dateRange) => {
    if (analysisMode === 'dual') {
      return await fetchDualBuryPointData(dateRange)
    } else {
      return await fetchSingleBuryPointData(dateRange)
    }
  }

  // 加载可用的页面列表
  const loadAvailablePages = async () => {
    try {
      const queryDate = dayjs().format('YYYY-MM-DD')
      const response = await yeepayAPI.searchBuryPointData({
        pageSize: 1000,
        date: queryDate
      })
      
      const data = response.data?.dataList || []
      
      // 提取所有唯一的页面名称并排序
      const pageSet = new Set(data.map(item => item.pageName).filter(name => name))
      availablePages.value = Array.from(pageSet).sort()
      
      console.log('加载到', availablePages.value.length, '个可用页面')
    } catch (error) {
      console.warn('加载页面列表失败:', error)
    }
  }

  // 验证连接
  const validateConnection = async () => {
    try {
      await yeepayAPI.validateToken()
      store.dispatch('updateSystemStatus', {
        dataConnected: true,
        lastUpdate: new Date().toISOString()
      })
      return true
    } catch (error) {
      console.warn('API连接验证失败，将使用模拟数据:', error)
      
      // 显示更详细的错误信息
      if (error.response) {
        console.error('服务器返回错误:', {
          状态码: error.response.status,
          错误数据: error.response.data,
          请求URL: error.config?.url,
          请求方法: error.config?.method,
          请求数据: error.config?.data
        })
      }
      
      store.dispatch('updateSystemStatus', {
        dataConnected: false,
        lastUpdate: new Date().toISOString()
      })
      return false
    }
  }

  return {
    fetchProgress,
    availablePages,
    fetchMultiDayData,
    loadAvailablePages,
    validateConnection
  }
}
