<template>
  <div class="ai-chat-container">
    <!-- 聊天头部 -->
    <div class="chat-header">
      <div class="header-info">
        <RobotOutlined class="ai-icon" />
        <div class="header-text">
          <h3 class="chat-title">AI 需求分析师</h3>
          <p class="chat-subtitle">告诉我您想要分析什么，我来帮您明确需求</p>
        </div>
      </div>
      <div class="header-actions">
        <a-tooltip title="清空对话">
          <a-button size="small" @click="clearChat">
            <ClearOutlined />
          </a-button>
        </a-tooltip>
      </div>
    </div>

    <!-- 日期范围选择器 -->
    <div class="date-range-section">
      <span class="date-label">分析时间范围：</span>
      <a-range-picker
        v-model:value="dateRange"
        style="width: 250px;"
        size="small"
        :disabled-date="disabledDate"
        @change="onDateRangeChange"
      />
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
          @click="sendMessage(suggestion)"
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
        show-count
        @keydown.enter.prevent="handleEnterKey"
      />
      <div class="input-actions">
        <a-button 
          type="primary" 
          @click="sendMessage"
          :loading="isAIThinking"
          :disabled="!inputMessage.trim()"
        >
          <SendOutlined />
          发送
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { 
  RobotOutlined, 
  UserOutlined, 
  ClearOutlined, 
  SendOutlined 
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { useStore } from 'vuex'
import { dataPreloadService } from '@/services/dataPreloadService'

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

// 响应式数据
const messages = ref([])
const inputMessage = ref('')
const isAIThinking = ref(false)
const messagesContainer = ref(null)
const store = useStore()

// 快捷建议
const quickSuggestions = ref([
  '分析首页访问量',
  '查看商品页点击情况',
  '用户注册转化流程',
  '按钮点击热度分析',
  '页面访问趋势',
  '购买转化漏斗'
])

// 计算属性
const dateRange = computed({
  get: () => props.dateRange,
  set: (value) => emit('date-range-change', value)
})

// 方法
const disabledDate = (current) => {
  return current && current > dayjs().endOf('day')
}

const onDateRangeChange = (dates) => {
  emit('date-range-change', dates)
}

const formatTime = (timestamp) => {
  return dayjs(timestamp).format('HH:mm')
}

const formatMessage = (content) => {
  // 简单的格式化，支持换行
  return content.replace(/\n/g, '<br>')
}

const addMessage = (content, type = 'user', actions = null) => {
  const messageObj = {
    id: Date.now() + Math.random(),
    content,
    type,
    timestamp: new Date(),
    actions
  }
  messages.value.push(messageObj)
  scrollToBottom()
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const handleEnterKey = (event) => {
  if (event.shiftKey) {
    // Shift+Enter 换行
    return
  }
  // Enter 发送消息
  sendMessage()
}

const sendMessage = async (text = null) => {
  const messageText = text || inputMessage.value.trim()
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
    // 检查是否是在输入页面信息
    const isInputtingPageInfo = checkIfInputtingPageInfo(messageText)
    
    if (isInputtingPageInfo.detected) {
      // 处理页面信息输入
      await handlePageInfoInput(messageText, isInputtingPageInfo.type)
    } else {
      // 调用AI分析服务
      const aiResponse = await analyzeWithAI(messageText)
      
      // 添加AI回复
      addMessage(aiResponse.content, 'ai', aiResponse.actions)
    }
    
  } catch (error) {
    console.error('AI分析失败:', error)
    addMessage('抱歉，我遇到了一些问题。请稍后再试或重新描述您的需求。', 'ai')
  } finally {
    isAIThinking.value = false
  }
}

const checkIfInputtingPageInfo = (messageText) => {
  const text = messageText.toLowerCase()
  
  // 检查是否包含页面相关信息
  if (text.includes('首页') || text.includes('商品') || text.includes('详情页') || 
      text.includes('用户') || text.includes('登录') || text.includes('注册') ||
      text.includes('/') || text.includes('页面') || text.includes('按钮')) {
    
    // 判断分析类型
    if (text.includes('按钮') || text.includes('点击')) {
      return { detected: true, type: 'user_click' }
    } else if (text.includes('起始：') || text.includes('步骤') || text.includes('目标：')) {
      return { detected: true, type: 'conversion' }
    } else {
      return { detected: true, type: 'page_visits' }
    }
  }
  
  return { detected: false }
}

const handlePageInfoInput = async (messageText, type) => {
  // 确认收到用户输入
  const confirmContent = `✅ 已收到您的输入

您提供的信息：${messageText}

我现在开始为您分析${type === 'page_visits' ? '页面访问' : type === 'user_click' ? '用户点击' : '转化流程'}数据。`

  const actions = [
    { 
      text: '开始分析', 
      type: 'analyze', 
      params: { 
        type: type, 
        scope: 'custom', 
        requirement: messageText,
        userInput: messageText
      } 
    }
  ]

  addMessage(confirmContent, 'ai', actions)
}

const analyzeWithAI = async (userMessage) => {
  try {
    // 调用真实的AI服务进行需求分析
    const { OllamaService } = await import('@/utils/ollamaService')
    const ollamaService = new OllamaService()
    
    // 构建对话上下文
    const conversationHistory = messages.value
      .filter(msg => msg.type === 'user' || msg.type === 'ai')
      .slice(-6) // 只保留最近3轮对话
      .map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
    
    // 调用AI服务进行智能对话
    const aiResponse = await ollamaService.chatWithUser({
      message: userMessage,
      conversationHistory,
      context: {
        availableFields: ['page_views', 'uv', 'pv', 'click_count', 'device_type', 'browser', 'conversion_rate'],
        dateRange: dateRange.value
      }
    })
    
    if (aiResponse.success) {
      return {
        content: aiResponse.content,
        actions: aiResponse.actions || []
      }
    } else {
      // AI服务失败时使用本地逻辑
      return generateAIResponse(userMessage)
    }
  } catch (error) {
    console.error('AI服务调用失败:', error)
    // 降级到本地逻辑
    return generateAIResponse(userMessage)
  }
}

const generateAIResponse = (userMessage) => {
  const message = userMessage.toLowerCase()
  
  // 需求澄清逻辑
  if (message.includes('页面访问量') || message.includes('访问量')) {
    return {
      content: '好的，您想分析页面访问量。为了给您更准确的分析，我想确认几个问题：\n\n1. 您是想看整体页面的访问量，还是特定页面的访问量？\n2. 您希望看到UV（独立访客）还是PV（页面浏览量）？\n3. 是否需要按时间维度展示趋势？',
      actions: [
        { text: '整体页面访问量', type: 'analyze', params: { type: 'page_visits', scope: 'all' } },
        { text: '特定页面访问量', type: 'clarify', params: { type: 'page_visits', scope: 'specific' } }
      ]
    }
  }
  
  if (message.includes('趋势') || message.includes('变化')) {
    return {
      content: '您想了解访问趋势，这很棒！我可以帮您分析：\n\n• 按天/周/月的访问趋势\n• 不同页面的访问趋势对比\n• 用户行为的时间分布\n\n您希望看到哪种趋势分析？',
      actions: [
        { text: '整体访问趋势', type: 'analyze', params: { type: 'trend', scope: 'overall' } },
        { text: '页面对比趋势', type: 'analyze', params: { type: 'trend', scope: 'comparison' } }
      ]
    }
  }
  
  if (message.includes('转化') || message.includes('漏斗')) {
    return {
      content: '转化分析是很有价值的！我可以帮您分析：\n\n• 用户从访问到转化的完整路径\n• 各环节的转化率\n• 流失点分析\n• 优化建议\n\n您想分析哪个转化流程？',
      actions: [
        { text: '整体转化漏斗', type: 'analyze', params: { type: 'conversion', scope: 'funnel' } },
        { text: '特定页面转化', type: 'analyze', params: { type: 'conversion', scope: 'page' } }
      ]
    }
  }
  
  if (message.includes('设备') || message.includes('浏览器')) {
    return {
      content: '设备分析可以帮助您了解用户的使用习惯！我可以展示：\n\n• 设备类型分布（手机/平板/电脑）\n• 浏览器使用情况\n• 操作系统分布\n• 屏幕分辨率统计\n\n您希望看到哪种设备分析？',
      actions: [
        { text: '设备类型分布', type: 'analyze', params: { type: 'device', scope: 'type' } },
        { text: '浏览器分析', type: 'analyze', params: { type: 'device', scope: 'browser' } }
      ]
    }
  }
  
  // 默认回复
  return {
    content: `我理解了您的需求："${userMessage}"\n\n让我为您分析一下。为了更好地帮助您，请告诉我：\n\n• 您主要关心哪些指标？（访问量、转化率、用户行为等）\n• 分析的时间范围是否合适？\n• 需要对比不同维度吗？\n\n您也可以点击下方快速选项来开始分析。`,
    actions: [
      { text: '开始分析', type: 'analyze', params: { requirement: userMessage } },
      { text: '重新描述需求', type: 'clarify', params: {} }
    ]
  }
}

const handleAction = async (action) => {
  if (action.type === 'select_analysis') {
    // 用户选择了分析类型，引导具体配置
    await handleAnalysisTypeSelection(action.params)
  } else if (action.type === 'page_selection') {
    // 需要用户选择页面
    await handlePageSelection(action.params)
  } else if (action.type === 'custom_conversion') {
    // 自定义转化路径
    await handleCustomConversion(action.params)
  } else if (action.type === 'input_page') {
    // 引导用户输入页面信息
    await handleInputPage(action.params)
  } else if (action.type === 'show_page_list') {
    // 显示页面列表供用户选择
    await handleShowPageList(action.params)
  } else if (action.type === 'show_all_pages') {
    // 显示所有页面列表
    await handleShowAllPages(action.params)
  } else if (action.type === 'show_page_batch') {
    // 显示指定批次的页面
    await handleShowPageBatch(action.params)
  } else if (action.type === 'trigger_preload') {
    // 触发数据预加载
    await handleTriggerPreload(action.params)
  } else if (action.type === 'show_config') {
    // 显示配置设置
    await handleShowConfig(action.params)
  } else if (action.type === 'acknowledge') {
    // 用户确认了解
    addMessage('好的，请按照提示进行操作。如果需要帮助，随时可以继续对话。', 'ai')
  } else if (action.type === 'open_config') {
    // 打开配置管理
    emit('show-config-modal')
    addMessage('已为您打开配置管理界面，请检查并保存配置后重试。', 'ai')
  } else if (action.type === 'analyze') {
    // 触发分析
    emit('analyze-requirement', action.params)
    
    // 添加确认消息
    addMessage(`好的，我开始为您分析${action.text}。`, 'ai')
  } else if (action.type === 'clarify') {
    // 需求澄清
    addMessage('请重新描述您的需求，我会更好地理解您想要的分析内容。', 'ai')
  }
}

const handleAnalysisTypeSelection = async (params) => {
  const { type, description } = params
  
  switch (type) {
    case 'page_visit':
      await handlePageVisitAnalysis()
      break
    case 'user_click':
      await handleUserClickAnalysis()
      break
    case 'conversion':
      await handleConversionAnalysis()
      break
    default:
      addMessage('我理解了您的需求，让我为您进行分析。', 'ai')
  }
}

const handlePageVisitAnalysis = async () => {
  const content = `📊 页面访问分析

请选择您要分析的页面范围：`

  const actions = [
    { text: '整体页面访问量', type: 'analyze', params: { type: 'page_visits', scope: 'all' } },
    { text: '选择页面分析', type: 'show_page_list', params: { type: 'page_visits', scope: 'specific' } }
  ]

  addMessage(content, 'ai', actions)
}

const handleUserClickAnalysis = async () => {
  const content = `🖱️ 用户点击分析

请选择您要分析的页面：`

  const actions = [
    { text: '选择页面进行点击分析', type: 'show_page_list', params: { type: 'user_click', scope: 'page' } },
    { text: '按钮点击热度分析', type: 'analyze', params: { type: 'button_heatmap', scope: 'all' } }
  ]

  addMessage(content, 'ai', actions)
}

const handleConversionAnalysis = async () => {
  const content = `🔄 行为转化分析

请选择转化分析类型：`

  const actions = [
    { text: '用户注册转化流程', type: 'analyze', params: { type: 'conversion', scope: 'registration' } },
    { text: '购买转化漏斗', type: 'analyze', params: { type: 'conversion', scope: 'purchase' } },
    { text: '自定义转化路径', type: 'custom_conversion', params: { type: 'conversion', scope: 'custom' } }
  ]

  addMessage(content, 'ai', actions)
}

const handlePageSelection = async (params) => {
  const { type, scope } = params
  
  let content = ''
  let actions = []
  
  if (type === 'page_visits') {
    content = `📄 页面选择 - 访问分析

请选择您要分析的页面：

1. **单个页面**：分析特定页面的访问情况
2. **多个页面**：对比多个页面的访问数据
3. **页面类型**：按页面类型进行分组分析

您可以：
- 直接输入页面名称或URL
- 告诉我页面的特征（如：商品详情页、用户中心等）
- 点击下方选项进行快速选择`

    actions = [
      { text: '输入页面名称', type: 'input_page', params: { type: 'page_visits', scope: 'manual' } },
      { text: '按页面类型分析', type: 'analyze', params: { type: 'page_visits', scope: 'by_type' } },
      { text: '多页面对比', type: 'analyze', params: { type: 'page_visits', scope: 'comparison' } }
    ]
  } else if (type === 'user_click') {
    content = `🖱️ 页面选择 - 点击分析

请选择您要分析点击行为的页面：

1. **页面选择**：告诉我具体的页面名称或URL
2. **按钮定位**：描述您关心的按钮或点击元素
3. **分析范围**：整个页面还是特定区域

请提供：
- 页面名称（如：首页、商品详情页等）
- 按钮描述（如：立即购买按钮、登录按钮等）
- 分析需求（如：点击次数、转化率等）`

    actions = [
      { text: '输入页面和按钮信息', type: 'input_page', params: { type: 'user_click', scope: 'manual' } },
      { text: '分析页面所有按钮', type: 'analyze', params: { type: 'user_click', scope: 'all_buttons' } },
      { text: '按钮点击热力图', type: 'analyze', params: { type: 'button_heatmap', scope: 'page' } }
    ]
  }
  
  addMessage(content, 'ai', actions)
}

const handleCustomConversion = async (params) => {
  const content = `🔄 自定义转化路径配置

请详细描述您的转化流程，包括：

**步骤1：起始行为**
- 用户从哪里开始？（如：访问首页、搜索商品等）
- 起始页面的具体名称

**步骤2：中间步骤**
- 用户需要经过哪些步骤？
- 每个步骤的具体页面或行为
- 步骤之间的逻辑关系

**步骤3：目标行为**
- 最终希望用户完成什么？
- 目标页面的具体名称

**示例**：
\`\`\`
起始：用户访问首页
步骤1：点击商品分类
步骤2：浏览商品列表
步骤3：进入商品详情页
步骤4：点击立即购买
目标：完成订单提交
\`\`\`

请按照上述格式描述您的转化流程，或者点击下方选项：`

  const actions = [
    { text: '输入自定义转化路径', type: 'input_page', params: { type: 'conversion', scope: 'custom' } },
    { text: '使用转化模板', type: 'analyze', params: { type: 'conversion', scope: 'template' } },
    { text: '分析现有转化漏斗', type: 'analyze', params: { type: 'conversion', scope: 'existing' } }
  ]

  addMessage(content, 'ai', actions)
}

const handleInputPage = async (params) => {
  const { type, scope } = params
  
  let content = ''
  
  if (type === 'page_visits') {
    content = `📝 页面信息输入

请告诉我您要分析的页面信息：

**可以输入的内容**：
- 页面名称（如：首页、商品详情页、用户中心）
- 页面URL（如：/home、/product/123、/user/profile）
- 页面特征（如：所有商品页面、所有表单页面）

**示例**：
- "首页"
- "/product/detail"
- "所有商品详情页"
- "用户注册页面"

请直接在输入框中输入您的页面信息，然后发送消息。`
  } else if (type === 'user_click') {
    content = `📝 页面和按钮信息输入

请告诉我您要分析的页面和按钮信息：

**页面信息**：
- 页面名称或URL

**按钮/元素信息**：
- 按钮名称（如：立即购买、登录、注册）
- 按钮位置（如：顶部导航、页面底部、侧边栏）
- 按钮特征（如：所有购买按钮、所有链接按钮）

**示例**：
- "首页的登录按钮"
- "商品详情页的立即购买按钮"
- "所有页面的搜索按钮"
- "购物车页面的结算按钮"

请直接在输入框中输入您的页面和按钮信息，然后发送消息。`
  } else if (type === 'conversion') {
    content = `📝 转化路径输入

请详细描述您的转化流程：

**格式要求**：
\`\`\`
起始：用户从哪里开始
步骤1：第一个行为
步骤2：第二个行为
...
目标：最终目标行为
\`\`\`

**示例**：
\`\`\`
起始：用户访问首页
步骤1：点击商品分类
步骤2：浏览商品列表
步骤3：点击商品进入详情页
步骤4：点击立即购买
步骤5：填写订单信息
目标：完成订单支付
\`\`\`

请直接在输入框中输入您的转化路径，然后发送消息。`
  }
  
  addMessage(content, 'ai')
}

const handleShowPageList = async (params) => {
  const { type, scope } = params
  
  try {
    // 显示加载状态
    addMessage('正在加载可用页面列表...', 'ai')
    
    // 获取当前埋点配置（与数据预加载服务保持一致）
    const currentPointId = store.state.apiConfig?.selectedPointId
    
    console.log('🔍 从缓存数据提取页面列表...')
    const cachedData = await dataPreloadService.getMultiDayCachedData(dateRange.value, currentPointId)
    
    let availablePages = []
    
    if (cachedData && cachedData.length > 0) {
      // 从缓存数据中提取唯一页面名称
      const pageSet = new Set()
      cachedData.forEach(item => {
        if (item.pageName && !item.pageName.includes('{{') && !item.pageName.includes('}}')) {
          pageSet.add(item.pageName)
        }
      })
      
      availablePages = Array.from(pageSet).sort()
      console.log(`✅ 从缓存提取到 ${availablePages.length} 个页面`)
    }
    
    if (availablePages.length > 0) {
      // 根据分析类型构建不同的页面选择界面
      let content = ''
      let actions = []
      
      if (type === 'user_click') {
        // 用户点击分析
        content = `📄 可用页面列表 - 点击分析

我找到了 ${availablePages.length} 个可用页面，请选择您要分析点击行为的页面：

**推荐选项**：
• 全部页面 - 分析所有页面的点击行为

**具体页面**：`

        const quickPages = availablePages.slice(0, 10)
        actions = [
          { text: '全部页面点击分析', type: 'analyze', params: { type: 'user_click', scope: 'all', pageName: '__ALL__' } },
          ...quickPages.map(page => ({
            text: page.length > 20 ? page.substring(0, 17) + '...' : page,
            type: 'analyze',
            params: { type: 'user_click', scope: 'specific', pageName: page }
          }))
        ]
      } else {
        // 页面访问分析
        content = `📄 可用页面列表

我找到了 ${availablePages.length} 个可用页面，请选择您要分析的页面：

**推荐选项**：
• 全部页面 - 查看整站UV/PV统计

**具体页面**：`

        const quickPages = availablePages.slice(0, 10)
        actions = [
          { text: '全部页面', type: 'analyze', params: { type: 'page_visits', scope: 'all', pageName: '__ALL__' } },
          ...quickPages.map(page => ({
            text: page.length > 20 ? page.substring(0, 17) + '...' : page,
            type: 'analyze',
            params: { type: 'page_visits', scope: 'specific', pageName: page }
          }))
        ]
      }
      
      // 如果页面超过10个，添加查看更多选项
      if (availablePages.length > 10) {
        actions.push({
          text: `查看更多页面 (${availablePages.length - 10}个)`,
          type: 'show_all_pages',
          params: { type: 'page_visits', scope: 'specific', allPages: availablePages }
        })
      }
      
      addMessage(content, 'ai', actions)
    } else {
      // 没有找到页面数据
      const content = `❌ 未找到页面数据

当前日期范围内没有可用的页面数据。根据系统检测，可能的原因：

🔍 **主要原因**：
• 数据尚未预加载 - 这是最常见的原因
• 当前埋点ID (${currentPointId}) 没有数据
• 选择的日期范围内没有访问记录

💡 **解决方案**：
1. **立即预加载数据** - 点击页面右上角的"数据预加载"按钮
2. **检查埋点配置** - 确保埋点ID配置正确
3. **调整日期范围** - 选择有数据的日期范围
4. **手动输入页面** - 如果您知道具体页面名称

请选择以下操作：`

      const actions = [
        { text: '🚀 启动数据预加载', type: 'trigger_preload', params: {} },
        { text: '⚙️ 检查配置设置', type: 'show_config', params: {} },
        { text: '📝 手动输入页面', type: 'input_page', params: { type: 'page_visits', scope: 'manual' } },
        { text: '🔄 重新加载页面', type: 'show_page_list', params: { type: 'page_visits', scope: 'specific' } }
      ]
      
      addMessage(content, 'ai', actions)
    }
    
  } catch (error) {
    console.error('加载页面列表失败:', error)
    addMessage('加载页面列表时出现错误，请稍后重试或手动输入页面名称。', 'ai')
  }
}

const handleShowAllPages = async (params) => {
  const { allPages } = params
  
  if (!allPages || allPages.length === 0) {
    addMessage('没有更多页面可显示。', 'ai')
    return
  }
  
  // 显示所有页面，分批显示以避免按钮过多
  const batchSize = 15
  const batches = []
  
  for (let i = 0; i < allPages.length; i += batchSize) {
    batches.push(allPages.slice(i, i + batchSize))
  }
  
  if (batches.length === 1) {
    // 只有一批，直接显示
    const content = `📄 所有页面列表 (${allPages.length}个)

请选择您要分析的页面：`
    
    const actions = [
      { text: '全部页面', type: 'analyze', params: { type: 'page_visits', scope: 'all', pageName: '__ALL__' } },
      ...allPages.map(page => ({
        text: page.length > 25 ? page.substring(0, 22) + '...' : page,
        type: 'analyze',
        params: { type: 'page_visits', scope: 'specific', pageName: page }
      }))
    ]
    
    addMessage(content, 'ai', actions)
  } else {
    // 多批，显示第一批并提供导航
    const firstBatch = batches[0]
    const content = `📄 页面列表 (第1批，共${batches.length}批)

显示第1批页面，共${allPages.length}个页面：`
    
    const actions = [
      { text: '全部页面', type: 'analyze', params: { type: 'page_visits', scope: 'all', pageName: '__ALL__' } },
      ...firstBatch.map(page => ({
        text: page.length > 25 ? page.substring(0, 22) + '...' : page,
        type: 'analyze',
        params: { type: 'page_visits', scope: 'specific', pageName: page }
      }))
    ]
    
    // 添加导航按钮
    if (batches.length > 1) {
      actions.push({
        text: `查看第2批页面 (${batches[1].length}个)`,
        type: 'show_page_batch',
        params: { 
          type: 'page_visits', 
          scope: 'specific', 
          allPages: allPages,
          currentBatch: 1,
          batches: batches
        }
      })
    }
    
    addMessage(content, 'ai', actions)
  }
}

const handleShowPageBatch = async (params) => {
  const { allPages, currentBatch, batches } = params
  
  if (currentBatch >= batches.length) {
    addMessage('已经是最后一批页面了。', 'ai')
    return
  }
  
  const batch = batches[currentBatch]
  const content = `📄 页面列表 (第${currentBatch + 1}批，共${batches.length}批)

显示第${currentBatch + 1}批页面：`
  
  const actions = [
    { text: '全部页面', type: 'analyze', params: { type: 'page_visits', scope: 'all', pageName: '__ALL__' } },
    ...batch.map(page => ({
      text: page.length > 25 ? page.substring(0, 22) + '...' : page,
      type: 'analyze',
      params: { type: 'page_visits', scope: 'specific', pageName: page }
    }))
  ]
  
  // 添加导航按钮
  if (currentBatch > 0) {
    actions.push({
      text: `← 上一批 (第${currentBatch}批)`,
      type: 'show_page_batch',
      params: { 
        type: 'page_visits', 
        scope: 'specific', 
        allPages: allPages,
        currentBatch: currentBatch - 1,
        batches: batches
      }
    })
  }
  
  if (currentBatch + 1 < batches.length) {
    actions.push({
      text: `下一批 (第${currentBatch + 2}批) →`,
      type: 'show_page_batch',
      params: { 
        type: 'page_visits', 
        scope: 'specific', 
        allPages: allPages,
        currentBatch: currentBatch + 1,
        batches: batches
      }
    })
  }
  
  addMessage(content, 'ai', actions)
}

const handleTriggerPreload = async (params) => {
  const content = `🚀 启动数据预加载

数据预加载是获取页面列表的必要步骤。点击"数据预加载"按钮后：

1. **系统会自动**：
   • 连接API获取最新数据
   • 缓存数据到本地存储
   • 提取可用页面列表
   • 为后续分析做准备

2. **预加载完成后**：
   • 页面列表会自动更新
   • 您可以直接选择页面进行分析
   • 分析速度会大大提升

💡 **操作步骤**：
请点击页面右上角的"数据预加载"按钮开始预加载，完成后再次尝试页面选择。`

  const actions = [
    { text: '✅ 我知道了，去预加载', type: 'acknowledge', params: {} },
    { text: '🔄 预加载完成后重试', type: 'show_page_list', params: { type: 'page_visits', scope: 'specific' } }
  ]

  addMessage(content, 'ai', actions)
}

const handleShowConfig = async (params) => {
  const content = `⚙️ 配置设置检查

为了确保页面数据正常加载，请检查以下配置：

🔧 **必要配置**：
• **埋点ID**：当前使用 ${store.state.apiConfig?.selectedPointId || '未配置'}
• **API地址**：${store.state.apiConfig?.baseUrl || '未配置'}
• **日期范围**：${dateRange.value[0].format('YYYY-MM-DD')} 至 ${dateRange.value[1].format('YYYY-MM-DD')}

📋 **检查步骤**：
1. 点击页面右上角的"配置管理"按钮
2. 确认API配置正确
3. 确认埋点ID配置正确
4. 保存配置后重新尝试

💡 **常见问题**：
• 埋点ID错误 → 无法获取数据
• API地址错误 → 连接失败
• 日期范围无数据 → 选择有数据的日期`

  const actions = [
    { text: '⚙️ 打开配置管理', type: 'open_config', params: {} },
    { text: '🔄 配置完成后重试', type: 'show_page_list', params: { type: 'page_visits', scope: 'specific' } }
  ]

  addMessage(content, 'ai', actions)
}

const clearChat = () => {
  messages.value = []
  localStorage.removeItem('ai_chat_history')
  emit('clear-requirement')
  message.success('对话已清空')
  
  // 重新添加欢迎消息
  setTimeout(() => {
    showWelcomeMessage()
  }, 100)
}

// 聊天历史管理
const saveChatHistory = () => {
  try {
    localStorage.setItem('ai_chat_history', JSON.stringify(messages.value))
  } catch (error) {
    console.error('保存聊天历史失败:', error)
  }
}

const loadChatHistory = () => {
  try {
    const saved = localStorage.getItem('ai_chat_history')
    if (saved) {
      const history = JSON.parse(saved)
      messages.value = history
      return history.length > 0
    }
  } catch (error) {
    console.error('加载聊天历史失败:', error)
  }
  return false
}

// 监听消息变化，自动保存
watch(messages, () => {
  saveChatHistory()
}, { deep: true })

// 初始化欢迎消息
onMounted(() => {
  const hasHistory = loadChatHistory()
  if (!hasHistory) {
    showWelcomeMessage()
  }
})

const showWelcomeMessage = () => {
  const welcomeContent = `您好！我是您的AI需求分析师。我将帮助您明确数据分析需求。

请选择您想要进行的分析类型：`

  const welcomeActions = [
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

  addMessage(welcomeContent, 'ai', welcomeActions)
}
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
  justify-content: space-between;
  align-items: center;
  padding: 16px 0 8px 0;
  margin-bottom: 16px;
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

.date-range-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 8px 0;
  width: 100%;
  overflow: hidden;
  flex-wrap: wrap;
}

.date-label {
  font-size: 13px;
  color: var(--text-color, #262626);
  white-space: nowrap;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  max-height: 400px;
  padding: 8px 0;
  margin-bottom: 16px;
  width: 100%;
  overflow-x: hidden;
}

.message {
  display: flex;
  margin-bottom: 16px;
  gap: 12px;
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

.suggestion-tag:hover {
  background: #e6f7ff;
  border-color: #91d5ff;
  color: #1890ff;
}

.chat-input {
  padding-top: 16px;
  margin-top: 16px;
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
  
  .date-range-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
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
