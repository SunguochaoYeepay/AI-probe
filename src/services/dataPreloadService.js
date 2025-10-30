/**
 * 数据预加载服务
 * 负责在应用启动时预加载常用数据，减少后续API调用
 */

import dayjs from 'dayjs'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import { yeepayAPI } from '@/api'
import { aggregationService } from '@/utils/aggregationService'
import store from '@/store'
import dataSyncConfigValidator from '@/utils/dataSyncConfigValidator'

// 扩展 dayjs 功能
dayjs.extend(isSameOrBefore)

class DataPreloadService {
  constructor() {
    this.isPreloading = false
    this.preloadProgress = { current: 0, total: 0 }
    this.lastPreloadDate = null
    this.cacheValidityPeriod = 4 * 60 * 60 * 1000 // 4小时（毫秒）
    this.forceRefreshAfter = 24 * 60 * 60 * 1000 // 24小时后强制刷新
    this.smartInvalidationEnabled = true
    
    // 初始化数据同步配置验证器
    dataSyncConfigValidator.init(store)
  }

  /**
   * 初始化数据预加载（支持N埋点模式）
   */
  async init() {
    try {
      console.log('🚀 开始数据预加载检查（N埋点模式）...')
      
      // 使用数据同步配置验证器获取埋点ID
      const selectedPointIds = dataSyncConfigValidator.getDataSyncPointIds()
      
      // 验证配置
      if (!dataSyncConfigValidator.validateDataSyncConfig()) {
        console.log('⏸️ 数据同步配置无效，跳过数据预加载')
        return
      }
      
      if (selectedPointIds.length === 0) {
        console.log('⏸️ 未选择任何埋点，跳过数据预加载')
        return
      }
      
      console.log(`📍 埋点ID列表: [${selectedPointIds.join(', ')}]`)
      
      // 检查是否需要预加载
      const shouldPreload = await this.shouldPreloadData()
      if (!shouldPreload) {
        console.log('✅ 数据已是最新，跳过预加载')
        return
      }

      console.log(`🔍 检查后端SQLite缓存状态...`)
      this.isPreloading = true
      const totalTasks = 7 * selectedPointIds.length
      this.preloadProgress = { current: 0, total: totalTasks }

      // 获取最近7天的数据
      const dates = this.getLast7Days()
      let successCount = 0
      let taskIndex = 0

      // 🚀 配置统一化：只检查后端SQLite缓存，不调用API
      for (const date of dates) {
        for (const pointId of selectedPointIds) {
          try {
            console.log(`🔍 检查后端SQLite: ${date} - 埋点 ${pointId}...`)
            
            // 检查后端SQLite是否有该日期该埋点的数据
            const hasData = await this.getBackendCachedData(date, pointId)
            if (hasData && hasData.length > 0) {
              console.log(`  ✅ 后端SQLite已有数据 (${hasData.length}条)`)
              successCount++
            } else {
              console.log(`  ⚠️ 后端SQLite无数据，等待后端预加载服务处理`)
            }
            
            taskIndex++
            this.preloadProgress.current = taskIndex
            console.log(`  📊 进度 (${taskIndex}/${totalTasks})`)
            
          } catch (error) {
            console.error(`  ❌ 检查后端缓存失败:`, error)
            taskIndex++
            this.preloadProgress.current = taskIndex
          }
        }
      }

      // 更新最后预加载时间
      this.lastPreloadDate = dayjs().format('YYYY-MM-DD')
      localStorage.setItem('lastPreloadDate', this.lastPreloadDate)

      console.log('====================================')
      console.log(`🎉 后端SQLite缓存检查完成！`)
      console.log(`✅ 有数据: ${successCount}/${totalTasks} 个任务`)
      console.log(`📊 覆盖: 7天 × ${selectedPointIds.length}个埋点`)
      console.log(`🚀 配置统一化：前端不再直接调用API，完全依赖后端SQLite缓存`)
      console.log('====================================')
      
    } catch (error) {
      console.error('❌ 数据预加载失败:', error)
    } finally {
      this.isPreloading = false
      this.preloadProgress = { current: 0, total: 0 }
    }
  }

