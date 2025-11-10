/**
 * 数据聚合服务
 * 根据图表配置将原始数据聚合为轻量级数据
 */

import dayjs from 'dayjs'

class AggregationService {
  /**
   * 根据图表配置聚合数据
   * @param {Array} rawData - 原始数据（某一天的3万条数据）
   * @param {Object} chartConfig - 图表配置
   * @param {String} date - 数据日期
   * @returns {Object} 聚合后的数据
   */
  aggregateForChart(rawData, chartConfig, date) {
    console.log(`📊 开始聚合数据: ${rawData.length}条 → 图表类型: ${chartConfig.chartType}`)
    
    // 1. 应用过滤条件
    const filtered = this.applyFilters(rawData, chartConfig.filters)
    console.log(`  ✓ 过滤后: ${filtered.length}条`)
    
    if (filtered.length === 0) {
      console.warn('  ⚠️ 过滤后无数据')
      return {
        metrics: this.getEmptyMetrics(chartConfig.metrics),
        dimensions: {},
        metadata: {
          rawRecordCount: rawData.length,
          filteredRecordCount: 0,
          processedAt: new Date().toISOString(),
          dataQuality: 'empty'
        }
      }
    }
    
    // 2. 根据图表类型聚合
    let result
    switch (chartConfig.chartType) {
      case 'line':
        result = this.aggregateForLine(filtered, chartConfig, date)
        break
      case 'bar':
        result = this.aggregateForBar(filtered, chartConfig, date)
        break
      case 'pie':
        result = this.aggregateForPie(filtered, chartConfig, date)
        break
      case 'funnel':
      case 'conversion_funnel':
        result = this.aggregateForFunnel(filtered, chartConfig, date)
        break
      case 'behavior_funnel':
        // 🚀 修复：behavior_funnel 跳过聚合，保持原有数据格式
        console.log('  ✓ behavior_funnel 跳过聚合，保持原有数据格式')
        return {
          metrics: {},
          dimensions: {},
          metadata: {
            rawRecordCount: rawData.length,
            filteredRecordCount: filtered.length,
            processedAt: new Date().toISOString(),
            dataQuality: 'preserved',
            chartType: 'behavior_funnel',
            skipAggregation: true
          }
        }
      case 'click_heatmap':
        result = this.aggregateForClickHeatmap(filtered, chartConfig, date)
        break
      case 'user_journey':
        result = this.aggregateForUserJourney(filtered, chartConfig, date)
        break
      case 'uv_pv_chart':
      case 'single_page_uv_pv_chart':
        result = this.aggregateForUVPV(filtered, chartConfig, date)
        break
      default:
        result = this.aggregateForLine(filtered, chartConfig, date)
    }
    
    // 3. 添加元数据
    result.metadata = {
      rawRecordCount: rawData.length,
      filteredRecordCount: filtered.length,
      processedAt: new Date().toISOString(),
      dataQuality: 'good'
    }
    
    console.log(`  ✓ 聚合完成: ${JSON.stringify(result.metrics)}`)
    return result
  }

  /**
   * 应用过滤条件
   */
  applyFilters(data, filters) {
    if (!filters) return data
    
    let result = data
    
    // 按单个页面过滤 - 使用智能匹配逻辑
    if (filters.pageName) {
      // 🚀 调试：记录过滤前的页面名称分布
      const pageNameDistribution = {}
      data.forEach(d => {
        const itemPageName = d.pageName || d.url || d.path || d.title || 'NULL'
        pageNameDistribution[itemPageName] = (pageNameDistribution[itemPageName] || 0) + 1
      })
      console.log(`🔍 [AggregationService] 过滤前页面名称分布 (目标: ${filters.pageName}):`, pageNameDistribution)
      
      result = data.filter(d => {
        const itemPageName = d.pageName || d.url || d.path || d.title
        const matchResult = this.smartMatch(filters.pageName, itemPageName)
        return matchResult
      })
      
      console.log(`🔍 [AggregationService] 过滤结果: ${data.length}条 → ${result.length}条 (目标页面: ${filters.pageName})`)
    }
    
    // 按多个页面过滤
    if (filters.pageNames && filters.pageNames.length > 0) {
      result = result.filter(d => {
        const itemPageName = d.pageName || d.url || d.path || d.title
        return filters.pageNames.some(pageName => this.smartMatch(pageName, itemPageName))
      })
    }
    
    // 按类型过滤
    if (filters.type) {
      result = result.filter(d => d.type === filters.type)
    }
    
    // 按页面行为过滤
    if (filters.pageBehavior) {
      result = result.filter(d => d.pageBehavior === filters.pageBehavior)
    }
    
    return result
  }

