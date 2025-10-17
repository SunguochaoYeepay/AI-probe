<template>
  <div class="ai-chat-container">
    <!-- 配置选择区域 -->
    <div class="config-section">
      <div class="config-item">
        <span class="config-label">分析时间：</span>
        <a-range-picker
          v-model:value="dateRange"
          style="width: 250px;"
          size="small"
          :disabled-date="disabledDate"
        />
      </div>
      
      <div class="config-item">
        <span class="config-label">分析埋点：</span>
        <a-select
          v-if="allBuryPoints.length > 0"
          v-model:value="selectedBuryPointId"
          placeholder="请选择分析埋点"
          style="width: 200px;"
          size="small"
          @change="onBuryPointChange"
        >
          <a-select-option
            v-for="point in allBuryPoints"
            :key="point.id"
            :value="point.id"
          >
            {{ point.name }} (ID: {{ point.id }}) - {{ point.type }}埋点
          </a-select-option>
        </a-select>
        <a-button 
          v-else
          type="dashed" 
          size="small"
          @click="$emit('show-config-modal')"
          style="width: 200px;"
        >
          请先配置埋点
        </a-button>
      </div>
      
      <div class="config-actions">
        <a-tooltip title="清空对话">
          <a-button size="small" @click="clearChat">
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
        show-count
        @keydown.enter.prevent="handleEnterKey"
      />
      <div class="input-actions">
        <a-button 
          type="primary" 
          @click="() => sendMessage()"
          :loading="isAIThinking"
          :disabled="!inputMessage.trim()"
        >
          <SendOutlined />
          发送
        </a-button>
      </div>
    </div>
    
    <!-- 按钮选择弹窗 -->
    <ButtonSelectionModal
      v-model:visible="buttonSelectionModalVisible"
      :page-name="selectedPageName"
      :buttons="availableButtons"
      @select-button="handleButtonSelection"
    />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { 
  RobotOutlined, 
  UserOutlined, 
  ClearOutlined, 
  SendOutlined,
  DatabaseOutlined,
  WarningOutlined
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { useStore } from 'vuex'
import { dataPreloadService } from '@/services/dataPreloadService'
import { useDataFetch } from '@/composables/useDataFetch'
import { extractButtonsFromMultiDayData } from '@/utils/buttonExtractor'
import ButtonSelectionModal from '@/components/ButtonSelectionModal.vue'

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

// 埋点选择
const selectedBuryPointId = ref(null)

// 按钮选择相关
const buttonSelectionModalVisible = ref(false)
const selectedPageName = ref('')
const availableButtons = ref([])

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
  set: (value) => {
    console.log('AIChatInterface: dateRange computed set 被调用', { value })
    // 当通过 v-model 设置时，触发日期范围变更事件
    // 注意：这里 value 是 dayjs 对象数组，需要转换为字符串数组
    const dateStrings = value ? value.map(date => date.format('YYYY-MM-DD')) : []
    console.log('AIChatInterface: 发送 date-range-change 事件', { value, dateStrings })
    emit('date-range-change', value, dateStrings)
  }
})

// 获取已配置的埋点信息（支持新的分离配置）
const allBuryPoints = computed(() => {
  const projectConfig = store.state.projectConfig
  const allBuryPoints = projectConfig?.buryPoints || []
  const configuredPoints = []
  
  // 优先使用新的分离配置
  if (projectConfig.visitBuryPointId || projectConfig.clickBuryPointId) {
    if (projectConfig.visitBuryPointId) {
      const visitPoint = allBuryPoints.find(p => p.id === projectConfig.visitBuryPointId)
      if (visitPoint) {
        configuredPoints.push({ ...visitPoint, type: '访问' })
      } else {
        // 如果埋点列表中没有找到，创建一个基本的埋点信息
        configuredPoints.push({ 
          id: projectConfig.visitBuryPointId, 
          name: '访问埋点', 
          type: '访问' 
        })
      }
    }
    if (projectConfig.clickBuryPointId && projectConfig.clickBuryPointId !== projectConfig.visitBuryPointId) {
      const clickPoint = allBuryPoints.find(p => p.id === projectConfig.clickBuryPointId)
      if (clickPoint) {
        configuredPoints.push({ ...clickPoint, type: '点击' })
      } else {
        // 如果埋点列表中没有找到，创建一个基本的埋点信息
        configuredPoints.push({ 
          id: projectConfig.clickBuryPointId, 
          name: '点击埋点', 
          type: '点击' 
        })
      }
    }
    console.log('使用分离配置的埋点:', configuredPoints)
  } else {
    // 回退到旧的配置方式
    const selectedIds = projectConfig?.selectedBuryPointIds || []
    selectedIds.forEach(id => {
      const point = allBuryPoints.find(p => p.id === id)
      if (point) {
        configuredPoints.push({ ...point, type: '通用' })
      } else {
        // 如果埋点列表中没有找到，创建一个基本的埋点信息
        configuredPoints.push({ 
          id: id, 
          name: '通用埋点', 
          type: '通用' 
        })
      }
    })
    console.log('使用旧配置的埋点:', configuredPoints)
  }
  
  return configuredPoints
})

