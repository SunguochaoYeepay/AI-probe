// 数据同步配置验证工具 - 确保数据同步使用正确的配置
import { useStore } from 'vuex'

class DataSyncConfigValidator {
  constructor() {
    this.store = null
  }

  // 初始化
  init(store) {
    this.store = store
  }

  // 获取数据同步应该使用的埋点ID列表
  getDataSyncPointIds() {
    if (!this.store) {
      console.error('❌ DataSyncConfigValidator未初始化')
      return []
    }

    const projectConfig = this.store.state.projectConfig
    const pointIds = new Set()
    
    console.log('🔍 数据同步配置验证:')
    console.log('  - 项目配置:', {
      visitBuryPointId: projectConfig.visitBuryPointId,
      clickBuryPointId: projectConfig.clickBuryPointId,
      behaviorBuryPointIds: projectConfig.behaviorBuryPointIds
    })
    
    // 添加访问埋点
    if (projectConfig.visitBuryPointId) {
      pointIds.add(projectConfig.visitBuryPointId)
      console.log(`  ✅ 添加访问埋点: ${projectConfig.visitBuryPointId}`)
    }
    
    // 添加点击埋点
    if (projectConfig.clickBuryPointId) {
      pointIds.add(projectConfig.clickBuryPointId)
      console.log(`  ✅ 添加点击埋点: ${projectConfig.clickBuryPointId}`)
    }
    
    // 添加行为分析埋点
    if (projectConfig.behaviorBuryPointIds && Array.isArray(projectConfig.behaviorBuryPointIds)) {
      projectConfig.behaviorBuryPointIds.forEach(id => {
        pointIds.add(id)
        console.log(`  ✅ 添加行为分析埋点: ${id}`)
      })
    }
    
    // 注意：已移除旧配置格式（selectedBuryPointIds）的兼容逻辑
    // 现在只使用新的分离配置格式，确保配置一致性
    
    const result = Array.from(pointIds)
    console.log(`📊 数据同步埋点ID列表: [${result.join(', ')}]`)
    return result
  }

  // 验证数据同步配置一致性
  validateDataSyncConfig() {
    if (!this.store) {
      console.error('❌ DataSyncConfigValidator未初始化')
      return false
    }

    const pointIds = this.getDataSyncPointIds()
    
    if (pointIds.length === 0) {
      console.warn('⚠️ 数据同步配置为空，没有可同步的埋点')
      return false
    }

    console.log('✅ 数据同步配置验证通过')
    return true
  }

  // 比较UI配置和数据同步配置
  compareWithUIConfig(uiConfig) {
    if (!this.store) {
      console.error('❌ DataSyncConfigValidator未初始化')
      return false
    }

    const dataSyncPointIds = this.getDataSyncPointIds()
    const uiPointIds = []
    
    // 从UI配置中提取埋点ID
    if (uiConfig.visitBuryPointId) {
      uiPointIds.push(uiConfig.visitBuryPointId)
    }
    if (uiConfig.clickBuryPointId) {
      uiPointIds.push(uiConfig.clickBuryPointId)
    }
    if (uiConfig.behaviorBuryPointIds && Array.isArray(uiConfig.behaviorBuryPointIds)) {
      uiPointIds.push(...uiConfig.behaviorBuryPointIds)
    }

    console.log('🔍 数据同步配置对比:')
    console.log('  - UI配置埋点:', uiPointIds)
    console.log('  - 数据同步埋点:', dataSyncPointIds)
    
    // 检查是否一致
    const isConsistent = 
      uiPointIds.length === dataSyncPointIds.length &&
      uiPointIds.every(id => dataSyncPointIds.includes(id)) &&
      dataSyncPointIds.every(id => uiPointIds.includes(id))
    
    console.log('  - 配置一致性:', isConsistent ? '✅ 一致' : '❌ 不一致')
    
    if (!isConsistent) {
      console.warn('⚠️ 数据同步配置与UI配置不一致，建议刷新页面或重新保存配置')
    }
    
    return isConsistent
  }

  // 获取数据同步状态报告
  getDataSyncStatusReport() {
    const pointIds = this.getDataSyncPointIds()
    const projectConfig = this.store?.state.projectConfig || {}
    
    return {
      hasStore: !!this.store,
      hasProjectConfig: !!projectConfig,
      visitBuryPointId: projectConfig.visitBuryPointId,
      clickBuryPointId: projectConfig.clickBuryPointId,
      behaviorBuryPointIds: projectConfig.behaviorBuryPointIds,
      dataSyncPointIds: pointIds,
      configValid: pointIds.length > 0,
      needsRefresh: pointIds.length === 0
    }
  }

  // 强制刷新数据同步配置
  async forceRefreshDataSyncConfig() {
    if (!window.configSyncService) {
      console.warn('⚠️ 配置同步服务不可用')
      return false
    }

    try {
      console.log('🔄 强制刷新数据同步配置...')
      const success = await window.configSyncService.loadConfigFromDatabase()
      if (success) {
        console.log('✅ 数据同步配置刷新成功')
        return true
      } else {
        console.warn('⚠️ 数据同步配置刷新失败')
        return false
      }
    } catch (error) {
      console.error('❌ 数据同步配置刷新出错:', error)
      return false
    }
  }
}

// 创建单例
const dataSyncConfigValidator = new DataSyncConfigValidator()

// 全局暴露
if (typeof window !== 'undefined') {
  window.dataSyncConfigValidator = dataSyncConfigValidator
}

export default dataSyncConfigValidator
