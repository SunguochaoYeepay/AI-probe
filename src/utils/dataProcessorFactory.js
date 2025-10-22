/**
 * 数据处理器工厂 - 统一管理所有分析类型的数据处理
 */

import { QueryConditionDataProcessor } from './queryConditionDataProcessor.js'

/**
 * 数据处理器基类
 */
export class BaseDataProcessor {
  constructor() {
    this.logger = console
  }

  /**
   * 统一的数据处理入口
   * @param {Array} data - 原始数据或已聚合数据
   * @param {Object} options - 处理选项
   * @returns {Object} 处理后的图表数据
   */
  process(data, options) {
    throw new Error('子类必须实现 process 方法')
  }

  /**
   * 数据标准化 - 将不同格式的数据转换为统一格式
   * @param {Array} data - 原始数据
   * @param {Object} options - 处理选项
   * @returns {Array} 标准化的聚合数据
   */
  normalize(data, options) {
    throw new Error('子类必须实现 normalize 方法')
  }

  /**
   * 数据分配 - 将聚合数据分配给各个维度
   * @param {Array} aggregatedData - 聚合数据
   * @param {Object} options - 处理选项
   * @returns {Object} 分配后的图表数据
   */
  allocate(aggregatedData, options) {
    throw new Error('子类必须实现 allocate 方法')
  }
}

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
      format: options.format,
      sampleData: data.slice(0, 2) // 🚀 添加样本数据用于调试
    })

    try {
      // 1. 数据标准化
      const normalizedData = this.normalize(data, options)
      this.logger.log('📊 [PageAccessDataProcessor] 数据标准化完成:', {
        count: normalizedData.length,
        sampleData: normalizedData.slice(0, 2) // 🚀 添加样本数据用于调试
      })

      // 2. 数据分配
      const result = this.allocate(normalizedData, options)
      this.logger.log('✅ [PageAccessDataProcessor] 数据分配完成:', {
        categoriesCount: result.categories.length,
        uvDataSample: result.uvData.slice(0, 3),
        pvDataSample: result.pvData.slice(0, 3)
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
      this.logger.log(`🔍 [PageAccessDataProcessor] 数据项 ${index} 匹配检查:`, {
        item: item,
        isMatch: isMatch,
        pageName: analysis.parameters?.pageName
      })

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

      this.logger.log(`🔍 [PageAccessDataProcessor] 数据项 ${index} 处理完成:`, {
        date: date,
        pv: dayData.pv,
        uv: dayData.uvSet.size,
        itemPv: item.pv,
        itemUv: item.uv,
        itemWeCustomerKey: item.weCustomerKey,
        itemUserId: item.userId,
        itemSessionId: item.sessionId,
        itemAllKeys: Object.keys(item),
        itemSample: {
          id: item.id,
          pageName: item.pageName,
          type: item.type,
          createdAt: item.createdAt,
          content: item.content
        }
      })
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
      this.logger.log('📅 [PageAccessDataProcessor] 使用用户选择的日期范围:', {
        startDate: startDate,
        endDate: endDate
      })
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
    
    this.logger.log('📊 [PageAccessDataProcessor] 完整时间轴生成:', {
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
    const { pageName } = analysis.parameters || {}
    
    this.logger.log(`🔍 [PageAccessDataProcessor] 数据匹配检查详情:`, {
      itemPageName: item.pageName,
      targetPageName: pageName,
      itemKeys: Object.keys(item),
      itemSample: {
        pageName: item.pageName,
        url: item.url,
        path: item.path,
        title: item.title,
        weCustomerKey: item.weCustomerKey,
        content: item.content,
        fullItem: item
      }
    })
    
    // 检查页面名称 - 支持多种字段匹配
    if (pageName) {
      // 尝试多种可能的页面名称字段
      const itemPageName = item.pageName || item.url || item.path || item.title
      
      // 🚀 修复：使用与ChartDetail.vue相同的智能匹配逻辑
      if (!itemPageName) {
        this.logger.log(`❌ [PageAccessDataProcessor] 页面名称字段为空`)
        return false
      }
      
      // 使用智能匹配逻辑
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
        
        // 4. 简单的包含匹配
        if (source.includes(target) || target.includes(source)) {
          return true
        }
        
        // 5. 关键词匹配
        const targetKeywords = target.split(/[—_\-的访问页面page]/gi).filter(k => k.trim().length > 1)
        const sourceKeywords = source.split(/[—_\-的访问页面page]/gi).filter(k => k.trim().length > 1)
        
        let matchCount = 0
        for (const targetKeyword of targetKeywords) {
          if (sourceKeywords.some(sourceKeyword => 
            sourceKeyword.includes(targetKeyword) || targetKeyword.includes(sourceKeyword)
          )) {
            matchCount++
          }
        }
        
        if (targetKeywords.length > 0 && matchCount === targetKeywords.length) {
          return true
        }
        
        return matchCount > 0
      }
      
      const matchResult = smartMatch(pageName, itemPageName)
      if (!matchResult) {
        this.logger.log(`❌ [PageAccessDataProcessor] 页面名称不匹配: ${itemPageName} !== ${pageName}`)
        return false
      }
    }

    this.logger.log(`✅ [PageAccessDataProcessor] 数据匹配成功`)
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
  process(analysisType, data, options) {
    const processor = this.getProcessor(analysisType)
    return processor.process(data, options)
  }
}

// 创建单例实例
export const dataProcessorFactory = new DataProcessorFactory()
