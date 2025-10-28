import { createStore } from 'vuex'
import { API_CONFIG } from '@/config/api'

// 从localStorage加载配置的辅助函数（仅作为备用，数据库配置优先）
const loadConfigFromStorage = () => {
  // 只在开发模式下从localStorage加载，生产环境完全依赖数据库
  if (process.env.NODE_ENV !== 'development') {
    return {
      visitBuryPointId: null,
      clickBuryPointId: null,
      behaviorBuryPointIds: [],
      pageMenuData: null
    }
  }
  
  const visitBuryPointId = localStorage.getItem('visitBuryPointId')
  const clickBuryPointId = localStorage.getItem('clickBuryPointId')
  const behaviorBuryPointIds = localStorage.getItem('behaviorBuryPointIds')
  const pageMenuData = localStorage.getItem('pageMenuData')
  
  return {
    visitBuryPointId: visitBuryPointId ? JSON.parse(visitBuryPointId) : null,
    clickBuryPointId: clickBuryPointId ? JSON.parse(clickBuryPointId) : null,
    behaviorBuryPointIds: behaviorBuryPointIds ? JSON.parse(behaviorBuryPointIds) : [],
    pageMenuData: pageMenuData ? JSON.parse(pageMenuData) : null
  }
}

export default createStore({
  state: {
    // API配置
    apiConfig: {
      ...API_CONFIG.environments.development,
      selectedPointId: null, // 初始化为null，等待项目配置加载
      defaults: API_CONFIG.defaults
    },
    
    // 动态项目配置
    projectConfig: {
      currentProject: null,
      buryPoints: [],
      visitPoint: null,
      clickPoint: null,
      hasVisitPoint: false,
      hasClickPoint: false,
      supportDualBuryPoint: false,
      // 注意：已移除selectedBuryPointIds字段，使用新的分离配置格式
      ...loadConfigFromStorage() // 从localStorage加载配置
    },
    
    // Ollama AI 配置
    ollamaConfig: {
      enabled: true,
      baseURL: 'http://localhost:11434',
      model: 'qwen:latest',
      timeout: 30000
    },
    
    // 当前分析需求
    currentRequirement: '',
    
    // 分析结果
    analysisResult: null,
    
    // 图表配置
    chartConfig: null,
    
    // 系统状态
    systemStatus: {
      dataConnected: false,
      configLoaded: false,
      lastUpdate: null
    },
    
    // 图表生成状态
    chartGeneration: {
      isGenerating: false,
      currentStep: '',
      progress: 0
    },
    
    // 按钮分析参数
    buttonAnalysisParams: {
      pageName: null,
      buttonName: null,
      buttonData: null
    },
    
    // 查询条件分析参数
    queryConditionAnalysisParams: {
      pageName: null,
      queryCondition: null,
      queryData: null
    },
    
    // 漏斗配置抽屉可见性
    funnelConfigDrawerVisible: false
  },
  
  mutations: {
    SET_API_CONFIG(state, config) {
      state.apiConfig = { ...state.apiConfig, ...config }
    },
    
    SET_PROJECT_CONFIG(state, config) {
      state.projectConfig = { ...state.projectConfig, ...config }
      // 注意：已移除selectedBuryPointIds的持久化逻辑，使用新的分离配置格式
      // 持久化访问埋点到localStorage
      if (config.visitBuryPointId !== undefined) {
        localStorage.setItem('visitBuryPointId', JSON.stringify(config.visitBuryPointId))
      }
      // 持久化点击埋点到localStorage
      if (config.clickBuryPointId !== undefined) {
        localStorage.setItem('clickBuryPointId', JSON.stringify(config.clickBuryPointId))
      }
      // 持久化行为分析埋点到localStorage
      if (config.behaviorBuryPointIds !== undefined) {
        localStorage.setItem('behaviorBuryPointIds', JSON.stringify(config.behaviorBuryPointIds))
      }
      // 持久化页面菜单数据到localStorage
      if (config.pageMenuData !== undefined) {
        if (config.pageMenuData === null) {
          localStorage.removeItem('pageMenuData')
        } else {
          localStorage.setItem('pageMenuData', JSON.stringify(config.pageMenuData))
        }
      }
    },
    
    SET_OLLAMA_CONFIG(state, config) {
      state.ollamaConfig = { ...state.ollamaConfig, ...config }
    },
    
    SET_CURRENT_REQUIREMENT(state, requirement) {
      state.currentRequirement = requirement
    },
    
    SET_ANALYSIS_RESULT(state, result) {
      state.analysisResult = result
    },
    
    SET_CHART_CONFIG(state, config) {
      state.chartConfig = config
    },
    
    SET_SYSTEM_STATUS(state, status) {
      state.systemStatus = { ...state.systemStatus, ...status }
    },
    
    SET_CHART_GENERATION_STATUS(state, status) {
      state.chartGeneration = { ...state.chartGeneration, ...status }
    },
    
    SET_BUTTON_ANALYSIS_PARAMS(state, params) {
      state.buttonAnalysisParams = { ...state.buttonAnalysisParams, ...params }
    },
    
    SET_QUERY_CONDITION_ANALYSIS_PARAMS(state, params) {
      state.queryConditionAnalysisParams = { ...state.queryConditionAnalysisParams, ...params }
    },
    
    SET_FUNNEL_CONFIG_DRAWER_VISIBLE(state, visible) {
      state.funnelConfigDrawerVisible = visible
    }
  },
  
  actions: {
    updateApiConfig({ commit }, config) {
      commit('SET_API_CONFIG', config)
    },
    
    updateProjectConfig({ commit }, config) {
      commit('SET_PROJECT_CONFIG', config)
    },
    
    updateOllamaConfig({ commit }, config) {
      commit('SET_OLLAMA_CONFIG', config)
    },
    
    updateRequirement({ commit }, requirement) {
      commit('SET_CURRENT_REQUIREMENT', requirement)
    },
    
    updateAnalysisResult({ commit }, result) {
      commit('SET_ANALYSIS_RESULT', result)
    },
    
    updateChartConfig({ commit }, config) {
      commit('SET_CHART_CONFIG', config)
    },
    
    updateSystemStatus({ commit }, status) {
      commit('SET_SYSTEM_STATUS', status)
    },
    
    updateChartGenerationStatus({ commit }, status) {
      commit('SET_CHART_GENERATION_STATUS', status)
    },
    
    updateButtonAnalysisParams({ commit }, params) {
      commit('SET_BUTTON_ANALYSIS_PARAMS', params)
    },
    
    updateQueryConditionAnalysisParams({ commit }, params) {
      commit('SET_QUERY_CONDITION_ANALYSIS_PARAMS', params)
    }
  },
  
  getters: {
    isSystemReady: state => {
      return state.systemStatus.dataConnected && state.systemStatus.configLoaded
    },
    
    hasAnalysisResult: state => {
      return state.analysisResult !== null
    }
  }
})
