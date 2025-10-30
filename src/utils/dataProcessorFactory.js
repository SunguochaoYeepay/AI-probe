/**
 * 数据处理器工厂 - 统一管理所有分析类型的数据处理
 */

import { BaseDataProcessor } from './baseDataProcessor.js'
import { QueryConditionDataProcessor } from './queryConditionDataProcessor.js'
import { BehaviorAnalysisDataProcessor } from './behaviorAnalysisDataProcessor.js'
import backendService from '../services/backendService.js'

/**
 * 按钮点击分析数据处理器
 */
export class ButtonClickDataProcessor extends BaseDataProcessor {
  process(data, options) {
    this.logger.log('🔧 [ButtonClickDataProcessor] 开始处理按钮点击数据:', {
      dataLength: data.length,
      format: options.format
    })

    try {
      // 1. 数据标准化
      const normalizedData = this.normalize(data, options)
      this.logger.log('📊 [ButtonClickDataProcessor] 数据标准化完成:', normalizedData)

      // 2. 数据分配
      const result = this.allocate(normalizedData, options)
      this.logger.log('✅ [ButtonClickDataProcessor] 数据分配完成:', result)

      return result
    } catch (error) {
      this.logger.error('❌ [ButtonClickDataProcessor] 数据处理失败:', error)
      throw error
    }
  }

  normalize(data, options) {
    if (options.format === 'aggregated') {
      this.logger.log('📋 [ButtonClickDataProcessor] 数据已是聚合格式，标准化处理')
      // 🚀 修复：标准化已聚合数据的格式，支持多种数据结构
      return data.map(item => {
        // 支持多种数据结构
        let pv = 0
        let uv = 0
        
        if (item.pv !== undefined) {
          pv = item.pv
        } else if (item.metrics && item.metrics.pv !== undefined) {
          pv = item.metrics.pv
        }
        
        if (item.uv !== undefined) {
          uv = item.uv
        } else if (item.metrics && item.metrics.uv !== undefined) {
          uv = item.metrics.uv
        }
        
        this.logger.log('🔍 [ButtonClickDataProcessor] 数据项标准化:', {
          originalItem: item,
          extractedPv: pv,
          extractedUv: uv,
          date: item.date || item.createdAt
        })
        
        return {
          date: item.date || item.createdAt,
          pv: pv,
          uv: uv
        }
      })
    }

    if (options.format === 'raw') {
      this.logger.log('🔄 [ButtonClickDataProcessor] 聚合原始数据')
      return this.aggregateRawData(data, options)
    }

    throw new Error(`不支持的数据格式: ${options.format}`)
  }

  aggregateRawData(rawData, options) {
    const { analysis } = options
    const dateMap = new Map()

    rawData.forEach(item => {
      // 检查数据是否匹配按钮点击条件
      if (!this.isDataMatch(item, analysis)) {
        return
      }

      const date = this.extractDate(item)
      
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date: date,
          pv: 0,
          uvSet: new Set()
        })
      }

      const dayData = dateMap.get(date)
      dayData.pv++

