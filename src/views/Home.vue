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
        <a-col :span="12">
          <div class="left-panel">
            <AIChatInterface
              v-model:date-range="dateRange"
              @date-range-change="onDateRangeChange"
              @analyze-requirement="handleChatAnalysis"
              @clear-requirement="clearRequirement"
              @show-config-modal="showConfigModal"
            />
          </div>
        </a-col>

        <!-- 右侧：分析结果 -->
        <a-col :span="12">
          <div class="right-panel">
            <h3 class="panel-title">分析结果</h3>
            <ChartSection
              :has-chart="hasChart"
              @regenerate-chart="regenerateChart"
              @export-chart="exportChart"
              @save-chart="saveChartToLibrary"
            />
          </div>
        </a-col>
      </a-row>

    <!-- 配置管理模态框 -->
    <ConfigModal
      v-model:visible="configModalVisible"
      :api-config-form="apiConfigForm"
      :ollama-config-form="ollamaConfigForm"
      :project-config-form="projectConfigForm"
      @save-config="saveConfig"
      @project-config-updated="onProjectConfigUpdated"
    />

    <!-- 页面选择弹窗 -->
    <PageSelectionModal
      v-model:visible="pageSelectionModalVisible"
      :available-pages="availablePages"
      @select-page="selectPageForAnalysis"
    />
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { message } from 'ant-design-vue'
import { SettingOutlined, DownloadOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { RequirementParser } from '@/utils/requirementParser'
import { useDataFetch } from '@/composables/useDataFetch'
import { useChart } from '@/composables/useChart'
import { useChartManager } from '@/composables/useChartManager'
import { aggregationService } from '@/utils/aggregationService'
import { dataPreloadService } from '@/services/dataPreloadService'
import AIChatInterface from '@/components/AIChatInterface.vue'
import ChartSection from '@/components/ChartSection.vue'
import ConfigModal from '@/components/ConfigModal.vue'
import PageSelectionModal from '@/components/PageSelectionModal.vue'
import AppLayout from '@/components/AppLayout.vue'

const store = useStore()

// 使用 composables
const { availablePages, fetchMultiDayData, loadAvailablePages, validateConnection, clearCache } = useDataFetch()
const { chartGenerator, initChartGenerator, generateChart, regenerateChart, exportChart, extractPageNames } = useChart()
const { saveChart: saveChartToManager } = useChartManager()

// 响应式数据
const currentRequirement = ref('')
const analyzing = ref(false)
const configModalVisible = ref(false)
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

// API 配置表单（移除了 defaultDate 和 baseUrl，日期在主界面上选择，baseUrl 写死在代码中）
const apiConfigForm = computed({
  get: () => ({
    pageSize: store.state.apiConfig.pageSize
  }),
  set: (value) => {
    store.dispatch('updateApiConfig', value)
  }
})

// 项目配置表单
const projectConfigForm = computed({
  get: () => ({
    accessToken: store.state.apiConfig.accessToken,
    selectedProjectId: store.state.projectConfig.currentProject?.id || store.state.apiConfig.projectId || 'event1021',
    selectedBuryPointIds: store.state.projectConfig.selectedBuryPointIds || []
  }),
  set: (value) => {
    store.dispatch('updateApiConfig', {
      projectId: value.selectedProjectId,
      accessToken: value.accessToken
    })
    // 同时更新项目配置中的埋点选择
    if (value.selectedBuryPointIds) {
      store.dispatch('updateProjectConfig', {
        selectedBuryPointIds: value.selectedBuryPointIds
      })
    }
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
  
  if (params.requirement || params.userInput) {
    // 如果直接传递了需求文本或用户输入，设置为当前需求并分析
    currentRequirement.value = params.requirement || params.userInput
    await analyzeRequirement()
  } else if (params.type) {
    // 如果传递了分析类型参数，构建对应的需求并分析
    let requirementText = ''
    
    switch (params.type) {
      case 'page_visits':
        if (params.scope === 'all') {
          requirementText = '页面访问量'
        } else if (params.scope === 'specific') {
          requirementText = '特定页面访问量'
        } else if (params.scope === 'by_type') {
          requirementText = '按页面类型分析访问量'
        } else if (params.scope === 'comparison') {
          requirementText = '多页面访问量对比'
        } else if (params.scope === 'custom') {
          requirementText = params.userInput || '页面访问分析'
        } else if (params.scope === 'specific' && params.pageName) {
          if (params.pageName === '__ALL__') {
            requirementText = '页面访问量'
          } else {
            requirementText = `${params.pageName}页面访问量`
          }
        } else {
          requirementText = '页面访问量'
        }
        break
      case 'trend':
        if (params.scope === 'overall') {
          requirementText = '显示访问趋势'
        } else {
          requirementText = '页面对比趋势'
        }
        break
      case 'conversion':
        if (params.scope === 'funnel') {
          requirementText = '用户转化流程'
        } else if (params.scope === 'registration') {
          requirementText = '用户注册转化流程'
        } else if (params.scope === 'purchase') {
          requirementText = '购买转化漏斗'
        } else if (params.scope === 'custom') {
          requirementText = params.userInput || '转化流程分析'
        } else {
          requirementText = '页面转化分析'
        }
        break
      case 'user_click':
        if (params.scope === 'page') {
          requirementText = '页面点击分析'
        } else if (params.scope === 'all_buttons') {
          requirementText = '页面所有按钮点击分析'
        } else if (params.scope === 'custom') {
          requirementText = params.userInput || '用户点击分析'
        } else if (params.scope === 'specific' && params.pageName) {
          if (params.pageName === '__ALL__') {
            requirementText = '用户点击分析'
          } else {
            requirementText = `${params.pageName}页面点击分析`
          }
        } else {
          requirementText = '用户点击分析'
        }
        break
      case 'button_heatmap':
        requirementText = '按钮点击热度分析'
        break
      case 'click_conversion':
        requirementText = '点击转化率分析'
        break
      case 'device':
        if (params.scope === 'type') {
          requirementText = '设备类型分布'
        } else {
          requirementText = '浏览器使用情况'
        }
        break
      default:
        requirementText = params.type
    }
    
    if (requirementText) {
      currentRequirement.value = requirementText
      await analyzeRequirement()
    }
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
    const result = await fetchMultiDayData(analysisMode.value, dateRange.value)
    
    // 检查是否使用了缓存数据
    if (result.totalRequests === 0) {
      console.log('✅ 成功使用预加载缓存数据，无API调用')
      message.success('使用缓存数据，分析完成')
    } else {
      console.log(`⚠️ 调用了 ${result.totalRequests} 个API请求`)
      message.warning(`调用了 ${result.totalRequests} 个API请求，建议先完成数据预加载`)
    }
    
    await generateChart(analysis, result.data, dateRange.value)
  } catch (error) {
    console.error('分析失败:', error)
    message.error('分析失败，请重试')
  } finally {
    analyzing.value = false
  }
}



// 事件处理方法
const onProjectConfigUpdated = (configInfo) => {
  console.log('项目配置更新事件:', configInfo)
  
  // 更新 Vuex 状态
  store.dispatch('updateProjectConfig', {
    currentProject: {
      id: configInfo.projectId,
      name: configInfo.projectId
    },
    ...configInfo.config,
    selectedBuryPointIds: configInfo.selectedBuryPointIds || []
  })
  
  const buryPointsCount = configInfo.selectedBuryPointIds?.length || 0
  message.success(`项目 ${configInfo.projectId} 配置已更新，已选择 ${buryPointsCount} 个埋点`)
  
  // 如果有当前的分析结果，可以重新生成图表以使用新的埋点配置
  if (analysisResult.value) {
    message.info('项目配置已更新，如需应用新配置请重新生成图表')
  }
}

const onDateRangeChange = async (dates, dateStrings) => {
  console.log('Home: onDateRangeChange 被调用', { dates, dateStrings })
  
  if (!dates || dates.length !== 2) {
    console.log('日期范围无效，退出')
    return
  }
  
  // 使用 dateStrings 如果存在，否则从 dates 中提取日期字符串
  let start, end
  if (dateStrings && dateStrings.length === 2) {
    [start, end] = dateStrings
  } else {
    // 从 dayjs 对象中提取日期字符串
    start = dates[0].format('YYYY-MM-DD')
    end = dates[1].format('YYYY-MM-DD')
  }
  
  console.log('范围模式 - 日期范围:', start, '至', end)
  
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
  configModalVisible.value = true
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
    
    message.loading('正在启动数据预加载...', 2)
    await dataPreloadService.triggerPreload()
    
    message.success('数据预加载已完成！现在创建图表将使用缓存数据')
    console.log('✅ 手动数据预加载完成')
  } catch (error) {
    console.error('手动数据预加载失败:', error)
    message.error('数据预加载失败: ' + error.message)
  } finally {
    isPreloading.value = false
  }
}

const saveConfig = async (configData) => {
  try {
    // 如果有埋点选择信息，更新到store
    if (configData && configData.selectedBuryPointIds) {
      store.dispatch('updateProjectConfig', {
        selectedBuryPointIds: configData.selectedBuryPointIds
      })
      console.log('保存埋点选择:', configData.selectedBuryPointIds)
    }
    
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
    
    // 配置保存后，自动触发数据预加载
    console.log('配置已保存，准备启动数据预加载...')
    try {
      // 在后台异步执行预加载，不阻塞用户操作
      dataPreloadService.triggerPreload().then(() => {
        console.log('数据预加载已完成')
      }).catch(err => {
        console.warn('数据预加载失败:', err)
      })
      message.info('数据预加载已启动，请稍候...', 2)
    } catch (error) {
      console.warn('启动数据预加载失败:', error)
    }
  } catch (error) {
    console.error('保存配置后验证连接失败:', error)
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
  if (!analysisResult.value || !store.state.chartConfig) {
    message.warning('请先生成图表')
    return
  }
  
  try {
    const chartData = store.state.chartConfig.data
    if (!chartData || chartData.length === 0) {
      message.warning('图表数据为空，无法保存')
      return
    }
    
    // 从数据中提取日期范围
    const dates = chartData.map(d => dayjs(d.createdAt).format('YYYY-MM-DD')).filter(d => d)
    const uniqueDates = [...new Set(dates)].sort()
    
    // 构造图表配置
    const chartConfig = {
      name: analysisResult.value.description || currentRequirement.value,
      description: currentRequirement.value,
      category: getCategoryByChartType(analysisResult.value.chartType),
      chartType: analysisResult.value.chartType,
      mode: analysisMode.value,
      selectedPointId: store.state.apiConfig.selectedPointId,
      埋点类型: analysisMode.value === 'dual' ? '访问+点击' : '访问',
      filters: {
        pageName: extractPageNames(currentRequirement.value)[0] || null
      },
      dimensions: ['date'],
      metrics: analysisResult.value.metrics || ['uv', 'pv'],
      dateRangeStrategy: 'last_30_days'
    }
    
    // 按日期聚合数据
    const initialData = {}
    
    // 使用聚合服务处理数据
    for (const date of uniqueDates) {
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
    
    // 确保chartConfig可序列化
    const serializableChartConfig = JSON.parse(JSON.stringify(chartConfig))
    
    // 保存图表
    const savedChart = await saveChartToManager(serializableChartConfig, initialData)
    
    message.success(`图表"${savedChart.name}"已保存`)
    
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
    console.error('保存图表失败:', error)
    message.error('保存图表失败: ' + error.message)
  }
}

// 根据图表类型获取分类
const getCategoryByChartType = (chartType) => {
  const categoryMap = {
    line: '页面分析',
    bar: '页面分析',
    pie: '页面分析',
    funnel: '转化分析',
    conversion_funnel: '转化分析',
    click_heatmap: '用户行为',
    user_journey: '用户行为',
    uv_pv_chart: '页面分析',
    single_page_uv_pv_chart: '页面分析'
  }
  return categoryMap[chartType] || '页面分析'
}
</script>

<style scoped>
.home-container {
  margin: 0 auto;
}

.left-panel, .right-panel {
  height: calc(100vh - 20px);
  min-height: 600px;
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
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
