/**
 * 用户行为分析数据处理器
 * 专门处理双埋点数据（访问埋点 + 点击埋点）的用户行为路径分析
 */

import { BaseDataProcessor } from './baseDataProcessor.js'

/**
 * 双埋点数据组织器
 */
class DualBuryPointDataOrganizer {
  /**
   * 整合访问埋点和点击埋点数据
   * @param {Array} visitData - 访问埋点数据
   * @param {Array} clickData - 点击埋点数据
   * @param {Array} customSteps - 自定义步骤配置
   * @returns {Array} 用户行为路径数组
   */
  organizeUserBehaviorPaths(visitData, clickData, customSteps = null) {
    console.log('🔄 [DualBuryPointDataOrganizer] 开始整合双埋点数据:', {
      visitDataCount: visitData?.length || 0,
      clickDataCount: clickData?.length || 0
    })

    // 1. 数据预处理和清洗
    const cleanVisitData = this.validateAndCleanData(visitData || [])
    const cleanClickData = this.validateAndCleanData(clickData || [])

    // 2. 按用户分组所有数据
    const userDataMap = new Map()
    
    // 处理访问数据
    cleanVisitData.forEach(record => {
      const userKey = record.weCustomerKey
      if (!userDataMap.has(userKey)) {
        userDataMap.set(userKey, {
          weCustomerKey: userKey,
          weUserId: record.weUserId,
          actions: [],
          deviceInfo: {
            weDeviceName: record.weDeviceName,
            wePlatform: record.wePlatform,
            weSystem: record.weSystem,
            weOs: record.weOs,
            weBrowserName: record.weBrowserName
          }
        })
      }
      
      userDataMap.get(userKey).actions.push({
        type: 'visit',
        pageName: record.pageName,
        pageBehavior: record.pageBehavior,
        stayTime: record.stayTime,
        timestamp: new Date(record.createdAt),
        wePath: record.wePath,
        originalData: record
      })
    })
    
    // 处理点击数据
    cleanClickData.forEach(record => {
      const userKey = record.weCustomerKey
      if (!userDataMap.has(userKey)) {
        userDataMap.set(userKey, {
          weCustomerKey: userKey,
          weUserId: record.weUserId,
          actions: [],
          deviceInfo: {
            weDeviceName: record.weDeviceName,
            wePlatform: record.wePlatform,
            weSystem: record.weSystem,
            weOs: record.weOs,
            weBrowserName: record.weBrowserName
          }
        })
      }
      
      userDataMap.get(userKey).actions.push({
        type: 'click',
        pageName: record.pageName,
        content: record.content,
        clickType: record.type, // query, click等
        timestamp: new Date(record.createdAt),
        wePath: record.wePath,
        originalData: record
      })
    })
    
    // 3. 为每个用户构建行为路径
    const userPaths = []
    userDataMap.forEach((userData, userKey) => {
      // 按时间排序所有行为
      userData.actions.sort((a, b) => a.timestamp - b.timestamp)
      
      // 构建行为路径（传递自定义步骤配置）
      const behaviorPath = this.buildBehaviorPath(userData.actions, customSteps)
      
      userPaths.push({
        weCustomerKey: userKey,
        weUserId: userData.weUserId,
        behaviorPath: behaviorPath,
        totalDuration: this.calculateTotalDuration(behaviorPath),
        isCompleted: this.isPathCompleted(behaviorPath),
        deviceInfo: userData.deviceInfo
      })
    })
    
    console.log('✅ [DualBuryPointDataOrganizer] 用户行为路径整合完成:', {
      totalUsers: userPaths.length,
      samplePath: userPaths[0]?.behaviorPath?.slice(0, 3)
    })
    
    return userPaths
  }
  