// 获取当前选择的埋点类型
const getCurrentBuryPointType = () => {
  const projectConfig = store.state.projectConfig
  const currentPointId = selectedBuryPointId.value
  
  console.log('getCurrentBuryPointType - 当前埋点ID:', currentPointId)
  console.log('getCurrentBuryPointType - 项目配置:', {
    visitBuryPointId: projectConfig.visitBuryPointId,
    clickBuryPointId: projectConfig.clickBuryPointId,
    buryPoints: projectConfig?.buryPoints?.length || 0
  })
  
  if (!currentPointId) {
    console.log('getCurrentBuryPointType - 没有当前埋点ID，返回null')
    return null
  }
  
  // 优先使用新的分离配置
  if (projectConfig.visitBuryPointId || projectConfig.clickBuryPointId) {
    if (currentPointId === projectConfig.visitBuryPointId) {
      console.log('getCurrentBuryPointType - 匹配访问埋点，返回"访问"')
      return '访问'
    } else if (currentPointId === projectConfig.clickBuryPointId) {
      console.log('getCurrentBuryPointType - 匹配点击埋点，返回"点击"')
      return '点击'
    }
    console.log('getCurrentBuryPointId - 当前埋点ID不匹配任何分离配置')
  }
  
  // 回退到旧的配置方式 - 通过埋点名称判断
  const allBuryPoints = projectConfig?.buryPoints || []
  const currentPoint = allBuryPoints.find(p => p.id === currentPointId)
  
  if (currentPoint) {
    console.log('getCurrentBuryPointType - 找到埋点信息:', currentPoint)
    // 通过埋点名称判断类型
    const name = currentPoint.name || ''
    if (name.includes('访问') || name.includes('浏览') || name.includes('页面')) {
      console.log('getCurrentBuryPointType - 通过名称判断为访问类型')
      return '访问'
    } else if (name.includes('点击') || name.includes('按钮') || name.includes('事件')) {
      console.log('getCurrentBuryPointType - 通过名称判断为点击类型')
      return '点击'
    }
    console.log('getCurrentBuryPointType - 埋点名称无法判断类型:', name)
  } else {
    console.log('getCurrentBuryPointType - 未找到对应的埋点信息')
  }
  
  console.log('getCurrentBuryPointType - 返回null')
  return null
}

// 埋点选择变化处理
const onBuryPointChange = (value) => {
  console.log('埋点选择变化:', value)
  
  // 先获取旧的埋点类型（基于当前的selectedBuryPointId.value）
  const oldBuryPointType = getBuryPointTypeById(selectedBuryPointId.value)
  console.log('旧的埋点ID:', selectedBuryPointId.value)
  console.log('旧的埋点类型:', oldBuryPointType)
  
  // 更新埋点选择
  selectedBuryPointId.value = value
  
  // 只更新 apiConfig.selectedPointId，不修改 projectConfig
  // 因为这里只是在已配置的埋点之间切换，不改变配置本身
  store.dispatch('updateApiConfig', {
    selectedPointId: value
  })
  
  console.log(`✅ 当前分析埋点已切换到: ${value}`)
  console.log('🔍 更新后的store.state.apiConfig.selectedPointId:', store.state.apiConfig.selectedPointId)
  
  // 获取新的埋点类型（基于新的埋点ID）
  const newBuryPointType = getBuryPointTypeById(value)
  console.log('新的埋点类型:', newBuryPointType)
  console.log(`埋点类型变化: ${oldBuryPointType} -> ${newBuryPointType}`)
  
  // 如果埋点类型发生变化，自动更新提示词
  if (oldBuryPointType !== newBuryPointType) {
    console.log('埋点类型发生变化，自动更新提示词')
    updateWelcomeMessageForBuryPointType()
    
    // 保存用户的埋点类型偏好到localStorage
    if (newBuryPointType === '访问') {
      localStorage.setItem('defaultBuryPointType', 'visit')
      console.log('已保存用户偏好：访问埋点')
    } else if (newBuryPointType === '点击') {
      localStorage.setItem('defaultBuryPointType', 'click')
      console.log('已保存用户偏好：点击埋点')
    }
  } else {
    console.log('埋点类型未发生变化，无需更新提示词')
    console.log('🔍 当前聊天记录数量:', messages.value.length)
    console.log('🔍 聊天记录内容:', messages.value)
    // 每次埋点切换都显示对应的提示词
    console.log('埋点切换完成，显示当前埋点的提示词')
    showWelcomeMessage()
  }
}

