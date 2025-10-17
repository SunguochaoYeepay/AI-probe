import { REQUIREMENT_MAPPING } from '@/config/api'
import OllamaService from './ollamaService'

/**
 * 需求理解引擎
 */
export class RequirementParser {
  constructor(config = {}) {
    this.mapping = REQUIREMENT_MAPPING
    this.useAI = config.useAI !== false // 默认启用 AI
    this.ollamaService = null
    this.availableFields = []
    
    // 如果启用 AI，初始化 Ollama 服务
    if (this.useAI) {
      this.ollamaService = new OllamaService(config.ollama || {})
    }
  }
  
  /**
   * 设置可用的数据字段
   * @param {Array} fields 字段列表
   */
  setAvailableFields(fields) {
    this.availableFields = fields
  }
  
  /**
   * 解析用户需求（主方法）
   * @param {string} requirement 用户需求描述
   * @param {Object} context 上下文信息（如页面名称等）
   * @returns {Promise<Object>} 解析结果
   */
  async parse(requirement, context = {}) {
    // 如果启用 AI 且 Ollama 可用，优先使用 AI 理解
    if (this.useAI && this.ollamaService) {
      try {
        const aiAvailable = await this.ollamaService.checkAvailability()
        if (aiAvailable) {
          console.log('使用 Ollama AI 理解需求...')
          return await this.parseWithAI(requirement, context)
        } else {
          console.warn('Ollama 服务不可用，降级到关键词匹配')
        }
      } catch (error) {
        console.error('AI 解析失败，降级到关键词匹配:', error)
      }
    }
    
    // 降级到关键词匹配
    console.log('使用关键词匹配解析需求...')
    return this.parseWithKeywords(requirement)
  }
  
  /**
   * 使用 AI 解析需求
   * @param {string} requirement 用户需求
   * @param {Object} context 上下文信息
   * @returns {Promise<Object>}
   */
  async parseWithAI(requirement, context = {}) {
    const result = await this.ollamaService.parseRequirement(
      requirement, 
      this.availableFields,
      context
    )
    
    if (result.success) {
      const aiAnalysis = result.analysis
      
      return {
        intent: aiAnalysis.intent || 'comparison',
        chartType: aiAnalysis.chartType || 'bar',
        description: aiAnalysis.description || requirement,
        confidence: aiAnalysis.confidence || 0.8,
        dataFields: aiAnalysis.dataFields || [],
        dimensions: aiAnalysis.dimensions || [],
        metrics: aiAnalysis.metrics || [],
        buryPointType: this.inferBuryPointType(aiAnalysis.intent || 'comparison'),
        originalText: requirement,
        source: 'ai',
        rawAIResponse: result.rawResponse
      }
    } else {
      // AI 解析失败，降级到关键词匹配
      return this.parseWithKeywords(requirement)
    }
  }
  
  /**
   * 使用关键词匹配解析需求（改进版）
   * @param {string} requirement 用户需求
   * @returns {Object}
   */
  parseWithKeywords(requirement) {
    console.log('🔍 使用关键词匹配解析需求:', requirement)
    
    const analysis = {
      intent: null,
      chartType: null,
      parameters: {},
      confidence: 0,
      originalText: requirement,
      source: 'keywords'
    }
    
    // 智能解析页面名称和日期
    const pageNameMatch = requirement.match(/(.+?)页面访问量/)
    const dateMatch = requirement.match(/(\d+月\d+日)/)
    
    if (pageNameMatch && pageNameMatch[1]) {
      let pageName = pageNameMatch[1].trim()
      
      // 清理页面名称
      pageName = pageName.replace(/的页面访问量$/, '')
      pageName = pageName.replace(/的访问量$/, '')
      pageName = pageName.replace(/访问量$/, '')
      pageName = pageName.replace(/\d+月\d+日访问量.*$/, '')
      pageName = pageName.replace(/\s*[,，]\s*$/, '').trim()
      
      analysis.parameters.pageName = pageName
      analysis.intent = 'single_page_uv_pv_analysis'
      analysis.chartType = 'single_page_uv_pv_chart'
      analysis.description = `${pageName}页面UV/PV时间趋势分析`
      analysis.confidence = 0.9
      
      console.log('✅ 智能解析结果:', {
        pageName: pageName,
        intent: analysis.intent,
        chartType: analysis.chartType
      })
      
      return analysis
    }
    
    // 1. 关键词匹配
    const matchedCategories = this.matchKeywords(requirement)
    
    // 2. 选择最佳匹配
    if (matchedCategories.length > 0) {
      const bestMatch = matchedCategories.sort((a, b) => b.score - a.score)[0]
      analysis.intent = bestMatch.category
      analysis.chartType = bestMatch.mapping.chartType
      analysis.confidence = bestMatch.score
      analysis.description = bestMatch.mapping.description
      analysis.buryPointType = this.inferBuryPointType(bestMatch.category)
    } else {
      // 默认使用柱状图
      analysis.intent = 'comparison'
      analysis.chartType = 'bar'
      analysis.confidence = 0.3
      analysis.description = '数据对比分析'
      analysis.buryPointType = 'single' // 默认单埋点
    }
    
    // 3. 参数提取
    analysis.parameters = this.extractParameters(requirement)
    
    return analysis
  }
  
