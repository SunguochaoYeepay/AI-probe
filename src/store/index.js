import { createStore } from 'vuex'

export default createStore({
  state: {
    // API配置
    apiConfig: {
      projectId: 'event1021',
      selectedPointId: 110,
      baseUrl: 'https://probe.yeepay.com',
      accessToken: '',
      pageSize: 1000
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
    }
  },
  
  mutations: {
    SET_API_CONFIG(state, config) {
      state.apiConfig = { ...state.apiConfig, ...config }
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
    }
  },
  
  actions: {
    updateApiConfig({ commit }, config) {
      commit('SET_API_CONFIG', config)
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