// 根据埋点ID获取埋点类型（不依赖selectedBuryPointId.value）
const getBuryPointTypeById = (pointId) => {
  const projectConfig = store.state.projectConfig
  
  console.log('getBuryPointTypeById - 埋点ID:', pointId)
  console.log('getBuryPointTypeById - 项目配置:', {
    visitBuryPointId: projectConfig.visitBuryPointId,
    clickBuryPointId: projectConfig.clickBuryPointId,
    buryPoints: projectConfig?.buryPoints?.length || 0
  })
  
  if (!pointId) {
    console.log('getBuryPointTypeById - 没有埋点ID，返回null')
    return null
  }
  
  // 优先使用新的分离配置
  if (projectConfig.visitBuryPointId || projectConfig.clickBuryPointId) {
    if (pointId === projectConfig.visitBuryPointId) {
      console.log('getBuryPointTypeById - 匹配访问埋点，返回"访问"')
      return '访问'
    } else if (pointId === projectConfig.clickBuryPointId) {
      console.log('getBuryPointTypeById - 匹配点击埋点，返回"点击"')
      return '点击'
    }
    console.log('getBuryPointTypeById - 埋点ID不匹配任何分离配置')
  }
  
  // 回退到旧的配置方式 - 通过埋点名称判断
  const allBuryPoints = projectConfig?.buryPoints || []
  const currentPoint = allBuryPoints.find(p => p.id === pointId)
  
  if (currentPoint) {
    console.log('getBuryPointTypeById - 找到埋点信息:', currentPoint)
    // 通过埋点名称判断类型
    const name = currentPoint.name || ''
    if (name.includes('访问') || name.includes('浏览') || name.includes('页面')) {
      console.log('getBuryPointTypeById - 通过名称判断为访问类型')
      return '访问'
    } else if (name.includes('点击') || name.includes('按钮') || name.includes('事件')) {
      console.log('getBuryPointTypeById - 通过名称判断为点击类型')
      return '点击'
    }
    console.log('getBuryPointTypeById - 埋点名称无法判断类型:', name)
  } else {
    console.log('getBuryPointTypeById - 未找到对应的埋点信息')
  }
  
  console.log('getBuryPointTypeById - 返回null')
  return null
}