  /**
   * 判断是否需要预加载数据
   */
  async shouldPreloadData() {
    const today = dayjs().format('YYYY-MM-DD')
    const lastPreload = localStorage.getItem('lastPreloadDate')
    
    // 使用数据同步配置验证器获取埋点ID
    const selectedPointIds = dataSyncConfigValidator.getDataSyncPointIds()
    
    if (selectedPointIds.length === 0) {
      console.log('⚠️ 未配置埋点ID，跳过预加载检查')
      return false
    }

    // 检查最近7天是否有缺失的数据（检查所有埋点ID）
    const dates = this.getLast7Days()
    let hasMissingData = false

    for (const pointId of selectedPointIds) {
      for (const date of dates) {
        const hasData = await this.hasCachedData(date, pointId)
        if (!hasData) {
          hasMissingData = true
          console.log(`📊 埋点ID ${pointId} 在 ${date} 缺少数据`)
          break
        }
      }
      if (hasMissingData) break
    }

    // 如果今天已经预加载过且没有缺失数据，跳过
    if (lastPreload === today && !hasMissingData) {
      console.log('✅ 今天已预加载且无缺失数据，跳过预加载')
      return false
    }

    console.log(`🔍 预加载检查结果: 有缺失数据=${hasMissingData}, 埋点数量=${selectedPointIds.length}`)
    return hasMissingData
  }

  /**
   * 获取最近7天的日期列表
   */
  getLast7Days() {
    const dates = []
    for (let i = 6; i >= 0; i--) {
      const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD')
      dates.push(date)
    }
    return dates
  }

  /**
   * 检查指定日期的数据是否已缓存（支持智能失效检查）
   */
  async hasCachedData(date, selectedPointId, options = {}) {
    try {
      // 检查后端数据库是否有缓存数据
      const backendData = await this.getBackendCachedData(date, selectedPointId)
      return backendData && backendData.length > 0
    } catch (error) {
      return false
    }
  }

  /**
   * 验证缓存有效性（智能失效检查）
   */
  async validateCacheValidity(cacheData, date, selectedPointId) {
    try {
      const now = new Date()
      const cachedAt = new Date(cacheData.cachedAt)
      const cacheAge = now - cachedAt
      
      // 1. 基础时间检查
      if (cacheAge > this.forceRefreshAfter) {
        console.log(`🕒 缓存超过24小时，强制失效: ${date} - 埋点 ${selectedPointId}`)
        return false
      }
      
      // 2. 对于今天和昨天的数据，更严格的检查
      const isRecent = dayjs(date).isAfter(dayjs().subtract(2, 'day'))
      if (isRecent && cacheAge > this.cacheValidityPeriod) {
        console.log(`⏰ 最近数据缓存超过4小时，需要刷新: ${date} - 埋点 ${selectedPointId}`)
        
        // 快速检查API是否有更新的数据
        const hasNewerData = await this.checkForNewerData(cacheData, date, selectedPointId)
        if (hasNewerData) {
          console.log(`🆕 发现更新的数据: ${date} - 埋点 ${selectedPointId}`)
          return false
        }
      }
      
      // 3. 数据完整性检查
      const isDataComplete = await this.checkDataCompleteness(cacheData, date, selectedPointId)
      if (!isDataComplete) {
        console.log(`📊 数据不完整，需要重新获取: ${date} - 埋点 ${selectedPointId}`)
        return false
      }
      
      return true
      
    } catch (error) {
      console.warn(`缓存验证出错: ${error.message}`)
      return true // 出错时保守处理，认为缓存有效
    }
  }

  /**
   * 检查是否有更新的数据
   */
  async checkForNewerData(cacheData, date, selectedPointId) {
    try {
      // 获取缓存中最新的数据时间
      const cachedLatestTime = Math.max(...cacheData.data.map(d => new Date(d.createdAt).getTime()))
      
      // 🚀 修复：不再直接调用API，只检查后端SQLite缓存
      const response = await this.getBackendCachedData(date, selectedPointId)
      if (!response || response.length === 0) {
        return false // 后端无数据，认为需要更新
      }
      
      const apiData = response || []
      if (apiData.length === 0) {
        return false
      }
      
      const apiLatestTime = Math.max(...apiData.map(d => new Date(d.createdAt).getTime()))
      
      // 如果API数据比缓存数据新超过2分钟，认为有更新
      return apiLatestTime > cachedLatestTime + 2 * 60 * 1000
      
    } catch (error) {
      console.warn(`检查新数据失败: ${error.message}`)
      return false
    }
  }