  /**
   * 构建用户行为路径
   * @param {Array} actions - 按时间排序的用户行为
   * @param {Array} customSteps - 自定义步骤配置
   * @returns {Array} 行为路径
   */
  buildBehaviorPath(actions, customSteps = null) {
    const path = []
    let stepCounter = 1
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      const nextAction = actions[i + 1]
      
      // 识别步骤名称（传递自定义步骤配置）
      const stepName = this.identifyStepName(action, nextAction, customSteps)
      
      path.push({
        step: stepCounter++,
        stepName: stepName,
        actionType: action.type,
        pageName: action.pageName,
        content: action.content || null,
        type: action.clickType || '页面',
        pageBehavior: action.pageBehavior || null,
        stayTime: action.stayTime || null,
        timestamp: action.timestamp.toISOString(),
        wePath: action.wePath,
        originalData: action.originalData
      })
    }
    
    return path
  }
  
  /**
   * 识别步骤名称
   * @param {Object} currentAction - 当前行为
   * @param {Object} nextAction - 下一个行为
   * @param {Array} customSteps - 自定义步骤配置
   * @returns {String} 步骤名称
   */
  identifyStepName(currentAction, nextAction, customSteps = null) {
    // 如果提供了自定义步骤配置，使用自定义逻辑
    if (customSteps && customSteps.length > 0) {
      return this.identifyStepWithCustomConfig(currentAction, customSteps)
    }
    
    // 默认的步骤识别逻辑
    if (currentAction.type === 'visit') {
      if (currentAction.pageBehavior === '打开') {
        return '流程开始'
      } else if (currentAction.pageBehavior === '关闭') {
        return '流程结束'
      } else {
        return `访问${currentAction.pageName}`
      }
    } else if (currentAction.type === 'click') {
      // 尝试从content中提取操作名称
      if (currentAction.content) {
        try {
          const contentObj = JSON.parse(currentAction.content)
          if (contentObj.申请时间 || contentObj.状态) {
            return '发起查询操作'
          }
        } catch (e) {
          // 如果不是JSON，直接使用content
          return currentAction.content
        }
      }
      return `点击操作`
    }
    
    return '未知步骤'
  }

  /**
   * 使用自定义配置识别步骤
   * @param {Object} currentAction - 当前行为
   * @param {Array} customSteps - 自定义步骤配置
   * @returns {String} 步骤名称
   */
  identifyStepWithCustomConfig(currentAction, customSteps) {
    for (const step of customSteps) {
      if (this.matchesStepCondition(currentAction, step)) {
        return step.name
      }
    }
    
    // 如果没有匹配的步骤，返回默认名称
    return '未匹配步骤'
  }

  /**
   * 检查行为是否匹配步骤条件
   * @param {Object} action - 行为对象
   * @param {Object} step - 步骤配置
   * @returns {Boolean} 是否匹配
   */
  matchesStepCondition(action, step) {
    // 检查类型匹配
    if (step.type === 'page' && action.type !== 'visit') {
      return false
    }
    if (step.type === 'button' && action.type !== 'click') {
      return false
    }

    // 页面访问条件检查
    if (step.type === 'page') {
      // 检查页面行为
      if (step.pageBehavior && step.pageBehavior !== '任意') {
        if (action.pageBehavior !== step.pageBehavior) {
          return false
        }
      }
      
      // 检查目标页面
      if (step.targetPage && step.targetPage !== '任意页面') {
        if (action.pageName !== step.targetPage) {
          return false
        }
      }
    }

    // 按钮点击条件检查
    if (step.type === 'button') {
      // 检查点击类型
      if (step.clickType && step.clickType !== '任意') {
        if (action.clickType !== step.clickType) {
          return false
        }
      }
      
      // 检查内容条件
      if (step.contentCondition) {
        const conditions = step.contentCondition.split(',').map(c => c.trim())
        let matches = false
        
        if (action.content) {
          try {
            const contentObj = JSON.parse(action.content)
            matches = conditions.some(condition => 
              Object.keys(contentObj).some(key => key.includes(condition))
            )
          } catch (e) {
            // 如果不是JSON，检查字符串包含
            matches = conditions.some(condition => 
              action.content.includes(condition)
            )
          }
        }
        
        if (!matches) {
          return false
        }
      }
      
      // 检查目标页面
      if (step.targetPage && step.targetPage !== '任意页面') {
        if (action.pageName !== step.targetPage) {
          return false
        }
      }
    }

    return true
  }
  
  /**
   * 计算总耗时
   * @param {Array} behaviorPath - 行为路径
   * @returns {Number} 总耗时(秒)
   */
  calculateTotalDuration(behaviorPath) {
    if (behaviorPath.length < 2) return 0
    
    const startTime = new Date(behaviorPath[0].timestamp)
    const endTime = new Date(behaviorPath[behaviorPath.length - 1].timestamp)
    
    return Math.floor((endTime - startTime) / 1000) // 转换为秒
  }
  
  /**
   * 判断路径是否完成
   * @param {Array} behaviorPath - 行为路径
   * @returns {Boolean} 是否完成
   */
  isPathCompleted(behaviorPath) {
    // 简单判断：如果有打开和关闭操作，认为完成
    const hasOpen = behaviorPath.some(step => step.pageBehavior === '打开')
    const hasClose = behaviorPath.some(step => step.pageBehavior === '关闭')
    
    return hasOpen && hasClose
  }

  /**
   * 数据质量检查和清洗
   * @param {Array} data - 原始数据
   * @returns {Array} 清洗后的数据
   */
  validateAndCleanData(data) {
    // 检查数据是否为数组
    if (!Array.isArray(data)) {
      console.warn('⚠️ [DualBuryPointDataOrganizer] 数据不是数组格式:', data)
      return []
    }
    
    const now = new Date()
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    
    return data.filter(record => {
      // 检查用户标识
      if (!record.weCustomerKey || record.weCustomerKey.trim() === '') {
        console.warn('⚠️ [DualBuryPointDataOrganizer] 发现空的用户标识:', record)
        return false
      }
      
      // 检查时间戳
      const recordTime = new Date(record.createdAt)
      if (isNaN(recordTime.getTime()) || recordTime < oneYearAgo || recordTime > oneDayFromNow) {
        console.warn('⚠️ [DualBuryPointDataOrganizer] 发现异常时间戳:', record)
        return false
      }
      
      // 检查页面行为
      if (record.pageBehavior && !['打开', '关闭'].includes(record.pageBehavior)) {
        console.warn('⚠️ [DualBuryPointDataOrganizer] 发现异常页面行为:', record)
        return false
      }
      
      return true
    })
  }
}

