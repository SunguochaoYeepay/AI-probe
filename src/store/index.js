import { createStore } from 'vuex'
import { API_CONFIG } from '@/config/api'

export default createStore({
  state: {
    // API配置
    apiConfig: {
      ...API_CONFIG.environments.development,
      selectedPointId: JSON.parse(localStorage.getItem('selectedBuryPointIds') || '[]')[0] || null, // 从localStorage读取第一个选中的埋点ID
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
      selectedBuryPointIds: JSON.parse(localStorage.getItem('selectedBuryPointIds') || '[]'), // 用户选中的埋点ID列表，从localStorage加载
      visitBuryPointId: JSON.parse(localStorage.getItem('visitBuryPointId') || 'null'), // 访问埋点ID
      clickBuryPointId: JSON.parse(localStorage.getItem('clickBuryPointId') || 'null'), // 点击埋点ID
      behaviorBuryPointIds: JSON.parse(localStorage.getItem('behaviorBuryPointIds') || '[]') // 行为分析埋点ID列表
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
    }
  },
  
  mutations: {
    SET_API_CONFIG(state, config) {
      state.apiConfig = { ...state.apiConfig, ...config }
    },
    
    SET_PROJECT_CONFIG(state, config) {
      state.projectConfig = { ...state.projectConfig, ...config }
      // 持久化埋点选择到localStorage
      if (config.selectedBuryPointIds !== undefined) {
        localStorage.setItem('selectedBuryPointIds', JSON.stringify(config.selectedBuryPointIds))
      }
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
