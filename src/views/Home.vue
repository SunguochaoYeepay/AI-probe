<template>
  <div class="home-container">
    <!-- 系统状态栏 -->
    <StatusBar
      :analysis-mode="analysisMode"
      v-model:date-range="dateRange"
      @date-range-change="onDateRangeChange"
      @refresh-data="refreshData"
      @show-config-modal="showConfigModal"
    />


    <!-- 需求描述区域 -->
    <RequirementSection
      v-model:current-requirement="currentRequirement"
      :analyzing="analyzing"
      :analysis-result="analysisResult"
      :quick-prompts="quickPrompts"
      @analyze-requirement="analyzeRequirement"
      @clear-requirement="clearRequirement"
      @fill-prompt="fillPrompt"
    />

    <!-- 图表展示区域 -->
    <ChartSection
      :has-chart="hasChart"
      @regenerate-chart="regenerateChart"
      @export-chart="exportChart"
      @save-config="saveConfig"
    />

    <!-- 配置管理模态框 -->
    <ConfigModal
      v-model:visible="configModalVisible"
      :api-config-form="apiConfigForm"
      :ollama-config-form="ollamaConfigForm"
      @save-config="saveConfig"
    />

    <!-- 页面选择弹窗 -->
    <PageSelectionModal
      v-model:visible="pageSelectionModalVisible"
      :available-pages="availablePages"
      @select-page="selectPageForAnalysis"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { RequirementParser } from '@/utils/requirementParser'
import { useDataFetch } from '@/composables/useDataFetch'
import { useChart } from '@/composables/useChart'
import StatusBar from '@/components/StatusBar.vue'
import RequirementSection from '@/components/RequirementSection.vue'
import ChartSection from '@/components/ChartSection.vue'
import ConfigModal from '@/components/ConfigModal.vue'
import PageSelectionModal from '@/components/PageSelectionModal.vue'

const store = useStore()

// 使用 composables
const { availablePages, fetchMultiDayData, loadAvailablePages, validateConnection } = useDataFetch()
const { chartGenerator, initChartGenerator, generateChart, regenerateChart, exportChart, extractPageNames } = useChart()

// 响应式数据
const currentRequirement = ref('')
const analyzing = ref(false)
const configModalVisible = ref(false)
const analysisMode = ref('single') // 'single' 或 'dual'
const dateRange = ref([dayjs().subtract(6, 'day'), dayjs()]) // 默认最近7天
const pageSelectionModalVisible = ref(false) // 页面选择弹窗
const currentAnalysisType = ref('') // 当前分析类型

// 常用提示词
const quickPrompts = ref([
  // 基础分析
  { text: '页面访问量', color: 'blue' },
  { text: '显示访问趋势', color: 'green' },
  { text: '页面类型分布', color: 'orange' },
  
  // 按钮分析
  { text: '按钮点击UV/PV对比', color: 'magenta' },
  
  // 转化分析
  { text: '用户转化流程', color: 'purple' },
  { text: '访问到点击转化率', color: 'volcano' },
  { text: '用户操作行为路径', color: 'geekblue' },
  
  // 行为分析
  { text: '按钮点击热度分析', color: 'red' },
  { text: '分析打开关闭比例', color: 'cyan' },
  { text: '页面停留时长统计', color: 'magenta' },
  
  // 设备分析
  { text: '设备类型分布', color: 'gold' },
  { text: '浏览器使用情况', color: 'lime' }
])

// 计算属性
const systemStatus = computed(() => store.state.systemStatus)
const analysisResult = computed(() => store.state.analysisResult)
const apiConfig = computed(() => store.state.apiConfig)
const currentDate = computed(() => new Date().toLocaleDateString())
const hasChart = computed(() => store.state.chartConfig !== null)

// API 配置表单（移除了 defaultDate，日期在主界面上选择）
const apiConfigForm = computed({
  get: () => ({
    ...store.state.apiConfig
  }),
  set: (value) => {
    store.dispatch('updateApiConfig', value)
  }
})

