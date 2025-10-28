// 配置验证工具 - 确保快速检查使用正确的配置
import { useStore } from 'vuex'

class ConfigValidator {
  constructor() {
    this.store = null
  }

  // 初始化
  init(store) {
    this.store = store
  }

  // 验证配置一致性
  validateConfigConsistency() {
    if (!this.store) {
      console.error('❌ ConfigValidator未初始化')
      return false
    }

    const projectConfig = this.store.state.projectConfig
    const apiConfig = this.store.state.apiConfig
    
    console.log('🔍 配置一致性验证:')
    console.log('  - 项目配置:', {
      visitBuryPointId: projectConfig.visitBuryPointId,
      clickBuryPointId: projectConfig.clickBuryPointId,
      behaviorBuryPointIds: projectConfig.behaviorBuryPointIds
    })
    console.log('  - API配置:', {
      selectedPointId: apiConfig.selectedPointId,
      projectId: apiConfig.projectId
    })

    // 检查是否有有效的埋点配置
    const hasValidConfig = projectConfig.visitBuryPointId || 
                          projectConfig.clickBuryPointId || 
                          (projectConfig.behaviorBuryPointIds && projectConfig.behaviorBuryPointIds.length > 0)

    if (!hasValidConfig) {
      console.warn('⚠️ 未找到有效的埋点配置')
      return false
    }

    return true
  }

  // 获取当前有效的埋点ID列表
  getCurrentPointIds() {
    if (!this.store) {
      console.error('❌ ConfigValidator未初始化')
      return []
    }

    const projectConfig = this.store.state.projectConfig
    const pointIds = new Set()
    
    // 添加访问埋点
    if (projectConfig.visitBuryPointId) {
      pointIds.add(projectConfig.visitBuryPointId)
    }
    
    // 添加点击埋点
    if (projectConfig.clickBuryPointId) {
      pointIds.add(projectConfig.clickBuryPointId)
    }
    
    // 添加行为分析埋点
    if (projectConfig.behaviorBuryPointIds && Array.isArray(projectConfig.behaviorBuryPointIds)) {
      projectConfig.behaviorBuryPointIds.forEach(id => pointIds.add(id))
    }
    
    // 注意：已移除旧配置格式（selectedBuryPointIds）的兼容逻辑
    // 现在只使用新的分离配置格式，确保配置一致性
    
    const result = Array.from(pointIds)
    console.log('📊 当前有效埋点ID列表:', result)
    return result
  }

  // 强制刷新配置
  async forceRefreshConfig() {
    if (!window.configSyncService) {
      console.warn('⚠️ 配置同步服务不可用')
      return false
    }

    try {
      console.log('🔄 强制刷新配置...')
      const success = await window.configSyncService.loadConfigFromDatabase()
      if (success) {
        console.log('✅ 配置刷新成功')
        return true
      } else {
        console.warn('⚠️ 配置刷新失败')
        return false
      }
    } catch (error) {
      console.error('❌ 配置刷新出错:', error)
      return false
    }
  }

  // 检查配置是否需要刷新
  shouldRefreshConfig() {
    const pointIds = this.getCurrentPointIds()
    return pointIds.length === 0
  }

  // 获取配置状态报告
  getConfigStatusReport() {
    const projectConfig = this.store?.state.projectConfig || {}
    const apiConfig = this.store?.state.apiConfig || {}
    
    return {
      hasStore: !!this.store,
      hasProjectConfig: !!projectConfig,
      hasApiConfig: !!apiConfig,
      visitBuryPointId: projectConfig.visitBuryPointId,
      clickBuryPointId: projectConfig.clickBuryPointId,
      behaviorBuryPointIds: projectConfig.behaviorBuryPointIds,
      selectedPointId: apiConfig.selectedPointId,
      projectId: apiConfig.projectId,
      currentPointIds: this.getCurrentPointIds(),
      needsRefresh: this.shouldRefreshConfig()
    }
  }
}

// 创建单例
const configValidator = new ConfigValidator()

// 全局暴露
if (typeof window !== 'undefined') {
  window.configValidator = configValidator
}

export default configValidator
