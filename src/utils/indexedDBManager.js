/**
 * IndexedDB 管理器
 * 用于图表配置和聚合数据的持久化存储
 */

class ChartDatabase {
  constructor() {
    this.db = null
    this.dbName = 'yeepay_charts_db'
    this.version = 1
  }

  /**
   * 初始化数据库
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        console.error('IndexedDB打开失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('✅ IndexedDB初始化成功')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        console.log('🔄 IndexedDB升级中...')

        // 创建图表配置表
        if (!db.objectStoreNames.contains('charts')) {
          const chartStore = db.createObjectStore('charts', { keyPath: 'id' })
          chartStore.createIndex('status', 'status', { unique: false })
          chartStore.createIndex('category', 'category', { unique: false })
          chartStore.createIndex('createdAt', 'createdAt', { unique: false })
          console.log('📊 创建 charts 表')
        }

        // 创建聚合数据表
        if (!db.objectStoreNames.contains('chart_data')) {
          const dataStore = db.createObjectStore('chart_data', { keyPath: 'id' })
          dataStore.createIndex('chartId', 'chartId', { unique: false })
          dataStore.createIndex('date', 'date', { unique: false })
          dataStore.createIndex('chartId_date', ['chartId', 'date'], { unique: true })
          console.log('📈 创建 chart_data 表')
        }

        // 创建原始数据缓存表（可选）
        if (!db.objectStoreNames.contains('raw_data_cache')) {
          const cacheStore = db.createObjectStore('raw_data_cache', { keyPath: 'id' })
          cacheStore.createIndex('date', 'date', { unique: false })
          cacheStore.createIndex('expiresAt', 'expiresAt', { unique: false })
          console.log('💾 创建 raw_data_cache 表')
        }
      }
    })
  }

  /**
   * 通用的事务执行方法
   */
  _executeTransaction(storeName, mode, callback) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'))
        return
      }

      try {
        const transaction = this.db.transaction([storeName], mode)
        const store = transaction.objectStore(storeName)
        
        const request = callback(store)
        
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      } catch (error) {
        reject(error)
      }
    })
  }

  // ==================== 图表配置 CRUD ====================

  /**
   * 保存图表配置
   */
  async saveChart(chart) {
    console.log('💾 保存图表配置:', chart.name)
    return this._executeTransaction('charts', 'readwrite', (store) => {
      return store.put(chart)
    })
  }

  /**
   * 获取单个图表配置
   */
  async getChart(id) {
    return this._executeTransaction('charts', 'readonly', (store) => {
      return store.get(id)
    })
  }

  /**
   * 获取所有图表配置
   * @param {Object} filter - 过滤条件 { status: 'active', category: 'page' }
   */
  async getAllCharts(filter = {}) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'))
        return
      }

      const transaction = this.db.transaction(['charts'], 'readonly')
      const store = transaction.objectStore('charts')
      const request = store.getAll()

      request.onsuccess = () => {
        let charts = request.result

        // 应用过滤条件
        if (filter.status) {
          charts = charts.filter(c => c.status === filter.status)
        }
        if (filter.category) {
          charts = charts.filter(c => c.category === filter.category)
        }

        // 按创建时间倒序排序
        charts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

        resolve(charts)
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 更新图表配置
   */
  async updateChart(id, updates) {
    const chart = await this.getChart(id)
    if (!chart) {
      throw new Error(`图表 ${id} 不存在`)
    }

    const updatedChart = {
      ...chart,
      ...updates,
      updatedAt: new Date().toISOString()
    }

    return this.saveChart(updatedChart)
  }

  /**
   * 删除图表配置
   */
  async deleteChart(id) {
    console.log('🗑️ 删除图表:', id)
    
    // 同时删除该图表的所有数据
    await this.deleteAllChartData(id)
    
    return this._executeTransaction('charts', 'readwrite', (store) => {
      return store.delete(id)
    })
  }

  // ==================== 图表数据 CRUD ====================

  /**
   * 保存图表数据
   * @param {Object} data - { chartId, date, metrics, dimensions, metadata }
   */
  async saveChartData(data) {
    const id = `${data.chartId}_${data.date}`
    const record = {
      id,
      ...data
    }

    console.log(`💾 保存图表数据: ${data.chartId} - ${data.date}`)
    return this._executeTransaction('chart_data', 'readwrite', (store) => {
      return store.put(record)
    })
  }

  /**
   * 批量保存图表数据
   */
  async batchSaveChartData(dataList) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'))
        return
      }

      const transaction = this.db.transaction(['chart_data'], 'readwrite')
      const store = transaction.objectStore('chart_data')

      dataList.forEach(data => {
        const id = `${data.chartId}_${data.date}`
        store.put({ id, ...data })
      })

      transaction.oncomplete = () => {
        console.log(`✅ 批量保存 ${dataList.length} 条数据`)
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)
    })
  }

  /**
   * 获取图表数据
   * @param {String} chartId - 图表ID
   * @param {Object} options - { startDate, endDate, limit }
   */
  async getChartData(chartId, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'))
        return
      }

      const transaction = this.db.transaction(['chart_data'], 'readonly')
      const store = transaction.objectStore('chart_data')
      const index = store.index('chartId')
      const request = index.getAll(chartId)

      request.onsuccess = () => {
        let data = request.result

        // 按日期过滤
        if (options.startDate) {
          data = data.filter(d => d.date >= options.startDate)
        }
        if (options.endDate) {
          data = data.filter(d => d.date <= options.endDate)
        }

        // 按日期排序
        data.sort((a, b) => a.date.localeCompare(b.date))

        // 限制数量
        if (options.limit) {
          data = data.slice(-options.limit)
        }

        resolve(data)
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 检查是否存在某天的数据
   */
  async hasChartData(chartId, date) {
    const id = `${chartId}_${date}`
    return this._executeTransaction('chart_data', 'readonly', (store) => {
      return store.get(id)
    }).then(result => !!result)
  }

  /**
   * 删除图表的所有数据
   */
  async deleteAllChartData(chartId) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'))
        return
      }

      const transaction = this.db.transaction(['chart_data'], 'readwrite')
      const store = transaction.objectStore('chart_data')
      const index = store.index('chartId')
      const request = index.openCursor(chartId)

      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }

      transaction.oncomplete = () => {
        console.log(`🗑️ 删除图表数据: ${chartId}`)
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)
    })
  }

  /**
   * 删除指定日期之前的数据（清理旧数据）
   */
  async deleteChartDataBefore(chartId, beforeDate) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'))
        return
      }

      const transaction = this.db.transaction(['chart_data'], 'readwrite')
      const store = transaction.objectStore('chart_data')
      const index = store.index('chartId')
      const request = index.openCursor(chartId)

      let deletedCount = 0

      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          if (cursor.value.date < beforeDate) {
            cursor.delete()
            deletedCount++
          }
          cursor.continue()
        }
      }

      transaction.oncomplete = () => {
        console.log(`🗑️ 清理旧数据: ${chartId}, 删除 ${deletedCount} 条`)
        resolve(deletedCount)
      }
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // ==================== 原始数据缓存 ====================

  /**
   * 保存原始数据缓存
   */
  async saveRawDataCache(cache) {
    console.log(`💾 缓存原始数据: ${cache.date}`)
    return this._executeTransaction('raw_data_cache', 'readwrite', (store) => {
      return store.put(cache)
    })
  }

  /**
   * 获取原始数据缓存
   */
  async getRawDataCache(id) {
    return this._executeTransaction('raw_data_cache', 'readonly', (store) => {
      return store.get(id)
    })
  }

  /**
   * 清理过期的原始数据缓存
   */
  async cleanExpiredCache() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'))
        return
      }

      const transaction = this.db.transaction(['raw_data_cache'], 'readwrite')
      const store = transaction.objectStore('raw_data_cache')
      const index = store.index('expiresAt')
      const now = new Date().toISOString()
      const request = index.openCursor()

      let deletedCount = 0

      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (cursor) {
          if (cursor.value.expiresAt < now) {
            cursor.delete()
            deletedCount++
          }
          cursor.continue()
        }
      }

      transaction.oncomplete = () => {
        if (deletedCount > 0) {
          console.log(`🗑️ 清理过期缓存: ${deletedCount} 条`)
        }
        resolve(deletedCount)
      }
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // ==================== 工具方法 ====================

  /**
   * 获取数据库统计信息
   */
  async getStats() {
    const charts = await this.getAllCharts()
    
    let totalDataCount = 0
    for (const chart of charts) {
      const data = await this.getChartData(chart.id)
      totalDataCount += data.length
    }

    return {
      chartCount: charts.length,
      activeChartCount: charts.filter(c => c.status === 'active').length,
      totalDataCount: totalDataCount,
      avgDataPerChart: charts.length > 0 ? Math.round(totalDataCount / charts.length) : 0
    }
  }

  /**
   * 清空所有数据（慎用）
   */
  async clearAll() {
    const stores = ['charts', 'chart_data', 'raw_data_cache']
    
    for (const storeName of stores) {
      await this._executeTransaction(storeName, 'readwrite', (store) => {
        return store.clear()
      })
    }
    
    console.log('🗑️ 已清空所有数据')
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this.db) {
      this.db.close()
      this.db = null
      console.log('👋 数据库连接已关闭')
    }
  }
}

// 导出单例
export const chartDB = new ChartDatabase()