      if (item.weCustomerKey) {
        dayData.uvSet.add(item.weCustomerKey)
      }
    })

    // 转换为标准格式
    const aggregatedData = Array.from(dateMap.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(dayData => ({
        date: dayData.date,
        pv: dayData.pv,
        uv: dayData.uvSet.size
      }))

    this.logger.log('📈 [ButtonClickDataProcessor] 原始数据聚合完成:', {
      originalCount: rawData.length,
      aggregatedCount: aggregatedData.length,
      sampleData: aggregatedData.slice(0, 3)
    })

    return aggregatedData
  }

  allocate(aggregatedData, options) {
    // 🚀 修复：生成完整的时间轴，填充缺失的天数为0值
    if (!aggregatedData || aggregatedData.length === 0) {
      return {
        categories: [],
        uvData: [],
        pvData: [],
        isMultipleConditions: false,
        conditionData: []
      }
    }

    // 🚀 优先使用用户选择的日期范围，如果没有则使用数据的实际日期范围
    let startDate, endDate
    
    if (options.dateRange && options.dateRange.startDate && options.dateRange.endDate) {
      // 使用用户选择的日期范围
      startDate = options.dateRange.startDate
      endDate = options.dateRange.endDate
      this.logger.log('📅 [ButtonClickDataProcessor] 使用用户选择的日期范围:', {
        startDate: startDate,
        endDate: endDate
      })
    } else {
      // 使用数据的实际日期范围
      const dates = aggregatedData.map(item => item.date).sort()
      startDate = dates[0]
      endDate = dates[dates.length - 1]
      this.logger.log('📅 [ButtonClickDataProcessor] 使用数据的实际日期范围:', {
        startDate: startDate,
        endDate: endDate
      })
    }
    
    // 生成完整的时间轴
    const fullDateRange = []
    let currentDate = new Date(startDate)
    const endDateObj = new Date(endDate)
    
    while (currentDate <= endDateObj) {
      fullDateRange.push(currentDate.toISOString().split('T')[0])
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    // 创建数据映射
    const dataMap = new Map()
    aggregatedData.forEach(item => {
      dataMap.set(item.date, item)
    })
    
    // 为每个日期生成数据点（包括无数据的天）
    const categories = []
    const uvData = []
    const pvData = []
    
    fullDateRange.forEach(date => {
      categories.push(date)
      const existingData = dataMap.get(date)
      if (existingData) {
        uvData.push(existingData.uv || 0)
        pvData.push(existingData.pv || 0)
      } else {
        // 无数据的天，填充0值
        uvData.push(0)
        pvData.push(0)
      }
    })
    
    this.logger.log('📊 [ButtonClickDataProcessor] 完整时间轴生成:', {
      originalDataCount: aggregatedData.length,
      fullDateRangeCount: fullDateRange.length,
      startDate: startDate,
      endDate: endDate,
      categoriesSample: categories.slice(0, 3),
      uvDataSample: uvData.slice(0, 3),
      pvDataSample: pvData.slice(0, 3)
    })
    
    return {
      categories: categories,
      uvData: uvData,
      pvData: pvData,
      isMultipleConditions: false,
      conditionData: []
    }
  }

  isDataMatch(item, analysis) {
    const { pageName, buttonName } = analysis.parameters || {}
    
    // 检查页面名称
    if (pageName && item.pageName !== pageName) {
      return false
    }

    // 检查按钮名称
    if (buttonName && item.content !== buttonName) {
      return false
    }

    return true
  }

  extractDate(item) {
    if (item.date) {
      return item.date
    }
    if (item.createdAt) {
      return item.createdAt.split('T')[0]
    }
    return new Date().toISOString().split('T')[0]
  }
}

/**
 * 页面访问分析数据处理器
 */
export class PageAccessDataProcessor extends BaseDataProcessor {
  process(data, options) {
    this.logger.log('🔧 [PageAccessDataProcessor] 开始处理页面访问数据:', {
      dataLength: data.length,
      format: options.format
    })

    try {
      // 1. 数据标准化
      const normalizedData = this.normalize(data, options)

      // 2. 数据分配
      const result = this.allocate(normalizedData, options)
      this.logger.log('✅ [PageAccessDataProcessor] 数据处理完成:', {
        categoriesCount: result.categories ? result.categories.length : 0,
        dataRange: result.categories ? `${result.categories[0]} - ${result.categories[result.categories.length - 1]}` : 'N/A'
      })

      return result
    } catch (error) {
      this.logger.error('❌ [PageAccessDataProcessor] 数据处理失败:', error)
      throw error
    }
  }

  normalize(data, options) {
    if (options.format === 'aggregated') {
      this.logger.log('📋 [PageAccessDataProcessor] 数据已是聚合格式，标准化处理')
      // 🚀 修复：标准化已聚合数据的格式，支持多种数据结构
      return data.map(item => {
        // 支持多种数据结构
        let pv = 0
        let uv = 0
        
        if (item.pv !== undefined) {
          pv = item.pv
        } else if (item.metrics && item.metrics.pv !== undefined) {
          pv = item.metrics.pv
        }
        
        if (item.uv !== undefined) {
          uv = item.uv
        } else if (item.metrics && item.metrics.uv !== undefined) {
          uv = item.metrics.uv
        }
        
        this.logger.log('🔍 [PageAccessDataProcessor] 数据项标准化:', {
          originalItem: item,
          extractedPv: pv,
          extractedUv: uv,
          date: item.date || item.createdAt
        })
        
        return {
          date: item.date || item.createdAt,
          pv: pv,
          uv: uv
        }
      })
    }

    if (options.format === 'raw') {
      this.logger.log('🔄 [PageAccessDataProcessor] 聚合原始数据')
      return this.aggregateRawData(data, options)
    }

    throw new Error(`不支持的数据格式: ${options.format}`)
  }

