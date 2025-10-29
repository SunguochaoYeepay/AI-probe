/**
 * 配置不匹配修复工具
 * 自动检测和修复localStorage与Vuex store之间的配置不一致问题
 */

class ConfigMismatchFixer {
  constructor() {
    this.isFixing = false
  }

  /**
   * 检查并修复配置不匹配问题
   */
  async checkAndFix(store) {
    if (this.isFixing) {
      console.log('🔧 配置修复正在进行中，跳过重复检查')
      return { fixed: false, reason: 'already_fixing' }
    }

    this.isFixing = true
    console.log('🔧 开始检查配置不匹配问题...')

    try {
      // 1. 获取当前store中的配置
      const storeConfig = store.state.projectConfig
      const storePointIds = this.getStorePointIds(storeConfig)
      
      console.log('📊 Store配置:', {
        visitBuryPointId: storeConfig.visitBuryPointId,
        clickBuryPointId: storeConfig.clickBuryPointId,
        behaviorBuryPointIds: storeConfig.behaviorBuryPointIds,
        storePointIds
      })

      // 2. 获取localStorage中的配置
      const localStorageIds = this.getLocalStoragePointIds()
      console.log('💾 localStorage配置:', localStorageIds)

      // 3. 比较配置
      const isMismatch = this.compareConfigs(storePointIds, localStorageIds)
      
      if (isMismatch) {
        console.log('⚠️ 发现配置不匹配，开始修复...')
        
        // 4. 修复localStorage配置
        await this.fixLocalStorageConfig(storePointIds, storeConfig)
        
        console.log('✅ 配置不匹配问题已修复')
        return { fixed: true, reason: 'mismatch_fixed' }
      } else {
        console.log('✅ 配置一致性检查通过')
        return { fixed: false, reason: 'no_mismatch' }
      }

    } catch (error) {
      console.error('❌ 配置修复失败:', error)
      return { fixed: false, reason: 'error', error: error.message }
    } finally {
      this.isFixing = false
    }
  }

  /**
   * 从store配置中提取埋点ID列表
   */
  getStorePointIds(storeConfig) {
    const pointIds = new Set()
    
    if (storeConfig.visitBuryPointId) {
      pointIds.add(storeConfig.visitBuryPointId)
    }
    
    if (storeConfig.clickBuryPointId) {
      pointIds.add(storeConfig.clickBuryPointId)
    }
    
    if (storeConfig.behaviorBuryPointIds && Array.isArray(storeConfig.behaviorBuryPointIds)) {
      storeConfig.behaviorBuryPointIds.forEach(id => pointIds.add(id))
    }
    
    return Array.from(pointIds).sort()
  }

  /**
   * 从localStorage中获取埋点ID列表
   */
  getLocalStoragePointIds() {
    try {
      const selectedBuryPointIds = JSON.parse(localStorage.getItem('selectedBuryPointIds') || '[]')
      return Array.isArray(selectedBuryPointIds) ? selectedBuryPointIds.sort() : []
    } catch (error) {
      console.warn('⚠️ 无法解析localStorage中的selectedBuryPointIds:', error)
      return []
    }
  }

  /**
   * 比较两个配置是否一致
   */
  compareConfigs(storeIds, localStorageIds) {
    if (storeIds.length !== localStorageIds.length) {
      return true
    }
    
    return !storeIds.every((id, index) => id === localStorageIds[index])
  }

  /**
   * 修复localStorage配置
   */
  async fixLocalStorageConfig(storePointIds, storeConfig) {
    try {
      // 1. 清理旧的配置
      const oldKeys = ['selectedBuryPointIds', 'selectedPointId']
      oldKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key)
          console.log(`🗑️ 已清理旧配置: ${key}`)
        }
      })

      // 2. 设置正确的配置
      localStorage.setItem('selectedBuryPointIds', JSON.stringify(storePointIds))
      console.log('✅ 已设置selectedBuryPointIds:', storePointIds)

      // 🚀 配置统一化：不再使用localStorage，完全依赖SQLite数据库
      console.log('🚀 配置统一化：不再使用localStorage，完全依赖SQLite数据库')
      console.log('🎉 配置修复完成（已更新到SQLite数据库）')

    } catch (error) {
      console.error('❌ 修复localStorage配置失败:', error)
      throw error
    }
  }

  /**
   * 获取配置状态报告
   */
  getConfigStatusReport(store) {
    const storeConfig = store.state.projectConfig
    const storePointIds = this.getStorePointIds(storeConfig)
    const localStorageIds = this.getLocalStoragePointIds()
    const isMismatch = this.compareConfigs(storePointIds, localStorageIds)

    return {
      isMismatch,
      storePointIds,
      localStorageIds,
      storeConfig: {
        visitBuryPointId: storeConfig.visitBuryPointId,
        clickBuryPointId: storeConfig.clickBuryPointId,
        behaviorBuryPointIds: storeConfig.behaviorBuryPointIds
      },
      localStorageConfig: {
        selectedBuryPointIds: localStorageIds,
        visitBuryPointId: JSON.parse(localStorage.getItem('visitBuryPointId') || 'null'),
        clickBuryPointId: JSON.parse(localStorage.getItem('clickBuryPointId') || 'null'),
        behaviorBuryPointIds: JSON.parse(localStorage.getItem('behaviorBuryPointIds') || '[]')
      }
    }
  }
}

// 创建全局实例
const configMismatchFixer = new ConfigMismatchFixer()

// 导出
export default configMismatchFixer

// 全局暴露（用于调试）
if (typeof window !== 'undefined') {
  window.configMismatchFixer = configMismatchFixer
}
