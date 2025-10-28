// 配置同步状态检查工具
import configSyncService from '../services/configSyncService.js'

class ConfigSyncChecker {
  constructor() {
    this.checkResults = {
      backendConnection: false,
      databaseAccess: false,
      configTypes: {
        projectConfig: false,
        apiConfig: false,
        aiConfig: false,
        pageMenuData: false,
        cacheConfig: false
      },
      lastCheckTime: null
    }
  }

  // 执行完整检查
  async performFullCheck() {
    console.log('🔍 开始配置同步状态检查...')
    
    this.checkResults.lastCheckTime = new Date().toISOString()
    
    // 1. 检查后端连接
    await this.checkBackendConnection()
    
    // 2. 检查数据库访问
    await this.checkDatabaseAccess()
    
    // 3. 检查各配置类型
    await this.checkConfigTypes()
    
    // 4. 输出检查结果
    this.outputResults()
    
    return this.checkResults
  }

  // 检查后端连接
  async checkBackendConnection() {
    try {
      const response = await fetch('http://localhost:3004/api/health', {
        method: 'GET',
        timeout: 3000
      })
      this.checkResults.backendConnection = response.ok
    } catch (error) {
      this.checkResults.backendConnection = false
      console.warn('⚠️ 后端连接检查失败:', error.message)
    }
  }

  // 检查数据库访问
  async checkDatabaseAccess() {
    try {
      const response = await fetch('http://localhost:3004/api/stats')
      this.checkResults.databaseAccess = response.ok
    } catch (error) {
      this.checkResults.databaseAccess = false
      console.warn('⚠️ 数据库访问检查失败:', error.message)
    }
  }

  // 检查各配置类型
  async checkConfigTypes() {
    try {
      const response = await fetch('http://localhost:3004/api/config')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const config = await response.json()
      
      // 检查各配置类型是否存在
      this.checkResults.configTypes.projectConfig = !!config.projectConfig
      this.checkResults.configTypes.apiConfig = !!config.apiConfig
      this.checkResults.configTypes.aiConfig = !!config.aiConfig
      this.checkResults.configTypes.pageMenuData = !!config.pageMenuData
      this.checkResults.configTypes.cacheConfig = !!config.cacheConfig
      
    } catch (error) {
      console.warn('⚠️ 配置类型检查失败:', error.message)
      // 所有配置类型标记为false
      Object.keys(this.checkResults.configTypes).forEach(key => {
        this.checkResults.configTypes[key] = false
      })
    }
  }

  // 输出检查结果
  outputResults() {
    console.log('📊 配置同步状态检查结果:')
    console.log('='.repeat(50))
    
    // 基础连接状态
    console.log(`🔗 后端连接: ${this.checkResults.backendConnection ? '✅ 正常' : '❌ 失败'}`)
    console.log(`🗄️ 数据库访问: ${this.checkResults.databaseAccess ? '✅ 正常' : '❌ 失败'}`)
    
    // 配置类型状态
    console.log('\n📋 配置类型同步状态:')
    Object.entries(this.checkResults.configTypes).forEach(([type, status]) => {
      const statusIcon = status ? '✅' : '❌'
      const typeName = this.getConfigTypeName(type)
      console.log(`  ${statusIcon} ${typeName}: ${status ? '已同步' : '未同步'}`)
    })
    
    // 总体状态
    const allConfigsSynced = Object.values(this.checkResults.configTypes).every(status => status)
    const overallStatus = this.checkResults.backendConnection && 
                         this.checkResults.databaseAccess && 
                         allConfigsSynced ? '✅ 完全正常' : '⚠️ 存在问题'
    
    console.log(`\n🎯 总体状态: ${overallStatus}`)
    console.log(`⏰ 检查时间: ${this.checkResults.lastCheckTime}`)
    console.log('='.repeat(50))
  }

  // 获取配置类型中文名称
  getConfigTypeName(type) {
    const names = {
      projectConfig: '项目配置',
      apiConfig: 'API配置',
      aiConfig: 'AI配置',
      pageMenuData: '页面菜单',
      cacheConfig: '缓存管理'
    }
    return names[type] || type
  }

  // 获取检查结果
  getResults() {
    return this.checkResults
  }

  // 检查特定配置类型
  async checkSpecificConfig(type) {
    try {
      const response = await fetch(`http://localhost:3004/api/config/${type}`)
      return response.ok
    } catch (error) {
      console.warn(`⚠️ 检查${type}配置失败:`, error.message)
      return false
    }
  }
}

// 创建单例
const configSyncChecker = new ConfigSyncChecker()

// 全局暴露，方便调试
if (typeof window !== 'undefined') {
  window.configSyncChecker = configSyncChecker
}

export default configSyncChecker