  /**
   * 检查数据完整性
   */
  async checkDataCompleteness(cacheData, date, selectedPointId) {
    try {
      // 对于今天的数据，检查是否可能不完整
      if (dayjs(date).isSame(dayjs(), 'day')) {
        const now = new Date()
        const latestCacheTime = Math.max(...cacheData.data.map(d => new Date(d.createdAt).getTime()))
        
        // 如果缓存中最新数据超过2小时前，可能不完整
        if (now - latestCacheTime > 2 * 60 * 60 * 1000) {
          console.log(`📈 今日数据可能不完整，最新记录时间: ${new Date(latestCacheTime).toLocaleString()}`)
          return false
        }
      }
      
      // 检查数据量是否合理（如果数据量异常少，可能不完整）
      const dataCount = cacheData.data.length
      if (dataCount < 5 && !dayjs(date).isSame(dayjs(), 'day')) {
        // 非今天的数据，如果少于5条，可能有问题
        console.log(`📊 数据量异常少 (${dataCount}条)，可能不完整`)
        return false
      }
      
      return true
      
    } catch (error) {
      console.warn(`数据完整性检查失败: ${error.message}`)
      return true
    }
  }

  /**
   * 预加载指定日期的数据（兼容方法，使用第一个选中的埋点）
   */
  async preloadDateData(date) {
    const selectedPointIds = store.state.projectConfig?.selectedBuryPointIds || []
    if (selectedPointIds.length === 0) {
      throw new Error('未选择任何埋点')
    }
    
    // 使用第一个埋点
    return await this.preloadDateDataForPoint(date, selectedPointIds[0])
  }

  /**
   * 预加载指定日期指定埋点的数据（N埋点模式核心方法）
   * 🚀 配置统一化：不再直接调用API，完全依赖后端SQLite缓存
   */
  async preloadDateDataForPoint(date, pointId) {
    try {
      console.log(`🔍 检查后端SQLite缓存: ${date} - 埋点 ${pointId}...`)
      
      // 🚀 配置统一化：只检查后端SQLite缓存，不调用API
      const cachedData = await this.getBackendCachedData(date, pointId)
      
      if (!cachedData || cachedData.length === 0) {
        console.log(`⚠️ 后端SQLite无 ${date} - 埋点 ${pointId} 数据，跳过预加载`)
        return
      }

      console.log(`✅ 后端SQLite已有 ${date} - 埋点 ${pointId} 数据 (${cachedData.length}条)`)
      
    } catch (error) {
      console.error(`检查后端缓存 ${date} - 埋点 ${pointId} 失败:`, error)
      throw error
    }
  }

  /**
   * 获取指定日期的原始数据（兼容方法）
   */
  async fetchDateRawData(date, config) {
    return await this.fetchDateRawDataForPoint(date, config.selectedPointId)
  }

  /**
   * 获取指定日期指定埋点的原始数据（N埋点模式核心方法）
   */
  /**
   * 获取指定日期指定埋点的原始数据（N埋点模式核心方法）
   * 🚀 修复：优先使用后端SQLite缓存，缓存为空时直接调用API
   */
  async fetchDateRawDataForPoint(date, pointId) {
    console.log(`🔍 从后端SQLite获取数据: ${date} - 埋点 ${pointId}...`)
    
    // 1. 优先从后端SQLite获取
    const cachedData = await this.getBackendCachedData(date, pointId)
    
    if (cachedData && cachedData.length > 0) {
      console.log(`✅ 从后端SQLite获取到 ${cachedData.length} 条数据`)
      return cachedData
    }

    // 2. 后端SQLite无数据，直接调用API作为备用方案
    console.log(`⚠️ 后端SQLite无数据，直接调用API获取: ${date} - 埋点 ${pointId}`)
    const apiData = await this.fetchDataFromAPI(date, pointId)
    
    if (apiData && apiData.length > 0) {
      console.log(`✅ 从API获取到 ${apiData.length} 条数据`)
      return apiData
    }

    console.log(`❌ 无法获取 ${date} - 埋点 ${pointId} 的数据`)
    return []
  }

