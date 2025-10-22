/**
 * 查询条件数据处理器 - 统一的数据处理逻辑
 * 解决创建图表和详情页面数据不一致的问题
 */

export class QueryConditionDataProcessor {
  constructor() {
    this.logger = console
  }

  /**
   * 统一的数据处理入口
   * @param {Array} data - 原始数据或已聚合数据
   * @param {Object} options - 处理选项
   * @param {string} options.format - 数据格式: 'raw' | 'aggregated'
   * @param {Object} options.analysis - 分析配置
   * @param {string} options.queryCondition - 查询条件
   * @param {Object} options.queryData - 查询数据配置
   * @returns {Object} 处理后的图表数据
   */
  process(data, options) {
    this.logger.log('🔧 [QueryConditionDataProcessor] 开始处理数据:', {
      dataLength: data.length,
      format: options.format,
      queryCondition: options.queryCondition
    })

    try {
      // 1. 数据标准化
      const normalizedData = this.normalize(data, options)
      this.logger.log('📊 [QueryConditionDataProcessor] 数据标准化完成:', normalizedData)

      // 2. 数据分配
      const result = this.allocate(normalizedData, options)
      this.logger.log('✅ [QueryConditionDataProcessor] 数据分配完成:', result)

      return result
    } catch (error) {
      this.logger.error('❌ [QueryConditionDataProcessor] 数据处理失败:', error)
      throw error
    }
  }

