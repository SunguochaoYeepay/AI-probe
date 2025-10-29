import store from '@/store'
import { dataPreloadService } from './dataPreloadService'
import { buildApiUrl, getBackendConfig } from '@/config/environment'

class ConfigSyncService {
  constructor() {
    this.store = null
    this.isConnected = false
    this.checkConnection()
  }

  // 检查后端连接状态
  async checkConnection() {
    try {
      const config = getBackendConfig()
      const response = await fetch(buildApiUrl(config.healthEndpoint), {
        method: 'GET',
        timeout: 3000
      })
      this.isConnected = response.ok
      console.log(this.isConnected ? '✅ 后端服务连接正常' : '❌ 后端服务连接失败')
    } catch (error) {
      this.isConnected = false
      console.log('❌ 后端服务连接失败:', error.message)
    }
  }

  // 🚀 配置统一化：不再使用localStorage，无需清理
  clearLegacyConfig() {
    console.log('🚀 配置统一化：不再使用localStorage，无需清理')
  }

  // 从数据库加载配置
  async loadConfigFromDatabase(retryCount = 0) {
    const maxRetries = 3
    const retryDelay = 1000
    
    // 先检查连接状态
    await this.checkConnection()
    
    if (!this.isConnected) {
      if (retryCount < maxRetries) {
        console.log(`⚠️ 后端服务未连接，${retryDelay}ms后重试 (${retryCount + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.loadConfigFromDatabase(retryCount + 1)
      } else {
        console.log('❌ 后端服务连接失败，跳过数据库配置加载')
        return false
      }
    }

    try {
      console.log('🔄 正在从数据库获取最新配置...')
      const config = getBackendConfig()
      const response = await fetch(buildApiUrl(config.configEndpoint))
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const configData = await response.json()
      console.log('📥 从数据库获取到配置:', configData)

      // 🚀 修复：每次都完全替换配置，确保数据库配置是唯一来源
      if (configData.projectConfig) {
        // 清理所有localStorage中的旧配置
        this.clearLegacyConfig()
        
        // 完全替换项目配置，不保留任何旧配置
        this.store.dispatch('replaceProjectConfig', configData.projectConfig)
        console.log('✅ 项目配置已从数据库完全替换到store')
      }

      if (configData.apiConfig) {
        this.store.dispatch('updateApiConfig', configData.apiConfig)
        console.log('✅ API配置已同步到store')
      }

      if (configData.aiConfig) {
        this.store.dispatch('updateOllamaConfig', configData.aiConfig)
        console.log('✅ AI配置已同步到store')
      }

      if (configData.pageMenuData) {
        this.store.dispatch('updateProjectConfig', { pageMenuData: configData.pageMenuData })
        console.log('✅ 页面菜单配置已同步到store')
      }

      if (configData.cacheConfig) {
        // 缓存配置需要特殊处理，因为它在dataPreloadService中
        dataPreloadService.setSmartInvalidation(configData.cacheConfig.smartInvalidation)
        dataPreloadService.setCacheValidityPeriod(configData.cacheConfig.validityPeriod)
        console.log('✅ 缓存管理配置已同步到store')
      }

      // 🚀 新增：定期刷新配置，确保配置始终是最新的
      this.scheduleConfigRefresh()
      
      return true
    } catch (error) {
      console.error('❌ 从数据库加载配置失败:', error)
      return false
    }
  }

  // 🚀 新增：定期刷新配置
  scheduleConfigRefresh() {
    // 每5分钟检查一次配置是否需要刷新（减少频率）
    setInterval(async () => {
      if (this.isConnected) {
        console.log('🔄 定期检查配置更新...')
        await this.loadConfigFromDatabase()
      }
    }, 300000) // 5分钟
  }

  // 🚀 新增：手动强制刷新配置
  async forceRefreshConfig() {
    console.log('🔄 手动强制刷新配置...')
    return await this.loadConfigFromDatabase()
  }

  // 🔧 新增：检查并修复配置不匹配问题
  async checkAndFixConfigMismatch() {
    if (this.store) {
      console.log('🔧 检查配置不匹配问题...')
      // 这里可以添加配置不匹配的检查和修复逻辑
      return true
    }
    return false
  }

  // 保存配置到数据库
  async saveConfigToDatabase(configType, configData) {
    if (!this.isConnected) {
      console.log('⚠️ 后端服务未连接，跳过数据库配置保存')
      return false
    }

    try {
      const config = getBackendConfig()
      const response = await fetch(buildApiUrl(config.configEndpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          [configType]: configData
        })
      })

      if (response.ok) {
        console.log(`✅ ${configType}配置已保存到数据库`)
        return true
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.warn(`⚠️ ${configType}配置保存到数据库失败:`, error.message)
      return false
    }
  }

  // 初始化服务
  init(store) {
    this.store = store
    console.log('🔧 配置同步服务已初始化')
  }

  // 获取连接状态
  getConnectionStatus() {
    const config = getBackendConfig()
    return {
      connected: this.isConnected,
      backendUrl: config.baseUrl
    }
  }
}

// 创建单例
const configSyncService = new ConfigSyncService()

// 全局暴露，方便调试和快速检查使用
if (typeof window !== 'undefined') {
  window.configSyncService = configSyncService
}

export { configSyncService }