  // 🚀 配置统一化：以下方法已废弃，不再直接调用API
  async fetchDateRawDataForPoint_OLD(date, pointId) {
    let allData = []
    const pageSize = 1000
    
    // 🚀 修复：使用后端SQLite缓存，不再直接调用API
    console.log(`  📡 从后端SQLite获取数据...`)
    const firstResponse = await this.getBackendCachedData(date, pointId)
    
    const total = firstResponse?.length || 0
    const firstPageData = firstResponse?.slice(0, pageSize) || []
    allData.push(...firstPageData)
    
    console.log(`  📊 总记录数: ${total}`)
    console.log(`  📄 第1页: ${firstPageData.length}条`)
    
    // 🔧 修复：更严格的分页判断逻辑
    console.log(`  🔍 分页判断: total=${total}, pageSize=${pageSize}, 第一页数据=${firstPageData.length}`)
    
    // 如果总数为0，直接返回
    if (total === 0) {
      console.log(`  ✅ 无数据，直接返回`)
      return this.filterDataByDate(allData, date)
    }
    
    // 如果第一页数据量等于total，说明只有一页数据
    if (firstPageData.length === total) {
      console.log(`  ✅ 只有一页数据: ${allData.length}/${total} 条`)
      return this.filterDataByDate(allData, date)
    }
    
    // 计算总页数
    const totalPages = Math.ceil(total / pageSize)
    console.log(`  📄 需要获取 ${totalPages} 页 (total=${total}, pageSize=${pageSize})`)
    
    // 🔧 修复：增加分页限制，防止数据截断
    const maxPages = 100 // 从50页增加到100页，防止数据截断
    if (totalPages > maxPages) {
      console.warn(`  ⚠️ 总页数过多(${totalPages}页)，限制为${maxPages}页`)
      const limitedTotal = maxPages * pageSize
      console.log(`  📊 限制后预期数据量: ${limitedTotal} 条`)
    }
    
    // 获取剩余页面
    const actualPages = Math.min(totalPages, maxPages)
    for (let page = 2; page <= actualPages; page++) {
      console.log(`  📡 获取第${page}/${actualPages}页...`)
      
      try {
        // 🚀 修复：使用后端SQLite缓存，不再直接调用API
        const response = await this.getBackendCachedData(date, pointId)
        if (!response || response.length === 0) {
          console.log(`  ⚠️ 后端SQLite无数据，跳过分页获取`)
          break
        }

        // 模拟分页响应格式
        const startIndex = (page - 1) * pageSize
        const endIndex = startIndex + pageSize
        const dataList = response.slice(startIndex, endIndex)
        allData.push(...dataList)

        console.log(`  📄 第${page}页: ${dataList.length}条`)
        
        // 如果某一页返回的数据为空，可能已经到达最后一页
        if (dataList.length === 0) {
          console.log(`  ⚠️ 第${page}页无数据，可能已到达最后一页`)
          break
        }
        
        // 防止请求过快
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`  ❌ 获取第${page}页失败:`, error)
        // 继续获取下一页，不中断整个流程
      }
    }
    
    // 验证数据完整性
    console.log(`  📊 数据完整性检查: 实际获取${allData.length}条，API total=${total}条`)
    
    if (allData.length !== total) {
      const difference = Math.abs(allData.length - total)
      const differencePercent = (difference / total * 100).toFixed(2)
      
      if (differencePercent > 5) {
        console.warn(`  ⚠️ 数据不完整: 期望${total}条，实际${allData.length}条，差异${differencePercent}%`)
        console.warn(`  💡 可能原因: API total字段不准确，或分页获取不完整`)
      } else {
        console.log(`  ✅ 数据基本完整: 差异${differencePercent}%在可接受范围内`)
      }
    } else {
      console.log(`  ✅ 数据完全一致: ${allData.length}/${total} 条`)
    }

