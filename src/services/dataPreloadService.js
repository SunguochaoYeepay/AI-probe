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
  }

  /**
   * 初始化数据预加载
   */
  async init() {
    try {
      console.log('🚀 开始数据预加载检查...')
      
      // 检查配置是否有效
      const config = this.getCurrentConfig()
      if (!config.selectedPointId || config.selectedPointId === 'default_point_id') {
        console.log('⏸️ 配置未完成，跳过数据预加载')
        return
      }
      
      console.log(`📋 使用配置: projectId=${config.projectId}, selectedPointId=${config.selectedPointId}`)
      
      // 检查是否需要预加载
      const shouldPreload = await this.shouldPreloadData()
      if (!shouldPreload) {
        console.log('✅ 数据已是最新，跳过预加载')
        return
      }

      console.log('📊 开始预加载最近7天数据...')
      this.isPreloading = true
      this.preloadProgress = { current: 0, total: 7 }

      // 获取最近7天的数据
      const dates = this.getLast7Days()
      let successCount = 0

      for (let i = 0; i < dates.length; i++) {
        const date = dates[i]
        try {
          console.log(`📅 预加载 ${date} 数据...`)
          
          // 检查该日期数据是否已存在
          const hasData = await this.hasCachedData(date, config.selectedPointId)
          if (hasData) {
            console.log(`✅ ${date} 数据已存在，跳过 [埋点:${config.selectedPointId}]`)
            this.preloadProgress.current = i + 1
            continue
          }

          // 获取该日期的数据
          await this.preloadDateData(date)
          successCount++
          
          this.preloadProgress.current = i + 1
          console.log(`✅ ${date} 数据预加载完成 (${i + 1}/7)`)
          
        } catch (error) {
          console.error(`❌ ${date} 数据预加载失败:`, error)
        }
      }

      // 更新最后预加载时间
      this.lastPreloadDate = dayjs().format('YYYY-MM-DD')
      localStorage.setItem('lastPreloadDate', this.lastPreloadDate)

      console.log(`🎉 数据预加载完成！成功加载 ${successCount}/7 天数据`)
      
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
    
    // 如果今天已经预加载过，跳过
    if (lastPreload === today) {
      return false
    }

    // 检查最近7天是否有缺失的数据
    const dates = this.getLast7Days()
    let hasMissingData = false

    for (const date of dates) {
      const hasData = await this.hasCachedData(date)
      if (!hasData) {
        hasMissingData = true
        break
      }
    }

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
   * 检查指定日期的数据是否已缓存
   */
  async hasCachedData(date, selectedPointId) {
    try {
      // 检查原始数据缓存（包含埋点ID）
      const cacheId = `raw_${selectedPointId}_${date}`
      const rawData = await chartDB.getRawDataCache(cacheId)
      return rawData && rawData.data && rawData.data.length > 0
    } catch (error) {
      return false
    }
  }

  /**
   * 预加载指定日期的数据
   */
  async preloadDateData(date) {
    try {
      // 获取当前配置
      const currentConfig = this.getCurrentConfig()
      if (!currentConfig.selectedPointId) {
        throw new Error('未配置埋点ID')
      }

      console.log(`📡 获取 ${date} 原始数据...`)
      
      // 获取原始数据
      const rawData = await this.fetchDateRawData(date, currentConfig)
      
      if (!rawData || rawData.length === 0) {
        console.log(`⚠️ ${date} 无数据`)
        return
      }

      // 缓存原始数据
      await this.cacheRawData(date, rawData, currentConfig.selectedPointId)
      
      console.log(`💾 ${date} 数据已缓存 (${rawData.length}条) [埋点:${currentConfig.selectedPointId}]`)
      
    } catch (error) {
      console.error(`预加载 ${date} 数据失败:`, error)
      throw error
    }
  }

  /**
   * 获取指定日期的原始数据
   */
  async fetchDateRawData(date, config) {
    let allData = []
    let page = 1
    const pageSize = 1000
    
    while (true) {
      const response = await yeepayAPI.searchBuryPointData({
        pageSize,
        page,
        date,
        selectedPointId: config.selectedPointId
      })

      const dataList = response.data?.dataList || []
      allData.push(...dataList)

      console.log(`  📄 第${page}页: ${dataList.length}条`)

      // 如果返回的数据少于页面大小，说明已经到最后一页
      if (dataList.length < pageSize) {
        break
      }

      page++
      
      // 防止请求过快
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return allData
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
    
    // 从localStorage获取配置（备用）
    const storedConfig = localStorage.getItem('apiConfig')
    if (storedConfig) {
      const parsedConfig = JSON.parse(storedConfig)
      return {
        selectedPointId: parsedConfig.selectedPointId,
        projectId: parsedConfig.projectId
      }
    }
    
    // 默认配置（从API_CONFIG获取）
    return {
      selectedPointId: 175, // 使用实际配置的埋点ID
      projectId: 'event1021'
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
      } else {
        console.log(`❌ ${date}: 无缓存数据`)
      }
      allData.push(...dayData)
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
    await this.init()
  }

  /**
   * 获取预加载状态
   */
  getStatus() {
    return {
      isPreloading: this.isPreloading,
      progress: this.preloadProgress,
      lastPreloadDate: this.lastPreloadDate
    }
  }
}

// 创建单例实例
export const dataPreloadService = new DataPreloadService()
