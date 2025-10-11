import axios from 'axios'
import { API_CONFIG } from '@/config/api'
import store from '@/store'

// 创建axios实例
const api = axios.create({
  timeout: API_CONFIG.defaults.timeout,
  headers: {
    'Content-Type': 'text/plain;charset=UTF-8',
    'Accept': '*/*'
  }
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    // 动态获取当前配置
    const currentConfig = store.state.apiConfig
    
    // 设置 baseURL（如果在请求配置中没有完整的 URL）
    if (!config.url.startsWith('http')) {
      config.baseURL = currentConfig.baseUrl || API_CONFIG.environments.development.baseUrl
    }
    
    // 自动添加访问令牌（优先使用 store 中的配置）
    const token = currentConfig.accessToken || API_CONFIG.environments.development.accessToken
    if (token) {
      config.headers['access-token'] = token
    }
    
    // 添加其他必要的请求头（移除浏览器禁止设置的头部）
    config.headers['accept-language'] = 'en,zh-CN;q=0.9,zh;q=0.8'
    
    console.log('API请求配置:', config)
    console.log('使用的令牌:', token ? token.substring(0, 20) + '...' : '无')
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    console.log('API响应成功:', response.data)
    return response.data
  },
  error => {
    console.error('API请求错误:', error)
    
    // 详细的错误信息
    if (error.response) {
      // 服务器返回了错误响应
      console.error('响应状态:', error.response.status)
      console.error('响应数据:', error.response.data)
      console.error('响应头:', error.response.headers)
    } else if (error.request) {
      // 请求已发送但没有收到响应
      console.error('请求已发送但无响应:', error.request)
    } else {
      // 发生了其他错误
      console.error('错误信息:', error.message)
    }
    
    return Promise.reject(error)
  }
)

// API方法
export const yeepayAPI = {
  // 搜索埋点数据
  searchBuryPointData: (params = {}) => {
    const currentConfig = store.state.apiConfig
    const requestData = {
      projectId: currentConfig.projectId || API_CONFIG.environments.development.projectId,
      selectedPointId: params.selectedPointId || currentConfig.selectedPointId || API_CONFIG.environments.development.selectedPointId,
      calcInfo: {},
      dataType: "list",
      filterList: [],
      page: 1,
      pageSize: params.pageSize || currentConfig.pageSize || API_CONFIG.environments.development.pageSize,
      order: "descend",
      date: params.date || new Date().toISOString().split('T')[0]
    }
    
    console.log('发送请求数据:', requestData)
    
    return api.post('/tracker/buryPointTest/search', requestData)
  },
  
  // 批量搜索埋点数据
  searchBuryPointDataBatch: (params = {}) => {
    const currentConfig = store.state.apiConfig
    const requestData = {
      projectId: currentConfig.projectId || API_CONFIG.environments.development.projectId,
      selectedPointId: params.selectedPointId || currentConfig.selectedPointId || API_CONFIG.environments.development.selectedPointId,
      calcInfo: {},
      dataType: "list",
      filterList: [],
      page: 1,
      pageSize: params.pageSize || 1000,
      order: "descend",
      date: params.date || new Date().toISOString().split('T')[0]
    }
    
    return api.post('/tracker/buryPointTest/search', requestData)
  },
  
  // 验证令牌 - 使用POST方法
  validateToken: () => {
    const currentConfig = store.state.apiConfig
    const requestData = {
      projectId: currentConfig.projectId || API_CONFIG.environments.development.projectId,
      selectedPointId: currentConfig.selectedPointId || API_CONFIG.environments.development.selectedPointId,
      calcInfo: {},
      dataType: "list",
      filterList: [],
      page: 1,
      pageSize: 1,
      order: "descend",
      date: new Date().toISOString().split('T')[0] // 使用当天日期验证
    }
    
    return api.post('/tracker/buryPointTest/search', requestData)
  }
}

export default api