  aggregateRawData(rawData, options) {
    const { analysis } = options
    const dateMap = new Map()

    this.logger.log('🔍 [PageAccessDataProcessor] 开始聚合原始数据:', {
      rawDataCount: rawData.length,
      analysisParameters: analysis.parameters,
      sampleRawData: rawData.slice(0, 2)
    })

    rawData.forEach((item, index) => {
      // 检查数据是否匹配页面访问条件
      const isMatch = this.isDataMatch(item, analysis)
      
      // 只在调试模式下输出详细日志
      if (import.meta.env?.MODE === 'development' && index < 5) {
        this.logger.log(`🔍 [PageAccessDataProcessor] 数据项 ${index} 匹配检查:`, {
          item: item,
          isMatch: isMatch,
          pageName: analysis.parameters?.pageName
        })
      }

      if (!isMatch) {
        return
      }

      const date = this.extractDate(item)
      
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date: date,
          pv: 0,
          uvSet: new Set()
        })
      }

      const dayData = dateMap.get(date)
      
      // 🚀 修复：支持多种PV计算方式
      if (item.pv && typeof item.pv === 'number') {
        dayData.pv += item.pv
      } else {
        dayData.pv++
      }

      // 🚀 修复：支持多种UV计算方式
      if (item.weCustomerKey) {
        dayData.uvSet.add(item.weCustomerKey)
      } else if (item.uv && typeof item.uv === 'number') {
        // 如果数据中已经有UV值，直接使用
        dayData.uvSet.add(`uv_${index}_${item.uv}`)
      } else if (item.userId) {
        dayData.uvSet.add(item.userId)
      } else if (item.sessionId) {
        dayData.uvSet.add(item.sessionId)
      }

