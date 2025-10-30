/**
 * 后端图表服务
 * 替代IndexedDB，使用后端SQLite数据库
 */

class BackendChartService {
  constructor() {
    this.baseURL = 'http://localhost:3004/api'
  }

  /**
   * 检查后端连接状态
   */
  async checkConnection() {
    try {
      const response = await fetch(`${this.baseURL}/health`)
      return response.ok
    } catch (error) {
      console.warn('后端服务不可用:', error.message)
      return false
    }
  }

  /**
   * 发送请求到后端
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
    }

    const response = await fetch(url, { ...defaultOptions, ...options })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  // ==================== 图表配置 CRUD ====================

  /**
   * 保存图表配置
   */
  async saveChart(chart) {
    console.log('💾 [BackendChartService] 保存图表配置:', chart.name)
    console.log('🔍 [BackendChartService] chart.category:', chart.category)
    
    try {
      const result = await this.request('/charts', {
        method: 'POST',
        body: JSON.stringify({
          id: chart.id,
          name: chart.name,
          description: chart.description,
          category: chart.category,
          config: chart.config,
          chartType: chart.config.chartType || 'unknown',
          tags: chart.tags,
          status: chart.status,
          createdAt: chart.createdAt,
          updatedAt: chart.updatedAt
        })
      })
      
      console.log('✅ [BackendChartService] 图表配置保存成功:', result)
      return result
    } catch (error) {
      console.error('❌ [BackendChartService] 图表配置保存失败:', error)
      throw error
    }
  }

  /**
   * 获取单个图表配置
   */
  async getChart(id) {
    try {
      const chart = await this.request(`/charts/${id}`)
      return chart
    } catch (error) {
      console.error('❌ [BackendChartService] 获取图表配置失败:', error)
      throw error
    }
  }

  /**
   * 获取所有图表
   */
  async getAllCharts() {
    try {
      const charts = await this.request('/charts')
      return charts
    } catch (error) {
      console.error('❌ [BackendChartService] 获取图表列表失败:', error)
      throw error
    }
  }

  /**
   * 删除图表
   */
  async deleteChart(id) {
    try {
      const result = await this.request(`/charts/${id}`, {
        method: 'DELETE'
      })
      return result
    } catch (error) {
      console.error('❌ [BackendChartService] 删除图表失败:', error)
      throw error
    }
  }

  // ==================== 图表数据 CRUD ====================

  /**
   * 批量保存图表数据
   */
  async batchSaveChartData(dataList) {
    console.log('💾 [BackendChartService] 批量保存图表数据:', dataList.length, '条')
    
    try {
      const result = await this.request('/charts/data/batch', {
        method: 'POST',
        body: JSON.stringify({ dataList })
      })
      
      console.log('✅ [BackendChartService] 批量保存成功:', result)
      return result
    } catch (error) {
      console.error('❌ [BackendChartService] 批量保存失败:', error)
      throw error
    }
  }

  /**
   * 获取图表数据
   */
  async getChartData(chartId, options = {}) {
    try {
      const params = new URLSearchParams()
      if (options.startDate) params.append('startDate', options.startDate)
      if (options.endDate) params.append('endDate', options.endDate)
      if (options.limit) params.append('limit', options.limit)
      
      const queryString = params.toString()
      const endpoint = `/charts/${chartId}/data${queryString ? `?${queryString}` : ''}`
      
      const data = await this.request(endpoint)
      return data
    } catch (error) {
      console.error('❌ [BackendChartService] 获取图表数据失败:', error)
      throw error
    }
  }

  /**
   * 检查是否存在某天的数据
   */
  async hasChartData(chartId, date) {
    try {
      const data = await this.getChartData(chartId, {
        startDate: date,
        endDate: date,
        limit: 1
      })
      return data && data.length > 0
    } catch (error) {
      console.error('❌ [BackendChartService] 检查数据存在性失败:', error)
      return false
    }
  }

  /**
   * 保存单天图表数据
   */
  async saveChartData(params) {
    try {
      // 支持两种调用方式：对象参数或分别传递参数
      let chartId, date, data
      if (typeof params === 'object' && params.chartId) {
        // 对象方式调用
        ({ chartId, date, ...data } = params)
      } else {
        // 分别传递参数的方式
        [chartId, date, data] = arguments
      }

      const result = await this.request(`/charts/${chartId}/data`, {
        method: 'POST',
        body: JSON.stringify({ date, data })
      })
      return result
    } catch (error) {
      console.error('❌ [BackendChartService] 保存单天数据失败:', error)
      throw error
    }
  }

  /**
   * 更新图表配置
   */
  async updateChart(id, updates) {
    try {
      // 先获取现有图表
      const existingChart = await this.getChart(id)
      if (!existingChart) {
        throw new Error('图表不存在')
      }

      // 合并更新
      const updatedChart = {
        ...existingChart,
        ...updates,
        updatedAt: new Date().toISOString()
      }

      // 保存更新后的图表
      const result = await this.request('/charts', {
        method: 'POST',
        body: JSON.stringify({
          id: updatedChart.id,
          name: updatedChart.name,
          description: updatedChart.description,
          category: updatedChart.category,
          config: updatedChart.config,
          chartType: updatedChart.config.chartType || 'unknown',
          tags: updatedChart.tags,
          status: updatedChart.status,
          createdAt: updatedChart.createdAt,
          updatedAt: updatedChart.updatedAt
        })
      })

      console.log('✅ [BackendChartService] 图表更新成功:', result)
      return result
    } catch (error) {
      console.error('❌ [BackendChartService] 图表更新失败:', error)
      throw error
    }
  }

  // ==================== 统计信息 ====================

  /**
   * 获取数据库统计信息
   */
  async getStats() {
    try {
      const stats = await this.request('/charts/stats')
      return stats
    } catch (error) {
      console.error('❌ [BackendChartService] 获取统计信息失败:', error)
      return {
        charts: 0,
        chartData: 0,
        totalSize: 0,
        error: error.message
      }
    }
  }

  /**
   * 清理数据库
   */
  async clearDatabase() {
    try {
      const result = await this.request('/charts/clear', {
        method: 'POST'
      })
      console.log('✅ [BackendChartService] 数据库清理完成')
      return result
    } catch (error) {
      console.error('❌ [BackendChartService] 数据库清理失败:', error)
      throw error
    }
  }

  /**
   * 初始化服务（兼容性方法）
   */
  async init() {
    console.log('🚀 [BackendChartService] 初始化服务')
    // 检查后端连接
    const isConnected = await this.checkConnection()
    if (!isConnected) {
      throw new Error('后端服务不可用')
    }
    console.log('✅ [BackendChartService] 服务初始化完成')
  }

  /**
   * 清理过期缓存（兼容性方法）
   */
  async cleanExpiredCache() {
    console.log('🧹 [BackendChartService] 清理过期缓存')
    // 后端SQLite不需要清理过期缓存，数据由后端管理
    console.log('✅ [BackendChartService] 缓存清理完成')
  }

  /**
   * 关闭连接（兼容性方法）
   */
  close() {
    console.log('👋 [BackendChartService] 服务关闭')
  }
}

// 导出单例
export const backendChartService = new BackendChartService()

// 为了兼容现有代码，也导出为 chartDB
export const chartDB = backendChartService