// 根据埋点类型更新欢迎消息
const updateWelcomeMessageForBuryPointType = () => {
  // 如果聊天记录为空，直接显示欢迎消息
  if (messages.value.length === 0) {
    showWelcomeMessage()
    return
  }
  
  // 如果已有聊天记录，添加一个提示消息告知用户埋点类型已切换
  const currentBuryPointType = getCurrentBuryPointType()
  let typeChangeMessage = ''
  let newActions = []
  
  if (currentBuryPointType === '访问') {
    typeChangeMessage = `🔄 检测到您已切换到访问埋点分析模式

现在为您提供页面访问分析相关的选项：`
    
    newActions = [
      { 
        text: '📊 页面访问量分析', 
        type: 'select_analysis', 
        params: { type: 'page_visit', description: '分析页面的访问量、UV/PV趋势等' } 
      },
      { 
        text: '📈 访问趋势分析', 
        type: 'select_analysis', 
        params: { type: 'page_visit', description: '分析页面访问的时间趋势和变化' } 
      },
      { 
        text: '📋 页面类型分布', 
        type: 'select_analysis', 
        params: { type: 'page_visit', description: '按页面类型分析访问分布情况' } 
      }
    ]
  } else if (currentBuryPointType === '点击') {
    typeChangeMessage = `🔄 检测到您已切换到点击埋点分析模式

现在为您提供按钮点击分析相关的选项：`
    
    newActions = [
      { 
        text: '🖱️ 按钮点击分析', 
        type: 'select_analysis', 
        params: { type: 'user_click', description: '分析按钮点击行为、点击次数等' } 
      },
      { 
        text: '🔥 按钮点击热度', 
        type: 'select_analysis', 
        params: { type: 'user_click', description: '分析按钮点击热度和用户偏好' } 
      },
      { 
        text: '📊 点击转化分析', 
        type: 'select_analysis', 
        params: { type: 'user_click', description: '分析点击到转化的路径和效果' } 
      }
    ]
  } else {
    // 默认情况
    typeChangeMessage = `🔄 埋点配置已更新

请选择您想要进行的分析类型：`
    
    newActions = [
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
  
  // 添加新的提示消息
  addMessage(typeChangeMessage, 'ai', newActions)
}

// 方法
const disabledDate = (current) => {
  return current && current > dayjs().endOf('day')
}


const formatTime = (timestamp) => {
  return dayjs(timestamp).format('HH:mm')
}

const formatMessage = (content) => {
  // 类型检查，确保content是字符串
  if (typeof content !== 'string') {
    console.warn('formatMessage received non-string content:', content)
    return String(content || '')
  }
  // 简单的格式化，支持换行
  return content.replace(/\n/g, '<br>')
}

const addMessage = (content, type = 'user', actions = null) => {
  // 确保content是字符串类型
  const messageContent = typeof content === 'string' ? content : String(content || '')
  
  const messageObj = {
    id: Date.now() + Math.random(),
    content: messageContent,
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
    const aiResponse = await analyzeWithAI(messageText)
    
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
      const fallbackResponse = await handleFallbackRecognition(messageText)
      addMessage(fallbackResponse.content, 'ai', fallbackResponse.actions)
    }
    
  } catch (error) {
    console.error('AI服务调用失败:', error)
    // AI服务完全失败，使用编码识别兜底
    console.log('🚨 AI服务不可用，使用编码识别兜底...')
    try {
      const fallbackResponse = await handleFallbackRecognition(messageText)
      addMessage(fallbackResponse.content, 'ai', fallbackResponse.actions)
    } catch (fallbackError) {
      console.error('编码识别也失败:', fallbackError)
      addMessage('抱歉，我遇到了一些问题。请稍后再试或重新描述您的需求。', 'ai')
    }
  } finally {
    isAIThinking.value = false
  }
}

const handleFallbackRecognition = async (messageText) => {
  console.log('🔧 执行编码识别降级逻辑...')
  
  // 检查是否是在输入页面信息
  const isInputtingPageInfo = await checkIfInputtingPageInfo(messageText)
  
  if (isInputtingPageInfo.detected) {
    // 处理页面信息输入
    console.log(`📄 检测到页面信息输入，类型: ${isInputtingPageInfo.type}`)
    
    // 使用AI智能检测是否包含特定页面名称
    const extractedPageName = await extractPageNameWithAI(messageText)
    const hasSpecificPage = extractedPageName !== null
    
    if (hasSpecificPage && isInputtingPageInfo.type === 'page_visits') {
      // 包含特定页面名称的访问分析，先检查页面是否存在
      console.log('🎯 检测到特定页面访问分析需求，检查页面是否存在...')
      
      // 使用AI智能提取页面名称
      const pageName = await extractPageNameWithAI(messageText) || messageText.replace(/分析|页面访问|访问量|的访问/g, '').trim()
      const pageExists = await checkPageExists(pageName)
      
      if (!pageExists) {
        // 页面不存在，直接告诉用户并显示实际可用的页面
        const availablePages = await getAvailablePages()
        
        // 直接添加消息并停止处理
        addMessage(`❌ 抱歉，系统中没有找到"${pageName}"这个页面。\n\n请检查页面名称是否正确，或者从以下可用页面中选择：\n\n${availablePages.slice(0, 10).map(page => `• ${page}`).join('\n')}${availablePages.length > 10 ? `\n\n...还有${availablePages.length - 10}个页面` : ''}\n\n💡 提示：请从上述页面中选择一个正确的页面名称。`, 'ai')
        
        // 返回null阻止继续处理
        return null
      } else {
        // 页面存在，直接触发分析
        console.log('✅ 页面存在，开始分析')
        
        emit('analyze-requirement', {
          type: 'page_visits',
          scope: 'specific',
          pageName: messageText,
          requirement: messageText,
          userInput: messageText
        })

        return {
          content: `✅ 已识别到页面访问分析需求\n\n您要分析的页面：${messageText}\n\n我现在开始为您分析该页面的访问数据。`,
          actions: []
        }
      }
    } else {
      // 通用处理
      return {
        content: `✅ 已收到您的输入\n\n您提供的信息：${messageText}\n\n我现在开始为您分析${isInputtingPageInfo.type === 'page_visits' ? '页面访问' : isInputtingPageInfo.type === 'user_click' ? '用户点击' : '转化流程'}数据。`,
        actions: [
          { 
            text: '开始分析', 
            type: 'analyze', 
            params: { 
              type: isInputtingPageInfo.type, 
              scope: 'custom', 
              requirement: messageText,
              userInput: messageText
            } 
          }
        ]
      }
    }
    } else {
      // 使用本地逻辑生成回复
      console.log('🤔 使用本地逻辑生成回复...')
      return await generateAIResponse(messageText)
    }
}

const checkIfInputtingPageInfo = async (messageText) => {
  // 确保messageText是字符串类型
  if (typeof messageText !== 'string') {
    console.warn('checkIfInputtingPageInfo received non-string messageText:', messageText)
    return { detected: false, type: null }
  }
  
  const text = messageText.toLowerCase()
  
  // 使用AI智能检测分析类型
  const analysisType = await detectAnalysisTypeWithAI(messageText)
  
  if (analysisType) {
    return { detected: true, type: analysisType }
  }
  
  return { detected: false }
}

const handlePageInfoInput = async (messageText, type) => {
  // 这个函数现在主要用于向后兼容，实际逻辑已移到 handleFallbackRecognition 中
  console.log('📝 handlePageInfoInput 被调用，但逻辑已移到 handleFallbackRecognition')
  
  // 直接调用降级识别逻辑
  const response = await handleFallbackRecognition(messageText)
  addMessage(response.content, 'ai', response.actions)
}

const analyzeWithAI = async (userMessage) => {
  try {
    // 先检查是否是页面访问量相关的请求 - 使用AI智能检测
    const analysisType = await detectAnalysisTypeWithAI(userMessage)
    if (analysisType === 'page_visits') {
      // 使用AI智能提取页面名称
      const extractedPageName = await extractPageNameWithAI(userMessage)
      
      if (extractedPageName) {
        console.log('AI提取的页面名称:', extractedPageName)
        
        // 检查页面是否真实存在
        const pageExists = await checkPageExists(extractedPageName)
        
        if (!pageExists) {
          // 页面不存在，直接告诉用户并显示实际可用的页面
          const availablePages = await getAvailablePages()
          
          return {
            content: `❌ 抱歉，系统中没有找到"${extractedPageName}"这个页面。\n\n请检查页面名称是否正确，或者从以下可用页面中选择：\n\n${availablePages.slice(0, 10).map(page => `• ${page}`).join('\n')}${availablePages.length > 10 ? `\n\n...还有${availablePages.length - 10}个页面` : ''}\n\n💡 提示：请从上述页面中选择一个正确的页面名称。`,
            actions: []
          }
        }
      } else {
        // 没有提取到具体页面名称，可能是通用描述，提供页面选择建议
        const availablePages = await getAvailablePages()
        
        return {
          content: `❌ 没有你要的页面。\n\n请从以下可用页面中选择您要分析的页面：\n\n${availablePages.slice(0, 10).map(page => `• ${page}`).join('\n')}${availablePages.length > 10 ? `\n\n...还有${availablePages.length - 10}个页面` : ''}\n\n💡 提示：请选择具体的页面名称进行分析。`,
          actions: availablePages.slice(0, 5).map(page => ({
            text: `分析${page}`,
            type: 'analyze',
            params: { type: 'page_visits', scope: 'specific', pageName: page }
          }))
        }
      }
    }
    
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
        availableFields: await getAvailableFields(),
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
      return await generateAIResponse(userMessage)
    }
  } catch (error) {
    console.error('AI服务调用失败:', error)
    // 降级到本地逻辑
    return await generateAIResponse(userMessage)
  }
}

