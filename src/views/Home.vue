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
              @edit-funnel-config="handleEditFunnelConfig"
            />
          </div>
        </a-col>
      </a-row>


    <!-- 页面选择弹窗 -->
    <PageSelectionModal
      v-model:open="pageSelectionModalVisible"
      :available-pages="modalAvailablePages"
      :analysis-type="modalAnalysisType"
      @select-page="(pageName) => selectPageForAnalysis(pageName, modalAnalysisType)"
    />
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
import { backendChartService as chartDB } from '@/services/backendChartService'
import { useChart } from '@/composables/useChart'
import { useChartManager } from '@/composables/useChartManager'
import { useChartSave } from '@/composables/useChartSave'
import { useChatAnalysis } from '@/composables/useChatAnalysis'
import { useRequirementAnalysis } from '@/composables/useRequirementAnalysis'
import { useAppState } from '@/composables/useAppState'
import { aggregationService } from '@/utils/aggregationService'
import { dataPreloadService } from '@/services/dataPreloadService'
import AIChatInterface from '@/components/AIChatInterface.vue'
import ChartSection from '@/components/ChartSection.vue'
import PageSelectionModal from '@/components/PageSelectionModal.vue'
import AppLayout from '@/components/AppLayout.vue'

const store = useStore()
const router = useRouter()

// 使用 composables
const { 
  availablePages, 
  fetchMultiDayData, 
  loadAvailablePages, 
  validateConnection, 
  clearCache,
  triggerManualPreload,
  onDateRangeChange,
  refreshData
} = useDataFetch()
const { chartGenerator, initChartGenerator, generateChart, extractPageNames, handleTimeRangeChange } = useChart()
const { saveChart: saveChartToManager } = useChartManager()
const { saveChartToLibrary } = useChartSave()
const { handleChatAnalysis, handleMultipleConditionsSelection, handleButtonSelection } = useChatAnalysis()
const { selectPageForAnalysis } = useRequirementAnalysis()
const { 
  isGenerating, 
  isAnalyzing, 
  isSaving, 
  hasChart, 
  hasData, 
  currentRequirement, 
  analysisResult, 
  chartConfig,
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
} = useAppState()

// 响应式数据
const analysisMode = ref('single') // 'single' 或 'dual'
const dateRange = ref([dayjs().subtract(6, 'day'), dayjs()]) // 默认最近7天
const pageSelectionModalVisible = ref(false) // 页面选择弹窗
const currentAnalysisType = ref('') // 当前分析类型
const isPreloading = ref(false) // 预加载状态
const modalAnalysisType = ref('') // 弹窗中的分析类型
const modalAvailablePages = ref([]) // 弹窗中的可用页面列表

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
const apiConfig = computed(() => store.state.apiConfig)
const currentDate = computed(() => new Date().toLocaleDateString())



// 需求解析器（会根据配置动态初始化）
let requirementParser = null

// 监听页面选择弹窗事件
const handlePageSelectionModalEvent = (event) => {
  console.log('收到页面选择弹窗事件:', event.detail)
  const { availablePages, analysisType, scope } = event.detail
  
  // 设置分析类型
  modalAnalysisType.value = analysisType
  
  // 更新弹窗中的可用页面列表
  if (availablePages && availablePages.length > 0) {
    console.log('更新弹窗可用页面列表，数量:', availablePages.length)
    modalAvailablePages.value = availablePages
  } else {
    console.log('没有可用页面数据')
    modalAvailablePages.value = []
  }
  
  // 显示弹窗
  pageSelectionModalVisible.value = true
}

// 监听关闭页面选择弹窗事件
const handleClosePageSelectionModalEvent = () => {
  console.log('收到关闭页面选择弹窗事件')
  pageSelectionModalVisible.value = false
}

// 生命周期
onMounted(() => {
  initializeSystem()
  
  // 添加事件监听器
  window.addEventListener('show-page-selection-modal', handlePageSelectionModalEvent)
  window.addEventListener('close-page-selection-modal', handleClosePageSelectionModalEvent)
  
  // 🚀 临时禁用自动缓存健康检查，避免阻塞保存过程
  // setTimeout(() => {
  //   startAutoCheck()
  // }, 2000)
})

// 组件卸载时清理事件监听器
onUnmounted(() => {
  window.removeEventListener('show-page-selection-modal', handlePageSelectionModalEvent)
  window.removeEventListener('close-page-selection-modal', handleClosePageSelectionModalEvent)
})

// initializeSystem 方法已移动到 useAppState composable


// handleChatAnalysis 方法已移动到 useChatAnalysis composable

// analyzeButtonClickRequirement 方法已移动到 useRequirementAnalysis composable

// analyzeQueryConditionRequirement 方法已移动到 useRequirementAnalysis composable

// analyzeRequirement 方法已移动到 useRequirementAnalysis composable




// onDateRangeChange 方法已移动到 useDataFetch composable

// refreshData 方法已移动到 useDataFetch composable

// showConfigModal 方法已移动到 useAppState composable

// handleMenuClick 方法已移动到 useAppState composable

// triggerManualPreload 方法已移动到 useDataFetch composable


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

// selectPageForAnalysis 方法已移动到 useRequirementAnalysis composable

// clearRequirement 方法已移动到 useAppState composable


// saveChartToLibrary 方法已移动到 useChartSave composable

// handleTimeRangeChange 方法已移动到 useChart composable

// 处理编辑漏斗配置
const handleEditFunnelConfig = () => {
  
  // 触发漏斗步骤配置抽屉打开
  // 这里需要与 AIChatInterface 组件通信
  // 由于 AIChatInterface 在左侧，我们需要通过事件或状态管理来打开抽屉
  
  // 方案1：通过 store 状态管理
  store.commit('SET_FUNNEL_CONFIG_DRAWER_VISIBLE', true)
  
  // 方案2：通过事件总线（如果需要的话）
  // eventBus.emit('open-funnel-config-drawer')
  
  message.info('正在打开漏斗配置编辑器...')
}

// fetchDataForDateRange 和 fetchDayData 方法已移动到 useDataFetch composable

// 根据分析类型获取分类
const getCategoryByAnalysisType = (analysisType) => {
  const categoryMap = {
    'page_analysis': '页面分析',
    'click_analysis': '用户行为',
    'behavior_analysis': '用户行为',
    'query_condition_analysis': '查询条件分析'
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