/**
 * 用户行为分析数据处理器
 */
export class BehaviorAnalysisDataProcessor extends BaseDataProcessor {
  constructor() {
    super()
    this.dataOrganizer = new DualBuryPointDataOrganizer()
  }

  /**
   * 统一的数据处理入口
   * @param {Object} data - 包含visitData和clickData的对象
   * @param {Object} options - 处理选项
   * @returns {Object} 处理后的漏斗图数据
   */
  process(data, options) {
    console.log('🔧 [BehaviorAnalysisDataProcessor] 开始处理用户行为分析数据:', {
      visitDataCount: data.visitData?.length || 0,
      clickDataCount: data.clickData?.length || 0,
      options: options
    })

    try {
      // 1. 检查是否有自定义步骤配置
      const customSteps = options?.funnelSteps || null
      
      if (customSteps && customSteps.length > 0) {
        // 🚀 修复：如果有自定义步骤配置，直接使用配置生成漏斗数据
        console.log('🔧 [BehaviorAnalysisDataProcessor] 使用自定义步骤配置:', customSteps)
        const funnelData = this.generateFunnelFromCustomSteps(customSteps, data, options)
        console.log('✅ [BehaviorAnalysisDataProcessor] 自定义步骤漏斗生成完成:', funnelData)
        return funnelData
      } else {
        // 2. 如果没有自定义步骤，使用原有逻辑
        console.log('🔧 [BehaviorAnalysisDataProcessor] 使用默认步骤提取逻辑')
        const userPaths = this.dataOrganizer.organizeUserBehaviorPaths(data.visitData, data.clickData, customSteps)
        const funnelData = this.analyzeUserBehaviorPaths(userPaths, options)
        console.log('✅ [BehaviorAnalysisDataProcessor] 默认步骤漏斗生成完成:', funnelData)
        return funnelData
      }
    } catch (error) {
      console.error('❌ [BehaviorAnalysisDataProcessor] 数据处理失败:', error)
      throw error
    }
  }

