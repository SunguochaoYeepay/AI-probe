<template>
  <div class="ai-chat-container">
    <!-- 漏斗步骤配置抽屉 -->
        <FunnelStepConfigDrawer
          v-model:open="showFunnelConfig"
          :initial-steps="funnelSteps"
          :available-pages="availablePages"
          :page-buttons="pageButtons"
          @save="handleFunnelStepsSaveWrapper"
        />
    <!-- 配置选择区域 -->
    <div class="config-section">
      <!-- 分析时间部分已隐藏，默认使用近7天 -->
      
      <div class="config-item">
        <span class="config-label">分析类型：</span>
        <a-select
          v-model:value="selectedAnalysisType"
          placeholder="请选择分析类型"
          size="small"
          @change="onAnalysisTypeChange"
        >
          <a-select-option value="page_analysis">页面分析</a-select-option>
          <a-select-option value="click_analysis">点击分析</a-select-option>
          <a-select-option value="query_analysis">查询条件分析</a-select-option>
          <a-select-option value="behavior_analysis">行为分析</a-select-option>
        </a-select>
      </div>
      
      <div class="config-item">
        <span class="config-label">分析埋点：</span>
        <!-- 单选模式 -->
        <a-select
          v-if="allBuryPoints.length > 0 && selectedAnalysisType !== 'behavior_analysis'"
          v-model:value="selectedBuryPointId"
          placeholder="请选择分析埋点"
          size="small"
          @change="onBuryPointChange"
        >
          <a-select-option
            v-for="point in allBuryPoints"
            :key="point.id"
            :value="point.id"
          >
            {{ point.name }} (ID: {{ point.id }})
          </a-select-option>
        </a-select>
        
        <!-- 多选模式（行为分析） -->
        <a-select
          v-if="allBuryPoints.length > 0 && selectedAnalysisType === 'behavior_analysis'"
          v-model:value="selectedBuryPointIds"
          mode="multiple"
          placeholder="请选择分析埋点（支持多选）"
          size="small"
          @change="onBuryPointChange"
        >
          <a-select-option
            v-for="point in allBuryPoints"
            :key="point.id"
            :value="point.id"
          >
            {{ point.name }} (ID: {{ point.id }})
          </a-select-option>
        </a-select>
        
        <!-- 配置埋点按钮 -->
        <a-button 
          v-if="allBuryPoints.length === 0"
          type="dashed" 
          size="small"
          @click="$emit('show-config-modal')"
        >
          请先配置埋点
        </a-button>
      </div>
      
      <div class="config-actions">
        <a-tooltip title="清空对话">
          <a-button size="small" @click="clearChatWrapper">
            <ClearOutlined />
          </a-button>
        </a-tooltip>
      </div>
    </div>

    <!-- 聊天消息区域 -->
    <div class="chat-messages" ref="messagesContainer">
      <div 
        v-for="message in messages" 
        :key="message.id"
        :class="['message', message.type]"
      >
        <div class="message-avatar">
          <RobotOutlined v-if="message.type === 'ai'" />
          <UserOutlined v-else />
        </div>
        <div class="message-content">
          <div class="message-text" v-html="formatMessage(message.content)"></div>
          
          <!-- AI消息的操作按钮 -->
          <div v-if="message.type === 'ai' && message.actions" class="message-actions">
            <a-button 
              v-for="action in message.actions" 
              :key="action.text"
              size="small" 
              type="primary" 
              ghost
              @click="handleAction(action)"
              :wave="false"
            >
              {{ action.text }}
            </a-button>
          </div>
          
          <div class="message-time">{{ formatTime(message.timestamp) }}</div>
        </div>
      </div>
      
      <!-- AI正在思考 -->
      <div v-if="isAIThinking" class="message ai">
        <div class="message-avatar">
          <RobotOutlined />
        </div>
        <div class="message-content">
          <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷提示 -->
    <div v-if="messages.length === 0" class="quick-suggestions">
      <div class="suggestions-title">💡 您可以这样开始：</div>
      <div class="suggestions-list">
        <a-tag 
          v-for="suggestion in quickSuggestions" 
          :key="suggestion"
          class="suggestion-tag"
          @click="() => sendMessage(suggestion)"
        >
          {{ suggestion }}
        </a-tag>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="chat-input">
      <a-textarea
        v-model:value="inputMessage"
        placeholder="请描述您想要的分析需求..."
        :rows="3"
        :maxlength="500"
        @keydown.enter.prevent="handleEnterKey"
      />
      <div class="input-actions">
        <a-button 
          type="primary" 
          @click="() => sendMessage()"
          :loading="isAIThinking"
          :disabled="!inputMessage.trim()"
          :wave="false"
        >
          <SendOutlined />
          发送
        </a-button>
      </div>
    </div>
    
    <!-- 按钮选择弹窗 -->
    <ButtonSelectionModal
      v-model:open="buttonSelectionModalVisible"
      :page-name="selectedPageName"
      :buttons="availableButtons"
      :selection-type="currentSelectionType"
      @select-button="handleButtonSelectionWrapper"
      @select-multiple-conditions="handleMultipleConditionsSelectionWrapper"
      @update:open="handleButtonSelectionModalClose"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { 
  RobotOutlined, 
  UserOutlined, 
  ClearOutlined, 
  SendOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { useStore } from 'vuex'
import ButtonSelectionModal from '@/components/ButtonSelectionModal.vue'
import FunnelStepConfigDrawer from '@/components/FunnelStepConfigDrawer.vue'
import { useAIChat } from '@/composables/useAIChat'
import { useBuryPointConfig } from '@/composables/useBuryPointConfig'
import { usePageDataManager } from '@/composables/usePageDataManager'
import { useMessageHandler } from '@/composables/useMessageHandler'
import { useActionHandler } from '@/composables/useActionHandler'
import { useRequirementAnalysis } from '@/composables/useRequirementAnalysis'

// Props
const props = defineProps({
  dateRange: {
    type: Array,
    default: () => [dayjs().subtract(7, 'day'), dayjs()]
  }
})

// Emits
const emit = defineEmits([
  'date-range-change',
  'analyze-requirement',
  'clear-requirement',
  'show-page-selection',
  'show-config-modal'
])

// 使用composables
const store = useStore()

// AI聊天核心功能
const {
  messages,
  inputMessage,
  isAIThinking,
  messagesContainer,
  quickSuggestions,
  formatTime,
  formatMessage,
  addMessage,
  scrollToBottom,
  handleEnterKey,
  clearChat,
  loadChatHistory
} = useAIChat()

// 需求分析功能
const { analyzeBehaviorRequirement } = useRequirementAnalysis()

// 埋点配置管理
const {
  selectedBuryPointId,
  selectedBuryPointIds,
  selectedAnalysisType,
  allBuryPoints,
  getCurrentBuryPointType,
  getBuryPointTypeById,
  onBuryPointChange,
  onAnalysisTypeChange,
  updateWelcomeMessageForBuryPointType
} = useBuryPointConfig(addMessage)

// 页面和按钮数据管理
const {
  buttonSelectionModalVisible,
  selectedPageName,
  availableButtons,
  currentSelectionType,
  showFunnelConfig,
  funnelSteps,
  pendingFunnelAnalysis,
  availablePages,
  pageButtons,
  getAvailableFields,
  getFieldAlias,
  getSamplePages,
  checkPageExistsWithAI,
  getAvailablePages,
  checkPageExists,
  loadAvailablePages,
  loadPageButtons,
  debugButtonData,
  reloadButtonData,
  onFunnelStepsSave
} = usePageDataManager()

// 消息处理和AI响应
const {
  extractPageNameWithAI,
  detectAnalysisTypeWithAI,
  analyzeWithAI,
  generateAIResponse,
  checkIfInputtingPageInfo,
  handleFallbackRecognition
} = useMessageHandler()

// 动作处理器
const {
  handleAnalysisTypeSelection,
  handlePageSelection,
  handleCustomConversion,
  handleInputPage,
  handleShowPageList,
  handleButtonSelection,
  handleMultipleConditionsSelection,
  handleSelectPageForButtons,
  handleSelectPageForQueries,
  handleShowAllPages,
  handleShowPageBatch,
  handleTriggerPreload,
  handleShowConfig
} = useActionHandler(selectedBuryPointId)

// 计算属性
const dateRange = computed({
  get: () => props.dateRange,
  set: (value) => {
    console.log('AIChatInterface: dateRange computed set 被调用', { value })
    // 当通过 v-model 设置时，触发日期范围变更事件
    // 注意：这里 value 是 dayjs 对象数组，需要转换为字符串数组
    const dateStrings = value ? value.map(date => date.format('YYYY-MM-DD')) : []
    console.log('AIChatInterface: 发送 date-range-change 事件', { value, dateStrings })
    emit('date-range-change', value, dateStrings)
  }
})

// 发送消息的核心逻辑
const sendMessage = async (text = null) => {
  // 确保text参数是字符串类型
  let messageText
  if (text !== null) {
    messageText = typeof text === 'string' ? text : String(text || '')
  } else {
    messageText = inputMessage.value.trim()
  }
  
  if (!messageText) return

  // 添加用户消息
  addMessage(messageText, 'user')
  
  // 清空输入框
  if (!text) {
    inputMessage.value = ''
  }

  // AI 思考状态
  isAIThinking.value = true

  try {
    // 优先使用AI识别用户意图
    console.log('🤖 尝试AI识别用户意图...')
    const aiResponse = await analyzeWithAI(messageText, messages, dateRange)
    
    // 检测AI是否真正理解了用户意图
    const isAISuccessful = aiResponse && aiResponse.content && 
      !aiResponse.content.includes('抱歉') && 
      !aiResponse.content.includes('无法理解') &&
      !aiResponse.content.includes('需要更多的上下文') &&
      !aiResponse.content.includes('可能需要更多') &&
      !aiResponse.content.includes('更多信息') &&
      (aiResponse.actions && aiResponse.actions.length > 0)
    
    // 额外检查：如果用户输入包含特定页面名称，但AI返回的是通用按钮，则使用降级逻辑
    const extractedPageName = await extractPageNameWithAI(messageText)
    const hasSpecificPage = extractedPageName !== null
    const hasGenericButtons = aiResponse?.actions?.some(action => {
      // 使用AI智能判断是否是通用按钮
      const genericKeywords = ['分析页面访问量', '显示访问趋势', '分析页面访问', '查看访问趋势', '页面访问量', '访问趋势']
      return genericKeywords.some(keyword => action.text.includes(keyword))
    })
    
    const shouldUseFallback = hasSpecificPage && hasGenericButtons
    
    if (isAISuccessful && !shouldUseFallback) {
      // AI成功识别，使用AI回复
      console.log('✅ AI识别成功，有具体操作建议')
      addMessage(aiResponse.content, 'ai', aiResponse.actions)
    } else {
      // AI需要澄清、没有提供具体操作，或返回了通用按钮，使用编码识别快速响应
      if (shouldUseFallback) {
        console.log('🎯 检测到特定页面但AI返回通用按钮，使用编码识别生成具体按钮...')
      } else {
        console.log('💬 AI需要澄清需求，使用编码识别快速响应...')
      }
      console.log('AI回复内容:', aiResponse?.content)
      const fallbackResponse = await handleFallbackRecognition(messageText, addMessage, emit)
      if (fallbackResponse) {
      addMessage(fallbackResponse.content, 'ai', fallbackResponse.actions)
      }
    }
    
  } catch (error) {
    console.error('AI服务调用失败:', error)
    // AI服务完全失败，使用编码识别兜底
    console.log('🚨 AI服务不可用，使用编码识别兜底...')
    try {
      const fallbackResponse = await handleFallbackRecognition(messageText, addMessage, emit)
      if (fallbackResponse) {
      addMessage(fallbackResponse.content, 'ai', fallbackResponse.actions)
      }
    } catch (fallbackError) {
      console.error('编码识别也失败:', fallbackError)
      addMessage('抱歉，我遇到了一些问题。请稍后再试或重新描述您的需求。', 'ai')
    }
  } finally {
    isAIThinking.value = false
  }
}

// 动作处理
const handleAction = async (action) => {
  if (action.type === 'select_analysis') {
    // 用户选择了分析类型，引导具体配置
    await handleAnalysisTypeSelection(action.params, addMessage)
  } else if (action.type === 'page_selection') {
    // 需要用户选择页面
    await handlePageSelection(action.params, addMessage)
  } else if (action.type === 'custom_conversion') {
    // 自定义转化路径
    await handleCustomConversion(action.params, addMessage)
  } else if (action.type === 'input_page') {
    // 引导用户输入页面信息
    await handleInputPage(action.params, addMessage)
  } else if (action.type === 'show_page_list') {
    // 显示页面列表供用户选择
    await handleShowPageList(action.params, addMessage, dateRange)
  } else if (action.type === 'select_page_for_buttons') {
    // 选择页面进行按钮分析
    await handleSelectPageForButtons(action.params, selectedPageName, availableButtons, currentSelectionType, buttonSelectionModalVisible, dateRange, addMessage)
  } else if (action.type === 'select_page_for_queries') {
    // 选择页面进行查询条件分析
    await handleSelectPageForQueries(action.params, selectedPageName, availableButtons, currentSelectionType, buttonSelectionModalVisible, dateRange, addMessage)
  } else if (action.type === 'show_all_pages') {
    // 显示所有页面列表
    await handleShowAllPages(action.params, addMessage)
  } else if (action.type === 'show_page_batch') {
    // 显示指定批次的页面
    await handleShowPageBatch(action.params, addMessage)
  } else if (action.type === 'trigger_preload') {
    // 触发数据预加载
    await handleTriggerPreload(action.params, addMessage)
  } else if (action.type === 'show_config') {
    // 显示配置设置
    await handleShowConfig(action.params, addMessage, dateRange)
  } else if (action.type === 'acknowledge') {
    // 用户确认了解
    addMessage('好的，请按照提示进行操作。如果需要帮助，随时可以继续对话。', 'ai')
  } else if (action.type === 'open_config') {
    // 打开配置管理
    emit('show-config-modal')
    addMessage('已为您打开配置管理界面，请检查并保存配置后重试。', 'ai')
  } else if (action.type === 'analyze') {
    // 检查是否是漏斗分析
    if (action.params?.type === 'behavior_funnel') {
      // 保存待执行的漏斗分析请求
      pendingFunnelAnalysis.value = action.params
      // 先获取页面列表，然后弹出漏斗步骤配置抽屉
      await loadAvailablePages()
      showFunnelConfig.value = true
    } else if (action.params?.type === 'behavior_path') {
      // 直接执行行为路径分析
      console.log('🔍 [handleAction] 执行行为路径分析:', action.params)
      emit('analyze-requirement', action.params)
    } else {
      // 触发分析
      emit('analyze-requirement', action.params)
      
      // 添加确认消息
      addMessage(`好的，我开始为您分析${action.text}。`, 'ai')
    }
  } else if (action.type === 'clarify') {
    // 需求澄清
    addMessage('请重新描述您的需求，我会更好地理解您想要的分析内容。', 'ai')
  }
}

// 处理按钮选择
const handleButtonSelectionWrapper = (button) => {
  handleButtonSelection(button, selectedPageName.value, currentSelectionType.value, buttonSelectionModalVisible, emit, addMessage)
}

// 处理多条件选择
const handleMultipleConditionsSelectionWrapper = (selectedItems) => {
  handleMultipleConditionsSelection(selectedItems, selectedPageName.value, emit, addMessage)
}

// 处理漏斗步骤配置保存
const handleFunnelStepsSaveWrapper = (steps) => {
  onFunnelStepsSave(steps, emit, addMessage)
}

// 处理页面选择按钮分析事件
const handleSelectPageForButtonsEvent = async (event) => {
  const { pageName } = event.detail
  console.log('收到按钮分析页面选择事件:', pageName)
  
  // 调用按钮分析处理函数
  await handleSelectPageForButtons(
    { pageName }, 
    selectedPageName, 
    availableButtons, 
    currentSelectionType, 
    buttonSelectionModalVisible, 
    dateRange, 
    addMessage
  )
}

// 处理页面选择查询条件分析事件
const handleSelectPageForQueriesEvent = async (event) => {
  const { pageName } = event.detail
  console.log('收到查询条件分析页面选择事件:', pageName)
  
  // 调用查询条件分析处理函数
  await handleSelectPageForQueries(
    { pageName }, 
    selectedPageName, 
    availableButtons, 
    currentSelectionType, 
    buttonSelectionModalVisible, 
    dateRange, 
    addMessage
  )
}

// 初始化欢迎消息
const showWelcomeMessage = () => {
  console.log('showWelcomeMessage - 开始显示欢迎消息')
  console.log('showWelcomeMessage - selectedBuryPointId.value:', selectedBuryPointId.value)
  console.log('showWelcomeMessage - selectedAnalysisType.value:', selectedAnalysisType.value)
  console.log('showWelcomeMessage - store.state.projectConfig:', store.state.projectConfig)
  
  // 优先根据分析类型显示消息
  if (selectedAnalysisType.value) {
    console.log('showWelcomeMessage - 根据分析类型显示消息:', selectedAnalysisType.value)
    
    let welcomeContent = ''
    let welcomeActions = []
    
    switch (selectedAnalysisType.value) {
      case 'page_analysis':
        welcomeContent = `📊 页面访问分析

请选择您要分析的页面范围：`
        
        welcomeActions = [
          { 
            text: '选择页面分析', 
            type: 'show_page_list', 
            params: { type: 'page_visits', scope: 'specific', description: '分析特定页面的访问趋势' } 
          }
        ]
        break
        
      case 'click_analysis':
        welcomeContent = `🖱️ 点击分析模式

请选择您要分析点击行为的页面：`
        
        welcomeActions = [
          { 
            text: '选择分析页面', 
            type: 'show_page_list', 
            params: { type: 'user_click', scope: 'page' } 
          }
        ]
        break
        
      case 'query_analysis':
        welcomeContent = `🔍 查询条件分析模式

请选择您要分析查询条件的页面：`
        
        welcomeActions = [
          { 
            text: '选择分析页面', 
            type: 'show_page_list', 
            params: { type: 'query_condition', scope: 'page' } 
          }
        ]
        break
        
      case 'behavior_analysis':
        welcomeContent = `🔄 行为分析模式

现在为您提供用户行为分析相关的选项：`
        
        welcomeActions = [
          { 
            text: '🛤️ 用户行为路径', 
            type: 'analyze', 
            params: { type: 'behavior_path', scope: 'path' } 
          },
          { 
            text: '🎯 行为转化漏斗', 
            type: 'analyze', 
            params: { type: 'behavior_funnel', scope: 'funnel' } 
          }
        ]
        break
        
      default:
        // 如果没有匹配的分析类型，回退到埋点类型逻辑
        const currentBuryPointType = getCurrentBuryPointType()
        console.log('showWelcomeMessage - 回退到埋点类型逻辑:', currentBuryPointType)
        
        if (currentBuryPointType === '访问') {
          welcomeContent = `📊 页面访问分析

请选择您要分析的页面范围：`

          welcomeActions = [
            { 
              text: '选择页面分析', 
              type: 'show_page_list', 
              params: { type: 'page_visits', scope: 'specific' } 
            }
          ]
        } else if (currentBuryPointType === '点击') {
          welcomeContent = `🖱️ 用户点击分析

请选择您要分析的页面范围：`

          welcomeActions = [
            { 
              text: '选择分析页面', 
              type: 'show_page_list', 
              params: { type: 'user_click', scope: 'page' } 
            }
          ]
        } else {
          // 默认情况 - 显示所有分析类型
          welcomeContent = `您好！我是您的AI需求分析师。我将帮助您明确数据分析需求。

请选择您想要进行的分析类型：`

          welcomeActions = [
            { 
              text: '📊 页面访问分析', 
              type: 'select_analysis', 
              params: { type: 'page_visit', description: '分析页面的访问量、UV/PV趋势等' } 
            },
            { 
              text: '🖱️ 用户点击分析', 
              type: 'select_analysis', 
              params: { type: 'user_click', description: '分析用户点击行为、按钮热度等' } 
            },
            { 
              text: '🔄 行为转化分析', 
              type: 'select_analysis', 
              params: { type: 'conversion', description: '分析用户行为路径和转化漏斗' } 
            }
          ]
        }
    }
    
    addMessage(welcomeContent, 'ai', welcomeActions)
    return
  }
  
  // 如果没有选择分析类型，回退到原来的埋点类型逻辑
  const currentBuryPointType = getCurrentBuryPointType()
  console.log('showWelcomeMessage - 当前埋点类型:', currentBuryPointType)
  
  let welcomeContent = ''
  let welcomeActions = []

  if (currentBuryPointType === '访问') {
    // 访问埋点类型 - 直接显示页面访问分析选项
    welcomeContent = `📊 页面访问分析

请选择您要分析的页面范围：`

    welcomeActions = [
      { 
        text: '选择页面分析', 
        type: 'show_page_list', 
        params: { type: 'page_visits', scope: 'specific' } 
      }
    ]
  } else if (currentBuryPointType === '点击') {
    // 点击埋点类型 - 直接显示按钮点击分析选项
    welcomeContent = `🖱️ 用户点击分析

请选择您要分析的页面范围：`

    welcomeActions = [
      { 
        text: '选择分析页面', 
        type: 'show_page_list', 
        params: { type: 'user_click', scope: 'page' } 
      }
    ]
  } else {
    // 默认情况 - 显示所有分析类型
    welcomeContent = `您好！我是您的AI需求分析师。我将帮助您明确数据分析需求。

请选择您想要进行的分析类型：`

    welcomeActions = [
      { 
        text: '📊 页面访问分析', 
        type: 'select_analysis', 
        params: { type: 'page_visit', description: '分析页面的访问量、UV/PV趋势等' } 
      },
      { 
        text: '🖱️ 用户点击分析', 
        type: 'select_analysis', 
        params: { type: 'user_click', description: '分析用户点击行为、按钮热度等' } 
      },
      { 
        text: '🔄 行为转化分析', 
        type: 'select_analysis', 
        params: { type: 'conversion', description: '分析用户行为路径和转化漏斗' } 
      }
    ]
  }

  addMessage(welcomeContent, 'ai', welcomeActions)
}

// 初始化组件
onMounted(() => {
  // 初始化分析类型（从store中恢复）
  const storeAnalysisType = store.state.apiConfig.selectedAnalysisType
  if (storeAnalysisType) {
    selectedAnalysisType.value = storeAnalysisType
    console.log('从store恢复分析类型:', storeAnalysisType)
  }
  
  // 初始化埋点选择（支持新的分离配置）
  const projectConfig = store.state.projectConfig
  let initialBuryPointId = null
  
  if (projectConfig.visitBuryPointId || projectConfig.clickBuryPointId || (projectConfig.behaviorBuryPointIds && projectConfig.behaviorBuryPointIds.length > 0)) {
    // 优先使用当前已选择的埋点
    const currentSelectedId = store.state.apiConfig.selectedPointId
    const allConfiguredIds = [
      projectConfig.visitBuryPointId,
      projectConfig.clickBuryPointId,
      ...(projectConfig.behaviorBuryPointIds || [])
    ].filter(Boolean)
    
    if (currentSelectedId && allConfiguredIds.includes(currentSelectedId)) {
      initialBuryPointId = currentSelectedId
      console.log('使用当前已选择的埋点:', initialBuryPointId)
    } else {
      // 如果没有当前选择，检查localStorage中的默认埋点类型偏好
      const defaultBuryPointType = localStorage.getItem('defaultBuryPointType')
      console.log('检查localStorage中的偏好设置:', defaultBuryPointType)
      console.log('可用的埋点配置:', {
        visitBuryPointId: projectConfig.visitBuryPointId,
        clickBuryPointId: projectConfig.clickBuryPointId,
        behaviorBuryPointIds: projectConfig.behaviorBuryPointIds
      })
      
      if (defaultBuryPointType === 'click' && projectConfig.clickBuryPointId) {
        // 用户偏好点击埋点
        initialBuryPointId = projectConfig.clickBuryPointId
        console.log('使用用户偏好的点击埋点:', initialBuryPointId)
      } else if (defaultBuryPointType === 'visit' && projectConfig.visitBuryPointId) {
        // 用户偏好访问埋点
        initialBuryPointId = projectConfig.visitBuryPointId
        console.log('使用用户偏好的访问埋点:', initialBuryPointId)
      } else if (defaultBuryPointType === 'behavior' && projectConfig.behaviorBuryPointIds && projectConfig.behaviorBuryPointIds.length > 0) {
        // 用户偏好行为分析埋点
        initialBuryPointId = projectConfig.behaviorBuryPointIds[0]
        console.log('使用用户偏好的行为分析埋点:', initialBuryPointId)
      } else {
        // 默认优先使用点击埋点，如果没有则使用访问埋点，最后使用行为分析埋点
        initialBuryPointId = projectConfig.clickBuryPointId || 
                           projectConfig.visitBuryPointId || 
                           (projectConfig.behaviorBuryPointIds && projectConfig.behaviorBuryPointIds[0])
        console.log('使用默认埋点选择（优先点击埋点）:', initialBuryPointId)
        console.log('埋点配置详情:', {
          defaultBuryPointType,
          clickBuryPointId: projectConfig.clickBuryPointId,
          visitBuryPointId: projectConfig.visitBuryPointId,
          behaviorBuryPointIds: projectConfig.behaviorBuryPointIds,
          hasClickPoint: !!projectConfig.clickBuryPointId,
          hasVisitPoint: !!projectConfig.visitBuryPointId,
          hasBehaviorPoints: !!(projectConfig.behaviorBuryPointIds && projectConfig.behaviorBuryPointIds.length > 0)
        })
        
        // 如果选择了点击埋点，立即更新store
        if (initialBuryPointId === projectConfig.clickBuryPointId) {
          store.dispatch('updateApiConfig', {
            selectedPointId: initialBuryPointId
          })
          console.log('✅ 已更新store中的selectedPointId为点击埋点:', initialBuryPointId)
        }
      }
    }
  } else {
    // 回退到旧的配置方式
    const selectedIds = projectConfig?.selectedBuryPointIds || []
    if (selectedIds.length > 0) {
      initialBuryPointId = selectedIds[0]
      console.log('使用旧配置的埋点选择:', initialBuryPointId)
    }
  }
  
  // 设置初始埋点选择
  if (initialBuryPointId) {
    selectedBuryPointId.value = initialBuryPointId
    console.log('初始化埋点选择完成:', initialBuryPointId)
  } else {
    // 如果没有找到合适的埋点，强制设置默认选择点击埋点
    console.log('未找到合适的埋点，尝试强制设置默认选择')
    
    // 检查是否有点击埋点可用
    if (projectConfig.clickBuryPointId) {
      selectedBuryPointId.value = projectConfig.clickBuryPointId
      console.log('强制设置点击埋点为默认选择:', projectConfig.clickBuryPointId)
      
      // 同时更新store中的选择
      store.dispatch('updateApiConfig', {
        selectedPointId: projectConfig.clickBuryPointId
      })
    } else if (projectConfig.visitBuryPointId) {
      selectedBuryPointId.value = projectConfig.visitBuryPointId
      console.log('强制设置访问埋点为默认选择:', projectConfig.visitBuryPointId)
      
      // 同时更新store中的选择
      store.dispatch('updateApiConfig', {
        selectedPointId: projectConfig.visitBuryPointId
      })
    }
  }
  
  // 如果是行为分析模式，初始化多选埋点
  if (selectedAnalysisType.value === 'behavior_analysis') {
    const defaultSelectedIds = []
    
    // 优先添加按钮点击埋点
    if (projectConfig.clickBuryPointId) {
      defaultSelectedIds.push(projectConfig.clickBuryPointId)
    }
    
    // 添加页面访问埋点
    if (projectConfig.visitBuryPointId) {
      defaultSelectedIds.push(projectConfig.visitBuryPointId)
    }
    
    if (defaultSelectedIds.length > 0) {
      selectedBuryPointIds.value = defaultSelectedIds
      console.log('行为分析模式初始化多选埋点（优先点击埋点）:', defaultSelectedIds)
      
      // 同时设置单选埋点为点击埋点（用于显示）
      if (projectConfig.clickBuryPointId) {
        selectedBuryPointId.value = projectConfig.clickBuryPointId
        console.log('✅ 行为分析模式：设置单选埋点为点击埋点:', projectConfig.clickBuryPointId)
      }
    }
  }
  
  // 加载聊天历史，如果没有历史记录则根据默认埋点类型显示提示词
  const hasHistory = loadChatHistory()
  console.log('onMounted - 是否有聊天历史:', hasHistory)
  if (!hasHistory) {
    console.log('onMounted - 没有聊天历史，根据默认埋点类型显示提示词')
    showWelcomeMessage()
  } else {
    console.log('onMounted - 有聊天历史，跳过显示欢迎消息')
  }
  
  // 添加事件监听器
  window.addEventListener('select-page-for-buttons', handleSelectPageForButtonsEvent)
  window.addEventListener('select-page-for-queries', handleSelectPageForQueriesEvent)
})

// 组件卸载时清理事件监听器
onUnmounted(() => {
  window.removeEventListener('select-page-for-buttons', handleSelectPageForButtonsEvent)
  window.removeEventListener('select-page-for-queries', handleSelectPageForQueriesEvent)
})



// 清空聊天记录
const clearChatWrapper = () => {
  clearChat()
  
  // 清空后根据当前埋点类型显示提示词
  setTimeout(() => {
    showWelcomeMessage()
  }, 100)
}

// 处理按钮选择弹窗的关闭
const handleButtonSelectionModalClose = () => {
  buttonSelectionModalVisible.value = false
}

// 处理漏斗步骤配置弹窗的关闭
const handleFunnelConfigClose = () => {
  showFunnelConfig.value = false
}

// 🚀 监听配置加载完成，自动设置默认埋点选择
watch(
  () => [
    store.state.projectConfig.visitBuryPointId,
    store.state.projectConfig.clickBuryPointId,
    selectedAnalysisType.value
  ],
  ([visitBuryPointId, clickBuryPointId, analysisType]) => {
    // 只在配置加载完成且当前没有选择埋点时设置默认值
    if (selectedBuryPointId.value !== null) {
      return // 已经有选择，不覆盖
    }
    
    // 只有当配置存在时才设置默认值
    if (!visitBuryPointId && !clickBuryPointId) {
      return // 配置还未加载完成
    }
    
    console.log('🔍 检测到配置已加载，自动设置默认埋点选择', {
      visitBuryPointId,
      clickBuryPointId,
      analysisType,
      currentSelected: selectedBuryPointId.value
    })
    
    // 根据分析类型选择默认埋点
    let defaultPointId = null
    
    switch (analysisType) {
      case 'page_analysis':
        // 页面分析默认使用访问埋点
        defaultPointId = visitBuryPointId
        break
      case 'click_analysis':
      case 'query_analysis':
        // 点击分析和查询条件分析默认使用点击埋点
        defaultPointId = clickBuryPointId
        break
      case 'behavior_analysis':
        // 行为分析默认使用点击埋点
        defaultPointId = clickBuryPointId || visitBuryPointId
        break
      default:
        // 默认优先使用点击埋点，如果没有则使用访问埋点
        defaultPointId = clickBuryPointId || visitBuryPointId
    }
    
    if (defaultPointId) {
      selectedBuryPointId.value = defaultPointId
      console.log('✅ 自动设置默认埋点选择:', defaultPointId, '（分析类型:', analysisType, '）')
      
      // 同时更新store中的选择
      store.dispatch('updateApiConfig', {
        selectedPointId: defaultPointId
      })
    }
  },
  { immediate: true } // 立即执行一次，处理配置已加载的情况
)

// 监听 store 中的漏斗配置抽屉状态
watch(() => store.state.funnelConfigDrawerVisible, (newValue) => {
  if (newValue) {
    // 从当前图表配置中提取漏斗步骤数据
    const chartConfig = store.state.chartConfig
    if (chartConfig && chartConfig.analysis && chartConfig.analysis.funnelSteps) {
      // 将图表配置中的漏斗步骤数据设置到 funnelSteps 中
      funnelSteps.value = chartConfig.analysis.funnelSteps
      console.log('从图表配置中提取漏斗步骤数据:', funnelSteps.value)
    }
    
    showFunnelConfig.value = true
    // 重置 store 状态
    store.commit('SET_FUNNEL_CONFIG_DRAWER_VISIBLE', false)
  }
})

// 导出必要的方法供模板使用
defineExpose({
  clearChat: clearChatWrapper,
  reloadButtonData
})
</script>

<style scoped>
.ai-chat-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  border: none;
  box-shadow: none;
}

