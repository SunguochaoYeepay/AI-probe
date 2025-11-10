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
   * 整合访问埋点数据（用户行为路径分析只使用页面浏览数据）
   * @param {Array} visitData - 访问埋点数据
   * @param {Array} clickData - 点击埋点数据（用户行为路径分析中不使用）
   * @param {Array} customSteps - 自定义步骤配置
   * @param {Object} pageMenuData - 页面菜单数据
   * @returns {Array} 用户行为路径数组
   */
  organizeUserBehaviorPaths(visitData, clickData, customSteps = null, pageMenuData = null) {
    console.log('🔄 [DualBuryPointDataOrganizer] 开始整合访问埋点数据:', {
      visitDataCount: visitData?.length || 0,
      clickDataCount: 0, // 用户行为路径分析不使用点击数据
      hasPageMenuData: !!pageMenuData
    })

    // 1. 数据预处理和清洗（只处理访问数据）
    const cleanVisitData = this.validateAndCleanData(visitData || [])

    // 2. 按用户分组访问数据
    const userDataMap = new Map()
    
    // 只处理访问数据，不处理点击数据
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
    
    // 3. 为每个用户构建行为路径
    const userPaths = []
    userDataMap.forEach((userData, userKey) => {
      // 按时间排序所有行为
      userData.actions.sort((a, b) => a.timestamp - b.timestamp)
      
      // 构建行为路径（传递自定义步骤配置和页面菜单数据）
      const behaviorPath = this.buildBehaviorPath(userData.actions, customSteps, pageMenuData)
      
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
   * @param {Object} pageMenuData - 页面菜单数据
   * @returns {Array} 行为路径
   */
  buildBehaviorPath(actions, customSteps = null, pageMenuData = null) {
    const path = []
    let stepCounter = 1
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      const nextAction = actions[i + 1]
      
      // 识别步骤名称（传递自定义步骤配置和页面菜单数据）
      const stepName = this.identifyStepName(action, nextAction, customSteps, pageMenuData)
      
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
   * 识别步骤名称（基于页面菜单数据优化）
   * @param {Object} currentAction - 当前行为
   * @param {Object} nextAction - 下一个行为
   * @param {Array} customSteps - 自定义步骤配置
   * @param {Object} pageMenuData - 页面菜单数据
   * @returns {String} 步骤名称
   */
  identifyStepName(currentAction, nextAction, customSteps = null, pageMenuData = null) {
    // 如果提供了自定义步骤配置，使用自定义逻辑
    if (customSteps && customSteps.length > 0) {
      return this.identifyStepWithCustomConfig(currentAction, customSteps)
    }
    
    // 基于页面菜单数据优化步骤名称
    if (currentAction.type === 'visit') {
      const pageName = currentAction.pageName || '未知页面'
      const cleanPageName = pageName.trim()
      
      // 如果有页面菜单数据，尝试匹配和优化页面名称
      if (pageMenuData && pageMenuData.data && pageMenuData.data.menus) {
        const optimizedName = this.optimizePageNameWithMenu(cleanPageName, pageMenuData)
        if (optimizedName) {
          return optimizedName
        }
      }
      
      // 直接返回页面名称
      return cleanPageName
    }
    
    return '未知步骤'
  }

  /**
   * 基于页面菜单数据优化页面名称
   * @param {String} pageName - 原始页面名称
   * @param {Object} pageMenuData - 页面菜单数据
   * @returns {String} 优化后的页面名称
   */
  optimizePageNameWithMenu(pageName, pageMenuData) {
    // 递归搜索菜单项
    const findMenuByPageName = (menus, targetName) => {
      for (const menu of menus) {
        // 检查当前菜单项
        if (menu.menuName === targetName || menu.url === targetName) {
          return menu
        }
        
        // 递归检查子菜单
        if (menu.subMenus && menu.subMenus.length > 0) {
          const found = findMenuByPageName(menu.subMenus, targetName)
          if (found) return found
        }
      }
      return null
    }
    
    // 尝试匹配菜单项
    const matchedMenu = findMenuByPageName(pageMenuData.data.menus, pageName)
    
    if (matchedMenu) {
      // 构建层级路径：一级菜单 > 二级菜单 > 三级菜单
      const buildMenuPath = (menu, menus) => {
        const path = [menu.menuName]
        
        // 查找父菜单
        const findParent = (parentMenus, childMenu) => {
          for (const parent of parentMenus) {
            if (parent.subMenus && parent.subMenus.some(sub => sub.menuId === childMenu.menuId)) {
              return parent
            }
            if (parent.subMenus) {
              const found = findParent(parent.subMenus, childMenu)
              if (found) return found
            }
          }
          return null
        }
        
        let currentMenu = menu
        while (currentMenu.parentId) {
          const parent = findParent(menus, currentMenu)
          if (parent) {
            path.unshift(parent.menuName)
            currentMenu = parent
          } else {
            break
          }
        }
        
        return path.join(' > ')
      }
      
      return buildMenuPath(matchedMenu, pageMenuData.data.menus)
    }
    
    return null
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
   * 检查行为是否匹配步骤条件（只处理页面访问）
   * @param {Object} action - 行为对象
   * @param {Object} step - 步骤配置
   * @returns {Boolean} 是否匹配
   */
  matchesStepCondition(action, step) {
    // 只处理页面访问类型
    if (action.type !== 'visit') {
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
      
      // 检查页面行为 - 允许"任意"页面行为
      if (record.pageBehavior && !['打开', '关闭', '任意'].includes(record.pageBehavior)) {
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
    // 开始处理用户行为分析数据
    console.log('🔍 [BehaviorAnalysisDataProcessor] 开始处理数据:', {
      analysisType: options?.analysisType,
      funnelSteps: options?.funnelSteps,
      visitDataCount: data.visitData?.length || 0,
      clickDataCount: data.clickData?.length || 0,
      options: options
    })

    try {
      // 检查分析类型
      const analysisType = options?.analysisType || 'behavior_funnel'
      
      if (analysisType === 'behavior_path') {
        // 行为路径分析：自动发现用户行为路径
        return this.generateBehaviorPathData(data, options)
      } else {
        // 漏斗分析：基于配置或自动提取步骤
        const customSteps = options?.funnelSteps || null
        
        console.log('🔍 [BehaviorAnalysisDataProcessor] 漏斗分析分支:', {
          customSteps: customSteps,
          customStepsLength: customSteps?.length || 0,
          hasCustomSteps: customSteps && customSteps.length > 0
        })
        
        if (customSteps && customSteps.length > 0) {
          // 🚀 修复：如果有自定义步骤配置，直接使用配置生成漏斗数据
          console.log('🔍 [BehaviorAnalysisDataProcessor] 使用自定义步骤生成漏斗数据')
          const funnelData = this.generateFunnelFromCustomSteps(customSteps, data, options)
          return funnelData
        } else {
          // 2. 如果没有自定义步骤，使用原有逻辑
          console.log('🔍 [BehaviorAnalysisDataProcessor] 使用默认逻辑生成漏斗数据')
          // 使用默认步骤提取逻辑
          const userPaths = this.dataOrganizer.organizeUserBehaviorPaths(data.visitData, data.clickData, customSteps)
          const funnelData = this.analyzeUserBehaviorPaths(userPaths, options)
          return funnelData
        }
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
    // 开始根据自定义步骤生成漏斗数据
    console.log('🔍 [BehaviorAnalysisDataProcessor] 开始生成漏斗数据:', {
      customStepsCount: customSteps?.length || 0,
      visitDataCount: data.visitData?.length || 0,
      clickDataCount: data.clickData?.length || 0,
      customSteps: customSteps
    })
    
    // 1. 根据自定义步骤配置分析数据
    const stepStats = new Map()
    const userStepTimeline = new Map()
    
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
    
    // 2. 分析数据，统计每个步骤的参与人数（处理访问数据和点击数据）
    const visitData = data.visitData || []
    const clickData = data.clickData || []
    
    console.log('🔍 [BehaviorAnalysisDataProcessor] 数据样本:', {
      visitDataSample: visitData.slice(0, 3),
      clickDataSample: clickData.slice(0, 3)
    })

    const recordUserStep = (userId, stepName, rawTimestamp) => {
      if (!userId || !stepStats.has(stepName) || !rawTimestamp) return
      const timeObj = new Date(rawTimestamp)
      if (Number.isNaN(timeObj.getTime())) return
      const stats = stepStats.get(stepName)
      const entry = {
        stepName,
        stepOrder: stats.stepOrder,
        timestamp: timeObj
      }
      if (!userStepTimeline.has(userId)) {
        userStepTimeline.set(userId, [])
      }
      userStepTimeline.get(userId).push(entry)
    }
    
    // 统计访问数据 - 计算平均停留时间
    let totalVisitMatches = 0
    const visitUserSet = new Set() // 用于去重统计访问用户
    
    visitData.forEach((visit, index) => {
      const matchedSteps = this.matchAllStepsFromData(visit, customSteps, 'visit')
      totalVisitMatches += matchedSteps.length
      
      // 调试：打印前几个访问数据的匹配情况
      if (index < 3) {
        console.log(`🔍 [BehaviorAnalysisDataProcessor] 访问数据 ${index + 1} 匹配情况:`, {
          pageName: visit.pageName,
          pageBehavior: visit.pageBehavior,
          matchedSteps: matchedSteps,
          visitData: visit
        })
      }
      
      // 获取用户标识（weCustomerKey是系统内置的用户唯一标识）
      const userId = visit.weCustomerKey || `visit_${visit.id || Math.random()}`
      
      matchedSteps.forEach(stepName => {
        if (stepStats.has(stepName)) {
          const stats = stepStats.get(stepName)
          
          // 初始化用户集合（如果不存在）
          if (!stats.userSet) {
            stats.userSet = new Set()
          }
          
          // 只有新用户才增加计数（UV统计）
          if (!stats.userSet.has(userId)) {
            stats.userSet.add(userId)
            stats.participantCount++
          }
          
          // 计算停留时间（用于计算平均停留时间）
          if (visit.stayTime) {
            const duration = parseInt(visit.stayTime) || 0
            stats.totalDuration += duration
            stats.durations.push(duration)
          }

          recordUserStep(userId, stepName, visit.createdAt || visit.timestamp)
        }
      })
    })
    
    // 🚀 修复：同时处理点击数据
    let totalClickMatches = 0
    const clickUserSet = new Set() // 用于去重统计点击用户
    
    clickData.forEach((click, index) => {
      const matchedSteps = this.matchAllStepsFromData(click, customSteps, 'click')
      totalClickMatches += matchedSteps.length
      
      // 调试：打印前几个点击数据的匹配情况
      if (index < 3) {
        console.log(`🔍 [BehaviorAnalysisDataProcessor] 点击数据 ${index + 1} 匹配情况:`, {
          pageName: click.pageName,
          content: click.content,
          type: click.type,
          matchedSteps: matchedSteps,
          clickData: click
        })
      }
      
      // 获取用户标识
      const userId = click.weCustomerKey || `click_${click.id || Math.random()}`
      
      matchedSteps.forEach(stepName => {
        if (stepStats.has(stepName)) {
          const stats = stepStats.get(stepName)
          
          // 初始化用户集合（如果不存在）
          if (!stats.userSet) {
            stats.userSet = new Set()
          }
          
          // 只有新用户才增加计数（UV统计）
          if (!stats.userSet.has(userId)) {
            stats.userSet.add(userId)
            stats.participantCount++
          }
          
        recordUserStep(userId, stepName, click.createdAt || click.timestamp)
        }
      })
    })
    
    console.log('🔍 [BehaviorAnalysisDataProcessor] 匹配统计:', {
      totalVisitMatches,
      stepStats: Array.from(stepStats.entries()).map(([name, stats]) => ({
        name,
        participantCount: stats.participantCount
      }))
    })

    // 根据用户步骤时间线补充步骤间耗时
    userStepTimeline.forEach(entries => {
      if (!entries || entries.length === 0) return
      entries.sort((a, b) => a.timestamp - b.timestamp)

      const earliestPerStep = new Map()
      for (const entry of entries) {
        if (!earliestPerStep.has(entry.stepName) ||
          entry.timestamp < earliestPerStep.get(entry.stepName).timestamp) {
          earliestPerStep.set(entry.stepName, entry)
        }
      }

      const orderedEntries = Array.from(earliestPerStep.values())
        .sort((a, b) => a.stepOrder - b.stepOrder)

      for (let i = 1; i < orderedEntries.length; i++) {
        const prev = orderedEntries[i - 1]
        const current = orderedEntries[i]
        const durationSeconds = Math.max(
          0,
          Math.round((current.timestamp - prev.timestamp) / 1000)
        )
        const stats = stepStats.get(current.stepName)
        if (stats) {
          stats.totalDuration += durationSeconds
          stats.durations.push(durationSeconds)
        }
      }
    })
    
    // 3. 转换为数组并排序
    const steps = Array.from(stepStats.values())
      .sort((a, b) => a.stepOrder - b.stepOrder)
    
    // 调试日志已移除，保持控制台干净
    
    // 4. 计算转化率和平均耗时
    const baseCount = steps[0]?.participantCount || 1
    
    // 🚀 修复：漏斗图应该是递减的，确保后续步骤的人数不超过前面步骤
    let currentCount = baseCount
    const processedSteps = steps.map((step, index) => {
      // 确保漏斗图递减：当前步骤的人数不能超过前面步骤的人数
      const actualParticipantCount = Math.min(step.participantCount, currentCount)
      
      // 更新当前计数为实际参与人数
      currentCount = actualParticipantCount
      
      return {
        stepId: `step_${step.stepOrder}`,
        stepName: step.stepName,
        participantCount: actualParticipantCount,
        conversionRate: Math.round((actualParticipantCount / baseCount) * 100 * 100) / 100,
        // 🚀 修复：使用所有匹配数据的平均停留时间，而不是基于用户数计算
        averageDuration: step.durations && step.durations.length > 0 ? 
          Math.round(step.durations.reduce((sum, duration) => sum + duration, 0) / step.durations.length) : 0,
        timeRange: this.getTimeRangeFromData(data),
        description: this.getStepDescription(step.stepName)
      }
    })
    
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
    // 自定义步骤漏斗数据生成完成
    
    return result
  }
  
  /**
   * 根据数据匹配所有符合条件的步骤（只处理页面访问）
   * @param {Object} dataItem - 数据项
   * @param {Array} customSteps - 自定义步骤配置
   * @param {String} dataType - 数据类型 (只处理 'visit')
   * @returns {Array} 匹配的步骤名称数组
   */
  matchAllStepsFromData(dataItem, customSteps, dataType) {
    const matchedSteps = []
    
    // 处理页面访问数据和点击数据
    if (dataType !== 'visit' && dataType !== 'click') {
      return matchedSteps
    }
    
    for (const step of customSteps) {
      if (step.type === 'page') {
        // 页面访问匹配
        const pageBehaviorMatch = step.pageBehavior === '任意' || step.pageBehavior === dataItem.pageBehavior
        const pageNameMatch = step.targetPage === '任意页面' || step.targetPage === dataItem.pageName
        
        if (pageBehaviorMatch && pageNameMatch) {
          matchedSteps.push(step.name)
          console.log(`✅ [MatchSteps] 页面匹配成功: step=${step.name}, targetPage=${step.targetPage}, actualPage=${dataItem.pageName}`)
        }
      } else if (step.type === 'button') {
        // 🚀 修复：按钮点击步骤需要更精确的匹配
        // 只处理点击数据
        if (dataType === 'click') {
          const pageMatch = step.targetPage === '任意页面' || step.targetPage === dataItem.pageName
          
          if (pageMatch) {
            // 检查是否有具体的按钮操作配置
            if (step.buttonOperation && step.buttonOperation !== '任意') {
              // 如果有具体按钮操作，需要精确匹配
              if (dataItem.content === step.buttonOperation) {
                matchedSteps.push(step.name)
                console.log(`✅ [MatchSteps] 按钮精确匹配成功: step=${step.name}, buttonOperation=${step.buttonOperation}`)
              }
            } else {
              // 如果没有具体按钮操作，使用内容条件匹配
              if (this.isContentConditionMatch(dataItem, step)) {
                matchedSteps.push(step.name)
                console.log(`✅ [MatchSteps] 按钮内容条件匹配成功: step=${step.name}`)
              }
            }
          }
        }
      }
    }
    
    if (matchedSteps.length === 0 && customSteps.length > 0) {
      // 调试：打印第一个步骤配置和第一个数据项的详细信息
      console.log('🔍 [MatchSteps] 无匹配，调试信息:', {
        stepType: customSteps[0]?.type,
        stepConfig: customSteps[0],
        dataType,
        dataItem: {
          type: dataItem.type,
          pageName: dataItem.pageName,
          pageBehavior: dataItem.pageBehavior,
          content: dataItem.content
        }
      })
    }
    
    return matchedSteps
  }
  
  /**
   * 检查内容条件是否匹配
   * @param {Object} dataItem - 数据项
   * @param {Object} step - 步骤配置
   * @returns {boolean} 是否匹配
   */
  isContentConditionMatch(dataItem, step) {
    // 🚀 修复：更严格的匹配逻辑
    // 如果没有内容条件，不匹配（避免过度匹配）
    if (!step.contentCondition || step.contentCondition.trim() === '') {
      return false
    }
    
    // 只处理点击数据
    if (dataItem.type !== 'click') {
      return false
    }
    
    // 检查按钮内容是否匹配
    const buttonContent = dataItem.content || ''
    const contentCondition = step.contentCondition.toLowerCase()
    
    // 🚀 修复：使用更灵活的匹配逻辑，避免硬编码
    const conditionKeywords = contentCondition.split(',').map(keyword => keyword.trim().toLowerCase())
    
    // 检查是否匹配任何条件关键词
    for (const keyword of conditionKeywords) {
      if (keyword === '') continue
      
      // 1. 直接文本匹配
      if (buttonContent.toLowerCase().includes(keyword)) {
        return true
      }
      
      // 2. 检查数据类型匹配
      if (dataItem.type === keyword) {
        return true
      }
      
      // 3. 检查JSON内容中的字段名匹配
      try {
        const jsonContent = JSON.parse(buttonContent)
        if (jsonContent && typeof jsonContent === 'object') {
          const hasMatchingFields = Object.keys(jsonContent).some(key => 
            key.toLowerCase().includes(keyword)
          )
          if (hasMatchingFields) {
            return true
          }
        }
      } catch (e) {
        // JSON解析失败，继续其他匹配方式
      }
      
      // 4. 检查JSON内容中的值匹配
      try {
        const jsonContent = JSON.parse(buttonContent)
        if (jsonContent && typeof jsonContent === 'object') {
          const hasMatchingValues = Object.values(jsonContent).some(value => 
            String(value).toLowerCase().includes(keyword)
          )
          if (hasMatchingValues) {
            return true
          }
        }
      } catch (e) {
        // JSON解析失败，继续其他匹配方式
      }
    }
    
    // 默认不匹配（更严格）
    return false
  }

  /**
   * 根据数据匹配步骤（保留原方法用于兼容）
   * @param {Object} dataItem - 数据项
   * @param {Array} customSteps - 自定义步骤配置
   * @param {String} dataType - 数据类型 ('visit' 或 'click')
   * @returns {String} 匹配的步骤名称
   */
  matchStepFromData(dataItem, customSteps, dataType) {
    const matchedSteps = this.matchAllStepsFromData(dataItem, customSteps, dataType)
    return matchedSteps.length > 0 ? matchedSteps[0] : null
  }
  
  /**
   * 从数据中获取时间范围（只处理访问数据）
   * @param {Object} data - 原始数据
   * @returns {String} 时间范围字符串
   */
  getTimeRangeFromData(data) {
    const visitData = data.visitData || []
    if (visitData.length === 0) return '无数据'
    
    const dates = visitData.map(item => item.createdAt || item.timestamp)
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
    
    // 限制处理用户数量以提高性能

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
    // 原始步骤数量统计
    
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
    
    // 筛选后步骤数量统计
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
    // 漏斗图数据生成完成
    
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

  /**
   * 生成行为路径数据
   * @param {Object} data - 包含visitData和clickData的对象
   * @param {Object} options - 处理选项
   * @returns {Object} 行为路径数据
   */
  generateBehaviorPathData(data, options) {
    console.log('🔧 [BehaviorAnalysisDataProcessor] 开始生成行为路径数据:', {
      visitDataCount: data.visitData?.length || 0,
      clickDataCount: 0, // 用户行为路径分析不使用点击数据
      options
    })

    // 1. 整合用户行为路径（传递页面菜单数据）
    const pageMenuData = options?.pageMenuData || null
    const userPaths = this.dataOrganizer.organizeUserBehaviorPaths(data.visitData, data.clickData, null, pageMenuData)
    
    // 2. 分析路径模式
    const pathAnalysis = this.analyzePathPatterns(userPaths)
    console.log('🔍 [generateBehaviorPathData] 路径分析结果:', pathAnalysis)
    
    // 3. 生成桑基图数据
    const sankeyData = this.generateSankeyData(pathAnalysis)
    console.log('🔍 [generateBehaviorPathData] 桑基图数据:', sankeyData)
    
    const result = {
      pathId: `path_${Date.now()}`,
      pathName: '用户行为路径分析',
      totalUsers: pathAnalysis.totalUsers,
      paths: pathAnalysis.paths,
      nodes: sankeyData.nodes,
      links: sankeyData.links,
      timestamp: new Date().toISOString()
    }

    console.log('✅ [BehaviorAnalysisDataProcessor] 行为路径数据生成完成:', {
      totalUsers: result.totalUsers,
      pathCount: result.paths.length,
      nodeCount: result.nodes.length,
      linkCount: result.links.length
    })

    return result
  }

  /**
   * 分析路径模式（基于页面名称去重和路径统计）
   * @param {Array} userPaths - 用户路径数据
   * @returns {Object} 路径分析结果
   */
  analyzePathPatterns(userPaths) {
    const pathCounts = new Map()
    const nodeCounts = new Map()
    let totalUsers = 0

    console.log('🔍 [analyzePathPatterns] 开始分析路径模式，用户数量:', userPaths.length)

    // 统计路径和节点
    userPaths.forEach((path, index) => {
      totalUsers++
      
      // 检查路径数据是否存在
      if (!path.behaviorPath || !Array.isArray(path.behaviorPath)) {
        console.warn('⚠️ [analyzePathPatterns] 路径数据无效:', path)
        return
      }
      
      // 清理路径：移除相邻重复的页面，保留用户的实际访问路径
      const cleanedSteps = []
      let lastStepName = null
      
      path.behaviorPath.forEach(step => {
        const currentStepName = step.stepName
        // 只移除相邻的重复步骤，保留用户的实际访问路径
        if (currentStepName !== lastStepName) {
          cleanedSteps.push(currentStepName)
          lastStepName = currentStepName
        }
      })
      
      // 统计清理后的完整路径
      if (cleanedSteps.length > 0) {
        const pathKey = cleanedSteps.join(' → ')
        pathCounts.set(pathKey, (pathCounts.get(pathKey) || 0) + 1)
        
        // 统计每个页面节点（去重）
        cleanedSteps.forEach(stepName => {
          nodeCounts.set(stepName, (nodeCounts.get(stepName) || 0) + 1)
        })
      }
      
      // 调试：打印前几个用户的路径
      if (index < 3) {
        console.log(`🔍 [analyzePathPatterns] 用户${index + 1}路径:`, {
          原始路径: path.behaviorPath.map(s => s.stepName),
          清理后路径: cleanedSteps
        })
      }
    })

    // 生成路径列表（按频次排序）
    const paths = Array.from(pathCounts.entries())
      .map(([path, count]) => ({
        path,
        count,
        percentage: ((count / totalUsers) * 100).toFixed(2)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20) // 只保留前20条路径

    console.log('✅ [analyzePathPatterns] 路径分析完成:', {
      totalUsers,
      pathCount: paths.length,
      nodeCount: nodeCounts.size,
      topPaths: paths.slice(0, 5).map(p => `${p.path} (${p.count})`),
      allNodes: Array.from(nodeCounts.keys())
    })

    return {
      totalUsers,
      paths,
      nodeCounts
    }
  }

  /**
   * 生成桑基图数据（基于页面名称去重和路径连接）
   * @param {Object} pathAnalysis - 路径分析结果
   * @returns {Object} 桑基图数据
   */
  generateSankeyData(pathAnalysis) {
    console.log('🔧 [generateSankeyData] 开始生成桑基图数据:', {
      pathCount: pathAnalysis.paths.length,
      nodeCounts: pathAnalysis.nodeCounts.size,
      allNodes: Array.from(pathAnalysis.nodeCounts.keys())
    })
    
    const nodes = []
    const links = []
    const nodeMap = new Map()

    // 1. 生成所有页面节点（基于nodeCounts去重）
    pathAnalysis.nodeCounts.forEach((count, nodeName) => {
      const node = {
        name: nodeName,
        value: count
      }
      nodes.push(node)
      nodeMap.set(nodeName, node)
    })

    console.log('🔍 [generateSankeyData] 生成的节点:', nodes.map(n => `${n.name}(${n.value})`))

    // 2. 生成页面间的连接（基于路径数据）
    pathAnalysis.paths.forEach((pathData, index) => {
      const steps = pathData.path.split(' → ')
      
      console.log(`🔍 [generateSankeyData] 处理路径 ${index + 1}: ${pathData.path} (${pathData.count}用户)`)
      
      // 生成页面间的连接
      for (let i = 0; i < steps.length - 1; i++) {
        const source = steps[i]
        const target = steps[i + 1]
        
        // 检查是否已存在相同的连接
        const existingLink = links.find(link => 
          link.source === source && link.target === target
        )
        
        if (existingLink) {
          existingLink.value += pathData.count
          console.log(`🔄 [generateSankeyData] 更新连接: ${source} → ${target}, 新值: ${existingLink.value}`)
        } else {
          links.push({
            source,
            target,
            value: pathData.count
          })
          console.log(`➕ [generateSankeyData] 添加连接: ${source} → ${target}, 值: ${pathData.count}`)
        }
      }
    })

    // 3. 按连接值排序，优先显示重要的连接
    links.sort((a, b) => b.value - a.value)

    // 4. 检测并移除循环连接，确保桑基图数据无环
    const acyclicLinks = this.removeCycles(links, nodes)
    console.log('🔧 [generateSankeyData] 循环检测完成:', {
      原始连接数: links.length,
      去环后连接数: acyclicLinks.length,
      移除的连接: links.length - acyclicLinks.length
    })

    console.log('✅ [generateSankeyData] 桑基图数据生成完成:', {
      nodeCount: nodes.length,
      linkCount: acyclicLinks.length,
      nodes: nodes.map(n => `${n.name}(${n.value})`),
      topLinks: acyclicLinks.slice(0, 10).map(l => `${l.source} → ${l.target} (${l.value})`)
    })

    return { nodes, links: acyclicLinks }
  }

  /**
   * 移除循环连接，确保桑基图数据无环
   * @param {Array} links - 原始连接数组
   * @param {Array} nodes - 节点数组
   * @returns {Array} 去环后的连接数组
   */
  removeCycles(links, nodes) {
    console.log('🔧 [removeCycles] 开始检测循环连接')
    console.log('🔍 [removeCycles] 原始连接:', links.map(l => `${l.source} → ${l.target} (${l.value})`))
    
    if (links.length === 0) {
      return links
    }
    
    // 🚀 简化的循环检测：直接移除明显的循环连接
    const acyclicLinks = []
    const processedPairs = new Set()
    
    // 按连接值排序，优先保留重要的连接
    const sortedLinks = [...links].sort((a, b) => b.value - a.value)
    
    for (const link of sortedLinks) {
      const pairKey = `${link.source}-${link.target}`
      const reversePairKey = `${link.target}-${link.source}`
      
      // 移除自循环
      if (link.source === link.target) {
        console.log(`🗑️ [removeCycles] 移除自循环: ${link.source} → ${link.target}`)
        continue
      }
      
      // 如果存在反向连接，只保留值更大的那个
      if (processedPairs.has(reversePairKey)) {
        console.log(`🗑️ [removeCycles] 移除反向循环: ${link.source} → ${link.target}`)
        continue
      }
      
      // 检查是否会造成复杂循环（简化版）
      if (this.wouldCreateComplexCycle(acyclicLinks, link)) {
        console.log(`🗑️ [removeCycles] 移除复杂循环: ${link.source} → ${link.target}`)
        continue
      }
      
      acyclicLinks.push(link)
      processedPairs.add(pairKey)
    }
    
    console.log('🔍 [removeCycles] 去环后连接:', acyclicLinks.map(l => `${l.source} → ${l.target} (${l.value})`))
    
    // 如果移除后连接数为0，保留前几个最重要的连接
    if (acyclicLinks.length === 0 && links.length > 0) {
      console.log('⚠️ [removeCycles] 移除循环后无连接，保留前3个重要连接')
      return links.slice(0, 3)
    }
    
    return acyclicLinks
  }

  /**
   * 检查添加连接是否会创建复杂循环
   * @param {Array} existingLinks - 现有连接
   * @param {Object} newLink - 新连接
   * @returns {Boolean} 是否会创建循环
   */
  wouldCreateComplexCycle(existingLinks, newLink) {
    // 使用深度优先搜索检测循环
    const visited = new Set()
    const recursionStack = new Set()
    
    // 构建邻接表
    const adjacencyList = new Map()
    
    // 添加现有连接
    existingLinks.forEach(link => {
      if (!adjacencyList.has(link.source)) {
        adjacencyList.set(link.source, [])
      }
      adjacencyList.get(link.source).push(link.target)
    })
    
    // 添加新连接
    if (!adjacencyList.has(newLink.source)) {
      adjacencyList.set(newLink.source, [])
    }
    adjacencyList.get(newLink.source).push(newLink.target)
    
    // DFS检测循环
    const hasCycle = (node) => {
      if (recursionStack.has(node)) {
        return true // 发现循环
      }
      
      if (visited.has(node)) {
        return false // 已经访问过，无循环
      }
      
      visited.add(node)
      recursionStack.add(node)
      
      const neighbors = adjacencyList.get(node) || []
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) {
          return true
        }
      }
      
      recursionStack.delete(node)
      return false
    }
    
    // 检查所有节点
    for (const node of adjacencyList.keys()) {
      if (!visited.has(node)) {
        if (hasCycle(node)) {
          return true
        }
      }
    }
    
    return false
  }
}