  /**
   * 根据自定义步骤配置生成漏斗图数据
   * @param {Array} customSteps - 自定义步骤配置
   * @param {Object} data - 原始数据
   * @param {Object} options - 处理选项
   * @returns {Object} 漏斗图数据
   */
  generateFunnelFromCustomSteps(customSteps, data, options) {
    console.log('🔧 [BehaviorAnalysisDataProcessor] 开始根据自定义步骤生成漏斗数据')
    
    // 1. 根据自定义步骤配置分析数据
    const stepStats = new Map()
    
    // 初始化步骤统计
    customSteps.forEach((step, index) => {
      stepStats.set(step.name, {
        stepName: step.name,
        participantCount: 0,
        totalDuration: 0,
        durations: [],
        stepOrder: index + 1,
        stepConfig: step
      })
    })
    
    // 2. 分析数据，统计每个步骤的参与人数
    const visitData = data.visitData || []
    const clickData = data.clickData || []
    
    // 统计访问数据
    visitData.forEach(visit => {
      const stepName = this.matchStepFromData(visit, customSteps, 'visit')
      if (stepName && stepStats.has(stepName)) {
        const stats = stepStats.get(stepName)
        stats.participantCount++
        
        // 计算停留时间
        if (visit.stayTime) {
          const duration = parseInt(visit.stayTime) || 0
          stats.totalDuration += duration
          stats.durations.push(duration)
        }
      }
    })
    
    // 统计点击数据
    clickData.forEach(click => {
      const stepName = this.matchStepFromData(click, customSteps, 'click')
      if (stepName && stepStats.has(stepName)) {
        const stats = stepStats.get(stepName)
        stats.participantCount++
        
        // 点击操作通常耗时较短
        stats.totalDuration += 1
        stats.durations.push(1)
      }
    })
    
    // 3. 转换为数组并排序
    const steps = Array.from(stepStats.values())
      .sort((a, b) => a.stepOrder - b.stepOrder)
    
    // 4. 计算转化率和平均耗时
    const baseCount = steps[0]?.participantCount || 1
    
    const processedSteps = steps.map(step => ({
      stepId: `step_${step.stepOrder}`,
      stepName: step.stepName,
      participantCount: step.participantCount,
      conversionRate: Math.round((step.participantCount / baseCount) * 100 * 100) / 100,
      averageDuration: step.participantCount > 0 ? Math.round(step.totalDuration / step.participantCount) : 0,
      timeRange: this.getTimeRangeFromData(data),
      description: this.getStepDescription(step.stepName)
    }))
    
    // 5. 计算整体统计
    const totalParticipants = baseCount
    const overallConversionRate = processedSteps.length > 0 ? 
      processedSteps[processedSteps.length - 1].conversionRate : 0
    const averageTotalDuration = processedSteps.length > 0 ? 
      Math.round(processedSteps.reduce((sum, step) => sum + step.averageDuration, 0) / processedSteps.length) : 0
    
    const result = {
      funnelId: `funnel_${Date.now()}`,
      funnelName: options.funnelName || '用户行为转化漏斗',
      steps: processedSteps,
      totalParticipants: totalParticipants,
      overallConversionRate: overallConversionRate,
      averageTotalDuration: averageTotalDuration
    }
    
    // 6. 详细调试信息
    console.log('📊 [BehaviorAnalysisDataProcessor] 自定义步骤漏斗详细数据:')
    console.log('  - 漏斗ID:', result.funnelId)
    console.log('  - 漏斗名称:', result.funnelName)
    console.log('  - 总参与人数:', result.totalParticipants)
    console.log('  - 整体转化率:', result.overallConversionRate + '%')
    console.log('  - 平均总耗时:', result.averageTotalDuration + '秒')
    console.log('  - 步骤数量:', result.steps.length)
    
    // 打印所有步骤的详细信息
    console.log('📋 [BehaviorAnalysisDataProcessor] 自定义步骤详情:')
    result.steps.forEach((step, index) => {
      console.log(`  ${index + 1}. ${step.stepName}:`)
      console.log(`     - 参与人数: ${step.participantCount}`)
      console.log(`     - 转化率: ${step.conversionRate}%`)
      console.log(`     - 平均耗时: ${step.averageDuration}秒`)
    })
    
    return result
  }
  
