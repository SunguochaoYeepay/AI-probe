// 配置强制同步工具 - 手动触发配置同步
import { configSyncService } from '../services/configSyncService.js'
import configValidator from './configValidator.js'
import dataSyncConfigValidator from './dataSyncConfigValidator.js'

class ConfigForceSync {
  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'development'
  }

  // 强制同步所有配置
  async forceSyncAllConfigs() {
    if (!this.isEnabled) {
      console.log('⚠️ 配置强制同步仅在开发环境可用')
      return false
    }

    console.log('🔄 开始强制同步所有配置...')
    console.log('='.repeat(50))

    try {
      // 1. 检查后端连接
      console.log('1️⃣ 检查后端连接...')
      await configSyncService.checkConnection()
      if (!configSyncService.isConnected) {
        console.error('❌ 后端服务未连接，无法同步配置')
        return false
      }
      console.log('✅ 后端服务连接正常')

      // 2. 从数据库加载配置
      console.log('2️⃣ 从数据库加载配置...')
      const success = await configSyncService.loadConfigFromDatabase()
      if (!success) {
        console.error('❌ 从数据库加载配置失败')
        return false
      }
      console.log('✅ 配置已从数据库加载')

      // 3. 验证配置同步结果
      console.log('3️⃣ 验证配置同步结果...')
      const configReport = configValidator.getConfigStatusReport()
      const dataSyncReport = dataSyncConfigValidator.getDataSyncStatusReport()

      console.log('📊 配置同步结果:')
      console.log('  - 访问埋点ID:', configReport.visitBuryPointId)
      console.log('  - 点击埋点ID:', configReport.clickBuryPointId)
      console.log('  - 行为分析埋点:', configReport.behaviorBuryPointIds)
      console.log('  - 当前埋点ID列表:', configReport.currentPointIds)
      console.log('  - 数据同步埋点ID列表:', dataSyncReport.dataSyncPointIds)

      // 4. 检查配置一致性
      const isConfigConsistent = configReport.currentPointIds.length > 0
      const isDataSyncConsistent = dataSyncReport.dataSyncPointIds.length > 0

      if (isConfigConsistent && isDataSyncConsistent) {
        console.log('✅ 配置同步成功，所有配置已更新')
        return true
      } else {
        console.warn('⚠️ 配置同步部分成功，某些配置可能未正确更新')
        return false
      }

    } catch (error) {
      console.error('❌ 配置同步失败:', error)
      return false
    } finally {
      console.log('='.repeat(50))
    }
  }

  // 强制刷新配置验证器
  async forceRefreshValidators() {
    if (!this.isEnabled) return false

    console.log('🔄 强制刷新配置验证器...')

    try {
      // 刷新配置验证器
      const configSuccess = await configValidator.forceRefreshConfig()
      
      // 刷新数据同步配置验证器
      const dataSyncSuccess = await dataSyncConfigValidator.forceRefreshDataSyncConfig()

      if (configSuccess && dataSyncSuccess) {
        console.log('✅ 配置验证器刷新成功')
        return true
      } else {
        console.warn('⚠️ 配置验证器刷新部分成功')
        return false
      }
    } catch (error) {
      console.error('❌ 配置验证器刷新失败:', error)
      return false
    }
  }

  // 获取配置同步状态
  getConfigSyncStatus() {
    if (!this.isEnabled) return null

    const configReport = configValidator.getConfigStatusReport()
    const dataSyncReport = dataSyncConfigValidator.getDataSyncStatusReport()

    return {
      config: configReport,
      dataSync: dataSyncReport,
      timestamp: new Date().toISOString()
    }
  }

  // 比较数据库配置和store配置
  async compareDatabaseAndStoreConfig() {
    if (!this.isEnabled) return null

    try {
      // 获取数据库配置
      const response = await fetch('http://localhost:3004/api/config')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const dbConfig = await response.json()

      // 获取store配置
      const storeConfig = configValidator.getConfigStatusReport()

      console.log('🔍 数据库配置 vs Store配置对比:')
      console.log('='.repeat(50))
      console.log('数据库配置:')
      console.log('  - 访问埋点ID:', dbConfig.projectConfig?.visitBuryPointId)
      console.log('  - 点击埋点ID:', dbConfig.projectConfig?.clickBuryPointId)
      console.log('  - 行为分析埋点:', dbConfig.projectConfig?.behaviorBuryPointIds)
      console.log('Store配置:')
      console.log('  - 访问埋点ID:', storeConfig.visitBuryPointId)
      console.log('  - 点击埋点ID:', storeConfig.clickBuryPointId)
      console.log('  - 行为分析埋点:', storeConfig.behaviorBuryPointIds)
      console.log('  - 当前埋点ID列表:', storeConfig.currentPointIds)
      console.log('='.repeat(50))

      return {
        database: dbConfig,
        store: storeConfig
      }
    } catch (error) {
      console.error('❌ 配置对比失败:', error)
      return null
    }
  }
}

// 创建单例
const configForceSync = new ConfigForceSync()

// 全局暴露
if (typeof window !== 'undefined') {
  window.configForceSync = configForceSync
}

export default configForceSync
