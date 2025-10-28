// 数据同步配置调试工具 - 帮助调试数据同步配置问题
import dataSyncConfigValidator from './dataSyncConfigValidator.js'

class DataSyncDebugger {
  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'development'
  }

  // 调试数据同步配置状态
  debugDataSyncConfig() {
    if (!this.isEnabled) return

    console.log('🔧 数据同步配置调试信息:')
    console.log('='.repeat(50))
    
    const report = dataSyncConfigValidator.getDataSyncStatusReport()
    
    console.log('📊 数据同步配置状态报告:')
    console.log('  - Store可用:', report.hasStore ? '✅' : '❌')
    console.log('  - 项目配置:', report.hasProjectConfig ? '✅' : '❌')
    console.log('  - 访问埋点ID:', report.visitBuryPointId || '未设置')
    console.log('  - 点击埋点ID:', report.clickBuryPointId || '未设置')
    console.log('  - 行为分析埋点:', report.behaviorBuryPointIds || '未设置')
    console.log('  - 数据同步埋点ID列表:', report.dataSyncPointIds)
    console.log('  - 配置有效:', report.configValid ? '✅' : '❌')
    console.log('  - 需要刷新:', report.needsRefresh ? '⚠️ 是' : '✅ 否')
    
    console.log('='.repeat(50))
  }

  // 比较UI配置和数据同步配置
  compareWithUIConfig(uiConfig) {
    if (!this.isEnabled) return

    console.log('🔍 数据同步配置对比分析:')
    console.log('='.repeat(50))
    
    const isConsistent = dataSyncConfigValidator.compareWithUIConfig(uiConfig)
    
    if (!isConsistent) {
      console.warn('⚠️ 发现数据同步配置与UI配置不一致，建议刷新页面或重新保存配置')
    }
    
    console.log('='.repeat(50))
  }

  // 强制同步数据同步配置
  async forceSyncDataSyncConfig() {
    if (!this.isEnabled) return false

    console.log('🔄 强制同步数据同步配置...')
    
    try {
      const success = await dataSyncConfigValidator.forceRefreshDataSyncConfig()
      if (success) {
        console.log('✅ 数据同步配置同步成功')
        this.debugDataSyncConfig()
        return true
      } else {
        console.warn('⚠️ 数据同步配置同步失败')
        return false
      }
    } catch (error) {
      console.error('❌ 数据同步配置同步出错:', error)
      return false
    }
  }

  // 检查数据预加载逻辑
  checkDataPreloadLogic() {
    if (!this.isEnabled) return

    console.log('🔍 数据预加载逻辑分析:')
    console.log('='.repeat(50))
    
    const pointIds = dataSyncConfigValidator.getDataSyncPointIds()
    console.log('数据预加载将使用的埋点ID列表:', pointIds)
    
    if (pointIds.length === 0) {
      console.warn('⚠️ 数据预加载将使用空配置，这可能导致预加载失败')
    } else {
      console.log('✅ 数据预加载配置正常')
    }
    
    console.log('='.repeat(50))
  }

  // 检查数据同步状态
  checkDataSyncStatus() {
    if (!this.isEnabled) return

    console.log('🔍 数据同步状态检查:')
    console.log('='.repeat(50))
    
    // 检查数据预加载服务状态
    if (window.dataPreloadService) {
      const status = window.dataPreloadService.getStatus()
      console.log('数据预加载服务状态:')
      console.log('  - 正在预加载:', status.isPreloading ? '✅ 是' : '❌ 否')
      console.log('  - 进度:', `${status.progress.current}/${status.progress.total}`)
      console.log('  - 最后预加载日期:', status.lastPreloadDate || '未预加载')
      console.log('  - 智能失效检查:', status.smartInvalidationEnabled ? '✅ 启用' : '❌ 禁用')
      console.log('  - 缓存有效期:', `${status.cacheValidityPeriod}小时`)
    } else {
      console.warn('⚠️ 数据预加载服务不可用')
    }
    
    console.log('='.repeat(50))
  }

  // 获取完整的数据同步调试报告
  getFullDataSyncDebugReport() {
    if (!this.isEnabled) return null

    const configReport = dataSyncConfigValidator.getDataSyncStatusReport()
    const preloadStatus = window.dataPreloadService?.getStatus() || null
    
    return {
      config: configReport,
      preload: preloadStatus,
      timestamp: new Date().toISOString()
    }
  }
}

// 创建单例
const dataSyncDebugger = new DataSyncDebugger()

// 全局暴露
if (typeof window !== 'undefined') {
  window.dataSyncDebugger = dataSyncDebugger
}

export default dataSyncDebugger