  /**
   * 根据数据匹配步骤
   * @param {Object} dataItem - 数据项
   * @param {Array} customSteps - 自定义步骤配置
   * @param {String} dataType - 数据类型 ('visit' 或 'click')
   * @returns {String} 匹配的步骤名称
   */
  matchStepFromData(dataItem, customSteps, dataType) {
    for (const step of customSteps) {
      if (step.type === 'page' && dataType === 'visit') {
        // 页面访问匹配
        if (step.pageBehavior === '任意' || step.pageBehavior === dataItem.pageBehavior) {
          if (step.targetPage === '任意页面' || step.targetPage === dataItem.pageName) {
            return step.name
          }
        }
      } else if (step.type === 'button' && dataType === 'click') {
        // 按钮点击匹配
        if (step.targetPage === '任意页面' || step.targetPage === dataItem.pageName) {
          if (step.contentCondition && dataItem.content) {
            // 检查内容条件
            const conditions = step.contentCondition.split(',').map(c => c.trim())
            const hasMatchingCondition = conditions.some(condition => 
              dataItem.content.includes(condition)
            )
            if (hasMatchingCondition) {
              return step.name
            }
          } else {
            // 没有内容条件，直接匹配
            return step.name
          }
        }
      }
    }
    return null
  }
  
  /**
   * 从数据中获取时间范围
   * @param {Object} data - 原始数据
   * @returns {String} 时间范围字符串
   */
  getTimeRangeFromData(data) {
    const allData = [...(data.visitData || []), ...(data.clickData || [])]
    if (allData.length === 0) return '无数据'
    
    const dates = allData.map(item => item.createdAt || item.timestamp)
      .filter(date => date)
      .map(date => new Date(date).toISOString().split('T')[0])
      .sort()
    
    if (dates.length === 0) return '无时间数据'
    
    return `${dates[0]} 到 ${dates[dates.length - 1]}`
  }

