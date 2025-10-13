import { ref, computed } from 'vue'
import { useStore } from 'vuex'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { cacheConsistencyManager } from '@/utils/cacheConsistencyManager'
import { dataPreloadService } from '@/services/dataPreloadService'

export function useDataConsistency() {
  const store = useStore()
  
  // 响应式状态
  const isChecking = ref(false)
  const diagnosticResults = ref([])
  const lastCheckTime = ref(null)
  const autoCheckEnabled = ref(true)
  const healthStatus = ref('unknown') // 'healthy', 'warning', 'critical', 'unknown'

  /**
   * 执行完整的数据一致性检查
   */
  const runFullCheck = async () => {
    if (isChecking.value) {
      message.warning('正在进行检查，请稍候...')
      return
    }

    const selectedPointIds = store.state.projectConfig?.selectedBuryPointIds || []
    
    if (selectedPointIds.length === 0) {
      message.error('请先选择埋点')
      return
    }

    isChecking.value = true
    const hideLoading = message.loading('正在检查数据一致性...', 0)
    
    try {
      console.log('🔍 开始完整数据一致性检查...')
      
      // 检查最近7天的数据
      const endDate = dayjs().format('YYYY-MM-DD')
      const startDate = dayjs().subtract(6, 'day').format('YYYY-MM-DD')
      const dateRange = [startDate, endDate]
      
      const result = await cacheConsistencyManager.runFullDiagnostic(dateRange, selectedPointIds)
      
      diagnosticResults.value = result.issues || []
      lastCheckTime.value = new Date().toISOString()
      
      // 更新健康状态
      updateHealthStatus(result.issues || [])
      
      hideLoading()
      
      if (result.success) {
        if (result.issueCount === 0) {
          message.success('数据一致性检查通过，未发现问题！')
        } else {
          message.warning(`发现 ${result.issueCount} 个问题，建议查看详情`)
        }
      } else {
        message.error(`检查失败: ${result.error}`)
      }
      
      return result
      
    } catch (error) {
      hideLoading()
      message.error(`检查过程出错: ${error.message}`)
      console.error('数据一致性检查失败:', error)
      return { success: false, error: error.message }
    } finally {
      isChecking.value = false
    }
  }

  /**
   * 快速健康检查（仅检查关键指标）
   */
  const quickHealthCheck = async () => {
    const selectedPointIds = store.state.projectConfig?.selectedBuryPointIds || []
    
    if (selectedPointIds.length === 0) {
      return { healthy: false, reason: '未选择埋点' }
    }

    try {
      const result = await cacheConsistencyManager.quickHealthCheck(selectedPointIds)
      updateHealthStatus(result.issues || [])
      
      return {
        healthy: result.healthy,
        issueCount: result.issueCount,
        issues: result.issues
      }
    } catch (error) {
      console.error('快速健康检查失败:', error)
      return { healthy: false, reason: error.message }
    }
  }

  /**
   * 自动修复发现的问题
   */
  const autoFixIssues = async () => {
    if (diagnosticResults.value.length === 0) {
      message.info('没有需要修复的问题')
      return
    }

    const selectedPointIds = store.state.projectConfig?.selectedBuryPointIds || []
    const hideLoading = message.loading('正在自动修复问题...', 0)
    
    try {
      const results = await cacheConsistencyManager.autoFixIssues(diagnosticResults.value, selectedPointIds)
      
      hideLoading()
      
      const fixedCount = results.filter(r => r.status === 'FIXED').length
      const failedCount = results.filter(r => r.status === 'FAILED').length
      
      if (fixedCount > 0) {
        message.success(`成功修复 ${fixedCount} 个问题`)
        
        // 重新检查
        setTimeout(() => {
          runFullCheck()
        }, 1000)
      }
      
      if (failedCount > 0) {
        message.warning(`有 ${failedCount} 个问题修复失败，请手动处理`)
      }
      
      return results
      
    } catch (error) {
      hideLoading()
      message.error(`自动修复失败: ${error.message}`)
      console.error('自动修复失败:', error)
      return []
    }
  }

  /**
   * 强制刷新当前数据
   */
  const forceRefreshData = async () => {
    const selectedPointIds = store.state.projectConfig?.selectedBuryPointIds || []
    
    if (selectedPointIds.length === 0) {
      message.error('请先选择埋点')
      return
    }

    try {
      const endDate = dayjs().format('YYYY-MM-DD')
      const startDate = dayjs().subtract(6, 'day').format('YYYY-MM-DD')
      const dateRange = [startDate, endDate]
      
      const result = await cacheConsistencyManager.forceRefreshCurrentData(dateRange, selectedPointIds)
      
      if (result.success) {
        // 清空之前的诊断结果
        diagnosticResults.value = []
        healthStatus.value = 'unknown'
        
        // 延迟一下再进行健康检查
        setTimeout(() => {
          quickHealthCheck()
        }, 2000)
      }
      
      return result
      
    } catch (error) {
      message.error(`强制刷新失败: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  /**
   * 更新健康状态
   */
  const updateHealthStatus = (issues) => {
    const criticalCount = issues.filter(i => i.severity === 'HIGH').length
    const warningCount = issues.filter(i => i.severity === 'MEDIUM').length
    
    if (criticalCount > 0) {
      healthStatus.value = 'critical'
    } else if (warningCount > 0) {
      healthStatus.value = 'warning'
    } else if (issues.length === 0) {
      healthStatus.value = 'healthy'
    } else {
      healthStatus.value = 'warning'
    }
  }

  /**
   * 启动自动检查
   */
  const startAutoCheck = () => {
    if (!autoCheckEnabled.value) return
    
    // 每10分钟进行一次快速健康检查
    const checkInterval = setInterval(async () => {
      if (!autoCheckEnabled.value) {
        clearInterval(checkInterval)
        return
      }
      
      try {
        await quickHealthCheck()
      } catch (error) {
        console.warn('自动健康检查失败:', error)
      }
    }, 10 * 60 * 1000)
    
    // 初始检查
    setTimeout(() => {
      quickHealthCheck()
    }, 3000)
    
    return checkInterval
  }

  /**
   * 获取缓存统计信息
   */
  const getCacheStats = async () => {
    try {
      const selectedPointIds = store.state.projectConfig?.selectedBuryPointIds || []
      const stats = {
        totalPoints: selectedPointIds.length,
        cachedDays: 0,
        totalRecords: 0,
        lastUpdate: null
      }
      
      // 统计最近7天的缓存情况
      const dates = []
      for (let i = 6; i >= 0; i--) {
        dates.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'))
      }
      
      for (const pointId of selectedPointIds) {
        for (const date of dates) {
          const hasCache = await dataPreloadService.hasCachedData(date, pointId, { skipSmartCheck: true })
          if (hasCache) {
            stats.cachedDays++
            const cachedData = await dataPreloadService.getCachedRawData(date, pointId)
            stats.totalRecords += cachedData.length
          }
        }
      }
      
      return stats
    } catch (error) {
      console.error('获取缓存统计失败:', error)
      return null
    }
  }

  // 计算属性
  const issuesSummary = computed(() => {
    const issues = diagnosticResults.value
    return {
      total: issues.length,
      critical: issues.filter(i => i.severity === 'HIGH').length,
      warning: issues.filter(i => i.severity === 'MEDIUM').length,
      info: issues.filter(i => i.severity === 'LOW').length
    }
  })

  const healthStatusText = computed(() => {
    switch (healthStatus.value) {
      case 'healthy': return '健康'
      case 'warning': return '警告'
      case 'critical': return '严重'
      default: return '未知'
    }
  })

  const healthStatusColor = computed(() => {
    switch (healthStatus.value) {
      case 'healthy': return '#52c41a'
      case 'warning': return '#faad14'
      case 'critical': return '#f5222d'
      default: return '#d9d9d9'
    }
  })

  return {
    // 状态
    isChecking,
    diagnosticResults,
    lastCheckTime,
    autoCheckEnabled,
    healthStatus,
    
    // 计算属性
    issuesSummary,
    healthStatusText,
    healthStatusColor,
    
    // 方法
    runFullCheck,
    quickHealthCheck,
    autoFixIssues,
    forceRefreshData,
    startAutoCheck,
    getCacheStats
  }
}
