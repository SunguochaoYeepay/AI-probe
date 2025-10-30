/**
 * 数据库调试工具
 * 统一管理后端SQLite的调试信息
 */

import { buildApiUrl } from '@/config/environment'

class DatabaseDebugger {
  constructor() {
    this.isElectron = window.electronAPI !== undefined
    this.backendUrl = buildApiUrl('')
  }

  /**
   * 获取当前使用的数据库类型
   */
  getCurrentDatabase() {
    return 'SQLite (Backend)'
  }

  /**
   * 检查数据库连接状态
   */
  async checkConnection() {
    const result = {
      database: this.getCurrentDatabase(),
      connected: false,
      details: {}
    }

    // 统一使用后端SQLite
    try {
      const response = await fetch(`${this.backendUrl}/api/health`)
      result.connected = response.ok
      result.details = {
        type: 'SQLite',
        location: 'electron/database/charts.db',
        status: response.ok ? 'connected' : 'disconnected'
      }
    } catch (error) {
      result.details.error = error.message
    }

    return result
  }

  /**
   * 获取数据库统计信息
   */
  async getStats() {
    try {
      const response = await fetch(`${this.backendUrl}/api/charts/stats`)
      const stats = await response.json()
      
      return {
        database: 'SQLite',
        ...stats
      }
    } catch (error) {
      return { 
        database: 'SQLite',
        error: error.message,
        charts: 0,
        chartData: 0,
        totalSize: 0
      }
    }
  }

  /**
   * 清理数据库
   */
  async clearDatabase() {
    try {
      const response = await fetch(`${this.backendUrl}/api/charts/clear`, {
        method: 'POST'
      })
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, message: 'SQLite数据库清理完成' }
      } else {
        return { success: false, message: result.error || '清理失败' }
      }
    } catch (error) {
      return { success: false, message: error.message }
    }
  }
}

// 导出单例
export const databaseDebugger = new DatabaseDebugger()