  /**
   * 分析用户行为路径，生成漏斗图数据
   * @param {Array} userPaths - 用户行为路径数组
   * @param {Object} options - 处理选项
   * @returns {Object} 漏斗图数据
   */
  analyzeUserBehaviorPaths(userPaths, options) {
    if (!userPaths || userPaths.length === 0) {
      return {
        funnelId: 'empty_funnel',
        funnelName: '用户行为转化漏斗',
        steps: [],
        totalParticipants: 0,
        overallConversionRate: 0,
        averageTotalDuration: 0
      }
    }

    // 优化：限制处理的用户数量，避免性能问题
    const maxUsers = 1000
    const limitedUserPaths = userPaths.length > maxUsers ? 
      userPaths.slice(0, maxUsers) : userPaths
    
    console.log(`🔧 [BehaviorAnalysisDataProcessor] 限制处理用户数量: ${limitedUserPaths.length}/${userPaths.length}`)

    // 1. 统计每个步骤的参与人数
    const stepStats = new Map()
    
    limitedUserPaths.forEach(userPath => {
      userPath.behaviorPath.forEach(step => {
        // 🚀 修复：过滤掉包含模板变量的步骤名称
        let stepKey = step.stepName
        if (stepKey && (stepKey.includes('{{') || stepKey.includes('}}'))) {
          // 如果包含模板变量，使用默认名称
          stepKey = '动态内容'
        }
        
        // 🚀 修复：过滤掉"流程结束"步骤，它不应该在漏斗中
        if (stepKey === '流程结束') {
          return // 跳过流程结束步骤
        }
        
        if (!stepStats.has(stepKey)) {
          stepStats.set(stepKey, {
            stepName: stepKey,
            participantCount: 0,
            totalDuration: 0,
            durations: [],
            stepOrder: step.step
          })
        }
        
        const stats = stepStats.get(stepKey)
        stats.participantCount++
        
        // 计算步骤耗时
        let duration = 0
        if (step.actionType === 'visit' && step.stayTime) {
          duration = parseInt(step.stayTime) || 0
        } else if (step.step < userPath.behaviorPath.length) {
          // 计算到下一步的时间间隔
          const currentTime = new Date(step.timestamp)
          const nextStep = userPath.behaviorPath[step.step]
          if (nextStep) {
            const nextTime = new Date(nextStep.timestamp)
            duration = Math.floor((nextTime - currentTime) / 1000)
          }
        }
        
        if (duration > 0) {
          stats.totalDuration += duration
          stats.durations.push(duration)
        }
      })
    })
    
    // 2. 转换为数组并排序
    let steps = Array.from(stepStats.values())
      .sort((a, b) => a.stepOrder - b.stepOrder)
    
    // 🚀 修复：筛选关键步骤，避免步骤过多
    console.log(`🔍 [BehaviorAnalysisDataProcessor] 原始步骤数量: ${steps.length}`)
    
    // 筛选策略：
    // 1. 保留前5个步骤（通常是主要流程）
    // 2. 保留参与人数大于等于10的步骤
    // 3. 保留转化率有明显下降的步骤
    const filteredSteps = steps.filter((step, index) => {
      // 保留前5个步骤
      if (index < 5) return true
      
      // 保留参与人数大于等于10的步骤
      if (step.participantCount >= 10) return true
      
      // 保留转化率大于0.1%的步骤
      const baseCount = steps[0]?.participantCount || 1
      const conversionRate = (step.participantCount / baseCount) * 100
      if (conversionRate > 0.1) return true
      
      return false
    })
    
    console.log(`🔍 [BehaviorAnalysisDataProcessor] 筛选后步骤数量: ${filteredSteps.length}`)
    steps = filteredSteps
    
    // 3. 计算转化率和平均耗时
    const baseCount = steps[0]?.participantCount || 1 // 起始步骤人数
    
    // 优化：只计算一次时间范围，避免重复计算
    const timeRange = this.getTimeRange(limitedUserPaths)
    
    const processedSteps = steps.map(step => ({
      stepId: `step_${step.stepOrder}`,
      stepName: step.stepName,
      participantCount: step.participantCount,
      conversionRate: Math.round((step.participantCount / baseCount) * 100 * 100) / 100, // 保留两位小数
      averageDuration: step.participantCount > 0 ? Math.round(step.totalDuration / step.participantCount) : 0,
      timeRange: timeRange,
      description: this.getStepDescription(step.stepName)
    }))
    
    // 4. 计算整体统计
    const totalParticipants = baseCount
    const overallConversionRate = processedSteps.length > 0 ? 
      processedSteps[processedSteps.length - 1].conversionRate : 0
    const averageTotalDuration = limitedUserPaths.length > 0 ? 
      Math.round(limitedUserPaths.reduce((sum, path) => sum + path.totalDuration, 0) / limitedUserPaths.length) : 0
    
    const result = {
      funnelId: `funnel_${Date.now()}`,
      funnelName: options.funnelName || '用户行为转化漏斗',
      steps: processedSteps,
      totalParticipants: totalParticipants,
      overallConversionRate: overallConversionRate,
      averageTotalDuration: averageTotalDuration
    }
    
    // 🚀 详细调试信息：打印漏斗图数据
    console.log('📊 [BehaviorAnalysisDataProcessor] 漏斗图详细数据:')
    console.log('  - 漏斗ID:', result.funnelId)
    console.log('  - 漏斗名称:', result.funnelName)
    console.log('  - 总参与人数:', result.totalParticipants)
    console.log('  - 整体转化率:', result.overallConversionRate + '%')
    console.log('  - 平均总耗时:', result.averageTotalDuration + '秒')
    console.log('  - 步骤数量:', result.steps.length)
    
    // 打印前10个步骤的详细信息
    console.log('📋 [BehaviorAnalysisDataProcessor] 前10个步骤详情:')
    result.steps.slice(0, 10).forEach((step, index) => {
      console.log(`  ${index + 1}. ${step.stepName}:`)
      console.log(`     - 参与人数: ${step.participantCount}`)
      console.log(`     - 转化率: ${step.conversionRate}%`)
      console.log(`     - 平均耗时: ${step.averageDuration}秒`)
      console.log(`     - 时间范围: ${step.timeRange}`)
    })
    
    // 打印最后5个步骤的详细信息
    if (result.steps.length > 10) {
      console.log('📋 [BehaviorAnalysisDataProcessor] 最后5个步骤详情:')
      result.steps.slice(-5).forEach((step, index) => {
        const actualIndex = result.steps.length - 5 + index + 1
        console.log(`  ${actualIndex}. ${step.stepName}:`)
        console.log(`     - 参与人数: ${step.participantCount}`)
        console.log(`     - 转化率: ${step.conversionRate}%`)
        console.log(`     - 平均耗时: ${step.averageDuration}秒`)
        console.log(`     - 时间范围: ${step.timeRange}`)
      })
    }
    
    return result
  }

