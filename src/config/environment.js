/**
 * 环境配置管理
 * 统一管理所有硬编码的地址和配置
 */

// 获取环境变量
const getEnvVar = (key, defaultValue) => {
  // 优先使用 window.ENV（运行时配置）
  if (typeof window !== 'undefined' && window.ENV) {
    return window.ENV[key] || defaultValue
  }
  
  // 在浏览器环境中，Vite 会将 VITE_ 开头的环境变量注入到 import.meta.env
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[`VITE_${key}`] || defaultValue
  }
  
  // 在 Node.js 环境中使用 process.env
  if (typeof process !== 'undefined' && process.env) {
    return process.env[`VITE_${key}`] || defaultValue
  }
  
  return defaultValue
}

// 后端服务配置
export const BACKEND_CONFIG = {
  // 开发环境
  development: {
    baseUrl: getEnvVar('BACKEND_URL', 'http://localhost:3004'),
    healthEndpoint: '/api/health',
    configEndpoint: '/api/config',
    statsEndpoint: '/api/stats'
  },
  // 生产环境
  production: {
    baseUrl: getEnvVar('BACKEND_URL', 'http://localhost:3004'),
    healthEndpoint: '/api/health',
    configEndpoint: '/api/config',
    statsEndpoint: '/api/stats'
  }
}

// Ollama AI 配置
export const OLLAMA_CONFIG = {
  development: {
    baseUrl: getEnvVar('OLLAMA_URL', 'http://localhost:11434'),
    timeout: 30000
  },
  production: {
    baseUrl: getEnvVar('OLLAMA_URL', 'http://localhost:11434'),
    timeout: 30000
  }
}

// Probe API 配置
export const PROBE_CONFIG = {
  development: {
    baseUrl: getEnvVar('PROBE_URL', 'https://probe.yeepay.com'),
    timeout: 10000
  },
  production: {
    baseUrl: getEnvVar('PROBE_URL', 'https://probe.yeepay.com'),
    timeout: 10000
  }
}

// 获取当前环境
const getCurrentEnvironment = () => {
  // 在浏览器环境中，Vite 会将 NODE_ENV 注入到 import.meta.env
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.MODE || import.meta.env.NODE_ENV || 'development'
  }
  
  // 在 Node.js 环境中使用 process.env
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV || 'development'
  }
  
  return 'development'
}

// 获取当前配置
export const getBackendConfig = () => {
  const env = getCurrentEnvironment()
  return BACKEND_CONFIG[env]
}

export const getOllamaConfig = () => {
  const env = getCurrentEnvironment()
  return OLLAMA_CONFIG[env]
}

export const getProbeConfig = () => {
  const env = getCurrentEnvironment()
  return PROBE_CONFIG[env]
}

// 构建完整的API URL
export const buildApiUrl = (endpoint) => {
  const config = getBackendConfig()
  return `${config.baseUrl}${endpoint}`
}

// 构建Ollama URL
export const buildOllamaUrl = (endpoint = '') => {
  const config = getOllamaConfig()
  return `${config.baseUrl}${endpoint}`
}

// 构建Probe URL
export const buildProbeUrl = (endpoint = '') => {
  const config = getProbeConfig()
  return `${config.baseUrl}${endpoint}`
}

// 导出所有配置
export const ENV_CONFIG = {
  backend: getBackendConfig(),
  ollama: getOllamaConfig(),
  probe: getProbeConfig(),
  environment: getCurrentEnvironment()
}

// 调试信息
console.log('🔧 环境配置已加载:', {
  environment: ENV_CONFIG.environment,
  backend: ENV_CONFIG.backend.baseUrl,
  ollama: ENV_CONFIG.ollama.baseUrl,
  probe: ENV_CONFIG.probe.baseUrl
})
