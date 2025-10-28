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
          
          // 🔧 修复：获取完整的API数据（所有页）
          console.log(`  📡 开始获取完整API数据...`)
          const { apiData, apiTotal, originalData } = await this.fetchCompleteApiData(date, pointId)
          
          // 🔧 修复：智能数据量对比 - 详细调试信息
          console.log(`🔍 [数据一致性检查] ${date} - 埋点${pointId}:`)
          console.log(`  📦 缓存数据量: ${cachedData.length} 条`)
          console.log(`  📡 API过滤后数据量: ${apiData.length} 条`)
          console.log(`  📊 API原始数据量: ${originalData ? originalData.length : 'N/A'} 条`)
          console.log(`  📊 API total字段: ${apiTotal} 条`)
          
          // 🔧 关键修复：直接使用已过滤的API数据进行比较
          const compareCount = apiData.length
          const compareSource = 'API过滤后'
          
          // 检查是否有跨天数据
          const hasCrossDayData = originalData && originalData.length > apiData.length
          if (hasCrossDayData) {
            console.log(`  🧹 发现跨天数据: API原始${originalData.length}条，过滤后${apiData.length}条`)
            console.log(`  📅 过滤掉的跨天数据: ${originalData.length - apiData.length}条`)
          } else {
            console.log(`  ✅ 无跨天数据: API数据${apiData.length}条全部为目标日期`)
          }
          
          // 验证API数据完整性
          if (originalData && apiTotal !== originalData.length) {
            const difference = Math.abs(apiTotal - originalData.length)
            const differencePercent = (difference / apiTotal * 100).toFixed(2)
            console.log(`  ⚠️ API数据不完整: 期望${apiTotal}条，实际${originalData.length}条，差异${differencePercent}%`)
          } else if (originalData) {
            console.log(`  ✅ API数据完整: ${originalData.length}/${apiTotal} 条`)
          }
          
          console.log(`  🔧 使用过滤后的API数据进行比较: ${compareCount}条`)
          
          // 使用过滤后的API数据量进行对比
          if (cachedData.length !== compareCount) {
            const difference = Math.abs(cachedData.length - compareCount)
            const differencePercent = compareCount > 0 ? (difference / compareCount) * 100 : 0
            
            // 判断是否是今天的日期
            const today = dayjs().format('YYYY-MM-DD')
            const isToday = date === today
            
            // 设置合理的差异阈值
            let allowedDifferencePercent
            if (isToday) {
              allowedDifferencePercent = 5  // 今天的数据允许5%差异（实时增长）
            } else {
              allowedDifferencePercent = 1  // 历史数据要求更严格
            }
            
            console.log(`  📈 数据量差异: ${cachedData.length} vs ${compareCount} (${compareSource})，差异${differencePercent.toFixed(2)}%`)
            console.log(`  💡 说明: 缓存数据已按日期过滤，API数据也需要过滤后比较`)
            
            if (differencePercent > allowedDifferencePercent) {
              const severity = differencePercent > 10 ? 'HIGH' : 'MEDIUM'
              
              issues.push({
                type: 'DATA_COUNT_MISMATCH',
                severity,
                pointId,
                date,
                cachedCount: cachedData.length,
                apiCount: compareCount,
                apiFirstPageCount: apiData.length,
                apiTotal: apiTotal,
                difference: difference,
                differencePercent: differencePercent.toFixed(2),
                isToday: isToday,
                hasCrossDayData,
                crossDayCount: originalData ? originalData.length - apiData.length : 0,
                compareSource: compareSource,
                description: `埋点 ${pointId} 在 ${date} 的数据量不一致：缓存 ${cachedData.length} 条，${compareSource} ${compareCount} 条（差异 ${differencePercent.toFixed(2)}%）${hasCrossDayData ? `，过滤掉${originalData ? originalData.length - apiData.length : 0}条跨天数据` : ''}`,
                solution: 'REFRESH_SPECIFIC_CACHE'
              })
            } else {
              // 差异在可接受范围内，不报告为问题
              console.log(`  ✅ 数据量差异 ${differencePercent.toFixed(2)}% 在可接受范围内${hasCrossDayData ? `（过滤掉${originalData ? originalData.length - apiData.length : 0}条跨天数据）` : ''}`)
            }
          } else {
            console.log(`  ✅ 数据量完全一致 ${cachedData.length} 条${hasCrossDayData ? `（过滤掉${originalData ? originalData.length - apiData.length : 0}条跨天数据）` : ''}`)
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
   */
  async cleanAndRefreshCache(pointId, date) {
    const cacheId = `raw_${pointId}_${date}`
    
    console.log(`🔧 开始清理并刷新缓存: ${cacheId}`)
    
    // 1. 删除旧缓存（IndexedDB）
    try {
      await chartDB._executeTransaction('raw_data_cache', 'readwrite', (store) => {
        return store.delete(cacheId)
      })
      console.log(`🗑️ 已清理缓存: ${cacheId}`)
    } catch (error) {
      console.warn('清理缓存失败:', error)
      // 继续执行，即使删除失败也要尝试重新加载
    }
    
    // 2. 清理内存缓存（如果有的话）
    if (window.dataCache && typeof window.dataCache.delete === 'function') {
      try {
        // 尝试通过不同方式清理内存缓存
        const cacheKey = `data_${pointId}_${date}`
        window.dataCache.delete(cacheKey)
        console.log(`🗑️ 已清理内存缓存: ${cacheKey}`)
      } catch (error) {
        // 忽略内存缓存清理错误
      }
    }
    
    // 3. 重新加载数据（现在会自动进行日期过滤）
    try {
      await dataPreloadService.preloadDateDataForPoint(date, pointId)
      console.log(`✅ 缓存刷新完成: ${cacheId}`)
      
      // 4. 等待一下确保缓存写入完成
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`❌ 刷新缓存失败: ${cacheId}`, error)
      throw error
    }
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
   * 获取完整的API数据（所有页）- 与dataPreloadService保持一致
   */
  async fetchCompleteApiData(date, pointId) {
    let allData = []
    const pageSize = 1000
    
    // 先获取第一页，确定总数
    console.log(`    📡 获取第1页...`)
    const firstResponse = await yeepayAPI.searchBuryPointData({
      pageSize,
      page: 1,
      date,
      selectedPointId: pointId
    })
    
    const total = firstResponse.data?.total || 0
    const firstPageData = firstResponse.data?.dataList || []
    allData.push(...firstPageData)
    
    console.log(`    📊 API总记录数: ${total}`)
    console.log(`    📄 第1页: ${firstPageData.length}条`)
    
    // 如果总数为0或第一页就是全部数据，直接返回
    if (total === 0 || firstPageData.length === total) {
      console.log(`    ✅ API数据获取完成: ${allData.length}/${total} 条`)
      // 🔧 关键修复：立即进行日期过滤，与缓存数据保持一致
      const filteredData = this.filterDataByDate(allData, date)
      return { apiData: filteredData, apiTotal: total, originalData: allData }
    }
    
    // 计算总页数
    const totalPages = Math.ceil(total / pageSize)
    console.log(`    📄 需要获取 ${totalPages} 页`)
    
    // 🔧 修复：增加分页限制，防止数据截断
    const maxPages = Math.min(totalPages, 100) // 从50页增加到100页
    
    // 获取剩余页面
    for (let page = 2; page <= maxPages; page++) {
      console.log(`    📡 获取第${page}/${maxPages}页...`)
      
      try {
        const response = await yeepayAPI.searchBuryPointData({
          pageSize,
          page,
          date,
          selectedPointId: pointId
        })
        
        const dataList = response.data?.dataList || []
        allData.push(...dataList)
        
        console.log(`    📄 第${page}页: ${dataList.length}条`)
        
        // 如果某一页返回的数据为空，可能已经到达最后一页
        if (dataList.length === 0) {
          console.log(`    ⚠️ 第${page}页无数据，可能已到达最后一页`)
          break
        }
        
        // 防止请求过快
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`    ❌ 获取第${page}页失败:`, error)
        // 继续获取下一页，不中断整个流程
      }
    }
    
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