    // 🔧 关键修复：严格按日期过滤数据
    return this.filterDataByDate(allData, date)
  }

  /**
   * 按日期严格过滤数据（防止跨天数据）
   */
  filterDataByDate(data, targetDate) {
    if (!data || data.length === 0) {
      return data
    }

    const filteredData = data.filter(item => {
      if (!item.createdAt) {
        console.warn(`  ⚠️ 记录缺少createdAt字段:`, item.id)
        return false
      }

      try {
        const itemDate = new Date(item.createdAt).toISOString().split('T')[0]
        return itemDate === targetDate
      } catch (error) {
        console.warn(`  ⚠️ 日期解析失败:`, item.createdAt, error.message)
        return false
      }
    })

    const removedCount = data.length - filteredData.length
    if (removedCount > 0) {
      console.log(`  🧹 日期过滤: 移除${removedCount}条跨天数据，保留${filteredData.length}条`)
      
      // 检查被移除数据的日期分布
      const removedDates = {}
      data.forEach(item => {
        if (item.createdAt) {
          try {
            const itemDate = new Date(item.createdAt).toISOString().split('T')[0]
            if (itemDate !== targetDate) {
              removedDates[itemDate] = (removedDates[itemDate] || 0) + 1
            }
          } catch (e) {
            // 忽略解析错误的日期
          }
        }
      })
      
      if (Object.keys(removedDates).length > 0) {
        console.log(`  📅 被移除的跨天数据分布:`, removedDates)
      }
    }

    return filteredData
  }

  /**
   * 缓存原始数据
   */
  async cacheRawData(date, data, selectedPointId) {
    // 🚀 简化架构：不再使用前端缓存
    // 数据现在由后端统一管理和缓存
    console.log(`📝 数据已由后端服务缓存: ${date} - 埋点${selectedPointId}`)
  }

  /**
   * 获取当前配置
   */
  getCurrentConfig() {
    // 从Vuex store获取配置
    const storeConfig = store.state.apiConfig
    if (storeConfig && storeConfig.selectedPointId) {
      return {
        selectedPointId: storeConfig.selectedPointId,
        projectId: storeConfig.projectId
      }
    }
    
    // 从store的projectConfig获取新的分离配置
    const projectConfig = store.state.projectConfig
    if (projectConfig && (projectConfig.visitBuryPointId || projectConfig.clickBuryPointId)) {
      // 优先使用点击埋点，如果没有则使用访问埋点
      const selectedPointId = projectConfig.clickBuryPointId || projectConfig.visitBuryPointId
      return {
        selectedPointId: selectedPointId,
        projectId: storeConfig?.projectId || 'event1021'
      }
    }
    
    // 注意：已移除旧配置方式（selectedBuryPointIds）和localStorage备用方案
    // 现在完全依赖数据库配置，确保配置一致性
    
    // 默认配置（返回null，强制用户配置）
    console.warn('⚠️ 未找到有效的埋点配置，请在配置管理中选择埋点')
    return {
      selectedPointId: null,
      projectId: storeConfig?.projectId || 'event1021'
    }
  }

  /**
   * 获取缓存的原始数据
   * 🚀 修复：优先使用后端SQLite缓存，缓存为空时直接调用API
   */
  async getCachedRawData(date, selectedPointId) {
    try {
      // 1. 优先从后端数据库获取
      console.log(`🔍 尝试从后端数据库获取 ${date} - 埋点${selectedPointId} 数据...`)
      const backendData = await this.getBackendCachedData(date, selectedPointId)
      if (backendData && backendData.length > 0) {
        console.log(`✅ 从后端数据库获取到 ${backendData.length} 条数据`)
        return backendData
      }

      // 2. 后端无数据，直接调用API作为备用方案
      console.log(`📡 后端无数据，直接调用API获取 ${date} - 埋点${selectedPointId} 数据...`)
      const apiData = await this.fetchDataFromAPI(date, selectedPointId)
      if (apiData && apiData.length > 0) {
        console.log(`✅ 从API获取到 ${apiData.length} 条数据`)
        return apiData
      }

      console.log(`📭 无法获取 ${date} - 埋点${selectedPointId} 的数据`)
      return []
    } catch (error) {
      console.error(`获取 ${date} 数据失败 [埋点:${selectedPointId}]:`, error)
      return []
    }
  }

  /**
   * 从后端数据库获取缓存数据
   */
  async getBackendCachedData(date, selectedPointId, debugMode = false) {
    try {
      const response = await fetch(`http://localhost:3004/api/cache/raw-data/${selectedPointId}/${date}`)
      if (response.ok) {
        const data = await response.json()
        console.log(`✅ 从后端获取到缓存数据: ${date} - 埋点${selectedPointId} (${data.length}条)`)
        return data || []
      } else if (response.status === 404) {
        // 数据不存在，在调试模式下输出日志
        if (debugMode) {
          console.log(`⚠️ 后端缓存无数据: ${date} - 埋点${selectedPointId} (404)`)
        }
        return []
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      // 只在非404错误时输出警告
      if (!error.message.includes('404')) {
        console.warn(`从后端获取缓存数据失败: ${error.message}`)
      }
      return []
    }
  }

  /**
   * 直接从API获取数据（后端无缓存时的备用方案）
   */
  async fetchDataFromAPI(date, selectedPointId) {
    try {
      const config = this.getCurrentConfig()
      const response = await yeepayAPI.searchBuryPointData({
        selectedPointId: selectedPointId,
        date: date,
        pageSize: 10000
      })
      
      if (response?.data?.dataList) {
        return response.data.dataList
      }
      return []
    } catch (error) {
      console.error('从API获取数据失败:', error)
      return []
    }
  }

  /**
   * 获取多天缓存数据
   */
  async getMultiDayCachedData(dateRange, selectedPointId) {
    let [startDate, endDate] = dateRange
    
    // 转换 dayjs 对象为字符串格式
    if (startDate && typeof startDate === 'object' && startDate.format) {
      startDate = startDate.format('YYYY-MM-DD')
    }
    if (endDate && typeof endDate === 'object' && endDate.format) {
      endDate = endDate.format('YYYY-MM-DD')
    }
    
    const dates = this.getDatesBetween(startDate, endDate)
    const allData = []

    // 如果没有提供埋点ID，使用当前配置的埋点ID
    if (!selectedPointId) {
      const config = this.getCurrentConfig()
      selectedPointId = config.selectedPointId
    }

    console.log('====================================')
    console.log(`🔍 检查多天缓存数据`)
    console.log(`📊 日期数量: ${dates.length}个`)
    console.log(`📅 日期列表: ${dates.join(', ')}`)
    console.log(`🎯 埋点ID: ${selectedPointId}`)
    console.log('====================================')

    for (const date of dates) {
      const cacheId = `raw_${selectedPointId}_${date}`
      console.log(`🔑 检查缓存ID: ${cacheId}`)
      const dayData = await this.getCachedRawData(date, selectedPointId)
      if (dayData && dayData.length > 0) {
        console.log(`✅ ${date}: 找到缓存 ${dayData.length}条`)
        allData.push(...dayData)
      } else {
        console.log(`❌ ${date}: 无缓存数据`)
        // 🚀 简化架构：不再检查前端缓存
        console.log(`  🔍 数据由后端服务管理`)
      }
    }

    console.log('====================================')
    console.log(`📈 总计缓存数据: ${allData.length}条`)
    if (allData.length === 0) {
      console.log(`⚠️ 警告：没有找到任何缓存数据！`)
      console.log(`💡 提示：请先在配置管理中点击"启动数据预加载"`)
    }
    console.log('====================================')
    return allData
  }

  /**
   * 获取两个日期之间的所有日期
   */
  getDatesBetween(startDate, endDate) {
    console.log('🔍 getDatesBetween 被调用，输入参数:')
    console.log('  startDate:', startDate, 'type:', typeof startDate)
    console.log('  endDate:', endDate, 'type:', typeof endDate)
    
    const dates = []
    
    // 确保输入是字符串格式，如果不是则转换
    let startStr, endStr
    if (typeof startDate === 'string') {
      startStr = startDate
      console.log('  startDate 是字符串，直接使用:', startStr)
    } else if (startDate && typeof startDate === 'object' && startDate.format) {
      startStr = startDate.format('YYYY-MM-DD')
      console.log('  startDate 是dayjs对象，转换为:', startStr)
    } else {
      startStr = dayjs(startDate).format('YYYY-MM-DD')
      console.log('  startDate 是其他格式，转换为:', startStr)
    }
    
    if (typeof endDate === 'string') {
      endStr = endDate
      console.log('  endDate 是字符串，直接使用:', endStr)
    } else if (endDate && typeof endDate === 'object' && endDate.format) {
      endStr = endDate.format('YYYY-MM-DD')
      console.log('  endDate 是dayjs对象，转换为:', endStr)
    } else {
      endStr = dayjs(endDate).format('YYYY-MM-DD')
      console.log('  endDate 是其他格式，转换为:', endStr)
    }
    
    const start = dayjs(startStr)
    const end = dayjs(endStr)
    
    console.log('  转换后的dayjs对象:')
    console.log('    start:', start, 'isSameOrBefore方法:', typeof start.isSameOrBefore)
    console.log('    end:', end)
    
    let current = start
    while (current.isSameOrBefore(end)) {
      dates.push(current.format('YYYY-MM-DD'))
      current = current.add(1, 'day')
    }
    
    console.log('  生成的日期列表:', dates)
    return dates
  }

  /**
   * 清理过期缓存
   * 🚀 简化架构：缓存由后端服务管理
   */
  async cleanExpiredCache() {
    console.log('🧹 缓存由后端服务统一管理，无需前端清理')
  }

  /**
   * 手动触发预加载（用于配置完成后）
   */
  async triggerPreload() {
    console.log('🔄 手动触发数据预加载...')
    
    // 强制清除预加载标记，确保执行预加载
    localStorage.removeItem('lastPreloadDate')
    console.log('🗑️ 已清除预加载标记，强制执行预加载')
    
    await this.init()
  }

  /**
   * 获取预加载状态
   */
  getStatus() {
    return {
      isPreloading: this.isPreloading,
      progress: this.preloadProgress,
      lastPreloadDate: this.lastPreloadDate,
      smartInvalidationEnabled: this.smartInvalidationEnabled,
      cacheValidityPeriod: this.cacheValidityPeriod / (60 * 60 * 1000) // 转换为小时
    }
  }

  /**
   * 启用/禁用智能缓存失效
   */
  setSmartInvalidation(enabled) {
    this.smartInvalidationEnabled = enabled
    console.log(`🧠 智能缓存失效: ${enabled ? '已启用' : '已禁用'}`)
  }

  /**
   * 设置缓存有效期
   */
  setCacheValidityPeriod(hours) {
    this.cacheValidityPeriod = hours * 60 * 60 * 1000
    console.log(`⏰ 缓存有效期设置为: ${hours} 小时`)
  }

  /**
   * 强制刷新所有缓存
   * 🚀 简化架构：只触发后端数据预加载服务
   */
  async forceRefreshAll() {
    const selectedPointIds = store.state.projectConfig?.selectedBuryPointIds || []
    
    if (selectedPointIds.length === 0) {
      console.warn('⚠️ 未选择任何埋点，无法执行强制刷新')
      return
    }

    console.log('🔄 开始强制刷新所有缓存...')
    
    try {
      // 触发后端数据预加载服务刷新
      const response = await fetch('http://localhost:3004/api/preload/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        console.log('✅ 后端数据预加载服务已触发')
      } else {
        console.warn('⚠️ 后端服务不可用，无法执行强制刷新')
      }
    } catch (error) {
      console.warn('⚠️ 后端服务不可用，无法执行强制刷新:', error)
    }
    
    console.log('✅ 强制刷新完成')
  }
}

// 创建单例实例
export const dataPreloadService = new DataPreloadService()