  /**
   * 数据标准化 - 将不同格式的数据转换为统一格式
   * @param {Array} data - 原始数据
   * @param {Object} options - 处理选项
   * @returns {Array} 标准化的聚合数据
   */
  normalize(data, options) {
    if (options.format === 'aggregated') {
      this.logger.log('📋 [QueryConditionDataProcessor] 数据已是聚合格式，标准化处理')
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
        
        this.logger.log('🔍 [QueryConditionDataProcessor] 数据项标准化:', {
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
      // 原始数据需要聚合
      this.logger.log('🔄 [QueryConditionDataProcessor] 聚合原始数据')
      return this.aggregateRawData(data, options)
    }

    throw new Error(`不支持的数据格式: ${options.format}`)
  }

  /**
   * 聚合原始数据
   * @param {Array} rawData - 原始数据
   * @param {Object} options - 处理选项
   * @returns {Array} 聚合后的数据
   */
  aggregateRawData(rawData, options) {
    const { analysis } = options
    const dateMap = new Map()

    rawData.forEach(item => {
      // 检查数据是否匹配查询条件
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

    this.logger.log('📈 [QueryConditionDataProcessor] 原始数据聚合完成:', {
      originalCount: rawData.length,
      aggregatedCount: aggregatedData.length,
      sampleData: aggregatedData.slice(0, 3)
    })

    return aggregatedData
  }

  /**
   * 数据分配 - 将聚合数据分配给各个条件
   * @param {Array} aggregatedData - 聚合数据
   * @param {Object} options - 处理选项
   * @returns {Object} 分配后的图表数据
   */
  allocate(aggregatedData, options) {
    const { queryCondition, queryData } = options

    // 判断是否为多条件
    const isMultiCondition = this.isMultiCondition(queryCondition)
    
    if (!isMultiCondition) {
      // 单条件：直接返回UV/PV数据
      return {
        categories: aggregatedData.map(item => item.date),
        uvData: aggregatedData.map(item => item.uv),
        pvData: aggregatedData.map(item => item.pv),
        isMultipleConditions: false,
        conditionData: []
      }
    }

    // 多条件：使用分配策略
    const conditionData = this.generateConditionData(aggregatedData, queryCondition)
    
    return {
      categories: aggregatedData.map(item => item.date),
      uvData: aggregatedData.map(item => item.uv),
      pvData: aggregatedData.map(item => item.pv),
      isMultipleConditions: true,
      conditionData: conditionData
    }
  }

  /**
   * 生成多条件数据
   * @param {Array} aggregatedData - 聚合数据
   * @param {string} queryCondition - 查询条件
   * @returns {Array} 条件数据
   */
  generateConditionData(aggregatedData, queryCondition) {
    this.logger.log('🔍 [QueryConditionDataProcessor] 生成多条件数据:', {
      dataLength: aggregatedData.length,
      queryCondition
    })

    // 提取条件名称
    const conditionNames = this.extractConditionNames(queryCondition)
    this.logger.log('📋 [QueryConditionDataProcessor] 解析出的条件名称:', conditionNames)

    // 为每个条件生成数据
    const conditionData = conditionNames.map((name, index) => {
      const dataPerCondition = aggregatedData.map(item => {
        const totalPv = item.pv || 0
        const totalUv = item.uv || 0
        let value = 0

        if (totalPv > 0) {
          if (conditionNames.length === 1) {
            // 单个条件：直接使用总PV
            value = totalPv
          } else {
            // 多个条件：使用加权分配策略
            const baseValue = Math.floor(totalPv / conditionNames.length)
            const remainder = totalPv % conditionNames.length
            
            // 第一个条件获得余数，其他条件获得基础值
            value = baseValue + (index === 0 ? remainder : 0)
            
            // 如果基础值太小，给每个条件分配至少1
            if (baseValue === 0 && totalPv >= conditionNames.length) {
              value = 1
            }
            
            // 如果总PV很大但分配后值很小，使用更合理的分配
            if (totalPv > 10 && value < 2) {
              value = Math.max(2, Math.floor(totalPv * 0.3))
            }
          }
        } else if (totalUv > 0) {
          // 如果totalPv为0，使用UV值
          value = totalUv
        }

        this.logger.log(`🔍 [QueryConditionDataProcessor] 条件"${name}" 日期${item.date} 数据分配: totalPv=${totalPv}, value=${value}`)
        
        return value
      })

      return {
        name: name.trim(),
        data: dataPerCondition
      }
    })

    this.logger.log('✅ [QueryConditionDataProcessor] 多条件数据生成完成:', conditionData)
    return conditionData
  }

  /**
   * 提取条件名称
   * @param {string} queryCondition - 查询条件字符串
   * @returns {Array} 条件名称数组
   */
  extractConditionNames(queryCondition) {
    if (queryCondition.startsWith('多条件:')) {
      return queryCondition.replace('多条件:', '').split(/[、，]/).map(name => name.trim())
    } else if (queryCondition.includes('、')) {
      return queryCondition.split('、').map(name => name.trim())
    } else if (queryCondition.includes('，')) {
      return queryCondition.split('，').map(name => name.trim())
    } else {
      return ['查询条件']
    }
  }

  /**
   * 判断是否为多条件
   * @param {string} queryCondition - 查询条件
   * @returns {boolean} 是否为多条件
   */
  isMultiCondition(queryCondition) {
    return queryCondition.startsWith('多条件:') || 
           queryCondition.includes('、') || 
           queryCondition.includes('，')
  }

  /**
   * 检查数据是否匹配查询条件
   * @param {Object} item - 数据项
   * @param {Object} analysis - 分析配置
   * @returns {boolean} 是否匹配
   */
  isDataMatch(item, analysis) {
    const { pageName, queryCondition } = analysis.parameters || {}
    
    // 检查页面名称
    if (pageName && item.pageName !== pageName) {
      return false
    }

    // 检查查询条件
    if (queryCondition) {
      return this.isConditionMatch(item.content, queryCondition, analysis.parameters?.queryData)
    }

    return true
  }

  /**
   * 检查条件是否匹配
   * @param {string} content - 内容
   * @param {string} queryCondition - 查询条件
   * @param {Object} queryData - 查询数据
   * @returns {boolean} 是否匹配
   */
  isConditionMatch(content, queryCondition, queryData) {
    if (!content) return false

    // 处理多条件情况
    if (queryCondition.startsWith('多条件:')) {
      const conditionsStr = queryCondition.replace('多条件:', '')
      const conditions = conditionsStr.split(/[、，]/).map(c => c.trim())
      
      // 首先尝试精确匹配
      let isMatch = conditions.some(condition => content === condition)
      
      // 如果没有精确匹配，尝试通用查询匹配
      if (!isMatch && content === '查询') {
        isMatch = true
      }
      
      return isMatch
    } else if (queryCondition.includes('、') || queryCondition.includes('，')) {
      const conditions = queryCondition.split(/[、，]/).map(c => c.trim())
      let isMatch = conditions.some(condition => content === condition)
      
      if (!isMatch && content === '查询') {
        isMatch = true
      }
      
      return isMatch
    } else {
      // 单条件直接匹配
      let isMatch = content === queryCondition
      
      if (!isMatch && content === '查询') {
        isMatch = true
      }
      
      return isMatch
    }
  }

  /**
   * 提取日期
   * @param {Object} item - 数据项
   * @returns {string} 日期字符串
   */
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

// 创建单例实例
export const queryConditionDataProcessor = new QueryConditionDataProcessor()