.chat-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 8px 0 4px 0;
  margin-bottom: 8px;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-icon {
  font-size: 24px;
  color: #1890ff;
}

.header-text {
  flex: 1;
}

.chat-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color, #262626);
}

.chat-subtitle {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: var(--text-color-secondary, #8c8c8c);
}

.config-section {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 16px;;
  background: var(--bg-color-light, #fafafa);
  flex-wrap: wrap;
  padding: 20px;
  border: 1px solid var(--border-color, #e8e8e8);
  border-radius: 8px;
  margin-bottom: 16px;
}

/* 暗色主题支持 */
.dark-theme .config-section {
  background: #1f1f1f !important;
  border: 1px solid #303030 !important;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 180px;
}

.config-item-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.config-actions {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.config-label {
  font-size: 14px;
  color: var(--text-color, #262626);
  font-weight: 500;
  margin-bottom: 2px;
}


.chat-messages {
  flex: 1;
  overflow-y: auto;
  max-height: calc(100vh - 400px);
  margin-bottom: 16px;
  width: 100%;
  overflow-x: hidden;
  padding: 16px;
}

.message {
  display: flex;
  margin-bottom: 16px;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.message.user .message-avatar {
  background: #1890ff;
  color: white;
}

.message.ai .message-avatar {
  background: #f0f0f0;
  color: #666;
}

/* 暗色主题支持 */
.dark-theme .message.ai .message-avatar {
  background: #303030 !important;
  color: #cccccc !important;
}

.message-content {
  flex: 1;
  min-width: 0;
  max-width: calc(100% - 44px);
  overflow: hidden;
}

.message-text {
  background: var(--bg-color, #f8f9fa);
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-color, #262626);
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  max-width: 100%;
  overflow: hidden;
  border: 1px solid var(--border-color, #e8e9ea);
}

.message.ai .message-text {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.message.ai .message-actions {
  background: var(--bg-color, #f8f9fa);
  margin: 0;
  padding: 12px 16px;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
  border: 1px solid var(--border-color, #e8e9ea);
  border-top: none;
}

.message.user .message-text {
  background: #1890ff;
  color: white;
}

.message-time {
  font-size: 11px;
  color: var(--text-color-secondary, #8c8c8c);
  margin-top: 8px;
  margin-left: 16px;
  text-align: right;
}

.message-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  max-width: 100%;
  overflow: hidden;
}

.message-actions .ant-btn {
  min-height: 32px;
  padding: 4px 12px;
  font-size: 13px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid #e8e9ea;
  background: #f8f9fa;
  transition: all 0.2s;
  color: #1890ff;
}

.message-actions .ant-btn:hover {
  border-color: #1890ff;
  background: #e6f7ff;
  color: #1890ff;
  transform: translateY(-1px);
}

.message-actions .ant-btn span {
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1890ff;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.quick-suggestions {
  text-align: center;
  padding: 20px 0;
}

.suggestions-title {
  font-size: 14px;
  color: var(--text-color-secondary, #8c8c8c);
  margin-bottom: 12px;
}

.suggestions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.suggestion-tag {
  cursor: pointer;
  transition: all 0.2s;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 6px;
  padding: 4px 8px;
  background: #f0f2f5;
  border: 1px solid #e8e9ea;
}

/* 暗色主题支持 */
.dark-theme .suggestion-tag {
  background: #303030 !important;
  border-color: #404040 !important;
  color: #ffffff !important;
}

.dark-theme .suggestion-tag:hover {
  background: #404040 !important;
  border-color: #1890ff !important;
  color: #1890ff !important;
}

.suggestion-tag:hover {
  background: #e6f7ff;
  border-color: #91d5ff;
  color: #1890ff;
}

.chat-input {
  padding-top: 16px;
  margin-top: 16px;
  padding: 0 20px;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 4px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #d9d9d9;
  border-radius: 2px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #bfbfbf;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .chat-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .header-info {
    width: 100%;
  }
  
  .config-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .config-item {
    width: 100%;
  }
  
  .config-actions {
    margin-left: 0;
    align-self: flex-end;
  }
  
  .suggestions-list {
    justify-content: flex-start;
  }
  
  .message-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .message-actions .ant-btn {
    max-width: 100%;
    width: 100%;
  }
  
  .message-content {
    max-width: calc(100% - 44px);
  }
}

@media (max-width: 480px) {
  .message-actions .ant-btn {
    font-size: 12px;
    padding: 6px 8px;
    min-height: 28px;
  }
  
  .suggestion-tag {
    max-width: 120px;
    font-size: 12px;
  }
  
  .chat-messages {
    max-height: 300px;
  }
}
</style>
