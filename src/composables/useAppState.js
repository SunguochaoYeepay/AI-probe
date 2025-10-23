import { ref, computed } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { RequirementParser } from '@/utils/requirementParser'

/**
 * 应用状态管理相关的逻辑
 */
export function useAppState() {
  const store = useStore()
  const router = useRouter()

  // 响应式状态
  const isGenerating = ref(false)
  const isAnalyzing = ref(false)
  const isSaving = ref(false)

  // 计算属性
  const hasChart = computed(() => !!store.state.chartConfig)
  const hasData = computed(() => {
    const chartData = store.state.chartConfig?.data
    return chartData && (
      (Array.isArray(chartData) && chartData.length > 0) ||
      (typeof chartData === 'object' && chartData.categories && chartData.categories.length > 0)
    )
  })

  const currentRequirement = computed(() => store.state.currentRequirement)
  const analysisResult = computed(() => store.state.analysisResult)
  const chartConfig = computed(() => store.state.chartConfig)

  // 状态更新方法
  const setGenerating = (value) => {
    isGenerating.value = value
  }

  const setAnalyzing = (value) => {
    isAnalyzing.value = value
  }

  const setSaving = (value) => {
    isSaving.value = value
  }

  const setCurrentRequirement = (requirement) => {
    store.commit('SET_CURRENT_REQUIREMENT', requirement)
  }

  const setAnalysisResult = (result) => {
    store.commit('SET_ANALYSIS_RESULT', result)
  }

  const setChartConfig = (config) => {
    store.commit('SET_CHART_CONFIG', config)
  }

  const clearChart = () => {
    store.commit('SET_CHART_CONFIG', null)
    store.commit('SET_ANALYSIS_RESULT', null)
  }

  /**
   * 清空需求
   */
  const clearRequirement = () => {
    store.commit('SET_CURRENT_REQUIREMENT', '')
    store.commit('SET_ANALYSIS_RESULT', null)
    store.commit('SET_CHART_CONFIG', null)
  }

  /**
   * 处理菜单点击
   */
  const handleMenuClick = (menuKey) => {
    console.log('菜单点击处理:', menuKey)
    // 可以在这里添加自定义逻辑
  }

  /**
   * 显示配置模态框
   */
  const showConfigModal = () => {
    router.push('/settings')
  }

  /**
   * 初始化系统
   */
  const initializeSystem = async () => {
    try {
      // 初始化系统状态
      store.dispatch('updateSystemStatus', {
        configLoaded: true,
        dataConnected: false
      })
      
      // 初始化需求解析器（使用 Ollama AI）
      const ollamaConfig = store.state.ollamaConfig
      const requirementParser = new RequirementParser({
        useAI: ollamaConfig.enabled,
        ollama: {
          baseURL: ollamaConfig.baseURL,
          model: ollamaConfig.model,
          timeout: ollamaConfig.timeout
        }
      })
      console.log('需求解析器初始化完成，AI 模式:', ollamaConfig.enabled ? '启用' : '禁用')
      
      // 注释掉自动加载页面列表，避免启动时调用API
      // 用户需要数据时再手动触发
      console.log('⏸️ 跳过自动加载页面列表，等待用户主动操作')
      
      message.success('系统初始化完成')
    } catch (error) {
      console.error('系统初始化失败:', error)
      message.error('系统初始化失败')
    }
  }

  return {
    // 状态
    isGenerating,
    isAnalyzing,
    isSaving,
    
    // 计算属性
    hasChart,
    hasData,
    currentRequirement,
    analysisResult,
    chartConfig,
    
    // 方法
    setGenerating,
    setAnalyzing,
    setSaving,
    setCurrentRequirement,
    setAnalysisResult,
    setChartConfig,
    clearChart,
    clearRequirement,
    handleMenuClick,
    showConfigModal,
    initializeSystem
  }
}
