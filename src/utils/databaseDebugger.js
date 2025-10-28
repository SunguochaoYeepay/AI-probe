/**
 * 数据库调试工具
 * 统一管理IndexedDB和SQLite的调试信息
 */

class DatabaseDebugger {
  constructor() {
    this.isElectron = window.electronAPI !== undefined
    this.backendUrl = 'http://localhost:3004'
  }

  /**
   * 获取当前使用的数据库类型
   */
  getCurrentDatabase() {
    return this.isElectron ? 'SQLite (Electron)' : 'IndexedDB (Browser)'
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

    if (this.isElectron) {
      // Electron环境：检查SQLite
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
    } else {
      // 浏览器环境：检查IndexedDB
      try {
        const db = await this.openIndexedDB()
        result.connected = true
        result.details = {
          type: 'IndexedDB',
          name: 'yeepay_charts_db',
          version: 2,
          status: 'connected'
        }
        db.close()
      } catch (error) {
        result.details.error = error.message
      }
    }

    return result
  }

  /**
   * 打开IndexedDB
   */
  openIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('yeepay_charts_db', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 获取数据库统计信息
   */
  async getStats() {
    const connection = await this.checkConnection()
    
    if (!connection.connected) {
      return { error: 'Database not connected' }
    }

    if (this.isElectron) {
      // SQLite统计
      try {
        const response = await fetch(`${this.backendUrl}/api/stats`)
        const data = await response.json()
        return {
          database: 'SQLite',
          ...data
        }
      } catch (error) {
        return { error: error.message }
      }
    } else {
      // IndexedDB统计
      try {
        const db = await this.openIndexedDB()
        const stats = await this.getIndexedDBStats(db)
        db.close()
        return {
          database: 'IndexedDB',
          ...stats
        }
      } catch (error) {
        return { error: error.message }
      }
    }
  }

  /**
   * 获取IndexedDB统计信息
   */
  async getIndexedDBStats(db) {
    return new Promise((resolve) => {
      const stats = {
        charts: 0,
        chartData: 0,
        totalSize: 0
      }

      // 统计图表数量
      const chartTransaction = db.transaction(['charts'], 'readonly')
      const chartStore = chartTransaction.objectStore('charts')
      const chartCountRequest = chartStore.count()
      
      chartCountRequest.onsuccess = () => {
        stats.charts = chartCountRequest.result

        // 统计数据数量
        const dataTransaction = db.transaction(['chart_data'], 'readonly')
        const dataStore = dataTransaction.objectStore('chart_data')
        const dataCountRequest = dataStore.count()
        
        dataCountRequest.onsuccess = () => {
          stats.chartData = dataCountRequest.result
          resolve(stats)
        }
      }
    })
  }

  /**
   * 清理数据库
   */
  async clearDatabase() {
    if (this.isElectron) {
      // 清理SQLite
      try {
        const response = await fetch(`${this.backendUrl}/api/clear`, { method: 'POST' })
        return await response.json()
      } catch (error) {
        return { error: error.message }
      }
    } else {
      // 清理IndexedDB
      try {
        const db = await this.openIndexedDB()
        await this.clearIndexedDB(db)
        db.close()
        return { success: true, message: 'IndexedDB cleared' }
      } catch (error) {
        return { error: error.message }
      }
    }
  }

  /**
   * 清理IndexedDB
   */
  clearIndexedDB(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['charts', 'chart_data'], 'readwrite')
      
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)

      const chartStore = transaction.objectStore('charts')
      const dataStore = transaction.objectStore('chart_data')
      
      chartStore.clear()
      dataStore.clear()
    })
  }

  /**
   * 导出数据库信息
   */
  async exportDebugInfo() {
    const connection = await this.checkConnection()
    const stats = await this.getStats()
    
    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      isElectron: this.isElectron,
      connection,
      stats,
      userAgent: navigator.userAgent
    }
  }
}

// 创建全局调试实例
window.databaseDebugger = new DatabaseDebugger()

// 添加控制台命令
console.log(`
🔧 数据库调试工具已加载
使用方法：
- databaseDebugger.checkConnection()  // 检查连接
- databaseDebugger.getStats()         // 获取统计
- databaseDebugger.clearDatabase()    // 清理数据库
- databaseDebugger.exportDebugInfo()  // 导出调试信息
`)

export default DatabaseDebugger
