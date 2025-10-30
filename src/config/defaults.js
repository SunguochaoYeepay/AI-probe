/**
 * 默认配置常量
 * 集中管理所有硬编码的默认值
 */

// 默认端口配置
export const DEFAULT_PORTS = {
  BACKEND: 3004,
  VITE: 3000,
  OLLAMA: 11434
}

// 默认URL配置
export const DEFAULT_URLS = {
  BACKEND: 'http://localhost:3004',
  OLLAMA: 'http://localhost:11434',
  PROBE: 'https://probe.yeepay.com'
}

// 默认超时配置
export const DEFAULT_TIMEOUTS = {
  OLLAMA: 30000,
  BACKEND: 10000,
  PROBE: 10000,
  REQUEST: 30000
}

// 默认项目配置
export const DEFAULT_PROJECT = {
  ID: 'event1021',
  VISIT_BURY_POINT_ID: 110,
  CLICK_BURY_POINT_ID: 109
}

// 默认API请求配置
export const DEFAULT_API_CONFIG = {
  ORIGIN: 'https://probe.yeepay.com',
  REFERER: 'https://probe.yeepay.com/webfunny_event/eventSearch.html',
  WF_T: '78d60508-8149-4109-94b0-d80c412647e1'
}

// 默认页面大小配置
export const DEFAULT_PAGE_SIZES = {
  API_SEARCH: 30,
  API_BATCH: 10000
}

// 默认主题配置
export const DEFAULT_THEME_CONFIG = {
  DEFAULT_THEME: 'light',
  STORAGE_KEY: 'app-theme',
  THEMES: {
    light: {
      name: '亮色主题',
      value: 'light',
      class: 'light-theme'
    },
    dark: {
      name: '暗黑主题',
      value: 'dark', 
      class: 'dark-theme'
    }
  }
}
