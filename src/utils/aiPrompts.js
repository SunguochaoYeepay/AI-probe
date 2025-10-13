/**
 * AI提示词统一管理
 * 集中管理所有AI相关的提示词，便于维护和修改
 */

export const AI_PROMPTS = {
  // 页面名称提取提示词
  EXTRACT_PAGE_NAME: (userInput) => `请仔细分析用户输入，提取页面名称。

用户输入：${userInput}

请按照以下步骤分析：
1. 识别用户提到的具体页面名称
2. 去除"页面"、"访问量"、"的访问"等通用词汇
3. 返回核心页面名称

示例：
- "分析页面'企业付款-付款结果'的访问量" → 企业付款-付款结果
- "下级管理-开户申请-苏宁-子商户页面访问" → 下级管理-开户申请-苏宁-子商户
- "付款确认页面访问量" → 付款确认

注意：请根据实际输入内容提取，不要返回固定答案。

提取结果：`,

  // 分析类型检测提示词
  DETECT_ANALYSIS_TYPE: (userInput) => `判断用户输入的分析类型。

用户输入：${userInput}

分析类型：
- page_visits: 页面访问量分析
- click_analysis: 点击行为分析
- conversion_analysis: 转化率分析
- general: 通用分析

规则：
- 如果包含"访问量"、"PV"、"UV"等词汇，返回page_visits
- 如果包含"点击"、"button"、"link"等词汇，返回click_analysis
- 如果包含"转化"、"转化率"、"conversion"等词汇，返回conversion_analysis
- 其他情况返回general

分析类型：`,

  // 页面存在性检查提示词
  CHECK_PAGE_EXISTS: (pageName) => `判断页面名称是否存在于企业支付管理系统中。

页面名称：${pageName}

系统包含：老板管账、对账管理、企业付款、易分账、下级管理、账户充值、终端信息等模块。

判断：`,

  // 需求分析提示词
  ANALYZE_REQUIREMENT: (userInput, availablePages, availableFields) => `分析用户需求并生成图表配置。

用户输入：${userInput}

可用页面：${availablePages.join('、')}
可用字段：${availableFields.join('、')}

请分析用户需求并返回JSON格式的配置：
{
  "chartType": "图表类型",
  "pageName": "页面名称（如果有）",
  "dateRange": "日期范围（如果有）",
  "description": "需求描述"
}

图表类型包括：
- single_page_uv_pv_chart: 单页面UV/PV图表
- multi_page_comparison: 多页面对比
- trend_analysis: 趋势分析
- general_analysis: 通用分析

配置：`,

  // 聊天回复生成提示词
  GENERATE_CHAT_RESPONSE: (userInput, context) => `作为数据分析助手，回复用户问题。

用户输入：${userInput}
上下文：${context}

请生成友好的回复，如果无法理解用户需求，请引导用户提供更多信息。

回复：`,

  // 生成示例页面列表提示词
  GENERATE_SAMPLE_PAGES: () => `列出企业支付管理系统中的5个常用页面名称。

系统包含：老板管账、对账管理、企业付款、易分账、下级管理、账户充值、终端信息等模块。

要求：
- 只返回页面名称，每行一个
- 不要编号、不要说明
- 格式：模块名-子模块名-页面名

页面列表：`
}

/**
 * AI响应解析工具函数
 */
export const AI_RESPONSE_PARSERS = {
  // 解析页面名称 - 完全AI驱动，无硬编码
  parsePageName: (response, originalInput = '') => {
    // 完全依赖AI的提取结果，不做任何硬编码处理
    let extractedName = response.trim()
    
    // 如果AI返回null或空字符串，说明没有提取到具体页面名称
    if (!extractedName || extractedName === 'null' || extractedName === 'None') {
      return null
    }
    
    // 只做最基本的清理，移除明显的示例文本
    extractedName = extractedName
      .replace(/^.*?输出[:：]\s*/, '') // 移除 "输出：" 前缀
      .replace(/^.*?页面名称[:：]\s*/, '') // 移除 "页面名称：" 前缀
      .trim()
    
    // 如果AI返回了多个页面名称（用换行符分隔），只取第一个
    if (extractedName.includes('\n')) {
      extractedName = extractedName.split('\n')[0].trim()
    }
    
    // 检查是否是明显的示例文本
    if (extractedName.includes('输入：') || extractedName.includes('输出：') || 
        extractedName.includes('示例') || extractedName.includes('规则') ||
        extractedName.length < 2 || extractedName.length > 100) {
      return null
    }
    
    return extractedName || null
  },

  // 解析分析类型
  parseAnalysisType: (response) => {
    let result = response.trim().toLowerCase()
    
    result = result
      .replace(/^.*?类型[:：]\s*/, '')
      .replace(/^.*?结果[:：]\s*/, '')
      .replace(/^.*?答案[:：]\s*/, '')
      .trim()
    
    // 检查是否包含关键词
    if (result.includes('page_visits') || result.includes('访问量')) {
      return 'page_visits'
    } else if (result.includes('click_analysis') || result.includes('点击')) {
      return 'click_analysis'
    } else if (result.includes('conversion_analysis') || result.includes('转化')) {
      return 'conversion_analysis'
    } else {
      return 'general'
    }
  },

  // 解析页面存在性
  parsePageExists: (response) => {
    let result = response.trim().toLowerCase()
    
    result = result
      .replace(/^.*?判断[:：]\s*/, '')
      .replace(/^.*?结果[:：]\s*/, '')
      .replace(/^.*?答案[:：]\s*/, '')
      .trim()
    
    const exists = result === 'true' || 
                   result === '是' || 
                   result === '存在' ||
                   result.includes('是的') ||
                   result.includes('存在') ||
                   result.includes('属于') ||
                   (result.includes('确实') && !result.includes('不'))
    
    const isNegative = result.includes('不') || result.includes('没有') || result.includes('无') || result === 'false'
    return isNegative ? false : exists
  },

  // 解析JSON配置
  parseJsonConfig: (response) => {
    try {
      // 尝试直接解析JSON
      return JSON.parse(response)
    } catch (error) {
      // 如果直接解析失败，尝试提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0])
        } catch (e) {
          console.error('JSON解析失败:', e)
          return null
        }
      }
      return null
    }
  },

  // 解析示例页面列表
  parseSamplePages: (response) => {
    const pages = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.includes('：') && !line.includes(':') && line.length > 2)
      .map(line => line.replace(/^[\d\.\-\*]+\s*/, '')) // 移除可能的编号
      .slice(0, 5)
    
    return pages.length > 0 ? pages : []
  }
}

/**
 * AI服务配置
 */
export const AI_CONFIG = {
  // 默认生成参数
  DEFAULT_GENERATE_OPTIONS: {
    temperature: 0.1,
    num_predict: 100
  },
  
  // 页面名称提取参数
  PAGE_NAME_EXTRACT_OPTIONS: {
    temperature: 0.3,
    num_predict: 50,
    seed: Math.floor(Math.random() * 1000000) // 增加随机种子
  },
  
  // 分析类型检测参数
  ANALYSIS_TYPE_DETECT_OPTIONS: {
    temperature: 0.1,
    num_predict: 20
  },
  
  // 页面存在性检查参数
  PAGE_EXISTS_CHECK_OPTIONS: {
    temperature: 0.1,
    num_predict: 10
  },
  
  // 生成示例页面参数
  SAMPLE_PAGES_OPTIONS: {
    temperature: 0.3,
    num_predict: 100
  }
}