  /**
   * 获取时间范围
   * @param {Array} userPaths - 用户行为路径数组
   * @returns {String} 时间范围字符串
   */
  getTimeRange(userPaths) {
    if (!userPaths || userPaths.length === 0) return ''
    
    // 优化：只处理前100个用户路径，避免处理大量数据
    const samplePaths = userPaths.slice(0, 100)
    let minTime = null
    let maxTime = null
    
    samplePaths.forEach(userPath => {
      userPath.behaviorPath.forEach(step => {
        const timestamp = new Date(step.timestamp)
        if (!minTime || timestamp < minTime) {
          minTime = timestamp
        }
        if (!maxTime || timestamp > maxTime) {
          maxTime = timestamp
        }
      })
    })
    
    if (!minTime || !maxTime) return ''
    
    return `${minTime.toISOString().split('T')[0]} 到 ${maxTime.toISOString().split('T')[0]}`
  }

  /**
   * 获取步骤描述
   * @param {String} stepName - 步骤名称
   * @returns {String} 步骤描述
   */
  getStepDescription(stepName) {
    const descriptions = {
      '流程开始': '用户进入流程的起始步骤',
      '流程结束': '用户完成流程的结束步骤',
      '发起查询操作': '用户点击查询按钮，设置查询条件',
      '点击操作': '用户执行点击操作',
      '访问': '用户访问页面'
    }
    
    for (const [key, description] of Object.entries(descriptions)) {
      if (stepName.includes(key)) {
        return description
      }
    }
    
    return `用户执行${stepName}操作`
  }

  // 实现基类的抽象方法（虽然在这个处理器中不需要）
  normalize(data, options) {
    return data
  }

  allocate(aggregatedData, options) {
    return aggregatedData
  }
}
