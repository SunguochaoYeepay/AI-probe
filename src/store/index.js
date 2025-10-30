import { createStore } from 'vuex'
import { API_CONFIG } from '@/config/api'
import { getOllamaConfig } from '@/config/environment'

// 从localStorage加载配置的辅助函数（仅作为备用，数据库配置优先）
const loadConfigFromStorage = () => {
  // 只在开发模式下从localStorage加载，生产环境完全依赖数据库
  if (import.meta.env?.MODE !== 'development') {
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
    // API配置 - 纯缓存模式，不持久化
    apiConfig: {
      ...API_CONFIG.environments.development,
      selectedPointId: null, // 初始化为null，等待项目配置加载
      defaults: API_CONFIG.defaults
    },
    
    // 动态项目配置 - 纯缓存模式，不持久化
    projectConfig: {
      currentProject: null,
      buryPoints: [],
      visitPoint: null,
      clickPoint: null,
      hasVisitPoint: false,
      hasClickPoint: false,
      supportDualBuryPoint: false,
      // 🚀 配置统一化：完全依赖SQLite数据库，不使用localStorage
      visitBuryPointId: null,
      clickBuryPointId: null,
      behaviorBuryPointIds: [],
      pageMenuData: null
    },
    
    // Ollama AI 配置 - 纯缓存模式，不持久化
    ollamaConfig: {
      enabled: true,
      ...getOllamaConfig(),
      model: 'qwen:latest'
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
    // 更新API配置 - 纯缓存更新
    SET_API_CONFIG(state, config) {
      state.apiConfig = { ...state.apiConfig, ...config }
    },
    
    // 更新项目配置 - 纯缓存更新
    SET_PROJECT_CONFIG(state, config) {
      state.projectConfig = { ...state.projectConfig, ...config }
      // 🚀 配置统一化：不再使用localStorage，完全依赖SQLite数据库
    },
    
    // 🚀 新增：完全替换项目配置（用于数据库配置同步）
    REPLACE_PROJECT_CONFIG(state, config) {
      // 完全替换项目配置，不保留任何旧配置
      state.projectConfig = {
        currentProject: state.projectConfig.currentProject, // 保留当前项目信息
        buryPoints: state.projectConfig.buryPoints, // 保留埋点列表信息
        visitPoint: state.projectConfig.visitPoint, // 保留埋点对象信息
        clickPoint: state.projectConfig.clickPoint, // 保留埋点对象信息
        hasVisitPoint: state.projectConfig.hasVisitPoint, // 保留功能标志
        hasClickPoint: state.projectConfig.hasClickPoint, // 保留功能标志
        supportDualBuryPoint: state.projectConfig.supportDualBuryPoint, // 保留功能标志
        ...config // 完全使用新配置覆盖
      }
      
      // 🚀 配置统一化：不再使用localStorage，完全依赖SQLite数据库
    },
    
    // 更新AI配置 - 纯缓存更新
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
    
    // 🚀 新增：完全替换项目配置（用于数据库配置同步）
    replaceProjectConfig({ commit }, config) {
      commit('REPLACE_PROJECT_CONFIG', config)
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