  /**
   * 关键词匹配
   * @param {string} requirement 需求文本
   * @returns {Array} 匹配结果
   */
  matchKeywords(requirement) {
    const matchedCategories = []
    
    Object.keys(this.mapping).forEach(category => {
      const mapping = this.mapping[category]
      const matchCount = mapping.keywords.filter(keyword => 
        requirement.includes(keyword)
      ).length
      
      if (matchCount > 0) {
        matchedCategories.push({
          category,
          score: matchCount / mapping.keywords.length,
          mapping
        })
      }
    })
    
    return matchedCategories
  }
  
  /**
   * 提取参数
   * @param {string} requirement 需求文本
   * @returns {Object} 提取的参数
   */
  extractParameters(requirement) {
    const parameters = {}
    
    // 提取页面名称
    const pageMatch = requirement.match(/([\u4e00-\u9fa5]+页面)/g)
    if (pageMatch) {
      parameters.pages = pageMatch.map(page => page.replace('页面', ''))
    }
    
    // 提取按钮名称
    const buttonMatch = requirement.match(/([\u4e00-\u9fa5]+按钮)/g)
    if (buttonMatch) {
      parameters.buttons = buttonMatch.map(button => button.replace('按钮', ''))
    }
    
    // 提取流程名称
    const flowMatch = requirement.match(/([\u4e00-\u9fa5]+流程)/g)
    if (flowMatch) {
      parameters.flows = flowMatch.map(flow => flow.replace('流程', ''))
    }
    
    // 提取时间范围
    const timeMatch = requirement.match(/(最近|过去|近)(\d+)(天|周|月|年)/g)
    if (timeMatch) {
      parameters.timeRange = timeMatch[0]
    }
    
    return parameters
  }
  
  /**
   * 生成分析摘要
   * @param {Object} analysis 分析结果
   * @returns {string} 分析摘要
   */
  generateSummary(analysis) {
    if (!analysis.intent && !analysis.description) {
      return '未能理解您的需求，请尝试更具体的描述'
    }
    
    let summary = ''
    
    // 如果是 AI 返回的结果，使用 AI 的 description
    if (analysis.source === 'ai' && analysis.description) {
      summary = `AI理解：${analysis.description}`
    } else {
      // 使用关键词匹配的结果
      const mapping = this.mapping[analysis.intent]
      summary = mapping ? `理解意图：${mapping.description}` : `理解意图：${analysis.description || '数据分析'}`
    }
    
    // 添加数据字段信息（AI 返回的）
    if (analysis.dataFields && analysis.dataFields.length > 0) {
      summary += `\n数据字段：${analysis.dataFields.join('、')}`
    }
    
    // 添加维度信息（AI 返回的）
    if (analysis.dimensions && analysis.dimensions.length > 0) {
      summary += `\n分析维度：${analysis.dimensions.join('、')}`
    }
    
    // 添加指标信息（AI 返回的）
    if (analysis.metrics && analysis.metrics.length > 0) {
      summary += `\n分析指标：${analysis.metrics.join('、')}`
    }
    
    // 传统参数提取（关键词匹配模式）
    if (analysis.parameters) {
      if (analysis.parameters.pages) {
        summary += `\n涉及页面：${analysis.parameters.pages.join('、')}`
      }
      
      if (analysis.parameters.buttons) {
        summary += `\n涉及按钮：${analysis.parameters.buttons.join('、')}`
      }
      
      if (analysis.parameters.flows) {
        summary += `\n涉及流程：${analysis.parameters.flows.join('、')}`
      }
    }
    
    summary += `\n推荐图表：${this.getChartTypeName(analysis.chartType)}`
    summary += `\n置信度：${(analysis.confidence * 100).toFixed(0)}%`
    
    if (analysis.source) {
      summary += `\n理解来源：${analysis.source === 'ai' ? 'AI智能理解' : '关键词匹配'}`
    }
    
    return summary
  }
  
  /**
   * 根据分析意图推断埋点类型
   * @param {string} intent 分析意图
   * @returns {string} 埋点类型 'single' 或 'dual'
   */
  inferBuryPointType(intent) {
    // 需要双埋点的分析类型
    const dualBuryPointIntents = [
      'conversion_analysis',
      'user_behavior_path', 
      'visit_to_click_conversion',
      'user_journey',
      'funnel_analysis',
      'behavior_analysis'
    ]
    
    return dualBuryPointIntents.includes(intent) ? 'dual' : 'single'
  }

  /**
   * 获取图表类型中文名称
   * @param {string} chartType 图表类型
   * @returns {string} 中文名称
   */
  getChartTypeName(chartType) {
    const typeNames = {
      funnel: '漏斗图',
      line: '折线图',
      bar: '柱状图',
      pie: '饼图',
      value_card: '数值卡片',
      stacked_bar: '堆叠柱状图',
      button_click_analysis: '按钮点击分析图'
    }
    return typeNames[chartType] || chartType
  }
}