// 使用AI智能提取页面名称
const extractPageNameWithAI = async (userMessage) => {
  try {
    // 使用统一的AI提取工具函数
    const { extractPageNameWithAI: aiExtract } = await import('@/utils/aiExtractor')
    
    const extractedName = await aiExtract(userMessage)
    
    console.log('AI提取页面名称结果:', { original: userMessage, extracted: extractedName })
    
    return extractedName
  } catch (error) {
    console.error('AI提取页面名称失败:', error)
    return null
  }
}

// 使用AI智能检测分析类型
const detectAnalysisTypeWithAI = async (messageText) => {
  try {
    // 使用统一的AI提取工具函数
    const { detectAnalysisTypeWithAI: aiDetect } = await import('@/utils/aiExtractor')
    
    const result = await aiDetect(messageText)
    
    return result
  } catch (error) {
    console.error('AI检测分析类型失败:', error)
    return null
  }
}

// 获取可用字段列表
const getAvailableFields = async () => {
  // 直接返回默认字段，避免Vue组合式API的上下文问题
  return [
    { fieldName: 'pageName', fieldAlias: '页面名称' },
    { fieldName: 'type', fieldAlias: '类型' },
    { fieldName: 'pageBehavior', fieldAlias: '页面行为' },
    { fieldName: 'stayTime', fieldAlias: '停留时长' },
    { fieldName: 'weUserId', fieldAlias: '用户ID' },
    { fieldName: 'wePath', fieldAlias: '页面路径' },
    { fieldName: 'createdAt', fieldAlias: '创建时间' },
    { fieldName: 'weDeviceName', fieldAlias: '设备名称' },
    { fieldName: 'weBrowserName', fieldAlias: '浏览器名称' },
    { fieldName: 'weIp', fieldAlias: 'IP地址' },
    { fieldName: 'weCity', fieldAlias: '城市' }
  ]
}

// 获取字段别名
const getFieldAlias = (fieldName) => {
  const aliasMap = {
    'pageName': '页面名称',
    'type': '类型',
    'pageBehavior': '页面行为',
    'stayTime': '停留时长',
    'weUserId': '用户ID',
    'wePath': '页面路径',
    'createdAt': '创建时间',
    'weDeviceName': '设备名称',
    'weBrowserName': '浏览器名称',
    'weIp': 'IP地址',
    'weCity': '城市'
  }
  return aliasMap[fieldName] || fieldName
}

// 获取示例页面列表
const getSamplePages = async () => {
  try {
    // 从缓存数据中获取实际存在的页面列表
    const { dataPreloadService } = await import('@/services/dataPreloadService')
    
    // 获取最近7天的数据来提取页面列表
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - 7)
    
    const dateRange = [startDate, endDate]
    const selectedPointId = store.state.projectConfig?.selectedBuryPointIds?.[0]
    
    if (selectedPointId) {
      const cachedData = await dataPreloadService.getMultiDayCachedData(dateRange, selectedPointId)
      
      if (cachedData && cachedData.length > 0) {
        // 从实际数据中提取页面名称
        const pageNames = [...new Set(cachedData.map(item => item.pageName).filter(name => name))]
        
        // 返回前5个页面作为示例
        const samplePages = pageNames.slice(0, 5)
        console.log('从缓存数据获取的示例页面:', samplePages)
        
        return samplePages
      }
    }
    
    // 如果没有缓存数据，降级使用AI生成
    console.log('无缓存数据，使用AI生成示例页面')
    const { OllamaService } = await import('@/utils/ollamaService')
    const { AI_PROMPTS, AI_RESPONSE_PARSERS, AI_CONFIG } = await import('@/utils/aiPrompts')
    const ollamaService = new OllamaService()
    
    const prompt = AI_PROMPTS.GENERATE_SAMPLE_PAGES()
    const response = await ollamaService.generate(prompt, AI_CONFIG.SAMPLE_PAGES_OPTIONS)
    
    const pages = AI_RESPONSE_PARSERS.parseSamplePages(response)
    
    console.log('AI生成的示例页面:', pages)
    
    return pages
  } catch (error) {
    console.error('获取示例页面失败:', error)
    // 失败时返回空数组，不显示示例页面
    return []
  }
}

