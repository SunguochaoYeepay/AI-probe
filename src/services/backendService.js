import axios from 'axios'
import { getBackendConfig } from '@/config/environment'

// 获取后端配置
const backendConfig = getBackendConfig()

// 创建axios实例
const backendAPI = axios.create({
  baseURL: backendConfig.baseUrl,
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
backendAPI.interceptors.request.use(
  (config) => {
    console.log(`🔄 发送请求到后端: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('❌ 请求配置错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
backendAPI.interceptors.response.use(
  (response) => {
    console.log(`✅ 后端响应成功: ${response.config.url}`)
    return response
  },
  (error) => {
    console.error('❌ 后端请求失败:', error.message)
    if (error.code === 'ECONNREFUSED') {
      console.error('🔌 无法连接到后端服务器，请确保服务器正在运行')
    }
    return Promise.reject(error)
  }
)

// 后端服务类
class BackendService {
  constructor() {
    this.isConnected = false
    this.checkConnection()
  }

  // 检查后端连接状态
  async checkConnection() {
    try {
      const response = await backendAPI.get('/api/health')
      this.isConnected = response.status === 200
      console.log('✅ 后端服务连接正常')
      return true
    } catch (error) {
      this.isConnected = false
      console.warn('⚠️ 后端服务连接失败，将使用前端处理模式')
      return false
    }
  }

  // 数据聚合接口
  async aggregateData(rawData, chartConfig) {
    try {
      console.log(`🔄 发送数据到后端聚合: ${rawData.length} 条原始数据`)
      
      const response = await backendAPI.post('/api/aggregate', {
        rawData,
        chartConfig
      })
      
      console.log(`✅ 后端聚合完成: ${response.data.aggregatedCount} 条聚合数据，耗时 ${response.data.processingTime}ms`)
      
      return {
        success: true,
        data: response.data.data,
        processingTime: response.data.processingTime,
        originalCount: response.data.originalCount,
        aggregatedCount: response.data.aggregatedCount
      }
    } catch (error) {
      console.error('❌ 后端聚合失败:', error.message)
      throw error
    }
  }

  // 缓存原始数据
  async cacheRawData(buryPointId, date, data) {
    try {
      await backendAPI.post('/api/cache/raw-data', {
        buryPointId,
        date,
        data
      })
      console.log(`✅ 原始数据已缓存: 埋点${buryPointId} - ${date}`)
    } catch (error) {
      console.error('❌ 缓存原始数据失败:', error.message)
      throw error
    }
  }

  // 获取缓存的原始数据
  async getCachedRawData(buryPointId, date) {
    try {
      const response = await backendAPI.get(`/api/cache/raw-data/${buryPointId}/${date}`)
      console.log(`✅ 获取缓存数据成功: 埋点${buryPointId} - ${date}`)
      return response.data
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`📭 缓存数据不存在: 埋点${buryPointId} - ${date}`)
        return null
      }
      console.error('❌ 获取缓存数据失败:', error.message)
      throw error
    }
  }

  // 创建图表
  async createChart(chartId, name, config, chartType) {
    try {
      const response = await backendAPI.post('/api/charts', {
        id: chartId,
        name,
        config,
        chartType
      })
      console.log(`✅ 图表创建成功: ${name}`)
      return response.data
    } catch (error) {
      console.error('❌ 创建图表失败:', error.message)
      throw error
    }
  }

  // 获取图表列表
  async getCharts() {
    try {
      const response = await backendAPI.get('/api/charts')
      return response.data
    } catch (error) {
      console.error('❌ 获取图表列表失败:', error.message)
      throw error
    }
  }

  // 获取图表数据
  async getChartData(chartId, startDate, endDate) {
    try {
      const params = {}
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      
      const response = await backendAPI.get(`/api/charts/${chartId}/data`, { params })
      return response.data
    } catch (error) {
      console.error('❌ 获取图表数据失败:', error.message)
      throw error
    }
  }

  // 检查是否应该使用后端处理
  shouldUseBackend(dataSize) {
    // 开发环境：优先使用前端处理，避免时序问题
    // 生产环境：根据数据量决定
    if (import.meta.env?.MODE === 'development') {
      // 在开发环境下，优先使用前端处理，确保一致性
      return false  // 始终使用前端处理，避免时序问题
    }
    return this.isConnected && dataSize > 1000
  }
}

// 创建单例实例
const backendService = new BackendService()

export default backendService