  /**
   * 智能匹配逻辑 - 与图表创建时保持一致
   */
  smartMatch(target, source) {
    if (!source) return false
    
    // 🚀 修复：统一处理 # 号，去除首尾的 # 号进行比较
    const normalizeHash = (str) => {
      if (!str) return ''
      return str.replace(/^#+/, '').replace(/#+$/, '').trim()
    }
    
    const normalizedTarget = normalizeHash(target)
    const normalizedSource = normalizeHash(source)
    
    // 1. 精确匹配（去除#号后）
    if (normalizedTarget === normalizedSource) return true
    
    // 2. 原始精确匹配（保留#号）
    if (target === source) return true
    
    // 3. 去除常见后缀后的精确匹配
    const cleanTarget = normalizedTarget.replace(/(的访问|访问|页面|page)$/gi, '').trim()
    const cleanSource = normalizedSource.replace(/(的访问|访问|页面|page)$/gi, '').trim()
    if (cleanTarget === cleanSource) return true
    
    // 4. 去除横线字符后的精确匹配
    const noDashTarget = cleanTarget.replace(/[—_\-]/g, '')
    const noDashSource = cleanSource.replace(/[—_\-]/g, '')
    if (noDashTarget === noDashSource) return true
    
    // 5. 简单的包含匹配（去除#号后）
    if (normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource)) {
      return true
    }
    // 也尝试原始包含匹配
    if (source.includes(target) || target.includes(source)) {
      return true
    }
    
    // 6. 关键词匹配（使用去除#号后的字符串）
    const targetKeywords = normalizedTarget.split(/[—_\-的访问页面page]/gi).filter(k => k.trim().length > 1)
    const sourceKeywords = normalizedSource.split(/[—_\-的访问页面page]/gi).filter(k => k.trim().length > 1)
    
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

  /**
   * 获取空指标
   */
  getEmptyMetrics(metricsConfig = []) {
    const metrics = {}
    metricsConfig.forEach(metric => {
      metrics[metric] = 0
    })
    return metrics
  }

  // ==================== 按图表类型聚合 ====================

  /**
   * 趋势图（折线图）- 按天聚合
   */
  aggregateForLine(data, config, date) {
    const metrics = this.calculateMetrics(data, config.metrics || ['uv', 'pv'])
    
    // 如果是单天数据且数据量足够，可以提供按小时的分布
    const hourlyDistribution = this.calculateHourlyDistribution(data)
    
    return {
      metrics,
      dimensions: {
        byHour: hourlyDistribution
      }
    }
  }

  /**
   * 柱状图 - 按页面聚合
   */
  aggregateForBar(data, config, date) {
    const byPage = this.groupByPage(data, config.metrics || ['uv', 'pv'])
    
    return {
      metrics: this.calculateMetrics(data, config.metrics || ['uv', 'pv']),
      dimensions: {
        byPage
      }
    }
  }

  /**
   * 饼图 - 按类型聚合
   */
  aggregateForPie(data, config, date) {
    const byType = this.groupByField(data, 'type', config.metrics || ['pv'])
    
    return {
      metrics: this.calculateMetrics(data, config.metrics || ['pv']),
      dimensions: {
        byType
      }
    }
  }

  /**
   * 漏斗图 - 按流程步骤聚合
   */
  aggregateForFunnel(data, config, date) {
    // 按页面行为分析
    const byBehavior = {
      total: data.length,
      open: data.filter(d => d.pageBehavior === '打开').length,
      close: data.filter(d => d.pageBehavior === '关闭').length
    }
    
    return {
      metrics: {
        total: data.length,
        uv: new Set(data.map(d => d.weCustomerKey).filter(k => k)).size
      },
      dimensions: {
        byBehavior
      }
    }
  }

  /**
   * 点击热力图 - 按点击内容聚合
   */
  aggregateForClickHeatmap(data, config, date) {
    const clickData = data.filter(d => d.type === 'click' || d.content)
    const byContent = this.groupByField(clickData, 'content', ['pv', 'uv'])
    
    return {
      metrics: {
        totalClicks: clickData.length,
        uniqueUsers: new Set(clickData.map(d => d.weCustomerKey).filter(k => k)).size
      },
      dimensions: {
        byContent
      }
    }
  }

  /**
   * 用户行为路径 - 需要保留序列信息
   */
  aggregateForUserJourney(data, config, date) {
    // 按页面统计访问和点击
    const byPage = this.groupByPage(data, ['uv', 'pv'])
    
    // 计算转化率（简化版）
    const visitData = data.filter(d => d.type === 'visit' || !d.type)
    const clickData = data.filter(d => d.type === 'click')
    
    return {
      metrics: {
        totalVisits: visitData.length,
        totalClicks: clickData.length,
        conversionRate: visitData.length > 0 ? (clickData.length / visitData.length) : 0
      },
      dimensions: {
        byPage
      }
    }
  }

  /**
   * UV/PV分析
   */
  aggregateForUVPV(data, config, date) {
    const metrics = this.calculateMetrics(data, ['uv', 'pv'])
    
    // 按小时分布
    const byHour = this.calculateHourlyDistribution(data)
    
    return {
      metrics,
      dimensions: {
        byHour
      }
    }
  }

  // ==================== 通用聚合方法 ====================

  /**
   * 计算指标
   */
  calculateMetrics(data, metricsConfig) {
    const metrics = {}
    
    metricsConfig.forEach(metric => {
      switch (metric) {
        case 'uv':
          metrics.uv = new Set(data.map(d => d.weCustomerKey).filter(k => k)).size
          break
        case 'pv':
          // PV：统计所有页面访问记录（不去重）
          metrics.pv = data.length
          break
        case 'total':
          metrics.total = data.length
          break
        case 'duration':
          // 平均停留时长（如果有）
          const durations = data.map(d => d.duration).filter(d => d)
          metrics.avgDuration = durations.length > 0 
            ? durations.reduce((a, b) => a + b, 0) / durations.length 
            : 0
          break
        case 'bounce_rate':
          // 跳出率（简化计算）
          const totalVisits = data.length // 使用总访问量作为分母
          const bounces = data.filter(d => d.pageBehavior === '关闭' && !d.hasClick).length
          metrics.bounceRate = totalVisits > 0 ? bounces / totalVisits : 0
          break
      }
    })
    
    return metrics
  }

  /**
   * 按页面分组
   */
  groupByPage(data, metricsConfig) {
    const pageMap = {}
    
    data.forEach(item => {
      const page = item.pageName || '未知页面'
      if (!pageMap[page]) {
        pageMap[page] = {
          uvSet: new Set(),
          pvCount: 0,
          totalCount: 0
        }
      }
      
      if (item.weCustomerKey) {
        pageMap[page].uvSet.add(item.weCustomerKey)
      }
      
      if (item.pageBehavior === '打开' || !item.pageBehavior) {
        pageMap[page].pvCount++
      }
      
      pageMap[page].totalCount++
    })
    
    // 转换为数组并计算指标
    return Object.entries(pageMap).map(([page, stats]) => {
      const result = { page }
      
      if (metricsConfig.includes('uv')) {
        result.uv = stats.uvSet.size
      }
      if (metricsConfig.includes('pv')) {
        result.pv = stats.pvCount
      }
      if (metricsConfig.includes('total')) {
        result.total = stats.totalCount
      }
      
      return result
    }).sort((a, b) => (b.pv || b.total || 0) - (a.pv || a.total || 0))
  }

  /**
   * 按字段分组
   */
  groupByField(data, fieldName, metricsConfig) {
    const fieldMap = {}
    
    data.forEach(item => {
      const fieldValue = item[fieldName] || '未知'
      if (!fieldMap[fieldValue]) {
        fieldMap[fieldValue] = {
          uvSet: new Set(),
          count: 0
        }
      }
      
      if (item.weCustomerKey) {
        fieldMap[fieldValue].uvSet.add(item.weCustomerKey)
      }
      fieldMap[fieldValue].count++
    })
    
    // 转换为数组
    return Object.entries(fieldMap).map(([name, stats]) => {
      const result = { name }
      
      if (metricsConfig.includes('uv')) {
        result.uv = stats.uvSet.size
      }
      if (metricsConfig.includes('pv') || metricsConfig.includes('total')) {
        result.value = stats.count
      }
      
      return result
    }).sort((a, b) => (b.value || 0) - (a.value || 0))
  }

  /**
   * 计算按小时分布
   */
  calculateHourlyDistribution(data) {
    const hourMap = {}
    
    data.forEach(item => {
      if (!item.createdAt) return
      
      const hour = dayjs(item.createdAt).format('HH')
      if (!hourMap[hour]) {
        hourMap[hour] = {
          uvSet: new Set(),
          pv: 0
        }
      }
      
      if (item.weCustomerKey) {
        hourMap[hour].uvSet.add(item.weCustomerKey)
      }
      
      if (item.pageBehavior === '打开' || !item.pageBehavior) {
        hourMap[hour].pv++
      }
    })
    
    // 转换为数组
    const hours = []
    for (let h = 0; h < 24; h++) {
      const hour = h.toString().padStart(2, '0')
      hours.push({
        hour,
        uv: hourMap[hour]?.uvSet.size || 0,
        pv: hourMap[hour]?.pv || 0
      })
    }
    
    return hours
  }

  /**
   * 保留样本数据（用于下钻分析）
   */
  extractSamples(data, count = 10) {
    if (data.length <= count) {
      return data
    }
    
    // 均匀采样
    const step = Math.floor(data.length / count)
    const samples = []
    for (let i = 0; i < count; i++) {
      samples.push(data[i * step])
    }
    
    return samples
  }

  /**
   * 计算数据质量指标
   */
  calculateDataQuality(data) {
    const total = data.length
    const withCustomerKey = data.filter(d => d.weCustomerKey).length
    const withPageName = data.filter(d => d.pageName).length
    const withTime = data.filter(d => d.createdAt).length
    
    const quality = (withCustomerKey + withPageName + withTime) / (total * 3)
    
    if (quality > 0.9) return 'good'
    if (quality > 0.7) return 'fair'
    return 'poor'
  }
}

export const aggregationService = new AggregationService()