      // 只在开发模式下输出详细日志
      if (import.meta.env?.MODE === 'development' && index < 3) {
        this.logger.log(`🔍 [PageAccessDataProcessor] 数据项 ${index} 处理完成:`, {
          date: date,
          pv: dayData.pv,
          uv: dayData.uvSet.size
        })
      }
    })

    // 转换为标准格式
    const aggregatedData = Array.from(dateMap.values())
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(dayData => ({
        date: dayData.date,
        pv: dayData.pv,
        uv: dayData.uvSet.size
      }))

    this.logger.log('📈 [PageAccessDataProcessor] 原始数据聚合完成:', {
      originalCount: rawData.length,
      aggregatedCount: aggregatedData.length,
      dateMapSize: dateMap.size,
      sampleData: aggregatedData.slice(0, 3)
    })

    return aggregatedData
  }

  allocate(aggregatedData, options) {
    // 🚀 修复：生成完整的时间轴，填充缺失的天数为0值
    this.logger.log('🔍 [PageAccessDataProcessor] allocate方法开始:', {
      aggregatedDataLength: aggregatedData ? aggregatedData.length : 0
    })
    
    if (!aggregatedData || aggregatedData.length === 0) {
      this.logger.log('⚠️ [PageAccessDataProcessor] 聚合数据为空，返回空结果')
      return {
        categories: [],
        uvData: [],
        pvData: [],
        isMultipleConditions: false,
        conditionData: []
      }
    }

    // 🚀 优先使用用户选择的日期范围，如果没有则使用数据的实际日期范围
    let startDate, endDate
    
    if (options.dateRange && options.dateRange.startDate && options.dateRange.endDate) {
      // 使用用户选择的日期范围
      startDate = options.dateRange.startDate
      endDate = options.dateRange.endDate
      this.logger.log('📅 [PageAccessDataProcessor] 使用用户选择的日期范围')
    } else {
      // 使用数据的实际日期范围
      const dates = aggregatedData.map(item => item.date).sort()
      startDate = dates[0]
      endDate = dates[dates.length - 1]
      this.logger.log('📅 [PageAccessDataProcessor] 使用数据的实际日期范围:', {
        startDate: startDate,
        endDate: endDate
      })
    }
    
    // 生成完整的时间轴
    const fullDateRange = []
    let currentDate = new Date(startDate)
    const endDateObj = new Date(endDate)
    
    this.logger.log('📅 [PageAccessDataProcessor] 生成时间轴')
    
    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split('T')[0]
      fullDateRange.push(dateStr)
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    this.logger.log('📅 [PageAccessDataProcessor] 时间轴生成完成')
    
    // 创建数据映射
    const dataMap = new Map()
    aggregatedData.forEach(item => {
      dataMap.set(item.date, item)
    })
    
    this.logger.log('📅 [PageAccessDataProcessor] 数据映射完成')
    
    // 为每个日期生成数据点（包括无数据的天）
    const categories = []
    const uvData = []
    const pvData = []
    
    fullDateRange.forEach(date => {
      categories.push(date)
      const existingData = dataMap.get(date)
      if (existingData) {
        uvData.push(existingData.uv || 0)
        pvData.push(existingData.pv || 0)
      } else {
        // 无数据的天，填充0值
        uvData.push(0)
        pvData.push(0)
      }
    })
    
    this.logger.log('📊 [PageAccessDataProcessor] 时间轴数据生成完成')
    
    return {
      categories: categories,
      uvData: uvData,
      pvData: pvData,
      isMultipleConditions: false,
      conditionData: []
    }
  }

  isDataMatch(item, analysis) {
    const { pageName } = analysis.parameters || {}
    
    // 只在开发模式下输出简要日志（减少频率）
    if (import.meta.env?.MODE === 'development' && Math.random() < 0.05) {
      this.logger.log(`🔍 [PageAccessDataProcessor] 数据匹配检查:`, {
        itemPageName: item.pageName,
        targetPageName: pageName,
        isMatch: false // 将在后面更新
      })
    }
    
    // 检查页面名称 - 支持多种字段匹配
    if (pageName) {
      // 尝试多种可能的页面名称字段
      const itemPageName = item.pageName || item.url || item.path || item.title
      
      // 🚀 修复：使用与ChartDetail.vue相同的智能匹配逻辑
      if (!itemPageName) {
        this.logger.log(`❌ [PageAccessDataProcessor] 页面名称字段为空`)
        return false
      }
      
      // 使用更严格的智能匹配逻辑
      const smartMatch = (target, source) => {
        if (!source) return false
        
        // 1. 精确匹配
        if (target === source) return true
        
        // 2. 去除常见后缀后的精确匹配
        const cleanTarget = target.replace(/(的访问|访问|页面|page)$/gi, '').trim()
        const cleanSource = source.replace(/(的访问|访问|页面|page)$/gi, '').trim()
        if (cleanTarget === cleanSource) return true
        
        // 3. 去除横线字符后的精确匹配
        const normalizedTarget = target.replace(/[—_\-]/g, '')
        const normalizedSource = source.replace(/[—_\-]/g, '')
        if (normalizedTarget === normalizedSource) return true
        
        // 4. 严格的包含匹配 - 只有当目标页面名称完全包含在源页面名称中时才匹配
        if (source.includes(target)) {
          return true
        }
        
        // 5. 关键词匹配 - 要求至少80%的关键词匹配
        const targetKeywords = target.split(/[—_\-的访问页面page]/gi).filter(k => k.trim().length > 1)
        const sourceKeywords = source.split(/[—_\-的访问页面page]/gi).filter(k => k.trim().length > 1)
        
        if (targetKeywords.length === 0) return false
        
        let matchCount = 0
        for (const targetKeyword of targetKeywords) {
          if (sourceKeywords.some(sourceKeyword => 
            sourceKeyword.includes(targetKeyword) || targetKeyword.includes(sourceKeyword)
          )) {
            matchCount++
          }
        }
        
        // 要求至少80%的关键词匹配
        const matchRatio = matchCount / targetKeywords.length
        return matchRatio >= 0.8
      }
      
      const matchResult = smartMatch(pageName, itemPageName)
      if (!matchResult) {
        // 只在调试模式下输出不匹配日志
        if (import.meta.env?.MODE === 'development') {
          this.logger.log(`❌ [PageAccessDataProcessor] 页面名称不匹配: ${itemPageName} !== ${pageName}`)
        }
        return false
      }
    }

    // 只在调试模式下输出成功日志
    if (import.meta.env?.MODE === 'development') {
      this.logger.log(`✅ [PageAccessDataProcessor] 数据匹配成功`)
    }
    return true
  }

  extractDate(item) {
    if (item.date) {
      return item.date
    }
    if (item.createdAt) {
      return item.createdAt.split('T')[0]
    }
    return new Date().toISOString().split('T')[0]
  }
}

