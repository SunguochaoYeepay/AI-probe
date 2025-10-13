/**
 * 缓存一致性管理器
 * 负责诊断和解决缓存与真实数据不一致的问题
 */

import dayjs from 'dayjs'
import { chartDB } from '@/utils/indexedDBManager'
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
   * 检查数据一致性 - 对比缓存数据与API数据
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
          // 获取缓存数据
          const cachedData = await dataPreloadService.getCachedRawData(date, pointId)
          
          // 获取API数据（第一页作为样本）
          const apiResponse = await yeepayAPI.searchBuryPointData({
            pageSize: 1000,
            page: 1,
            date,
            selectedPointId: pointId
          })
          
          const apiData = apiResponse.data?.dataList || []
          const apiTotal = apiResponse.data?.total || 0
          
          // 对比数据量
          if (cachedData.length !== apiTotal) {
            const severity = Math.abs(cachedData.length - apiTotal) > apiTotal * 0.1 ? 'HIGH' : 'MEDIUM'
            
            issues.push({
              type: 'DATA_COUNT_MISMATCH',
              severity,
              pointId,
              date,
              cachedCount: cachedData.length,
              apiCount: apiTotal,
              difference: Math.abs(cachedData.length - apiTotal),
              description: `埋点 ${pointId} 在 ${date} 的数据量不一致：缓存 ${cachedData.length} 条，API ${apiTotal} 条`,
              solution: 'REFRESH_SPECIFIC_CACHE'
            })
          }
          
          // 对比数据新鲜度（如果有数据的话）
          if (cachedData.length > 0 && apiData.length > 0) {
            const latestCacheTime = Math.max(...cachedData.map(d => new Date(d.createdAt).getTime()))
            const latestApiTime = Math.max(...apiData.map(d => new Date(d.createdAt).getTime()))
            
            if (latestApiTime > latestCacheTime + 60000) { // 超过1分钟差异
              issues.push({
                type: 'DATA_FRESHNESS_ISSUE',
                severity: 'MEDIUM',
                pointId,
                date,
                cacheLatestTime: new Date(latestCacheTime).toISOString(),
                apiLatestTime: new Date(latestApiTime).toISOString(),
                description: `埋点 ${pointId} 在 ${date} 的缓存数据不是最新的`,
                solution: 'REFRESH_SPECIFIC_CACHE'
              })
            }
          }
          
          // 短暂延迟，避免API请求过快
          await new Promise(resolve => setTimeout(resolve, 200))
          
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
   */
  async checkCacheExpiration(dateRange, selectedPointIds) {
    const issues = []
    const dates = this.generateDateRange(dateRange)
    
    console.log('⏰ 检查缓存过期情况...')
    
    for (const pointId of selectedPointIds) {
      for (const date of dates) {
        try {
          const cacheId = `raw_${pointId}_${date}`
          const cacheData = await chartDB.getRawDataCache(cacheId)
          
          if (cacheData) {
            const now = new Date()
            const cachedAt = new Date(cacheData.cachedAt)
            const expiresAt = new Date(cacheData.expiresAt)
            const ageHours = (now - cachedAt) / (1000 * 60 * 60)
            
            // 检查是否过期
            if (now > expiresAt) {
              issues.push({
                type: 'CACHE_EXPIRED',
                severity: 'HIGH',
                pointId,
                date,
                cachedAt: cacheData.cachedAt,
                expiresAt: cacheData.expiresAt,
                description: `埋点 ${pointId} 在 ${date} 的缓存已过期`,
                solution: 'CLEAN_AND_REFRESH'
              })
            } 
            // 检查是否过于陈旧（超过24小时）
            else if (ageHours > 24) {
              issues.push({
                type: 'CACHE_STALE',
                severity: 'MEDIUM',
                pointId,
                date,
                cachedAt: cacheData.cachedAt,
                ageHours: Math.round(ageHours),
                description: `埋点 ${pointId} 在 ${date} 的缓存已有 ${Math.round(ageHours)} 小时，建议更新`,
                solution: 'REFRESH_SPECIFIC_CACHE'
              })
            }
          }
        } catch (error) {
          // 忽略读取缓存时的错误
        }
      }
    }
    
    return issues
  }

  /**
   * 检查配置一致性
   */
  async checkConfigConsistency(selectedPointIds) {
    const issues = []
    
    console.log('⚙️ 检查配置一致性...')
    
    // 检查localStorage与store的一致性
    try {
      const localStorageIds = JSON.parse(localStorage.getItem('selectedBuryPointIds') || '[]')
      
      if (JSON.stringify(localStorageIds.sort()) !== JSON.stringify([...selectedPointIds].sort())) {
        issues.push({
          type: 'CONFIG_MISMATCH',
          severity: 'MEDIUM',
          localStorageIds,
          storeIds: selectedPointIds,
          description: 'localStorage与Vuex store中的埋点配置不一致',
          solution: 'SYNC_CONFIG'
        })
      }
    } catch (error) {
      issues.push({
        type: 'CONFIG_ERROR',
        severity: 'LOW',
        description: '无法读取localStorage中的埋点配置',
        solution: 'RESET_CONFIG'
      })
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
    const results = []
    
    // 按优先级分组
    const criticalIssues = issues.filter(i => i.severity === 'HIGH')
    const moderateIssues = issues.filter(i => i.severity === 'MEDIUM')
    
    // 1. 处理严重问题
    for (const issue of criticalIssues) {
      try {
        let fixed = false
        
        switch (issue.solution) {
          case 'CLEAN_AND_REFRESH':
            await this.cleanAndRefreshCache(issue.pointId, issue.date)
            fixed = true
            break
            
          case 'REFRESH_CACHE':
            if (issue.dates) {
              for (const date of issue.dates) {
                await dataPreloadService.preloadDateDataForPoint(date, issue.pointId)
              }
            }
            fixed = true
            break
            
          case 'REFRESH_SPECIFIC_CACHE':
            await dataPreloadService.preloadDateDataForPoint(issue.date, issue.pointId)
            fixed = true
            break
        }
        
        if (fixed) {
          results.push({
            issue: issue.type,
            status: 'FIXED',
            description: `已修复: ${issue.description}`
          })
        }
        
      } catch (error) {
        results.push({
          issue: issue.type,
          status: 'FAILED',
          description: `修复失败: ${issue.description}`,
          error: error.message
        })
      }
    }
    
    // 2. 全量刷新缓存（如果有多个严重问题）
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
    console.log(`✅ 成功修复: ${results.filter(r => r.status === 'FIXED').length} 个`)
    console.log(`❌ 修复失败: ${results.filter(r => r.status === 'FAILED').length} 个`)
    
    return results
  }

  /**
   * 清理并刷新特定缓存
   */
  async cleanAndRefreshCache(pointId, date) {
    const cacheId = `raw_${pointId}_${date}`
    
    // 删除旧缓存
    try {
      await chartDB._executeTransaction('raw_data_cache', 'readwrite', (store) => {
        return store.delete(cacheId)
      })
      console.log(`🗑️ 已清理缓存: ${cacheId}`)
    } catch (error) {
      console.warn('清理缓存失败:', error)
    }
    
    // 重新加载数据（现在会自动进行日期过滤）
    await dataPreloadService.preloadDateDataForPoint(date, pointId)
  }

  /**
   * 执行全量缓存刷新
   */
  async performFullCacheRefresh(selectedPointIds) {
    // 清理所有相关缓存
    for (const pointId of selectedPointIds) {
      const dates = this.generateDateRange([
        dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
        dayjs().format('YYYY-MM-DD')
      ])
      
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
    
    // 触发重新预加载
    await dataPreloadService.triggerPreload()
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
