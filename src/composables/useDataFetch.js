import { ref } from 'vue'
import { useStore } from 'vuex'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { yeepayAPI } from '@/api'
import { dataPreloadService } from '@/services/dataPreloadService'
import { API_CONFIG } from '@/config/api'

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
    
    // 获取动态埋点配置（与fetchMultiDayData保持一致）
    const apiConfig = store.state.apiConfig
    const projectConfig = store.state.projectConfig
    let selectedPointId = null
    
    // 优先使用apiConfig中的埋点ID（与缓存逻辑保持一致）
    if (apiConfig && apiConfig.selectedPointId) {
      selectedPointId = apiConfig.selectedPointId
      console.log(`使用API配置的埋点: ${selectedPointId}`)
    } else if (projectConfig.selectedBuryPointIds && projectConfig.selectedBuryPointIds.length > 0) {
      // 回退到用户选择的埋点
      selectedPointId = projectConfig.selectedBuryPointIds[0]
      console.log(`使用用户选择的埋点: ${selectedPointId}`)
    } else if (projectConfig.hasVisitPoint || projectConfig.hasClickPoint) {
      // 使用动态配置，优先使用访问埋点
      selectedPointId = projectConfig.visitPoint?.id || projectConfig.clickPoint?.id
      console.log(`使用动态埋点配置: ${selectedPointId}`)
    } else {
      // 使用默认配置
      selectedPointId = API_CONFIG.defaultBuryPoints.visit.id
      console.log(`使用默认埋点配置: ${selectedPointId}`)
    }
    
    // 显示全局Loading
    const hideLoading = message.loading(`正在获取数据... (0/${dates.length}天)`, 0)
    
    const allData = []
    const currentPageSize = store.state.apiConfig.pageSize || 1000
    let totalRequests = 0 // 统计总请求数
    
    console.log(`🚀 开始获取${dates.length}天数据，预计最多${dates.length * 25}个请求`)
    
    for (let i = 0; i < dates.length; i++) {
      try {
        console.log(`正在获取第 ${i + 1}/${dates.length} 天数据: ${dates[i]}`)
        
        // 更新Loading消息
        hideLoading()
        const newHideLoading = message.loading(`正在获取数据... (${i + 1}/${dates.length}天)`, 0)
        
        // 获取第一页数据，检查总数
        const firstResponse = await yeepayAPI.searchBuryPointData({
          pageSize: currentPageSize,
          date: dates[i],
          selectedPointId: selectedPointId
        })
        totalRequests++ // 第一页请求
        
        const totalRecords = firstResponse.data?.total || 0
        const firstPageData = firstResponse.data?.dataList || []
        let dayData = [...firstPageData]
        
        console.log(`  ${dates[i]}: 后台总数 ${totalRecords}，第一页获取 ${firstPageData.length} 条`)
        
        // 如果总数超过第一页，需要分页获取所有数据
        if (totalRecords > currentPageSize) {
          const totalPages = Math.ceil(totalRecords / currentPageSize)
          console.log(`  ${dates[i]}: 需要分页获取，共 ${totalPages} 页，预计请求数: ${totalPages}`)
          
          // 如果页数过多，给出警告
          if (totalPages > 20) {
            console.warn(`⚠️  ${dates[i]}: 页数过多(${totalPages}页)，可能影响性能`)
          }
          
          for (let page = 2; page <= totalPages; page++) {
            console.log(`    获取第 ${page}/${totalPages} 页...`)
            const pageResponse = await yeepayAPI.searchBuryPointData({
              pageSize: currentPageSize,
              page: page,
              date: dates[i],
              selectedPointId: selectedPointId
            })
            
            const pageData = pageResponse.data?.dataList || []
            dayData.push(...pageData)
            totalRequests++ // 分页请求
            console.log(`    第 ${page} 页获取 ${pageData.length} 条`)
            
            // 短暂延迟，避免请求过快
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
        
        allData.push(...dayData)
        console.log(`  ${dates[i]}: 总计获取 ${dayData.length} 条数据`)
        
        // 调试：显示前几条数据的实际结构
        if (dayData.length > 0) {
          console.log(`  ${dates[i]} 前3条数据结构:`, dayData.slice(0, 3).map(d => ({
            id: d.id,
            pageName: d.pageName,
            type: d.type,
            createdAt: d.createdAt,
            hasAllFields: !!(d.id && d.pageName && d.type && d.createdAt),
            allKeys: Object.keys(d),
            weCustomerKey: d.weCustomerKey,
            content: d.content
          })))
        }
        
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
    console.log(`📊 请求统计: 总请求数 ${totalRequests}，平均每天 ${(totalRequests/dates.length).toFixed(1)} 个请求`)
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
        
        // 获取动态埋点配置
        const projectConfig = store.state.projectConfig
        let visitPointId = null
        let clickPointId = null
        
        if (projectConfig.hasVisitPoint && projectConfig.hasClickPoint) {
          // 使用动态配置
          visitPointId = projectConfig.visitPoint?.id
          clickPointId = projectConfig.clickPoint?.id
          console.log(`使用动态双埋点配置: 访问${visitPointId}, 点击${clickPointId}`)
        } else {
          // 使用默认配置
          visitPointId = API_CONFIG.defaultBuryPoints.visit.id
          clickPointId = API_CONFIG.defaultBuryPoints.click.id
          console.log(`使用默认双埋点配置: 访问${visitPointId}, 点击${clickPointId}`)
        }
        
        // 获取访问数据
        const visitResponse = await yeepayAPI.searchBuryPointData({
          pageSize: currentPageSize,
          date: date,
          selectedPointId: visitPointId
        })
        const dayVisitData = visitResponse.data?.dataList || []
        allVisitData.push(...dayVisitData)
        console.log(`  ${date} 访问数据: ${dayVisitData.length} 条`)
        
        // 获取点击数据
        const clickResponse = await yeepayAPI.searchBuryPointData({
          pageSize: currentPageSize,
          date: date,
          selectedPointId: clickPointId
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

  // 数据缓存
  const dataCache = ref(new Map())
  
  // 生成缓存键
  const generateCacheKey = (analysisMode, dateRange) => {
    const [start, end] = dateRange
    // 确保日期格式一致，统一转换为 YYYY-MM-DD 格式
    const startStr = dayjs(start).format('YYYY-MM-DD')
    const endStr = dayjs(end).format('YYYY-MM-DD')
    return `${analysisMode}-${startStr}-${endStr}`
  }
  
  // 批量获取多天数据（优先使用预加载缓存）
  const fetchMultiDayData = async (analysisMode, dateRange) => {
    const cacheKey = generateCacheKey(analysisMode, dateRange)
    
    console.log(`[数据获取] 请求缓存键: ${cacheKey}`)
    console.log(`[数据获取] 分析模式: ${analysisMode}`)
    console.log(`[数据获取] 日期范围: ${dateRange[0]} 至 ${dateRange[1]}`)
    
    // 检查内存缓存
    if (dataCache.value.has(cacheKey)) {
      console.log(`✅ 使用内存缓存数据: ${cacheKey}`)
      return dataCache.value.get(cacheKey)
    }
    
    // 尝试使用预加载的缓存数据
    console.log(`🔍 检查预加载缓存数据...`)
    console.log(`📅 请求日期范围: ${dateRange[0]} 至 ${dateRange[1]}`)
    
    // 获取当前埋点ID
    const currentPointId = store.state.apiConfig?.selectedPointId || 
                          store.state.projectConfig?.selectedBuryPointIds?.[0]
    
    console.log('====================================')
    console.log('🔍 数据获取请求详情:')
    console.log(`📅 日期范围: ${dateRange[0]} 至 ${dateRange[1]}`)
    console.log(`🎯 当前埋点ID: ${currentPointId}`)
    console.log(`📊 分析模式: ${analysisMode}`)
    console.log('====================================')
    
    try {
      const cachedData = await dataPreloadService.getMultiDayCachedData(dateRange, currentPointId)
      
      console.log(`📊 预加载缓存检查结果: ${cachedData ? cachedData.length : 0}条数据`)
      
      if (cachedData && cachedData.length > 0) {
        console.log(`✅✅✅ 缓存命中！使用预加载缓存数据: ${cachedData.length}条 [埋点:${currentPointId}]`)
        console.log(`💡 跳过API调用，直接使用缓存数据`)
        console.log('====================================')
        
        // 根据分析模式处理数据
        let result
        if (analysisMode === 'dual') {
          // 对于双埋点分析，需要进一步处理
          result = {
            data: cachedData,
            totalRequests: 0,
            totalRecords: cachedData.length,
            analysisMode: 'dual'
          }
        } else {
          result = {
            data: cachedData,
            totalRequests: 0,
            totalRecords: cachedData.length,
            analysisMode: 'single'
          }
        }
        
        // 缓存到内存
        dataCache.value.set(cacheKey, result)
        return result
      }
    } catch (error) {
      console.warn('❌ 获取预加载缓存失败，回退到API调用:', error)
    }
    
    // 缓存未命中，从API获取数据
    console.log('====================================')
    console.log(`❌ 缓存未命中！需要从API获取数据`)
    console.log(`🔑 缓存键: ${cacheKey}`)
    console.log(`📡 即将调用API获取数据...`)
    console.log('====================================')
    
    let result
    if (analysisMode === 'dual') {
      result = await fetchDualBuryPointData(dateRange)
    } else {
      result = await fetchSingleBuryPointData(dateRange)
    }
    
    // 缓存结果
    dataCache.value.set(cacheKey, result)
    console.log(`💾 数据已缓存: ${cacheKey}`)
    
    // 清理旧缓存（保留最近5个）
    if (dataCache.value.size > 5) {
      const keys = Array.from(dataCache.value.keys())
      const oldKey = keys[0]
      dataCache.value.delete(oldKey)
      console.log(`🗑️ 清理旧缓存: ${oldKey}`)
    }
    
    return result
  }

  // 加载可用的页面列表
  const loadAvailablePages = async (userDateRange = null) => {
    try {
      console.log('开始加载页面列表...')
      
      // 使用用户选择的日期范围，如果没有则使用默认的7天范围
      let dateRange
      if (userDateRange && userDateRange.length === 2) {
        dateRange = userDateRange
        console.log('使用用户选择的日期范围:', dateRange)
      } else {
        const endDate = dayjs().format('YYYY-MM-DD')
        const startDate = dayjs().subtract(6, 'day').format('YYYY-MM-DD')
        dateRange = [startDate, endDate]
        console.log('使用默认日期范围:', dateRange)
      }
      
      // 使用缓存的数据获取逻辑
      const result = await fetchMultiDayData('single', dateRange)
      const data = result.data // 提取实际的数据数组
      
      // 从实际数据中提取页面名称，过滤掉模板字符串
      const allPages = new Set()
      data.forEach(item => {
        if (item.pageName && !item.pageName.includes('{{') && !item.pageName.includes('}}')) {
          allPages.add(item.pageName)
        }
      })
      
      availablePages.value = Array.from(allPages).sort()
      
      console.log('加载到', availablePages.value.length, '个可用页面（基于实际数据）')
      console.log('页面列表:', availablePages.value.slice(0, 10)) // 显示前10个页面
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

  // 清理缓存
  const clearCache = () => {
    dataCache.value.clear()
    console.log('数据缓存已清理')
  }
  
  return {
    fetchProgress,
    availablePages,
    fetchMultiDayData,
    loadAvailablePages,
    validateConnection,
    clearCache
  }
}
