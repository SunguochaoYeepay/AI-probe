/**
 * AI提取工具函数
 * 统一管理所有AI提取相关的功能
 */

import { OllamaService } from '@/utils/ollamaService'
import { AI_PROMPTS, AI_RESPONSE_PARSERS, AI_CONFIG } from '@/utils/aiPrompts'

/**
 * 检查是否是通用描述，没有具体页面名称
 * @param {string} text - 要检查的文本
 * @returns {boolean} 是否是通用描述
 */
/**
 * 检查是否是通用描述，没有具体页面名称
 * @param {string} text - 要检查的文本
 * @returns {boolean} 是否是通用描述
 */
const isGenericDescription = (text) => {
  if (!text || typeof text !== 'string') return true
  
  // 检查是否为通用描述，不硬编码具体页面名称
  const genericPatterns = [
    /^页面访问量$/,
    /^访问量$/,
    /^页面访问$/,
    /^页面$/,
    /^访问$/,
    /^pv$/i,
    /^uv$/i,
    /^无具体页面名称$/,
    /^null$/i,
    /^空$/,
    /^无$/,
    // 检查是否包含常见通用词汇组合
    /首页.*访问量$/,
    /主页.*访问量$/,
    /首页.*访问$/,
    /主页.*访问$/,
    /.*页面.*访问量$/,
    /.*页面.*访问$/
  ]
  
  return genericPatterns.some(pattern => pattern.test(text.trim()))
}

/**
 * 使用AI智能提取页面名称
 * @param {string} userMessage - 用户输入的消息
 * @returns {Promise<string|null>} 提取的页面名称
 */
export const extractPageNameWithAI = async (userMessage) => {
  try {
    console.log('🔍 AI提取页面名称 - 原始输入:', userMessage)
    
    // 检查是否是通用描述，没有具体页面名称
    if (isGenericDescription(userMessage)) {
      console.log('🔍 检测到通用描述，无具体页面名称')
      return null
    }
    
    // 先尝试简单的文本提取作为备用方案
    const simpleExtract = extractPageNameSimple(userMessage)
    if (simpleExtract) {
      console.log('🔍 简单提取成功:', simpleExtract)
      return simpleExtract
    }
    
    // 如果简单提取失败，再使用AI
    const ollamaService = new OllamaService()
    
    const prompt = AI_PROMPTS.EXTRACT_PAGE_NAME(userMessage)
    console.log('🔍 AI提取页面名称 - 提示词:', prompt)
    const response = await ollamaService.generate(prompt, AI_CONFIG.PAGE_NAME_EXTRACT_OPTIONS)
    console.log('🔍 AI提取页面名称 - 原始响应:', response)
    
    // 传入原始输入，让解析器优先提取引号内容
    const extractedName = AI_RESPONSE_PARSERS.parsePageName(response, userMessage)
    console.log('🔍 AI提取页面名称 - 解析结果:', extractedName)
    
    // 如果AI返回的结果是通用描述，返回null
    if (isGenericDescription(extractedName)) {
      console.log('🔍 AI返回的是通用描述，返回null')
      return null
    }
    
    return extractedName
  } catch (error) {
    console.error('AI提取页面名称失败:', error)
    // AI失败时，尝试简单提取
    return extractPageNameSimple(userMessage)
  }
}

/**
 * 简单的页面名称提取（备用方案）
 * @param {string} userMessage - 用户输入的消息
 * @returns {string|null} 提取的页面名称
 */
const extractPageNameSimple = (userMessage) => {
  try {
    // 1. 提取引号内的内容
    const quotedMatch = userMessage.match(/[""''`]([^""''`]+)[""''`]/)
    if (quotedMatch) {
      const extracted = quotedMatch[1].trim()
      console.log('🔍 引号提取:', extracted)
      return extracted
    }
    
    // 2. 提取"分析页面XXX的访问量"模式
    const pageMatch = userMessage.match(/分析页面[""''`]?([^""''`的访问量]+)[""''`]?的访问量/)
    if (pageMatch) {
      const extracted = pageMatch[1].trim()
      console.log('🔍 页面模式提取:', extracted)
      return extracted
    }
    
    // 3. 提取"XXX页面访问量"模式
    const simpleMatch = userMessage.match(/([^页面访问量]+)页面访问量/)
    if (simpleMatch) {
      const extracted = simpleMatch[1].trim()
      console.log('🔍 简单模式提取:', extracted)
      return extracted
    }
    
    // 4. 如果包含"页面"关键词，提取前面的内容
    const pageKeywordMatch = userMessage.match(/(.+?)页面/)
    if (pageKeywordMatch) {
      const extracted = pageKeywordMatch[1].trim()
      // 过滤掉常见的分析词汇
      if (!extracted.includes('分析') && !extracted.includes('查看') && extracted.length > 1) {
        console.log('🔍 关键词提取:', extracted)
        return extracted
      }
    }
    
    console.log('🔍 简单提取失败')
    return null
  } catch (error) {
    console.error('简单提取失败:', error)
    return null
  }
}

/**
 * 使用AI智能检测分析类型
 * @param {string} messageText - 用户输入的消息
 * @returns {Promise<string|null>} 分析类型
 */
export const detectAnalysisTypeWithAI = async (messageText) => {
  try {
    const ollamaService = new OllamaService()
    
    const prompt = AI_PROMPTS.DETECT_ANALYSIS_TYPE(messageText)
    const response = await ollamaService.generate(prompt, AI_CONFIG.ANALYSIS_TYPE_DETECT_OPTIONS)
    
    const result = AI_RESPONSE_PARSERS.parseAnalysisType(response)
    
    if (result) {
      console.log(`AI检测到分析类型: ${result}`, '原始响应:', response)
    }
    
    return result
  } catch (error) {
    console.error('AI检测分析类型失败:', error)
    return null
  }
}

/**
 * 使用AI智能判断页面是否存在
 * @param {string} pageName - 页面名称
 * @returns {Promise<boolean>} 页面是否存在
 */
export const checkPageExistsWithAI = async (pageName) => {
  try {
    const ollamaService = new OllamaService()
    
    const prompt = AI_PROMPTS.CHECK_PAGE_EXISTS(pageName)
    const response = await ollamaService.generate(prompt, AI_CONFIG.PAGE_EXISTS_CHECK_OPTIONS)
    
    const finalResult = AI_RESPONSE_PARSERS.parsePageExists(response)
    
    console.log(`AI判断页面"${pageName}"存在性:`, finalResult, '原始响应:', response)
    return finalResult
  } catch (error) {
    console.error('AI判断页面存在性失败:', error)
    return false
  }
}