// Ollama 配置表单
const ollamaConfigForm = computed({
  get: () => ({
    ...store.state.ollamaConfig
  }),
  set: (value) => {
    store.dispatch('updateOllamaConfig', value)
  }
})

// 需求解析器（会根据配置动态初始化）
let requirementParser = null

// 生命周期
onMounted(() => {
  initializeSystem()
})

// 方法
const initializeSystem = async () => {
  try {
    // 初始化系统状态
    store.dispatch('updateSystemStatus', {
      configLoaded: true,
      dataConnected: false
    })
    
    // 初始化需求解析器（使用 Ollama AI）
    const ollamaConfig = store.state.ollamaConfig
    requirementParser = new RequirementParser({
      useAI: ollamaConfig.enabled,
      ollama: {
        baseURL: ollamaConfig.baseURL,
        model: ollamaConfig.model,
        timeout: ollamaConfig.timeout
      }
    })
    console.log('需求解析器初始化完成，AI 模式:', ollamaConfig.enabled ? '启用' : '禁用')
    
    // 验证API连接（不阻塞系统启动）
    const isConnected = await validateConnection()
    
    // 初始化图表生成器
    initChartGenerator()
    
    // 获取可用的页面列表（用于自动补全）
    await loadAvailablePages()
    
    if (isConnected) {
      message.success('系统初始化完成，已连接到数据源')
    } else {
      message.warning('系统初始化完成，将使用模拟数据进行演示')
    }
  } catch (error) {
    console.error('系统初始化失败:', error)
    message.error('系统初始化失败')
  }
}


const analyzeRequirement = async () => {
  if (!currentRequirement.value.trim()) {
    message.warning('请输入分析需求')
    return
  }
  
  if (!requirementParser) {
    message.error('需求解析器未初始化，请刷新页面')
    return
  }
  
  analyzing.value = true
  
  try {
    // 解析需求（现在是异步的，支持 AI 理解）
    let analysis = await requirementParser.parse(currentRequirement.value)
    
    // 检测单页面查询并强制转换为UV/PV组合图
    const specifiedPages = extractPageNames(currentRequirement.value)
    if (specifiedPages.length > 0 && analysis.chartType === 'uv_pv_chart') {
      console.log('检测到单页面查询，强制转换为UV/PV时间组合图')
      analysis = {
        ...analysis,
        intent: 'single_page_uv_pv_analysis',
        chartType: 'single_page_uv_pv_chart',
        description: `${specifiedPages[0]}页面UV/PV时间趋势分析`
      }
    }
    
    console.log('需求分析结果:', analysis)
    
    // 根据分析结果自动设置埋点类型
    if (analysis.buryPointType) {
      analysisMode.value = analysis.buryPointType
      console.log(`自动设置埋点类型: ${analysis.buryPointType}`)
    }
    
    // 更新状态
    store.dispatch('updateRequirement', currentRequirement.value)
    store.dispatch('updateAnalysisResult', {
      ...analysis,
      summary: requirementParser.generateSummary(analysis)
    })
    
    // 获取数据并生成图表
    const result = await fetchMultiDayData(analysisMode.value, dateRange.value)
    await generateChart(analysis, result.data, dateRange.value)
  } catch (error) {
    console.error('分析失败:', error)
    message.error('分析失败，请重试')
  } finally {
    analyzing.value = false
  }
}



// 事件处理方法
const onDateRangeChange = async (dates, dateStrings) => {
  if (!dates || dates.length !== 2) {
    return
  }
  
  const [start, end] = dateStrings
  console.log('范围模式 - 日期范围:', start, '至', end)
  
  // 如果有当前的分析结果，重新生成图表
  if (analysisResult.value) {
    analyzing.value = true
    try {
      const result = await fetchMultiDayData(analysisMode.value, dateRange.value)
      await generateChart(analysisResult.value, result.data, dateRange.value)
      message.success(`数据已更新为 ${start} 至 ${end}`)
    } catch (error) {
      console.error('切换日期范围后图表生成失败:', error)
      message.error('图表更新失败')
    } finally {
      analyzing.value = false
    }
  } else {
    message.info('请先进行需求分析，再切换日期范围查看数据')
  }
}

