/**
 * 数据预加载服务
 * 负责在应用启动时预加载常用数据，减少后续API调用
 */

import dayjs from 'dayjs'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import { chartDB } from '@/utils/indexedDBManager'
import { yeepayAPI } from '@/api'
import { aggregationService } from '@/utils/aggregationService'
import store from '@/store'

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
  }

  /**
   * 初始化数据预加载（支持N埋点模式）
   */
  async init() {
    try {
      console.log('🚀 开始数据预加载检查（N埋点模式）...')
      
      // 获取埋点ID（优先使用新的分离配置）
      const projectConfig = store.state.projectConfig
      let selectedPointIds = []
      
      // 优先使用新的分离配置
      if (projectConfig.visitBuryPointId || projectConfig.clickBuryPointId) {
        if (projectConfig.visitBuryPointId) {
          selectedPointIds.push(projectConfig.visitBuryPointId)
        }
        if (projectConfig.clickBuryPointId && projectConfig.clickBuryPointId !== projectConfig.visitBuryPointId) {
          selectedPointIds.push(projectConfig.clickBuryPointId)
        }
        console.log(`📋 使用分离配置: 访问埋点=${projectConfig.visitBuryPointId}, 点击埋点=${projectConfig.clickBuryPointId}`)
      } else {
        // 回退到旧的配置方式
        selectedPointIds = projectConfig?.selectedBuryPointIds || []
        console.log(`📋 使用旧配置: 选中 ${selectedPointIds.length} 个埋点`)
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

      console.log(`📊 开始预加载最近7天 × ${selectedPointIds.length}个埋点的数据...`)
      this.isPreloading = true
      const totalTasks = 7 * selectedPointIds.length
      this.preloadProgress = { current: 0, total: totalTasks }

      // 获取最近7天的数据
      const dates = this.getLast7Days()
      let successCount = 0
      let taskIndex = 0

      // 遍历每一天
      for (const date of dates) {
        // 遍历每个埋点
        for (const pointId of selectedPointIds) {
          try {
            console.log(`📅 预加载 ${date} - 埋点 ${pointId}...`)
            
            // 检查该日期该埋点的数据是否已存在
            const hasData = await this.hasCachedData(date, pointId)
            if (hasData) {
              console.log(`  ✅ 数据已存在，跳过`)
              taskIndex++
              this.preloadProgress.current = taskIndex
              continue
            }

            // 获取该日期该埋点的数据
            await this.preloadDateDataForPoint(date, pointId)
            successCount++
            
            taskIndex++
            this.preloadProgress.current = taskIndex
            console.log(`  ✅ 完成 (${taskIndex}/${totalTasks})`)
            
          } catch (error) {
            console.error(`  ❌ 预加载失败:`, error)
            taskIndex++
            this.preloadProgress.current = taskIndex
          }
        }
      }

      // 更新最后预加载时间
      this.lastPreloadDate = dayjs().format('YYYY-MM-DD')
      localStorage.setItem('lastPreloadDate', this.lastPreloadDate)

      console.log('====================================')
      console.log(`🎉 数据预加载完成！`)
      console.log(`✅ 成功: ${successCount}/${totalTasks} 个任务`)
      console.log(`📊 覆盖: 7天 × ${selectedPointIds.length}个埋点`)
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
    
    // 获取当前配置的埋点ID列表（与init方法保持一致）
    const projectConfig = store.state.projectConfig
    let selectedPointIds = []
    
    // 优先使用新的分离配置
    if (projectConfig.visitBuryPointId || projectConfig.clickBuryPointId) {
      if (projectConfig.visitBuryPointId) {
        selectedPointIds.push(projectConfig.visitBuryPointId)
      }
      if (projectConfig.clickBuryPointId && projectConfig.clickBuryPointId !== projectConfig.visitBuryPointId) {
        selectedPointIds.push(projectConfig.clickBuryPointId)
      }
    } else {
      // 回退到旧的配置方式
      selectedPointIds = projectConfig?.selectedBuryPointIds || []
    }
    
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
      // 检查原始数据缓存（包含埋点ID）
      const cacheId = `raw_${selectedPointId}_${date}`
      const rawData = await chartDB.getRawDataCache(cacheId)
      
      if (!rawData || !rawData.data || rawData.data.length === 0) {
        return false
      }

      // 如果启用智能失效检查
      if (this.smartInvalidationEnabled && !options.skipSmartCheck) {
        const isValid = await this.validateCacheValidity(rawData, date, selectedPointId)
        if (!isValid) {
          console.log(`⚠️ 缓存 ${cacheId} 未通过智能验证，标记为无效`)
          return false
        }
      }
      
      return true
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
      
      // 向API请求第一页数据，检查是否有更新
      const response = await yeepayAPI.searchBuryPointData({
        pageSize: 10, // 只取少量数据进行比较
        page: 1,
        date,
        selectedPointId
      })
      
      const apiData = response.data?.dataList || []
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
   */
  async preloadDateDataForPoint(date, pointId) {
    try {
      console.log(`📡 获取 ${date} - 埋点 ${pointId} 原始数据...`)
      
      // 获取原始数据
      const rawData = await this.fetchDateRawDataForPoint(date, pointId)
      
      if (!rawData || rawData.length === 0) {
        console.log(`⚠️ ${date} - 埋点 ${pointId} 无数据`)
        return
      }

      // 缓存原始数据
      await this.cacheRawData(date, rawData, pointId)
      
      console.log(`💾 ${date} - 埋点 ${pointId} 数据已缓存 (${rawData.length}条)`)
      
    } catch (error) {
      console.error(`预加载 ${date} - 埋点 ${pointId} 数据失败:`, error)
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
  async fetchDateRawDataForPoint(date, pointId) {
    let allData = []
    const pageSize = 1000
    
    // 先获取第一页，确定总数
    console.log(`  📡 获取第1页...`)
    const firstResponse = await yeepayAPI.searchBuryPointData({
      pageSize,
      page: 1,
      date,
      selectedPointId: pointId
    })
    
    const total = firstResponse.data?.total || 0
    const firstPageData = firstResponse.data?.dataList || []
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
    
    // 🔧 添加安全检查：如果total异常大，限制最大页数
    const maxPages = 50 // 最多获取50页，防止无限循环
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
        const response = await yeepayAPI.searchBuryPointData({
          pageSize,
          page,
          date,
          selectedPointId: pointId
        })

        const dataList = response.data?.dataList || []
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
    const cacheData = {
      id: `raw_${selectedPointId}_${date}`, // 包含埋点ID
      date,
      selectedPointId, // 记录埋点ID
      data,
      cachedAt: new Date().toISOString(),
      expiresAt: dayjs().add(30, 'day').toISOString() // 30天过期
    }

    await chartDB.saveRawDataCache(cacheData)
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
    
    // 从store的projectConfig获取选中的埋点列表（旧配置方式）
    if (projectConfig && projectConfig.selectedBuryPointIds && projectConfig.selectedBuryPointIds.length > 0) {
      return {
        selectedPointId: projectConfig.selectedBuryPointIds[0],
        projectId: storeConfig?.projectId || 'event1021'
      }
    }
    
    // 从localStorage获取配置（备用）
    const selectedBuryPointIds = JSON.parse(localStorage.getItem('selectedBuryPointIds') || '[]')
    if (selectedBuryPointIds.length > 0) {
      return {
        selectedPointId: selectedBuryPointIds[0],
        projectId: storeConfig?.projectId || 'event1021'
      }
    }
    
    // 默认配置（返回null，强制用户配置）
    console.warn('⚠️ 未找到有效的埋点配置，请在配置管理中选择埋点')
    return {
      selectedPointId: null,
      projectId: storeConfig?.projectId || 'event1021'
    }
  }

  /**
   * 获取缓存的原始数据
   */
  async getCachedRawData(date, selectedPointId) {
    try {
      const cacheId = `raw_${selectedPointId}_${date}`
      const cacheData = await chartDB.getRawDataCache(cacheId)
      return cacheData?.data || []
    } catch (error) {
      console.error(`获取 ${date} 缓存数据失败 [埋点:${selectedPointId}]:`, error)
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
        // 尝试检查原始缓存数据
        try {
          const rawCacheData = await chartDB.getRawDataCache(cacheId)
          if (rawCacheData) {
            console.log(`  🔍 原始缓存数据存在但为空:`, rawCacheData)
          } else {
            console.log(`  🔍 原始缓存数据不存在`)
          }
        } catch (e) {
          console.log(`  🔍 检查原始缓存数据失败:`, e.message)
        }
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
   */
  async cleanExpiredCache() {
    try {
      await chartDB.cleanExpiredCache()
      console.log('🧹 过期缓存已清理')
    } catch (error) {
      console.error('清理过期缓存失败:', error)
    }
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
   * 强制刷新所有缓存（绕过智能检查）
   */
  async forceRefreshAll() {
    const selectedPointIds = store.state.projectConfig?.selectedBuryPointIds || []
    
    if (selectedPointIds.length === 0) {
      console.warn('⚠️ 未选择任何埋点，无法执行强制刷新')
      return
    }

    console.log('🔄 开始强制刷新所有缓存...')
    
    // 清理所有相关缓存
    const dates = this.getLast7Days()
    for (const pointId of selectedPointIds) {
      for (const date of dates) {
        const cacheId = `raw_${pointId}_${date}`
        try {
          await chartDB._executeTransaction('raw_data_cache', 'readwrite', (store) => {
            return store.delete(cacheId)
          })
        } catch (error) {
          // 忽略删除错误
        }
      }
    }

    // 重置预加载标记
    localStorage.removeItem('lastPreloadDate')
    
    // 触发重新预加载
    await this.init()
    
    console.log('✅ 强制刷新完成')
  }
}

// 创建单例实例
export const dataPreloadService = new DataPreloadService()
