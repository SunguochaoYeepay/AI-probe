// 配置同步服务 - 负责前端与数据库配置的同步
import { useStore } from 'vuex'
import configMismatchFixer from '../utils/configMismatchFixer' // 引入配置不匹配修复工具
import { dataPreloadService } from './dataPreloadService' // 引入数据预加载服务

class ConfigSyncService {
  constructor() {
    this.store = null
    this.isConnected = false
    this.checkConnection()
  }

  // 检查后端连接
  async checkConnection() {
    try {
      const response = await fetch('http://localhost:3004/api/health', {
        method: 'GET',
        timeout: 3000
      })
      this.isConnected = response.ok
    } catch (error) {
      this.isConnected = false
    }
  }

  // 清理localStorage中的旧配置
  clearLegacyConfig() {
    const legacyKeys = [
      'selectedBuryPointIds',
      'selectedPointId',
      'visitBuryPointId', 
      'clickBuryPointId',
      'behaviorBuryPointIds'
    ]
    
    legacyKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key)
        console.log(`🗑️ 已清理localStorage中的旧配置: ${key}`)
      }
    })
  }

  // 从数据库加载配置
  async loadConfigFromDatabase() {
    if (!this.isConnected) {
      console.log('⚠️ 后端服务未连接，跳过数据库配置加载')
      return false
    }

    try {
      const response = await fetch('http://localhost:3004/api/config')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const config = await response.json()
      console.log('📥 从数据库加载配置:', config)

      // 同步到store（强制覆盖localStorage缓存）
      if (config.projectConfig) {
        // 清理localStorage中的旧配置，确保数据库配置优先
        this.clearLegacyConfig()
        
        this.store.dispatch('updateProjectConfig', config.projectConfig)
        console.log('✅ 项目配置已同步到store（已清理localStorage缓存）')
      }

      if (config.apiConfig) {
        this.store.dispatch('updateApiConfig', config.apiConfig)
        console.log('✅ API配置已同步到store')
      }

      if (config.aiConfig) {
        this.store.dispatch('updateOllamaConfig', config.aiConfig)
        console.log('✅ AI配置已同步到store')
      }

      if (config.pageMenuData) {
        this.store.dispatch('updateProjectConfig', { pageMenuData: config.pageMenuData })
        console.log('✅ 页面菜单配置已同步到store')
      }

      if (config.cacheConfig) {
        // 缓存配置需要特殊处理，因为它在dataPreloadService中
        dataPreloadService.setSmartInvalidation(config.cacheConfig.smartInvalidation)
        dataPreloadService.setCacheValidityPeriod(config.cacheConfig.validityPeriod)
        // autoCheckEnabled 是一个ref，需要直接设置
        // 或者直接在CacheManagementPanel中处理autoCheck的加载
        console.log('✅ 缓存管理配置已同步到store')
      }

      // 🔧 新增：检查并修复配置不匹配问题
      if (this.store) {
        console.log('🔧 检查配置不匹配问题...')
        const fixResult = await configMismatchFixer.checkAndFix(this.store)
        if (fixResult.fixed) {
          console.log('✅ 配置不匹配问题已自动修复')
        } else {
          console.log('✅ 配置一致性检查通过')
        }
      }

      return true
    } catch (error) {
      console.warn('⚠️ 从数据库加载配置失败:', error.message)
      return false
    }
  }

  // 保存配置到数据库
  async saveConfigToDatabase(configType, configData) {
    if (!this.isConnected) {
      console.log('⚠️ 后端服务未连接，跳过数据库配置保存')
      return false
    }

    try {
      const response = await fetch('http://localhost:3004/api/config', {
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
    return {
      connected: this.isConnected,
      backendUrl: 'http://localhost:3004'
    }
  }
}

// 创建单例
const configSyncService = new ConfigSyncService()

// 全局暴露，方便调试和快速检查使用
if (typeof window !== 'undefined') {
  window.configSyncService = configSyncService
}

export default configSyncService
