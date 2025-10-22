<template>
  <AppLayout 
    page-title="智能图表生成系统"
    current-page="create"
    @menu-click="handleMenuClick"
  >
    <template #header-actions>
      <a-button @click="triggerManualPreload" :loading="isPreloading">
        <DownloadOutlined />
        数据预加载
      </a-button>
      <a-button @click="showConfigModal">
        <SettingOutlined />
        配置管理
      </a-button>
    </template>
    
    <div class="home-container">
      <a-row :gutter="24">
        <!-- 左侧：AI聊天界面 -->
        <a-col :span="8">
          <div class="left-panel">
            <AIChatInterface
              v-model:date-range="dateRange"
              @date-range-change="onDateRangeChange"
              @analyze-requirement="handleChatAnalysis"
              @clear-requirement="clearRequirement"
              @show-config-modal="showConfigModal"
              @save-chart="() => { console.log('🟦 [Home] 收到子组件保存事件'); saveChartToLibrary(); }"
            />
          </div>
        </a-col>

        <!-- 右侧：分析结果 -->
        <a-col :span="16">
          <div class="right-panel">
            <ChartSection
              :has-chart="hasChart"
              :show-time-range-selector="false"
              @save-chart="saveChartToLibrary"
              @time-range-change="handleTimeRangeChange"
            />
          </div>
        </a-col>
      </a-row>


    <!-- 页面选择弹窗 -->
    <PageSelectionModal
      v-model:open="pageSelectionModalVisible"
      :available-pages="availablePages"
      @select-page="selectPageForAnalysis"
    />
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { 
  SettingOutlined, 
  DownloadOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { RequirementParser } from '@/utils/requirementParser'
import { useDataFetch } from '@/composables/useDataFetch'
import { useChart } from '@/composables/useChart'
import { useChartManager } from '@/composables/useChartManager'
import { useDataConsistency } from '@/composables/useDataConsistency'
import { aggregationService } from '@/utils/aggregationService'
import { dataPreloadService } from '@/services/dataPreloadService'
import AIChatInterface from '@/components/AIChatInterface.vue'
import ChartSection from '@/components/ChartSection.vue'
import PageSelectionModal from '@/components/PageSelectionModal.vue'
import AppLayout from '@/components/AppLayout.vue'

const store = useStore()
const router = useRouter()

// 使用 composables
const { availablePages, fetchMultiDayData, loadAvailablePages, validateConnection, clearCache } = useDataFetch()
const { chartGenerator, initChartGenerator, generateChart, extractPageNames } = useChart()
const { saveChart: saveChartToManager } = useChartManager()
const { 
  healthStatus, 
  healthStatusColor, 
  quickHealthCheck, 
  forceRefreshData, 
  startAutoCheck 
} = useDataConsistency()

// 响应式数据
const currentRequirement = ref('')
const analyzing = ref(false)
const analysisMode = ref('single') // 'single' 或 'dual'
const dateRange = ref([dayjs().subtract(6, 'day'), dayjs()]) // 默认最近7天
const pageSelectionModalVisible = ref(false) // 页面选择弹窗
const currentAnalysisType = ref('') // 当前分析类型
const isPreloading = ref(false) // 预加载状态

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



// 需求解析器（会根据配置动态初始化）
let requirementParser = null

// 生命周期
onMounted(() => {
  initializeSystem()
  // 启动自动缓存健康检查
  setTimeout(() => {
    startAutoCheck()
  }, 2000)
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
    
    // 注释掉自动加载页面列表，避免启动时调用API
    // 用户需要数据时再手动触发
    // await loadAvailablePages(dateRange.value)
    console.log('⏸️ 跳过自动加载页面列表，等待用户主动操作')
    
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


const handleChatAnalysis = async (params) => {
  // 处理来自聊天界面的分析请求
  console.log('聊天分析请求:', params)
  
  // 处理按钮点击分析的特殊情况
  if (params.type === 'button_click_analysis' || params.type === 'button_click_daily') {
    // 直接设置需求文本，包含页面和按钮信息
    currentRequirement.value = params.requirement
    // 保存按钮分析的特殊参数到全局状态，供后续使用
    if (params.pageName) {
      store.dispatch('updateButtonAnalysisParams', {
        pageName: params.pageName,
        buttonName: params.buttonName,
        buttonData: params.buttonData,
        type: params.type // 保存原始类型
      })
    }
    // 直接调用分析，跳过常规的需求解析流程
    await analyzeButtonClickRequirement()
    return
  }
  
  if (params.type && (params.scope === 'specific' || params.scope === 'all')) {
    // 如果传递了分析类型参数，构建对应的需求并分析
    let requirementText = ''
    
    switch (params.type) {
      case 'page_visits':
        if (params.scope === 'all') {
          requirementText = '页面访问量'
        } else if (params.scope === 'specific' && params.pageName) {
          if (params.pageName === '__ALL__') {
            requirementText = '页面访问量'
          } else {
            // 构建更清晰的需求描述，明确指定页面分析
            requirementText = `分析页面"${params.pageName}"的访问量数据`
          }
        } else if (params.scope === 'specific') {
          // 如果没有指定具体页面，应该触发页面选择流程
          requirementText = '页面访问量'
        } else if (params.scope === 'by_type') {
          requirementText = '按页面类型分析访问量'
        }
        break
      case 'user_click':
        if (params.scope === 'all') {
          requirementText = '用户点击行为分析'
        } else if (params.scope === 'specific' && params.pageName) {
          if (params.pageName === '__ALL__') {
            requirementText = '用户点击行为分析'
          } else {
            requirementText = `分析页面"${params.pageName}"的点击行为`
          }
        } else {
          requirementText = '用户点击行为分析'
        }
        break
      case 'conversion':
        if (params.scope === 'funnel') {
          requirementText = '用户转化漏斗分析'
        } else if (params.scope === 'page') {
          requirementText = '页面转化分析'
        } else if (params.scope === 'custom') {
          requirementText = params.requirement || params.userInput || '自定义转化路径分析'
        } else {
          requirementText = '用户行为转化分析'
        }
        break
      default:
        requirementText = params.requirement || params.userInput || '数据分析'
    }
    
    currentRequirement.value = requirementText
    console.log('构建的需求文本:', requirementText)
    await analyzeRequirement()
  } else if (params.requirement || params.userInput) {
    // 如果直接传递了需求文本或用户输入，设置为当前需求并分析
    currentRequirement.value = params.requirement || params.userInput
    await analyzeRequirement()
  }
}

// 专门处理按钮点击分析需求
const analyzeButtonClickRequirement = async () => {
  if (!currentRequirement.value.trim()) {
    message.warning('请输入分析需求')
    return
  }
  
  analyzing.value = true
  
  // 开始图表生成loading状态
  store.dispatch('updateChartGenerationStatus', {
    isGenerating: true,
    currentStep: '正在分析按钮点击需求...',
    progress: 10
  })
  
  try {
    // 构建按钮点击分析的固定配置
    const pageName = store.state.buttonAnalysisParams.pageName
    const buttonName = store.state.buttonAnalysisParams.buttonName
    
    const analysis = {
      intent: 'button_click_analysis',
      chartType: 'button_click_analysis',
      description: `分析页面"${pageName}"的"${buttonName}"按钮点击情况`,
      confidence: 0.95,
      dataFields: [],
      dimensions: [],
      metrics: [],
      buryPointType: 'click',
      originalText: currentRequirement.value,
      source: 'button_selection',
      parameters: {
        pageName: pageName,
        buttonName: buttonName
      }
    }
    
    console.log('按钮点击分析配置:', analysis)
    
    // 更新生成状态 - 需求分析完成
    store.dispatch('updateChartGenerationStatus', {
      isGenerating: true,
      currentStep: '需求分析完成，开始获取数据...',
      progress: 30
    })
    
    // 获取数据
    const result = await fetchMultiDayData(analysisMode.value, dateRange.value, analysis)
    
    // 检查是否使用了缓存数据
    if (result.totalRequests === 0) {
      console.log('✅ 成功使用预加载缓存数据，无API调用')
      message.success('使用缓存数据，分析完成')
    } else {
      console.log(`⚠️ 调用了 ${result.totalRequests} 个API请求`)
      message.warning(`调用了 ${result.totalRequests} 个API请求，建议先完成数据预加载`)
    }
    
    // 更新生成状态 - 开始生成图表
    store.dispatch('updateChartGenerationStatus', {
      isGenerating: true,
      currentStep: '正在生成图表...',
      progress: 80
    })
    
    await generateChart(analysis, result.data, dateRange.value)
    
    // 完成生成
    store.dispatch('updateChartGenerationStatus', {
      isGenerating: false,
      currentStep: '图表生成完成',
      progress: 100
    })
    
  } catch (error) {
    console.error('按钮点击分析失败:', error)
    
    // 检查是否是页面不存在的错误
    if (error.message && error.message.includes('未找到页面')) {
      // 显示详细的页面不存在错误信息
      message.error({
        content: error.message,
        duration: 10, // 显示更长时间让用户看到页面列表
        style: {
          whiteSpace: 'pre-line' // 支持换行显示
        }
      })
    } else {
      message.error('按钮点击分析失败，请重试')
    }
    
    // 错误时也要清除loading状态
    store.dispatch('updateChartGenerationStatus', {
      isGenerating: false,
      currentStep: '生成失败',
      progress: 0
    })
    
    analyzing.value = false
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
  
  // 开始图表生成loading状态
  store.dispatch('updateChartGenerationStatus', {
    isGenerating: true,
    currentStep: '正在分析需求...',
    progress: 10
  })
  
  try {
    // 构建上下文信息
    const context = {}
    
    // 如果当前需求包含页面名称信息，提取出来
    const pageNameMatch = currentRequirement.value.match(/(.+?)页面访问量/)
    if (pageNameMatch && pageNameMatch[1]) {
      context.pageName = pageNameMatch[1].trim()
    }
    
    // 解析需求（现在是异步的，支持 AI 理解）
    let analysis = await requirementParser.parse(currentRequirement.value, context)
    
    // 检测整站UV/PV分析并强制转换为UV/PV分析
    if (currentRequirement.value.includes('整站UV/PV趋势分析') || currentRequirement.value.includes('整站UV/PV')) {
      console.log('检测到整站UV/PV分析，强制转换为UV/PV分析')
      analysis = {
        ...analysis,
        intent: 'uv_pv_analysis',
        chartType: 'line',
        description: '整站UV/PV趋势分析'
      }
    }
    
    // 检测单页面查询并强制转换为正确的图表类型（排除按钮点击分析）
    const specifiedPages = await extractPageNames(currentRequirement.value)
    if (specifiedPages.length > 0 && 
        !analysis.chartType?.includes('button_click_analysis') && 
        !analysis.chartType?.includes('button_click_daily') &&
        analysis.chartType !== 'button_click_analysis' &&
        analysis.chartType !== 'button_click_daily') {
      console.log('检测到单页面查询，强制转换为UV/PV时间组合图')
      
      // 根据分析类型生成具体的描述
      const analysisType = store.state.apiConfig.selectedAnalysisType || 'page_analysis'
      let specificDescription = ''
      
      if (analysisType === 'page_analysis') {
        specificDescription = `分析页面"${specifiedPages[0]}"的访问量数据`
      } else if (analysisType === 'click_analysis') {
        specificDescription = `分析页面"${specifiedPages[0]}"的点击行为`
      } else if (analysisType === 'behavior_analysis') {
        specificDescription = `分析页面"${specifiedPages[0]}"的用户行为`
      } else {
        specificDescription = `分析页面"${specifiedPages[0]}"的数据`
      }
      
      analysis = {
        ...analysis,
        intent: 'single_page_uv_pv_analysis',
        chartType: 'single_page_uv_pv_chart',
        description: specificDescription, // 使用具体的页面分析描述
        parameters: {
          ...analysis.parameters,
          pageName: specifiedPages[0]
        }
      }
    } else {
      console.log('✅ 使用AI分析结果:', analysis)
    }
    
    console.log('需求分析结果:', analysis)
    
    // 更新生成状态 - 需求分析完成
    store.dispatch('updateChartGenerationStatus', {
      isGenerating: true,
      currentStep: '正在获取数据...',
      progress: 30
    })
    
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
    
    // 检查预加载状态，如果正在进行中则等待完成
    const preloadStatus = dataPreloadService.getStatus()
    if (preloadStatus.isPreloading) {
      console.log('⏳ 数据预加载正在进行中，等待完成...')
      message.loading('数据预加载中，请稍候...', 0)
      
      // 等待预加载完成（最多等待30秒）
      let waitTime = 0
      const maxWaitTime = 30000 // 30秒
      
      while (preloadStatus.isPreloading && waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // 等待1秒
        waitTime += 1000
        
        // 更新状态
        const currentStatus = dataPreloadService.getStatus()
        if (!currentStatus.isPreloading) {
          break
        }
      }
      
      message.destroy() // 清除loading消息
      
      if (waitTime >= maxWaitTime) {
        console.warn('⏰ 预加载等待超时，继续使用API获取数据')
      } else {
        console.log('✅ 数据预加载已完成，继续分析')
      }
    }
    
    // 获取数据并生成图表（使用缓存机制）
    console.log('🔍 开始获取数据，优先使用预加载缓存...')
    
    // 更新生成状态 - 开始获取数据
    store.dispatch('updateChartGenerationStatus', {
      isGenerating: true,
      currentStep: '正在获取数据...',
      progress: 50
    })
    
    // 添加调试信息
    console.log('🔍 数据获取前的配置状态:')
    console.log('  分析模式:', analysisMode.value)
    console.log('  项目配置:', store.state.projectConfig)
    console.log('  API配置:', store.state.apiConfig)
    console.log('  分析结果:', analysis)
    
    const result = await fetchMultiDayData(analysisMode.value, dateRange.value, analysis)
    
    // 检查是否使用了缓存数据
    if (result.totalRequests === 0) {
      console.log('✅ 成功使用预加载缓存数据，无API调用')
      message.success('使用缓存数据，分析完成')
    } else {
      console.log(`⚠️ 调用了 ${result.totalRequests} 个API请求`)
      message.warning(`调用了 ${result.totalRequests} 个API请求，建议先完成数据预加载`)
    }
    
    // 更新生成状态 - 开始生成图表
    store.dispatch('updateChartGenerationStatus', {
      isGenerating: true,
      currentStep: '正在生成图表...',
      progress: 80
    })
    
    await generateChart(analysis, result.data, dateRange.value)
    
    // 完成生成
    store.dispatch('updateChartGenerationStatus', {
      isGenerating: false,
      currentStep: '图表生成完成',
      progress: 100
    })
    
  } catch (error) {
    console.error('分析失败:', error)
    
    // 检查是否是页面不存在的错误
    if (error.message && error.message.includes('未找到页面')) {
      // 显示详细的页面不存在错误信息
      message.error({
        content: error.message,
        duration: 10, // 显示更长时间让用户看到页面列表
        style: {
          whiteSpace: 'pre-line' // 支持换行显示
        }
      })
    } else {
      message.error('分析失败，请重试')
    }
    
    // 错误时也要清除loading状态
    store.dispatch('updateChartGenerationStatus', {
      isGenerating: false,
      currentStep: '生成失败',
      progress: 0
    })
  } finally {
    analyzing.value = false
  }
}




const onDateRangeChange = async (dates, dateStrings) => {
  console.log('====================================')
  console.log('Home: onDateRangeChange 被调用')
  console.log('传入的 dates:', dates)
  console.log('传入的 dateStrings:', dateStrings)
  console.log('当前 dateRange.value:', dateRange.value)
  console.log('====================================')
  
  if (!dates || dates.length !== 2) {
    console.log('日期范围无效，退出')
    return
  }
  
  // 更新本地 dateRange 变量
  dateRange.value = dates
  console.log('更新后的 dateRange.value:', dateRange.value)
  
  // 使用 dateStrings 如果存在，否则从 dates 中提取日期字符串
  let start, end
  if (dateStrings && dateStrings.length === 2) {
    [start, end] = dateStrings
    console.log('使用 dateStrings:', start, '至', end)
  } else {
    // 从 dayjs 对象中提取日期字符串
    start = dates[0].format('YYYY-MM-DD')
    end = dates[1].format('YYYY-MM-DD')
    console.log('从 dates 提取:', start, '至', end)
  }
  
  console.log('最终日期范围:', start, '至', end)
  
  // 清空缓存，确保使用新的日期范围重新获取数据
  clearCache()
  console.log('已清空数据缓存，准备重新加载数据')
  
  // 注释掉自动重新加载页面列表，避免调用API
  // await loadAvailablePages(dateRange.value)
  console.log('⏸️ 跳过自动重新加载页面列表')
  
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
    message.success(`日期范围已设置为 ${start} 至 ${end}`)
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
  router.push('/settings')
}

const handleMenuClick = (menuKey) => {
  console.log('菜单点击处理:', menuKey)
  // 可以在这里添加自定义逻辑
}

// 手动触发数据预加载
const triggerManualPreload = async () => {
  try {
    isPreloading.value = true
    console.log('🔄 手动触发数据预加载...')
    
    // 不显示loading消息，让右侧状态组件处理
    await dataPreloadService.triggerPreload()
    
    // 不显示success消息，让右侧状态组件处理
    console.log('✅ 手动数据预加载完成')
  } catch (error) {
    console.error('手动数据预加载失败:', error)
    message.error('数据预加载失败: ' + error.message)
  } finally {
    isPreloading.value = false
  }
}


const fillPrompt = async (text) => {
  if (text === '页面访问量') {
    // 页面访问量直接分析，不调用API获取页面列表
    currentRequirement.value = '页面访问量'
    currentAnalysisType.value = text
    message.success('已填充需求：页面访问量')
    
    console.log('====================================')
    console.log('🔍 点击页面访问量 - 缓存状态检查:')
    
    const currentPointId = store.state.apiConfig?.selectedPointId || 
                          store.state.projectConfig?.selectedBuryPointIds?.[0]
    console.log(`🎯 当前埋点ID: ${currentPointId}`)
    console.log(`📅 日期范围: ${dateRange.value[0].format('YYYY-MM-DD')} 至 ${dateRange.value[1].format('YYYY-MM-DD')}`)
    
    // 检查预加载状态
    const preloadStatus = dataPreloadService.getStatus()
    console.log(`📊 预加载状态:`, preloadStatus)
    
    // 尝试直接检查缓存
    try {
      const testCacheData = await dataPreloadService.getMultiDayCachedData(dateRange.value, currentPointId)
      console.log(`💾 直接缓存检查结果: ${testCacheData.length}条数据`)
      if (testCacheData.length === 0) {
        console.log(`❌ 缓存为空！这就是为什么还要调用API的原因`)
        message.warning('缓存为空，将调用API获取数据。建议先点击"数据预加载"按钮')
      } else {
        console.log(`✅ 缓存有数据，将使用缓存`)
      }
    } catch (error) {
      console.error(`❌ 缓存检查失败:`, error)
    }
    
    console.log('====================================')
    
    // 直接开始分析，不调用loadAvailablePages
    try {
      await analyzeRequirement()
    } catch (error) {
      console.error('自动分析失败:', error)
      message.error('分析失败，请手动点击智能分析按钮')
    }
  } else if (text === '显示访问趋势') {
    // 显示访问趋势需要先加载页面列表，然后显示选择弹窗
    currentAnalysisType.value = text
    message.loading('正在加载页面列表...', 0)
    
    try {
      // 从缓存数据中提取页面列表
      const currentPointId = store.state.apiConfig?.selectedPointId || 
                            store.state.projectConfig?.selectedBuryPointIds?.[0]
      
      console.log('🔍 从缓存数据提取页面列表...')
      const cachedData = await dataPreloadService.getMultiDayCachedData(dateRange.value, currentPointId)
      
      if (cachedData && cachedData.length > 0) {
        // 从缓存数据中提取唯一页面名称（使用 pageName 字段）
        const pageSet = new Set()
        cachedData.forEach(item => {
          if (item.pageName) {
            pageSet.add(item.pageName)
          }
        })
        
        availablePages.value = Array.from(pageSet).sort()
        console.log(`✅ 从缓存提取到 ${availablePages.value.length} 个页面`)
        message.destroy()
        message.success(`找到 ${availablePages.value.length} 个页面`)
      } else {
        // 缓存为空，需要调用API
        console.log('⚠️ 缓存为空，调用API加载页面列表')
        await loadAvailablePages(dateRange.value)
        message.destroy()
      }
      
      // 显示页面选择弹窗
      pageSelectionModalVisible.value = true
    } catch (error) {
      console.error('加载页面列表失败:', error)
      message.destroy()
      message.error('加载页面列表失败: ' + error.message)
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
  if (pageName === '__ALL__') {
    // 全部页面：不添加页面过滤，查看整站UV/PV
    currentRequirement.value = '整站UV/PV趋势分析'
    message.success('开始分析整站UV/PV')
  } else {
    // 单个页面：添加页面标识符
    currentRequirement.value = `#${pageName} 页面访问量`
    message.success(`开始分析页面：${pageName}`)
  }
  
  // 自动开始分析
  try {
    await analyzeRequirement()
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


// 保存图表到图表库
const saveChartToLibrary = async () => {
  // 允许在 analysisResult 为空但 chartConfig 存在时保存（例如通过按钮选择等路径生成的图表）
  if (!store.state.chartConfig) {
    message.warning('请先生成图表')
    return
  }
  
  try {
    console.groupCollapsed('💾 [Home] 保存图表 - 优化版本')
    console.time('saveChart')
    const chartData = store.state.chartConfig.data
    const effectiveAnalysis = analysisResult.value || store.state.chartConfig.analysis || {}
    const chartType = effectiveAnalysis.chartType
    console.log('➡️ [Home] 输入参数: ', {
      chartType,
      analysisDescription: effectiveAnalysis?.description,
      dataType: Array.isArray(chartData) ? 'array' : typeof chartData,
      isChartObject: !!(chartData && !Array.isArray(chartData) && chartData.categories),
      sampleArray: Array.isArray(chartData) ? chartData.slice(0, 2) : undefined,
      sampleObject: !Array.isArray(chartData) ? chartData : undefined
    })
    if (!chartData || (Array.isArray(chartData) && chartData.length === 0)) {
      message.warning('图表数据为空，无法保存')
      console.warn('⚠️ [Home] 数据为空，终止保存')
      console.groupEnd()
      return
    }
    
    // 从数据中提取日期范围（兼容两种数据结构）
    let uniqueDates = []
    if (chartData && typeof chartData === 'object' && !Array.isArray(chartData) && chartData.categories) {
      uniqueDates = [...new Set(chartData.categories)].sort()
      console.log('🗓️ [Home] 使用图表对象中的categories作为日期范围', uniqueDates)
    } else {
      const dates = chartData.map(d => dayjs(d.createdAt).format('YYYY-MM-DD')).filter(d => d)
      uniqueDates = [...new Set(dates)].sort()
      console.log('🗓️ [Home] 使用原始数组数据提取的日期范围', uniqueDates)
    }
    
    // 🚀 优化策略：只保存最近7天的数据，历史数据通过定时任务补充
    const maxInitialDays = 7
    const recentDates = uniqueDates.slice(-maxInitialDays)
    console.log(`📊 [Home] 优化策略：只保存最近${maxInitialDays}天数据 (${recentDates.length}/${uniqueDates.length}天)`)
    
    if (recentDates.length < uniqueDates.length) {
      console.log(`⏰ [Home] 历史数据将通过定时任务补充：${uniqueDates.length - recentDates.length}天`)
    }
    
    // 构造图表配置 - 改进图表名称生成
    let chartName = effectiveAnalysis.description || currentRequirement.value
    
    // 如果没有具体的描述，尝试从需求中提取页面名称生成更具体的名称
    if (!chartName || chartName === '数据分析' || chartName === '数据对比分析') {
      const pageName = extractPageNames(currentRequirement.value)[0]
      if (pageName && pageName !== '__ALL__') {
        // 根据分析类型生成不同的名称
        const analysisType = store.state.apiConfig.selectedAnalysisType || 'page_analysis'
        if (analysisType === 'page_analysis') {
          chartName = `分析页面"${pageName}"的访问量数据`
        } else if (analysisType === 'click_analysis') {
          chartName = `分析页面"${pageName}"的点击行为`
        } else if (analysisType === 'behavior_analysis') {
          chartName = `分析页面"${pageName}"的用户行为`
        } else {
          chartName = `分析页面"${pageName}"的数据`
        }
      } else {
        chartName = currentRequirement.value || '数据分析'
      }
    }
    
    const chartConfig = {
      name: chartName,
      description: currentRequirement.value,
      category: getCategoryByAnalysisType(store.state.apiConfig.selectedAnalysisType || 'page_analysis'),
      chartType: chartType,
      mode: analysisMode.value,
      selectedPointId: store.state.apiConfig.selectedPointId,
      埋点类型: analysisMode.value === 'dual' ? '访问+点击' : '访问',
      filters: {
        pageName: extractPageNames(currentRequirement.value)[0] || null
      },
      dimensions: ['date'],
      metrics: effectiveAnalysis.metrics || ['uv', 'pv'],
      dateRangeStrategy: 'last_30_days',
      // 🚀 新增：定时任务配置
      scheduledUpdate: {
        enabled: true,
        frequency: 'daily', // 每天更新
        time: '01:00', // 凌晨1点执行
        maxHistoryDays: 365, // 最多保留365天历史数据
        batchSize: 10 // 每次批量处理10天数据
      },
      // 🚀 新增：数据范围信息
      dataRange: {
        totalDays: uniqueDates.length,
        initialDays: recentDates.length,
        pendingDays: uniqueDates.length - recentDates.length,
        lastDataUpdate: recentDates[recentDates.length - 1] || null
      }
    }
    
    // 按日期聚合数据（只处理最近的数据）
    const initialData = {}
    
    // 检查是否为按钮点击分析（数据格式可能不同）
    const isButtonClickAnalysis = chartType === 'button_click_analysis' || 
                                 chartType === 'button_click_daily'
    
    if (isButtonClickAnalysis) {
      // 按钮点击分析：数据已经是按日期聚合的格式
      console.log('🔍 [Home] 检测到按钮点击分析，使用特殊处理逻辑')
      
      // 检查数据格式：如果数据包含categories和uvData/pvData，说明已经是图表格式
      if (chartData && typeof chartData === 'object' && !Array.isArray(chartData) && chartData.categories) {
        console.log('📊 [Home] 数据已经是图表格式，直接转换', {
          categoriesLen: chartData.categories?.length,
          uvLen: chartData.uvData?.length,
          pvLen: chartData.pvData?.length
        })
        
        // 将图表格式数据转换为按日期的聚合数据（只处理最近的数据）
        chartData.categories.forEach((date, index) => {
          // 🚀 优化：只保存最近的数据
          if (recentDates.includes(date)) {
            initialData[date] = {
              metrics: {
                uv: chartData.uvData[index] || 0,
                pv: chartData.pvData[index] || 0
              },
              dimensions: {},
              metadata: {
                rawRecordCount: 0,
                filteredRecordCount: 0,
                processedAt: new Date().toISOString(),
                dataQuality: 'good'
              }
            }
          }
        })
        console.log('🧩 [Home] 转换完成: 聚合天数=', Object.keys(initialData).length)
      } else {
        // 按钮点击分析：直接从原始数据聚合UV/PV（只处理最近的数据）
        console.log('🔧 [Home] 按钮点击分析：直接从原始数据聚合UV/PV')
        for (const date of recentDates) {
          const dayData = chartData.filter(d => 
            dayjs(d.createdAt).format('YYYY-MM-DD') === date
          )
          
          if (dayData.length > 0) {
            // 过滤出指定页面和按钮的点击数据
            console.log(`🔍 [Home] 日期 ${date} 的数据过滤:`)
            console.log(`  - 总数据量: ${dayData.length}`)
            console.log(`  - 点击数据量: ${dayData.filter(item => item.type === 'click').length}`)
            console.log(`  - 页面名称匹配: ${dayData.filter(item => item.pageName === effectiveAnalysis.pageName).length}`)
            console.log(`  - 按钮名称匹配: ${dayData.filter(item => item.content === effectiveAnalysis.buttonName).length}`)
            
            const buttonClickData = dayData.filter(item => 
              item.type === 'click' && 
              item.pageName === effectiveAnalysis.pageName && 
              item.content === effectiveAnalysis.buttonName
            )
            
            console.log(`  - 最终匹配的按钮点击数据: ${buttonClickData.length} 条`)
            if (buttonClickData.length > 0) {
              console.log(`  - 样本数据:`, buttonClickData.slice(0, 2))
            }
            
            // 计算UV和PV
            let uv = 0
            let pv = 0
            const uvSet = new Set()
            
            buttonClickData.forEach(item => {
              pv++ // 每次点击都计数
              if (item.weCustomerKey) {
                uvSet.add(item.weCustomerKey) // 按用户去重
              }
            })
            
            uv = uvSet.size
            
            initialData[date] = {
              metrics: {
                uv: uv,
                pv: pv
              },
              dimensions: {},
              metadata: {
                rawRecordCount: dayData.length,
                filteredRecordCount: buttonClickData.length,
                processedAt: new Date().toISOString(),
                dataQuality: buttonClickData.length > 0 ? 'good' : 'no_data'
              }
            }
          }
        }
        console.log('🧩 [Home] 按钮点击数据聚合完成: 处理天数=', Object.keys(initialData).length)
      }
    } else {
      // 其他图表类型：使用标准聚合服务处理数据（只处理最近的数据）
      console.log('📈 [Home] 非按钮点击图表，使用标准聚合')
      for (const date of recentDates) {
        const dayData = chartData.filter(d => 
          dayjs(d.createdAt).format('YYYY-MM-DD') === date
        )
        
        if (dayData.length > 0) {
          const aggregated = aggregationService.aggregateForChart(
            dayData,
            chartConfig,
            date
          )
          
          // 深度克隆，移除不可序列化的对象
          initialData[date] = JSON.parse(JSON.stringify(aggregated))
        }
      }
    }
    
    console.log('📝 [Home] initialData 预览(前2天):', Object.entries(initialData).slice(0,2))
    console.log('🧾 [Home] chartConfig 预览:', chartConfig)
    // 确保chartConfig可序列化
    const serializableChartConfig = JSON.parse(JSON.stringify(chartConfig))
    
    // 保存图表
    const savedChart = await saveChartToManager(serializableChartConfig, initialData)
    
    // 🚀 优化提示：显示保存状态和历史数据补充信息
    const savedDays = Object.keys(initialData).length
    const pendingDays = chartConfig.dataRange.pendingDays
    
    message.success(`图表"${savedChart.name}"已保存（${savedDays}天数据）`)
    
    if (pendingDays > 0) {
      message.info({
        content: `历史数据（${pendingDays}天）将通过定时任务自动补充`,
        duration: 8
      })
    }
    
    console.timeEnd('saveChart')
    console.groupEnd()
    
    // 提示用户查看
    const key = `save-chart-${Date.now()}`
    message.info({
      content: '图表已保存，点击查看',
      duration: 5,
      key,
      onClick: () => {
        message.destroy(key)
        window.open('/my-charts', '_blank')
      }
    })
    
  } catch (error) {
    console.error('❌ [Home] 保存图表失败:', error)
    console.error('❌ [Home] error.stack:', error?.stack)
    console.error('❌ [Home] 当前analysisResult:', analysisResult.value)
    console.error('❌ [Home] 当前store.chartConfig:', store.state.chartConfig)
    console.groupEnd()
    message.error('保存图表失败: ' + error.message)
  }
}

// 将保存方法暴露为全局兜底，防止事件链断裂
// 注意：仅用于调试/紧急兜底，不改变既有事件流
// 在组件挂载后绑定，页面卸载时可由浏览器回收
window._saveChart = saveChartToLibrary

// 处理时间范围变化
const handleTimeRangeChange = async (timeRangeInfo) => {
  console.log('🕒 [Home] 收到时间范围变化事件:', timeRangeInfo)
  
  if (!store.state.chartConfig) {
    console.warn('⚠️ [Home] 没有图表配置，无法更新时间范围')
    return
  }
  
  try {
    const { days } = timeRangeInfo
    console.log(`📅 [Home] 切换到${days}天数据范围`)
    
    // 显示加载状态
    message.loading(`正在加载${days}天数据...`, 0)
    
    // 计算新的日期范围
    const endDate = dayjs()
    const startDate = endDate.subtract(days - 1, 'day')
    const newDateRange = [startDate, endDate]
    
    console.log(`📊 [Home] 新日期范围: ${startDate.format('YYYY-MM-DD')} 至 ${endDate.format('YYYY-MM-DD')}`)
    
    // 获取新时间范围的数据
    const newData = await fetchDataForDateRange(newDateRange)
    
    // 更新图表配置中的日期范围信息
    const updatedChartConfig = {
      ...store.state.chartConfig,
      analysis: {
        ...store.state.chartConfig.analysis,
        userDateRange: newDateRange,
        timeRange: days
      }
    }
    
    // 更新store中的图表配置
    store.dispatch('updateChartConfig', {
      ...updatedChartConfig,
      data: newData,
      rawData: newData,
      timestamp: new Date().toISOString()
    })
    
    // 重新生成图表
    await generateChart(updatedChartConfig.analysis, newData, newDateRange)
    
    message.destroy()
    message.success(`已切换到${days}天数据视图`)
    
  } catch (error) {
    message.destroy()
    console.error('❌ [Home] 时间范围切换失败:', error)
    message.error(`切换时间范围失败: ${error.message}`)
  }
}

// 根据日期范围获取数据
const fetchDataForDateRange = async (dateRange) => {
  const [startDate, endDate] = dateRange
  const startDateStr = startDate.format('YYYY-MM-DD')
  const endDateStr = endDate.format('YYYY-MM-DD')
  
  console.log(`📡 [Home] 获取数据: ${startDateStr} 至 ${endDateStr}`)
  
  // 获取日期范围内的所有数据
  const allData = []
  let currentDate = startDate
  
  while (currentDate.isSameOrBefore(endDate)) {
    const dateStr = currentDate.format('YYYY-MM-DD')
    console.log(`📅 [Home] 获取 ${dateStr} 的数据...`)
    
    try {
      const dayData = await fetchDayData({
        date: dateStr,
        projectId: store.state.apiConfig.projectId,
        selectedPointId: store.state.apiConfig.selectedPointId
      })
      
      allData.push(...dayData)
      console.log(`✅ [Home] ${dateStr}: ${dayData.length} 条数据`)
      
    } catch (error) {
      console.warn(`⚠️ [Home] ${dateStr} 数据获取失败:`, error)
      // 即使某天数据获取失败，也继续处理其他天
    }
    
    currentDate = currentDate.add(1, 'day')
  }
  
  console.log(`📊 [Home] 总计获取 ${allData.length} 条数据`)
  return allData
}

// 获取单天数据的辅助函数
const fetchDayData = async ({ date, projectId, selectedPointId }) => {
  const { yeepayAPI } = await import('@/api')
  
  const response = await yeepayAPI.searchBuryPointData({
    date: date,
    pageSize: store.state.apiConfig.pageSize || 1000,
    projectId: projectId,
    selectedPointId: selectedPointId
  })
  
  return response.data?.dataList || []
}

// 根据分析类型获取分类
const getCategoryByAnalysisType = (analysisType) => {
  const categoryMap = {
    'page_analysis': '页面分析',
    'click_analysis': '用户行为',
    'behavior_analysis': '用户行为'
  }
  return categoryMap[analysisType] || '页面分析'
}
</script>

<style scoped>
.home-container {
  margin: 0 auto;
}

.left-panel {
  height: calc(100vh - 120px);
  min-height: 600px;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  overflow-y: auto;
}

.right-panel {
  height: calc(100vh - 120px);
  min-height: 600px;
  border-radius: 8px;
  overflow-y: auto;
}

.panel-title {
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #1890ff;
  padding-bottom: 8px;
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

/* 缓存状态指示器样式 */
.cache-status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cache-status-indicator :deep(.ant-badge-status-text) {
  font-size: 12px;
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
  min-height: 600px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fff;
}

.empty-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 600px;
}

.chart-content {
  width: 100%;
  height: 600px;
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
  
  .left-panel, .right-panel {
    height: auto;
    min-height: 400px;
    margin-bottom: 16px;
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