/**
 * 数据处理器工厂
 */
export class DataProcessorFactory {
  constructor() {
    this.processors = new Map()
    this.initializeProcessors()
  }

  initializeProcessors() {
    // 注册各种分析类型的数据处理器
    this.processors.set('query_condition_analysis', new QueryConditionDataProcessor())
    this.processors.set('button_click_analysis', new ButtonClickDataProcessor())
    this.processors.set('button_click_daily', new ButtonClickDataProcessor())
    this.processors.set('page_analysis', new PageAccessDataProcessor())
    this.processors.set('single_page_uv_pv_chart', new PageAccessDataProcessor())
    this.processors.set('uv_pv_chart', new PageAccessDataProcessor())
    
    // 注册用户行为分析数据处理器
    this.processors.set('behavior_funnel_analysis', new BehaviorAnalysisDataProcessor())
    this.processors.set('behavior_path_analysis', new BehaviorAnalysisDataProcessor())
    this.processors.set('behavior_analysis', new BehaviorAnalysisDataProcessor())
    this.processors.set('behavior_funnel', new BehaviorAnalysisDataProcessor())
    this.processors.set('conversion_funnel', new BehaviorAnalysisDataProcessor())
  }

  /**
   * 获取数据处理器
   * @param {string} analysisType - 分析类型
   * @returns {BaseDataProcessor} 数据处理器实例
   */
  getProcessor(analysisType) {
    const processor = this.processors.get(analysisType)
    if (!processor) {
      console.warn(`⚠️ 未找到分析类型 "${analysisType}" 的数据处理器，使用默认处理器`)
      return new PageAccessDataProcessor() // 默认使用页面访问处理器
    }
    return processor
  }

  /**
   * 处理数据
   * @param {string} analysisType - 分析类型
   * @param {Array} data - 数据
   * @param {Object} options - 处理选项
   * @returns {Object} 处理后的图表数据
   */
  async process(analysisType, data, options) {
    // 检查是否应该使用后端处理
    if (backendService.shouldUseBackend(data.length)) {
      console.log(`🚀 使用后端处理: ${data.length} 条数据`)
      return await this.processWithBackend(analysisType, data, options)
    } else {
      console.log(`💻 使用前端处理: ${data.length} 条数据`)
      return this.processWithFrontend(analysisType, data, options)
    }
  }

  /**
   * 使用后端处理数据
   */
  async processWithBackend(analysisType, data, options) {
    try {
      const chartConfig = {
        chartType: analysisType,
        parameters: {
          ...options.analysis?.parameters || {},
          // 传递日期范围参数
          dateRange: options.dateRange
        },
        filters: options.filters || {}
      }

      const result = await backendService.aggregateData(data, chartConfig)
      
      return {
        success: true,
        ...result.data, // 展开后端返回的数据格式
        processingTime: result.processingTime,
        originalCount: result.originalCount,
        aggregatedCount: result.aggregatedCount,
        processingMode: 'backend'
      }
    } catch (error) {
      console.warn('⚠️ 后端处理失败，回退到前端处理:', error.message)
      return this.processWithFrontend(analysisType, data, options)
    }
  }

  /**
   * 使用前端处理数据
   */
  processWithFrontend(analysisType, data, options) {
    const processor = this.getProcessor(analysisType)
    
    // 🚀 为查询条件分析传递原始数据
    if (analysisType === 'query_condition_analysis' && options.rawData) {
      options.rawData = options.rawData
    }
    
    const result = processor.process(data, options)
    
    const finalResult = {
      ...result,
      processingMode: 'frontend'
    }
    
    return finalResult
  }
}

// 创建单例实例
export const dataProcessorFactory = new DataProcessorFactory()