// 使用AI智能判断页面是否存在
const checkPageExistsWithAI = async (pageName) => {
  try {
    // 使用统一的AI提取工具函数
    const { checkPageExistsWithAI: aiCheck } = await import('@/utils/aiExtractor')
    
    const finalResult = await aiCheck(pageName)
    
    return finalResult
  } catch (error) {
    console.error('AI判断页面存在性失败:', error)
    return false
  }
}

// 检查页面是否存在的函数
/**
 * 动态获取可用页面列表
 * @returns {Promise<Array>} 可用页面列表
 */
const getAvailablePages = async () => {
  try {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - 7)
    
    const dateRange = [startDate, endDate]
    const selectedPointId = store.state.projectConfig?.selectedBuryPointIds?.[0]
    
    if (selectedPointId) {
      const cachedData = await dataPreloadService.getMultiDayCachedData(dateRange, selectedPointId)
      
      if (cachedData && cachedData.length > 0) {
        // 从实际数据中提取页面名称，过滤掉模板字符串
        const availablePages = [...new Set(cachedData.map(item => item.pageName).filter(name => name && !name.includes('{{') && !name.includes('}}')))].sort()
        console.log('🔍 动态获取到可用页面:', availablePages.slice(0, 10))
        return availablePages
      }
    }
    
    return []
  } catch (error) {
    console.error('获取可用页面列表时出错:', error)
    return []
  }
}

const checkPageExists = async (pageName) => {
  try {
    console.log('检查页面存在性:', pageName)
    
    // 从缓存数据中查询页面是否存在
    const { dataPreloadService } = await import('@/services/dataPreloadService')
    
    // 获取最近7天的数据来检查页面是否存在
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - 7)
    
    const dateRange = [startDate, endDate]
    const selectedPointId = store.state.projectConfig?.selectedBuryPointIds?.[0]
    
    if (selectedPointId) {
      const cachedData = await dataPreloadService.getMultiDayCachedData(dateRange, selectedPointId)
      
      if (cachedData && cachedData.length > 0) {
        // 先打印所有页面名称用于调试
        const allPageNames = [...new Set(cachedData.map(item => item.pageName).filter(name => name))]
        console.log('🔍 实际数据中的所有页面名称:', allPageNames)
        console.log('🔍 当前检查的页面名称:', pageName)
        
        // 检查页面名称是否存在于实际数据中（严格匹配）
        let matchedPage = null
        const pageExists = cachedData.some(item => {
          if (!item.pageName) return false
          
          // 精确匹配
          if (item.pageName === pageName) {
            matchedPage = item.pageName
            return true
          }
          
          // 智能匹配：去除常见后缀后严格比较
          const cleanPageName = pageName.replace(/页面$|访问量$|的访问$/, '').trim()
          const cleanItemPageName = item.pageName.replace(/页面$|访问量$|的访问$/, '').trim()
          
          // 严格匹配：去除后缀后必须完全相同
          if (cleanPageName === cleanItemPageName) {
            matchedPage = item.pageName
            return true
          }
          
          return false
        })
        
        console.log(`🔍 页面匹配结果: "${pageName}" ${pageExists ? `→ 匹配到 "${matchedPage}"` : '→ 未找到匹配'}`)
        return pageExists
      }
    }
    
    // 如果没有缓存数据，降级使用AI判断
    console.log('无缓存数据，使用AI判断页面存在性')
    return await checkPageExistsWithAI(pageName)
  } catch (error) {
    console.error('检查页面存在性时出错:', error)
    return false
  }
}

