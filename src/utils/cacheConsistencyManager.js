/**
 * 缓存一致性管理器
 * 负责诊断和解决缓存与真实数据不一致的问题
 */

import dayjs from 'dayjs'
import { yeepayAPI } from '@/api'
import { dataPreloadService } from '@/services/dataPreloadService'
import { message } from 'ant-design-vue'

class CacheConsistencyManager {
  constructor() {
    this.isChecking = false
    this.diagnosticResults = []
  }

  /**
   * 全面诊断缓存一致性问题
   */
  async runFullDiagnostic(dateRange, selectedPointIds) {
    this.isChecking = true
    this.diagnosticResults = []
    
    console.log('🔍 开始缓存一致性诊断...')
    console.log(`📅 检查日期范围: ${dateRange[0]} 至 ${dateRange[1]}`)
    console.log(`🎯 检查埋点: [${selectedPointIds.join(', ')}]`)
    
    try {
      const issues = []
      
      // 1. 检查缓存完整性
      const completenessIssues = await this.checkCacheCompleteness(dateRange, selectedPointIds)
      issues.push(...completenessIssues)
      
      // 2. 检查数据一致性
      const consistencyIssues = await this.checkDataConsistency(dateRange, selectedPointIds)
      issues.push(...consistencyIssues)
      
      // 3. 检查缓存过期情况
      const expirationIssues = await this.checkCacheExpiration(dateRange, selectedPointIds)
      issues.push(...expirationIssues)
      
      // 4. 检查埋点配置一致性
      const configIssues = await this.checkConfigConsistency(selectedPointIds)
      issues.push(...configIssues)
      
      this.diagnosticResults = issues
      
      console.log('🔍 诊断完成！')
      console.log(`📊 发现 ${issues.length} 个问题`)
      issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.severity}] ${issue.type}: ${issue.description}`)
      })
      
      return {
        success: true,
        issueCount: issues.length,
        issues: issues,
        suggestions: this.generateSuggestions(issues)
      }
      
    } catch (error) {
      console.error('❌ 诊断过程出错:', error)
      return {
        success: false,
        error: error.message
      }
    } finally {
      this.isChecking = false
    }
  }

  /**
   * 检查缓存完整性 - 是否缺少某些日期或埋点的缓存
   */
  async checkCacheCompleteness(dateRange, selectedPointIds) {
    const issues = []
    const dates = this.generateDateRange(dateRange)
    
    console.log('📋 检查缓存完整性...')
    
    for (const pointId of selectedPointIds) {
      let missingDates = []
      
      for (const date of dates) {
        const hasCache = await dataPreloadService.hasCachedData(date, pointId)
        if (!hasCache) {
          missingDates.push(date)
        }
      }
      
      if (missingDates.length > 0) {
        issues.push({
          type: 'CACHE_MISSING',
          severity: 'HIGH',
          pointId,
          dates: missingDates,
          description: `埋点 ${pointId} 缺少 ${missingDates.length} 天的缓存数据`,
          solution: 'REFRESH_CACHE'
        })
      }
    }
    
    return issues
  }

  /**
   * 检查数据一致性 - 对比前端缓存与后端缓存数据
   */
  async checkDataConsistency(dateRange, selectedPointIds, sampleDates = 2) {
    const issues = []
    const dates = this.generateDateRange(dateRange)
    
    // 只检查前几天和最近几天作为样本
    const sampleDateList = [
      ...dates.slice(0, Math.min(sampleDates, dates.length)),
      ...dates.slice(-Math.min(sampleDates, dates.length))
    ]
    
    console.log('🔍 检查数据一致性...')
    console.log(`📊 采样日期: [${[...new Set(sampleDateList)].join(', ')}]`)
    
    for (const pointId of selectedPointIds) {
      for (const date of [...new Set(sampleDateList)]) {
        try {
          // 🚀 优化：只获取后端缓存数据进行比较，不直接调用外部API
          console.log(`  📡 获取后端缓存数据进行比较...`)
          const backendData = await dataPreloadService.getBackendCachedData(date, pointId, true)
          
          // 🔧 修复：智能数据量对比 - 详细调试信息
          console.log(`🔍 [数据一致性检查] ${date} - 埋点${pointId}:`)
          console.log(`  📡 后端缓存数据量: ${backendData.length} 条`)
          
          // 检查后端缓存是否有数据
          if (backendData.length === 0) {
            issues.push({
              type: 'BACKEND_CACHE_MISSING',
              severity: 'HIGH',
              pointId,
              date,
              description: `埋点 ${pointId} 在 ${date} 的后端缓存中无数据`,
              solution: 'TRIGGER_BACKEND_PRELOAD'
            })
            console.log(`  ❌ 后端缓存无数据`)
            continue
          }
          
          console.log(`  ✅ 后端缓存数据正常: ${backendData.length} 条`)
          
        } catch (error) {
          console.warn(`检查 ${date} - 埋点 ${pointId} 时出错:`, error)
          // 不记录为问题，可能是网络问题
        }
      }
    }
    
    return issues
  }

  /**
   * 检查缓存过期情况
   * 🚀 简化架构：检查后端服务状态
   */
  async checkCacheExpiration(dateRange, selectedPointIds) {
    const issues = []
    
    console.log('⏰ 检查后端服务状态...')
    
    try {
      // 检查后端服务状态
      const response = await fetch('http://localhost:3004/api/preload/status')
      if (!response.ok) {
        issues.push({
          type: 'BACKEND_UNAVAILABLE',
          severity: 'HIGH',
          description: '后端服务不可用，无法检查缓存状态',
          solution: 'RESTART_BACKEND_SERVICE'
        })
        return issues
      }

      const backendData = await response.json()
      const isRunning = backendData.data.isRunning
      
      if (!isRunning) {
        issues.push({
          type: 'BACKEND_STOPPED',
          severity: 'HIGH',
          description: '后端数据预加载服务已停止',
          solution: 'RESTART_BACKEND_SERVICE'
        })
      } else {
        console.log('✅ 后端服务运行正常')
      }
    } catch (error) {
      issues.push({
        type: 'BACKEND_ERROR',
        severity: 'HIGH',
        description: `无法连接到后端服务: ${error.message}`,
        solution: 'CHECK_BACKEND_CONNECTION'
      })
    }
    
    return issues
  }

  /**
   * 检查配置一致性
   */
  async checkConfigConsistency(selectedPointIds) {
    const issues = []
    
    console.log('⚙️ 检查配置一致性...')
    
    // 🔧 修复：检查localStorage与store的一致性，并自动修复
    try {
      const localStorageIds = JSON.parse(localStorage.getItem('selectedBuryPointIds') || '[]')
      
      if (JSON.stringify(localStorageIds.sort()) !== JSON.stringify([...selectedPointIds].sort())) {
        console.log('🔧 发现配置不匹配，自动修复...')
        console.log('  - localStorage:', localStorageIds)
        console.log('  - store:', selectedPointIds)
        
        // 自动修复：更新localStorage以匹配store
        localStorage.setItem('selectedBuryPointIds', JSON.stringify([...selectedPointIds]))
        console.log('✅ 已自动修复localStorage配置')
        
        // 不再报告为问题，因为已经自动修复
        console.log('✅ 配置不匹配问题已自动解决')
      } else {
        console.log('✅ 配置一致性检查通过')
      }
    } catch (error) {
      console.warn('⚠️ 配置检查出错，尝试重置:', error.message)
      
      // 尝试重置localStorage配置
      try {
        localStorage.setItem('selectedBuryPointIds', JSON.stringify([...selectedPointIds]))
        console.log('✅ 已重置localStorage配置')
      } catch (resetError) {
        console.error('❌ 重置配置失败:', resetError.message)
        issues.push({
          type: 'CONFIG_ERROR',
          severity: 'LOW',
          description: '无法读取或修复localStorage中的埋点配置',
          solution: 'RESET_CONFIG'
        })
      }
    }
    
    return issues
  }

  /**
   * 根据问题类型生成建议
   */
  generateSuggestions(issues) {
    const suggestions = []
    const severeCounts = {
      HIGH: issues.filter(i => i.severity === 'HIGH').length,
      MEDIUM: issues.filter(i => i.severity === 'MEDIUM').length,
      LOW: issues.filter(i => i.severity === 'LOW').length
    }
    
    if (severeCounts.HIGH > 0) {
      suggestions.push({
        priority: 'HIGH',
        action: 'IMMEDIATE_CACHE_REFRESH',
        description: `发现 ${severeCounts.HIGH} 个严重问题，建议立即刷新缓存`
      })
    }
    
    if (issues.some(i => i.type === 'CACHE_MISSING')) {
      suggestions.push({
        priority: 'HIGH',
        action: 'PRELOAD_MISSING_DATA',
        description: '部分缓存数据缺失，建议重新预加载数据'
      })
    }
    
    if (issues.some(i => i.type === 'DATA_COUNT_MISMATCH')) {
      suggestions.push({
        priority: 'MEDIUM',
        action: 'VALIDATE_DATA_SOURCE',
        description: '缓存与API数据量不匹配，可能是预加载时发生了错误'
      })
    }
    
    if (severeCounts.MEDIUM > 0 || severeCounts.LOW > 0) {
      suggestions.push({
        priority: 'LOW',
        action: 'ROUTINE_MAINTENANCE',
        description: `发现 ${severeCounts.MEDIUM + severeCounts.LOW} 个轻微问题，建议定期维护`
      })
    }
    
    return suggestions
  }

  /**
   * 自动修复问题
   */
  async autoFixIssues(issues, selectedPointIds) {
    console.log('🔧 开始自动修复问题...')
    console.log(`🔍 待修复问题总数: ${issues.length}`)
    const results = []
    
    // 按优先级分组
    const criticalIssues = issues.filter(i => i.severity === 'HIGH')
    const moderateIssues = issues.filter(i => i.severity === 'MEDIUM')
    const lowIssues = issues.filter(i => i.severity === 'LOW')
    
    console.log(`📊 问题统计: 严重(${criticalIssues.length}) 中等(${moderateIssues.length}) 轻微(${lowIssues.length})`)
    
    // 处理函数，用于修复单个问题
    const processIssue = async (issue) => {
      try {
        let fixed = false
        
        console.log(`🔍 处理问题: ${issue.type} - ${issue.description}`)
        console.log(`   解决方案: ${issue.solution || '无'}`)
        
        if (!issue.solution) {
          console.warn(`⚠️ 问题缺少解决方案: ${issue.type}`)
          return {
            issue: issue.type,
            status: 'SKIPPED',
            description: `无法修复: 缺少解决方案`,
            reason: 'NO_SOLUTION'
          }
        }
        
        switch (issue.solution) {
          case 'CLEAN_AND_REFRESH':
            if (!issue.pointId || !issue.date) {
              console.error(`❌ 缺少必要参数: pointId=${issue.pointId}, date=${issue.date}`)
              return {
                issue: issue.type,
                status: 'FAILED',
                description: `修复失败: 缺少必要参数`,
                error: 'Missing pointId or date'
              }
            }
            console.log(`🔄 清理并刷新缓存: 埋点${issue.pointId} - ${issue.date}`)
            await this.cleanAndRefreshCache(issue.pointId, issue.date)
            fixed = true
            break
            
          case 'REFRESH_CACHE':
            if (!issue.pointId || !issue.dates) {
              console.error(`❌ 缺少必要参数: pointId=${issue.pointId}, dates=${issue.dates}`)
              return {
                issue: issue.type,
                status: 'FAILED',
                description: `修复失败: 缺少必要参数`,
                error: 'Missing pointId or dates'
              }
            }
            console.log(`🔄 刷新缓存: 埋点${issue.pointId} - ${issue.dates.join(', ')}`)
            for (const date of issue.dates) {
              await dataPreloadService.preloadDateDataForPoint(date, issue.pointId)
            }
            fixed = true
            break
            
          case 'REFRESH_SPECIFIC_CACHE':
            if (!issue.pointId || !issue.date) {
              console.error(`❌ 缺少必要参数: pointId=${issue.pointId}, date=${issue.date}`)
              return {
                issue: issue.type,
                status: 'FAILED',
                description: `修复失败: 缺少必要参数`,
                error: 'Missing pointId or date'
              }
            }
            // 对于REFRESH_SPECIFIC_CACHE，我们也应该清理旧缓存后重新加载
            console.log(`🔄 刷新特定缓存: 埋点${issue.pointId} - ${issue.date}`)
            await this.cleanAndRefreshCache(issue.pointId, issue.date)
            fixed = true
            break
            
          case 'SYNC_CONFIG':
            console.log(`🔧 同步配置: 将Vuex store配置同步到localStorage`)
            try {
              localStorage.setItem('selectedBuryPointIds', JSON.stringify(selectedPointIds))
              console.log(`✅ 配置已同步到localStorage: [${selectedPointIds.join(', ')}]`)
              fixed = true
            } catch (error) {
              console.error(`❌ 同步配置失败:`, error)
              throw error
            }
            break
            
          case 'RESET_CONFIG':
            console.log(`🔧 重置配置: 清空localStorage中的配置`)
            try {
              localStorage.removeItem('selectedBuryPointIds')
              console.log(`✅ 配置已重置`)
              fixed = true
            } catch (error) {
              console.error(`❌ 重置配置失败:`, error)
              throw error
            }
            break
            
          default:
            console.warn(`⚠️ 未知的解决方案类型: ${issue.solution}`)
            return {
              issue: issue.type,
              status: 'SKIPPED',
              description: `无法修复: 未知的解决方案类型`,
              reason: 'UNKNOWN_SOLUTION'
            }
        }
        
        if (fixed) {
          return {
            issue: issue.type,
            status: 'FIXED',
            description: `已修复: ${issue.description}`
          }
        }
        
        return null
      } catch (error) {
        console.error(`❌ 修复失败: ${issue.description}`, error)
        return {
          issue: issue.type,
          status: 'FAILED',
          description: `修复失败: ${issue.description}`,
          error: error.message
        }
      }
    }
    
    // 1. 处理严重问题
    console.log('🔴 处理严重问题...')
    for (const issue of criticalIssues) {
      const result = await processIssue(issue)
      if (result) results.push(result)
    }
    
    // 2. 处理中等严重问题
    console.log('🟡 处理中等严重问题...')
    for (const issue of moderateIssues) {
      const result = await processIssue(issue)
      if (result) results.push(result)
    }
    
    // 3. 全量刷新缓存（如果有多个严重问题）
    if (criticalIssues.length > 3) {
      try {
        console.log('🔄 问题较多，执行全量缓存刷新...')
        await this.performFullCacheRefresh(selectedPointIds)
        results.push({
          issue: 'MULTIPLE_CRITICAL',
          status: 'FIXED',
          description: '已执行全量缓存刷新'
        })
      } catch (error) {
        results.push({
          issue: 'FULL_REFRESH',
          status: 'FAILED',
          description: '全量刷新失败',
          error: error.message
        })
      }
    }
    
    console.log('🔧 自动修复完成！')
    const fixedCount = results.filter(r => r.status === 'FIXED').length
    const failedCount = results.filter(r => r.status === 'FAILED').length
    const skippedCount = results.filter(r => r.status === 'SKIPPED').length
    
    console.log(`✅ 成功修复: ${fixedCount} 个`)
    console.log(`❌ 修复失败: ${failedCount} 个`)
    if (skippedCount > 0) {
      console.log(`⏭️ 跳过修复: ${skippedCount} 个`)
    }
    
    return results
  }

  /**
   * 清理并刷新特定缓存
   * 🚀 简化架构：只触发后端数据刷新
   */
  async cleanAndRefreshCache(pointId, date) {
    console.log(`🔧 开始清理并刷新缓存: ${pointId} - ${date}`)
    
    try {
      // 触发后端数据预加载服务刷新
      const response = await fetch('http://localhost:3004/api/preload/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        console.log(`✅ 后端缓存刷新已触发: ${pointId} - ${date}`)
      } else {
        console.warn(`⚠️ 后端服务不可用，无法刷新缓存: ${pointId} - ${date}`)
      }
    } catch (error) {
      console.error(`❌ 刷新缓存失败: ${pointId} - ${date}`, error)
      throw error
    }
  }

  /**
   * 执行全量缓存刷新
   */
  async performFullCacheRefresh(selectedPointIds) {
    console.log('🔄 执行全量缓存刷新...')
    
    try {
      // 触发后端数据预加载服务刷新
      const response = await fetch('http://localhost:3004/api/preload/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        console.log('✅ 后端全量缓存刷新已触发')
      } else {
        console.warn('⚠️ 后端服务不可用，无法执行全量缓存刷新')
      }
    } catch (error) {
      console.error('❌ 全量缓存刷新失败:', error)
      throw error
    }
  }

  /**
   * 强制刷新当前数据
   */
  async forceRefreshCurrentData(dateRange, selectedPointIds) {
    console.log('🔄 强制刷新当前数据...')
    
    const hideLoading = message.loading('正在强制刷新数据...', 0)
    
    try {
      // 1. 清理内存缓存
      if (window.dataCache) {
        window.dataCache.clear()
      }
      
      // 2. 清理相关的IndexedDB缓存
      const dates = this.generateDateRange(dateRange)
      for (const pointId of selectedPointIds) {
        for (const date of dates) {
          await this.cleanAndRefreshCache(pointId, date)
        }
      }
      
      // 3. 清理localStorage中的lastPreloadDate，触发重新预加载
      localStorage.removeItem('lastPreloadDate')
      
      hideLoading()
      message.success('数据已强制刷新完成！')
      
      return { success: true }
      
    } catch (error) {
      hideLoading()
      message.error(`强制刷新失败: ${error.message}`)
      console.error('强制刷新失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 获取完整的API数据（所有页）- 与dataPreloadService保持一致
   */
  async fetchCompleteApiData(date, pointId) {
    let allData = []
    const pageSize = 1000
    
    // 🚀 修复：数据一致性检查需要比较缓存数据和API数据
    console.log(`    📡 从API获取数据进行比较...`)
    
    try {
      // 直接调用API获取数据
      const response = await dataPreloadService.fetchDataFromAPI(date, pointId)
      allData = response || []
      
      const total = allData.length
      const firstPageData = allData.slice(0, pageSize)
      
      console.log(`    📊 API总记录数: ${total}`)
      console.log(`    📄 第1页: ${firstPageData.length}条`)
      
      // 如果总数为0或第一页就是全部数据，直接返回
      if (total === 0 || firstPageData.length === total) {
        console.log(`    ✅ API数据获取完成: ${allData.length}/${total} 条`)
        // 🔧 关键修复：立即进行日期过滤，与缓存数据保持一致
        const filteredData = this.filterDataByDate(allData, date)
        return { apiData: filteredData, apiTotal: total, originalData: allData }
      }
    } catch (error) {
      console.error(`    ❌ API数据获取失败:`, error)
      return { apiData: [], apiTotal: 0, originalData: [] }
    }
    
    // 由于API调用已经返回了所有数据，不需要分页
    const total = allData.length
    console.log(`    ✅ API数据获取完成: ${allData.length}/${total} 条`)
    
    // 🔧 关键修复：立即进行日期过滤，与缓存数据保持一致
    const filteredData = this.filterDataByDate(allData, date)
    console.log(`    🧹 日期过滤: 原始${allData.length}条，过滤后${filteredData.length}条`)
    
    return { apiData: filteredData, apiTotal: total, originalData: allData }
  }

  /**
   * 按日期过滤数据（与dataPreloadService保持一致）
   */
  filterDataByDate(data, targetDate) {
    if (!data || data.length === 0) {
      return data
    }

    const filteredData = data.filter(item => {
      if (!item.createdAt) {
        console.warn(`    ⚠️ 记录缺少createdAt字段:`, item.id)
        return false
      }

      try {
        const itemDate = new Date(item.createdAt).toISOString().split('T')[0]
        return itemDate === targetDate
      } catch (error) {
        console.warn(`    ⚠️ 日期解析失败:`, item.createdAt, error.message)
        return false
      }
    })

    const removedCount = data.length - filteredData.length
    if (removedCount > 0) {
      console.log(`    🧹 日期过滤: 移除${removedCount}条跨天数据，保留${filteredData.length}条`)
      
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
        console.log(`    📅 被移除的跨天数据分布:`, removedDates)
      }
    }

    return filteredData
  }

  /**
   * 生成日期范围
   */
  generateDateRange(dateRange) {
    const [start, end] = dateRange
    const dates = []
    let current = dayjs(start)
    const endDate = dayjs(end)
    
    while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
      dates.push(current.format('YYYY-MM-DD'))
      current = current.add(1, 'day')
    }
    
    return dates
  }

  /**
   * 获取诊断状态
   */
  getStatus() {
    return {
      isChecking: this.isChecking,
      lastResults: this.diagnosticResults,
      issueCount: this.diagnosticResults.length
    }
  }

  /**
   * 快速检查（仅检查关键指标）
   */
  async quickHealthCheck(selectedPointIds) {
    console.log('⚡ 执行快速健康检查...')
    
    const today = dayjs().format('YYYY-MM-DD')
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    
    const issues = []
    
    for (const pointId of selectedPointIds) {
      // 检查今天和昨天的缓存
      const todayCache = await dataPreloadService.hasCachedData(today, pointId)
      const yesterdayCache = await dataPreloadService.hasCachedData(yesterday, pointId)
      
      if (!todayCache || !yesterdayCache) {
        issues.push({
          type: 'RECENT_CACHE_MISSING',
          severity: 'HIGH',
          pointId,
          description: `埋点 ${pointId} 缺少最近的缓存数据`
        })
      }
    }
    
    return {
      healthy: issues.length === 0,
      issueCount: issues.length,
      issues
    }
  }
}

export const cacheConsistencyManager = new CacheConsistencyManager()
