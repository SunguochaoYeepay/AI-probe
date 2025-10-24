import { ref } from 'vue'
import { useStore } from 'vuex'
import { dataPreloadService } from '@/services/dataPreloadService'
import { extractButtonsFromMultiDayData, extractQueryConditionsFromMultiDayData, groupQueryConditions } from '@/utils/buttonExtractor'

/**
 * 消息处理和AI响应composable
 */
export function useMessageHandler() {
  const store = useStore()

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

  const analyzeWithAI = async (userMessage, messages, dateRange) => {
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

  const handleFallbackRecognition = async (messageText, addMessage, emit) => {
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

  // 获取可用页面列表
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

  // 检查页面是否存在
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

  return {
    // 方法
    extractPageNameWithAI,
    detectAnalysisTypeWithAI,
    analyzeWithAI,
    generateAIResponse,
    checkIfInputtingPageInfo,
    handleFallbackRecognition,
    getAvailableFields,
    getAvailablePages,
    checkPageExists,
    checkPageExistsWithAI
  }
}
