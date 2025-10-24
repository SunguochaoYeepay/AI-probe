import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { useStore } from 'vuex'
import { dataPreloadService } from '@/services/dataPreloadService'
import { useDataFetch } from '@/composables/useDataFetch'
import { extractButtonsFromMultiDayData, extractQueryConditionsFromMultiDayData, groupQueryConditions } from '@/utils/buttonExtractor'

/**
 * AI聊天核心功能composable
 */
export function useAIChat() {
  const store = useStore()
  const { fetchMultiDayData } = useDataFetch()

  // 响应式数据
  const messages = ref([])
  const inputMessage = ref('')
  const isAIThinking = ref(false)
  const messagesContainer = ref(null)

  // 快捷建议
  const quickSuggestions = ref([
    '分析首页访问量',
    '查看商品页点击情况',
    '用户注册转化流程',
    '按钮点击热度分析',
    '页面访问趋势',
    '购买转化漏斗'
  ])

  // 方法
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

  const clearChat = () => {
    messages.value = []
    localStorage.removeItem('ai_chat_history')
    message.success('对话已清空')
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

  return {
    // 响应式数据
    messages,
    inputMessage,
    isAIThinking,
    messagesContainer,
    quickSuggestions,
    
    // 方法
    formatTime,
    formatMessage,
    addMessage,
    scrollToBottom,
    handleEnterKey,
    clearChat,
    saveChatHistory,
    loadChatHistory
  }
}
