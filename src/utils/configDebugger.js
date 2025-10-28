// 配置调试工具 - 帮助调试配置问题
import configValidator from './configValidator.js'

class ConfigDebugger {
  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'development'
  }

  // 调试配置状态
  debugConfigStatus() {
    if (!this.isEnabled) return

    console.log('🔧 配置调试信息:')
    console.log('='.repeat(50))
    
    const report = configValidator.getConfigStatusReport()
    
    console.log('📊 配置状态报告:')
    console.log('  - Store可用:', report.hasStore ? '✅' : '❌')
    console.log('  - 项目配置:', report.hasProjectConfig ? '✅' : '❌')
    console.log('  - API配置:', report.hasApiConfig ? '✅' : '❌')
    console.log('  - 访问埋点ID:', report.visitBuryPointId || '未设置')
    console.log('  - 点击埋点ID:', report.clickBuryPointId || '未设置')
    console.log('  - 行为分析埋点:', report.behaviorBuryPointIds || '未设置')
    console.log('  - 选中埋点ID:', report.selectedPointId || '未设置')
    console.log('  - 项目ID:', report.projectId || '未设置')
    console.log('  - 当前埋点ID列表:', report.currentPointIds)
    console.log('  - 需要刷新:', report.needsRefresh ? '⚠️ 是' : '✅ 否')
    
    console.log('='.repeat(50))
  }

  // 比较UI配置和实际配置
  compareConfigs(uiConfig) {
    if (!this.isEnabled) return

    console.log('🔍 配置对比分析:')
    console.log('='.repeat(50))
    
    const report = configValidator.getConfigStatusReport()
    
    console.log('UI显示的配置:')
    console.log('  - 访问埋点ID:', uiConfig.visitBuryPointId || '未设置')
    console.log('  - 点击埋点ID:', uiConfig.clickBuryPointId || '未设置')
    console.log('  - 行为分析埋点:', uiConfig.behaviorBuryPointIds || '未设置')
    
    console.log('实际使用的配置:')
    console.log('  - 访问埋点ID:', report.visitBuryPointId || '未设置')
    console.log('  - 点击埋点ID:', report.clickBuryPointId || '未设置')
    console.log('  - 行为分析埋点:', report.behaviorBuryPointIds || '未设置')
    
    // 检查是否一致
    const isConsistent = 
      uiConfig.visitBuryPointId === report.visitBuryPointId &&
      uiConfig.clickBuryPointId === report.clickBuryPointId &&
      JSON.stringify(uiConfig.behaviorBuryPointIds) === JSON.stringify(report.behaviorBuryPointIds)
    
    console.log('配置一致性:', isConsistent ? '✅ 一致' : '❌ 不一致')
    
    if (!isConsistent) {
      console.warn('⚠️ 发现配置不一致，建议刷新页面或重新保存配置')
    }
    
    console.log('='.repeat(50))
  }

  // 强制同步配置
  async forceSyncConfig() {
    if (!this.isEnabled) return false

    console.log('🔄 强制同步配置...')
    
    try {
      const success = await configValidator.forceRefreshConfig()
      if (success) {
        console.log('✅ 配置同步成功')
        this.debugConfigStatus()
        return true
      } else {
        console.warn('⚠️ 配置同步失败')
        return false
      }
    } catch (error) {
      console.error('❌ 配置同步出错:', error)
      return false
    }
  }

  // 检查快速检查逻辑
  checkQuickCheckLogic() {
    if (!this.isEnabled) return

    console.log('🔍 快速检查逻辑分析:')
    console.log('='.repeat(50))
    
    const pointIds = configValidator.getCurrentPointIds()
    console.log('快速检查将使用的埋点ID列表:', pointIds)
    
    if (pointIds.length === 0) {
      console.warn('⚠️ 快速检查将使用空配置，这可能导致检查不准确')
    } else {
      console.log('✅ 快速检查配置正常')
    }
    
    console.log('='.repeat(50))
  }
}

// 创建单例
const configDebugger = new ConfigDebugger()

// 全局暴露
if (typeof window !== 'undefined') {
  window.configDebugger = configDebugger
}

export default configDebugger