const generateAIResponse = async (userMessage) => {
  const message = userMessage.toLowerCase()
  
  // 需求澄清逻辑 - 使用AI智能检测
  const analysisType = await detectAnalysisTypeWithAI(userMessage)
  if (analysisType === 'page_visits') {
    // 使用AI智能检测是否包含特定页面名称
    const extractedPageName = await extractPageNameWithAI(userMessage)
    const hasSpecificPage = extractedPageName !== null
    
    if (hasSpecificPage) {
      // 使用AI智能提取页面名称
      const pageName = await extractPageNameWithAI(userMessage) || userMessage.replace(/分析|页面访问|访问量|的访问/g, '').trim()
      
      // 检查页面是否真实存在
      const pageExists = await checkPageExists(pageName)
      
      if (!pageExists) {
        // 页面不存在，直接告诉用户并显示实际可用的页面
        const availablePages = await getAvailablePages()
        
        // 直接添加消息并停止处理
        addMessage(`❌ 抱歉，系统中没有找到"${pageName}"这个页面。\n\n请检查页面名称是否正确，或者从以下可用页面中选择：\n\n${availablePages.slice(0, 10).map(page => `• ${page}`).join('\n')}${availablePages.length > 10 ? `\n\n...还有${availablePages.length - 10}个页面` : ''}\n\n💡 提示：请从上述页面中选择一个正确的页面名称。`, 'ai')
        
        // 返回null阻止继续处理
        return null
      } else {
        // 页面存在，提供分析选项
        return {
          content: `✅ 好的，我理解您想分析"${pageName}"的访问情况。\n\n我可以为您提供以下分析：\n\n• UV/PV统计 - 查看页面的访问量数据\n• 时间趋势 - 分析访问量的变化趋势\n• 详细数据 - 获取具体的访问记录\n\n请选择您想要的分析类型：`,
        actions: [
          { text: `分析${pageName}页面访问量`, type: 'analyze', params: { type: 'page_visits', scope: 'specific', pageName: userMessage } },
          { text: `查看${pageName}访问趋势`, type: 'analyze', params: { type: 'trend', scope: 'specific', pageName: userMessage } },
          { text: `获取${pageName}详细数据`, type: 'analyze', params: { type: 'page_visits', scope: 'detailed', pageName: userMessage } }
        ]
      }
    } }
  }
  
  // 使用AI智能检测其他分析类型
  if (analysisType === 'conversion') {
    return {
      content: '转化分析是很有价值的！我可以帮您分析：\n\n• 用户从访问到转化的完整路径\n• 各环节的转化率\n• 流失点分析\n• 优化建议\n\n您想分析哪个转化流程？',
      actions: [
        { text: '整体转化漏斗', type: 'analyze', params: { type: 'conversion', scope: 'funnel' } },
        { text: '特定页面转化', type: 'analyze', params: { type: 'conversion', scope: 'page' } }
      ]
    }
  } else if (analysisType === 'user_click') {
    return {
      content: '您想分析用户点击行为。我可以为您提供以下分析：\n\n• 点击热度分析 - 查看页面各区域的点击情况\n• 按钮点击分析 - 分析不同按钮的点击率\n• 用户行为路径 - 追踪用户的点击路径\n\n请选择您想要的分析类型：',
      actions: [
        { text: '点击热度分析', type: 'analyze', params: { type: 'click_heatmap', scope: 'heat' } },
        { text: '按钮点击分析', type: 'analyze', params: { type: 'button_click', scope: 'rate' } },
        { text: '用户行为路径', type: 'analyze', params: { type: 'user_journey', scope: 'path' } }
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
  } else if (action.type === 'select_page_for_buttons') {
    // 选择页面进行按钮分析
    await handleSelectPageForButtons(action.params)
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
    let currentPointId = store.state.apiConfig?.selectedPointId
    
    // 如果apiConfig中的selectedPointId为null，使用组件内的selectedBuryPointId
    if (!currentPointId && selectedBuryPointId.value) {
      currentPointId = selectedBuryPointId.value
      console.log('🔍 apiConfig.selectedPointId为null，使用selectedBuryPointId:', currentPointId)
    }
    
    console.log('🔍 从缓存数据提取页面列表...')
    console.log('🔍 当前埋点ID:', currentPointId)
    console.log('🔍 store.state.apiConfig:', store.state.apiConfig)
    console.log('🔍 store.state.projectConfig:', store.state.projectConfig)
    console.log('🔍 selectedBuryPointId.value:', selectedBuryPointId.value)
    console.log('🔍 日期范围:', dateRange.value)
    const cachedData = await dataPreloadService.getMultiDayCachedData(dateRange.value, currentPointId)
    console.log('🔍 获取到的缓存数据长度:', cachedData ? cachedData.length : 0)
    
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

我找到了 ${availablePages.length} 个可用页面，请选择您要分析点击行为的页面：`

        const quickPages = availablePages.slice(0, 10)
        actions = [
          ...quickPages.map(page => ({
            text: page.length > 20 ? page.substring(0, 17) + '...' : page,
            type: 'select_page_for_buttons',
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

const handleSelectPageForButtons = async (params) => {
  const { pageName } = params
  
  try {
    // 显示加载状态
    addMessage(`正在加载页面 "${pageName}" 的按钮数据...`, 'ai')
    
    // 获取当前埋点配置
    const currentPointId = store.state.apiConfig?.selectedPointId
    
    // 获取缓存数据
    const cachedData = await dataPreloadService.getMultiDayCachedData(dateRange.value, currentPointId)
    
    if (!cachedData || cachedData.length === 0) {
      addMessage(`❌ 未找到页面 "${pageName}" 的数据，请检查数据预加载状态。`, 'ai')
      return
    }
    
    // 提取按钮信息
    const buttons = extractButtonsFromMultiDayData(cachedData, pageName)
    
    if (buttons.length === 0) {
      addMessage(`❌ 页面 "${pageName}" 没有找到按钮点击数据。`, 'ai')
      return
    }
    
    // 设置按钮选择弹窗数据
    selectedPageName.value = pageName
    availableButtons.value = buttons
    buttonSelectionModalVisible.value = true
    
    // 添加确认消息
    addMessage(`✅ 找到页面 "${pageName}" 的 ${buttons.length} 个按钮，请选择要分析的按钮。`, 'ai')
    
  } catch (error) {
    console.error('加载按钮数据失败:', error)
    addMessage(`❌ 加载按钮数据失败: ${error.message}`, 'ai')
  }
}

const handleButtonSelection = (button) => {
  // 关闭按钮选择弹窗
  buttonSelectionModalVisible.value = false
  
  // 检查是否是"全部按钮点击量"选项
  if (button.type === 'all_buttons') {
    // 设置需求文本
    const requirement = `#${selectedPageName.value} 页面的全部按钮点击量分析（按天展示）`
    
    // 触发分析
    emit('analyze-requirement', {
      requirement,
      type: 'button_click_daily',
      scope: 'all_buttons',
      pageName: selectedPageName.value
    })
    
    // 添加确认消息
    addMessage(`✅ 开始分析页面 "${selectedPageName.value}" 的全部按钮点击量（按天展示）。`, 'ai')
  } else {
    // 设置需求文本
    const requirement = `#${selectedPageName.value} 页面的"${button.content}"按钮点击分析`
    
    // 触发分析
    emit('analyze-requirement', {
      requirement,
      type: 'button_click_analysis',
      pageName: selectedPageName.value,
      buttonName: button.content,
      buttonData: button
    })
    
    // 添加确认消息
    addMessage(`✅ 开始分析页面 "${selectedPageName.value}" 的"${button.content}"按钮点击情况。`, 'ai')
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
  
  // 清空后根据当前埋点类型显示提示词
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
    console.log('loadChatHistory - 检查localStorage中的聊天历史:', saved ? '有历史记录' : '无历史记录')
    if (saved) {
      const history = JSON.parse(saved)
      console.log('loadChatHistory - 加载到历史记录数量:', history.length)
      messages.value = history
      return history.length > 0
    }
  } catch (error) {
    console.error('加载聊天历史失败:', error)
  }
  console.log('loadChatHistory - 返回false，无历史记录')
  return false
}

// 监听消息变化，自动保存
watch(messages, () => {
  saveChatHistory()
}, { deep: true })

// 初始化欢迎消息
onMounted(() => {
  // 初始化埋点选择（支持新的分离配置）
  const projectConfig = store.state.projectConfig
  let initialBuryPointId = null
  
  if (projectConfig.visitBuryPointId || projectConfig.clickBuryPointId) {
    // 优先使用当前已选择的埋点
    const currentSelectedId = store.state.apiConfig.selectedPointId
    if (currentSelectedId && (currentSelectedId === projectConfig.visitBuryPointId || currentSelectedId === projectConfig.clickBuryPointId)) {
      initialBuryPointId = currentSelectedId
      console.log('使用当前已选择的埋点:', initialBuryPointId)
    } else {
      // 如果没有当前选择，检查localStorage中的默认埋点类型偏好
      const defaultBuryPointType = localStorage.getItem('defaultBuryPointType')
      console.log('检查localStorage中的偏好设置:', defaultBuryPointType)
      console.log('可用的埋点配置:', {
        visitBuryPointId: projectConfig.visitBuryPointId,
        clickBuryPointId: projectConfig.clickBuryPointId
      })
      
      if (defaultBuryPointType === 'click' && projectConfig.clickBuryPointId) {
        // 用户偏好点击埋点
        initialBuryPointId = projectConfig.clickBuryPointId
        console.log('使用用户偏好的点击埋点:', initialBuryPointId)
      } else if (defaultBuryPointType === 'visit' && projectConfig.visitBuryPointId) {
        // 用户偏好访问埋点
        initialBuryPointId = projectConfig.visitBuryPointId
        console.log('使用用户偏好的访问埋点:', initialBuryPointId)
      } else {
        // 默认优先使用访问埋点，如果没有则使用点击埋点
        initialBuryPointId = projectConfig.visitBuryPointId || projectConfig.clickBuryPointId
        console.log('使用默认埋点选择:', initialBuryPointId)
        console.log('偏好设置无效的原因:', {
          defaultBuryPointType,
          hasClickPoint: !!projectConfig.clickBuryPointId,
          hasVisitPoint: !!projectConfig.visitBuryPointId
        })
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
})

const showWelcomeMessage = () => {
  console.log('showWelcomeMessage - 开始显示欢迎消息')
  console.log('showWelcomeMessage - selectedBuryPointId.value:', selectedBuryPointId.value)
  console.log('showWelcomeMessage - store.state.projectConfig:', store.state.projectConfig)
  // 获取当前选择的埋点类型
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
        text: '整体页面访问量', 
        type: 'analyze', 
        params: { type: 'page_visits', scope: 'all' } 
      },
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
  align-items: center;
  gap: 24px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 8px;
  flex-wrap: wrap;
}

.config-item {
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
  white-space: nowrap;
  font-weight: 500;
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