const refreshData = async () => {
  try {
    await validateConnection()
    message.success('数据刷新成功')
  } catch (error) {
    message.error('数据刷新失败')
  }
}

const showConfigModal = () => {
  configModalVisible.value = true
}

const saveConfig = async () => {
  try {
    // 配置已通过 v-model 自动同步到 store
    configModalVisible.value = false
    message.success('配置保存成功')
    
    // 重新初始化需求解析器（应用新的 Ollama 配置）
    const ollamaConfig = store.state.ollamaConfig
    requirementParser = new RequirementParser({
      useAI: ollamaConfig.enabled,
      ollama: {
        baseURL: ollamaConfig.baseURL,
        model: ollamaConfig.model,
        timeout: ollamaConfig.timeout
      }
    })
    console.log('需求解析器已重新初始化，AI 模式:', ollamaConfig.enabled ? '启用' : '禁用')
    
    // 重新验证连接
    await validateConnection()
  } catch (error) {
    console.error('保存配置后验证连接失败:', error)
  }
}

const fillPrompt = async (text) => {
  if (text === '页面访问量') {
    // 页面访问量需要选择具体页面
    currentAnalysisType.value = text
    await loadAvailablePages()
    if (availablePages.value.length > 0) {
      pageSelectionModalVisible.value = true
    } else {
      message.warning('暂无可用页面数据，请先获取数据')
    }
  } else {
    // 其他提示词直接填充
    currentRequirement.value = text
    message.info(`已填充：${text}`)
  }
}

const selectPageForAnalysis = async (pageName) => {
  // 关闭弹窗
  pageSelectionModalVisible.value = false
  
  // 设置需求文本 - 页面访问量（UV/PV）
  currentRequirement.value = `#${pageName} 页面访问量`
  
  // 自动开始分析
  try {
    await analyzeRequirement()
    message.success(`开始分析页面：${pageName}`)
  } catch (error) {
    console.error('自动分析失败:', error)
    message.error('分析失败，请手动点击智能分析按钮')
  }
}

const clearRequirement = () => {
  currentRequirement.value = ''
  store.dispatch('updateRequirement', '')
  store.dispatch('updateAnalysisResult', null)
  store.dispatch('updateChartConfig', null)
}
</script>

<style scoped>
.home-container {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.status-card {
  margin-bottom: 24px;
}

.progress-card {
  margin-bottom: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.progress-card :deep(.ant-card-body) {
  padding: 20px;
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
}

.date-picker-item {
  flex-wrap: nowrap;
  white-space: nowrap;
}

.status-actions {
  display: flex;
  gap: 8px;
}

.requirement-card {
  margin-bottom: 24px;
}

.requirement-section {
  margin-bottom: 16px;
}

.quick-prompts {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.prompt-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
  margin-right: 4px;
}

.prompt-tag {
  cursor: pointer;
  transition: all 0.3s;
  user-select: none;
}

.prompt-tag:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}


/* 页面选择弹窗样式 */
.page-selection-content {
  max-height: 500px;
}

.page-list-modal {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}

.page-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: all 0.2s;
}

.page-item:last-child {
  border-bottom: none;
}

.page-item:hover {
  background-color: #f5f5f5;
}

.page-name {
  flex: 1;
  font-size: 14px;
  color: #333;
  word-break: break-all;
}

.page-action {
  margin-left: 12px;
}

.no-pages {
  text-align: center;
  padding: 40px 0;
}

.requirement-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}

.analysis-result {
  margin-top: 16px;
}

.chart-card {
  margin-bottom: 24px;
}

.chart-container {
  min-height: 400px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fff;
}

.empty-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
}

.chart-content {
  width: 100%;
  height: 400px;
}

.chart-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}

@media (max-width: 768px) {
  .home-container {
    padding: 16px;
  }
  
  .status-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .status-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .quick-prompts {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .prompt-tag {
    font-size: 12px;
  }
}
</style>
