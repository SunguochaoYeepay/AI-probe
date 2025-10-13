/**
 * Ollama 本地 LLM 服务
 * 用于需求理解和智能分析
 */
export class OllamaService {
  constructor(config = {}) {
    this.baseURL = config.baseURL || 'http://localhost:11434'
    this.model = config.model || 'qwen:latest'
    this.timeout = config.timeout || 30000
  }

  /**
   * 检查 Ollama 服务是否可用
   * @returns {Promise<boolean>}
   */
  async checkAvailability() {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch (error) {
      console.warn('Ollama 服务不可用:', error)
      return false
    }
  }

  /**
   * 获取已安装的模型列表
   * @returns {Promise<Array>}
   */
  async getModels() {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      
      if (!response.ok) {
        throw new Error('获取模型列表失败')
      }
      
      const data = await response.json()
      return data.models || []
    } catch (error) {
      console.error('获取 Ollama 模型列表失败:', error)
      return []
    }
  }

  /**
   * 调用 Ollama 生成
   * @param {string} prompt - 提示词
   * @param {Object} options - 选项
   * @returns {Promise<string>}
   */
  async generate(prompt, options = {}) {
    try {
      const requestBody = {
        model: options.model || this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.3,
          top_p: options.top_p || 0.9,
          num_predict: options.num_predict || 500
        }
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Ollama API 错误: ${response.status}`)
      }

      const data = await response.json()
      return data.response || ''
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Ollama 请求超时')
      }
      throw error
    }
  }

  /**
   * 理解用户的数据分析需求
   * @param {string} requirement - 用户需求描述
   * @param {Array} availableFields - 可用的数据字段
   * @param {Object} context - 上下文信息（如页面名称等）
   * @returns {Promise<Object>} 解析结果
   */
  async parseRequirement(requirement, availableFields = [], context = {}) {
    const prompt = this.buildAnalysisPrompt(requirement, availableFields, context)
    
    try {
      const response = await this.generate(prompt, {
        temperature: 0.1 // 进一步降低温度，获得更确定的结果
      })
      
      console.log('Ollama 原始响应:', response)
      
      // 多种方式提取 JSON
      let jsonStr = response.trim()
      
      // 移除可能的 markdown 代码块标记
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '')
      
      // 尝试多种方式提取 JSON
      let analysis = null
      
      // 方法1: 尝试直接解析整个字符串
      try {
        analysis = JSON.parse(jsonStr)
      } catch (e1) {
        // 方法2: 尝试提取第一个完整的 JSON 对象
        // 使用更精确的匹配，只匹配完整的 JSON 对象
        const jsonMatch = jsonStr.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/)
        if (jsonMatch) {
          try {
            analysis = JSON.parse(jsonMatch[0])
          } catch (e2) {
            // 方法3: 尝试从第一个 { 开始，找到对应的结束 }
            const firstBrace = jsonStr.indexOf('{')
            if (firstBrace !== -1) {
              let braceCount = 0
              let endPos = firstBrace
              for (let i = firstBrace; i < jsonStr.length; i++) {
                if (jsonStr[i] === '{') braceCount++
                if (jsonStr[i] === '}') braceCount--
                if (braceCount === 0) {
                  endPos = i + 1
                  break
                }
              }
              const extractedJson = jsonStr.substring(firstBrace, endPos)
              try {
                analysis = JSON.parse(extractedJson)
              } catch (e3) {
                console.error('JSON 解析失败，原始文本:', jsonStr)
                throw new Error('JSON 解析失败: 无法从响应中提取有效的 JSON')
              }
            } else {
              throw new Error('LLM 未返回有效的 JSON 格式')
            }
          }
        } else {
          throw new Error('LLM 未返回有效的 JSON 格式')
        }
      }
      
      // 验证必需字段
      if (!analysis.chartType || !analysis.intent) {
        console.warn('AI 返回的 JSON 缺少必需字段，尝试修复...')
        // 尝试基于规则补充
        if (!analysis.chartType) {
          analysis.chartType = 'bar' // 默认值
        }
        if (!analysis.intent) {
          analysis.intent = 'comparison' // 默认值
        }
      }
      
      console.log('Ollama AI 理解结果:', analysis)
      
      return {
        success: true,
        analysis,
        rawResponse: response
      }
    } catch (error) {
      console.error('Ollama 需求解析失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 构建需求分析的 Prompt
   * @param {string} requirement - 用户需求
   * @param {Array} availableFields - 可用字段
   * @returns {string} Prompt
   */
  buildAnalysisPrompt(requirement, availableFields, context = {}) {
    const fieldsDescription = availableFields.length > 0 
      ? `可用的数据字段：\n${availableFields.map(f => `- ${f.fieldAlias || f.fieldName}: ${f.fieldName}`).join('\n')}`
      : `可用的数据字段：
- pageName: 页面名称
- type: 类型（页面、窗口等）
- pageBehavior: 页面行为（打开、关闭）
- stayTime: 停留时长
- weUserId: 用户ID
- wePath: 页面路径
- createdAt: 创建时间
- weDeviceName: 设备名称
- weBrowserName: 浏览器名称
- weIp: IP地址
- weCity: 城市`

    // 构建上下文信息
    let contextInfo = ''
    if (context.pageName && context.pageName !== '__ALL__') {
      contextInfo = `\n**重要上下文**：用户选择了特定页面 "${context.pageName}"，请针对此页面进行分析。\n`
    }

    return `分析需求，返回JSON。

需求："${requirement}"${contextInfo}

规则：
- 趋势/时间→line
- 对比/访问量→bar
- 分布/占比→pie
- 转化/流程→funnel
- 总数/统计→value_card
- 按钮点击/点击热度→click_heatmap
- 访问到点击转化→conversion_funnel
- 用户行为路径→user_journey

**重要区分**：
- 如果需求包含特定页面名（如"#页面名"或"页面名 访问量"）→ 单页面分析，使用line显示时间趋势
- 如果需求是通用分析（如"页面访问量"、"访问趋势"）→ 多页面分析，使用对应图表类型

示例：
Q:"访问趋势"
A:{"intent":"trend","chartType":"line","description":"访问量时间趋势","confidence":0.95}

Q:"转化流程"
A:{"intent":"funnel","chartType":"funnel","description":"用户转化流程","confidence":0.95}

Q:"页面访问量"
A:{"intent":"uv_pv_analysis","chartType":"uv_pv_chart","description":"页面访问UV/PV分析","confidence":0.95}

Q:"整站UV/PV趋势分析"
A:{"intent":"uv_pv_analysis","chartType":"line","description":"整站UV/PV趋势分析","confidence":0.95}

Q:"#首页 页面访问量"
A:{"intent":"single_page_analysis","chartType":"line","description":"首页访问量时间趋势","confidence":0.95}

Q:"#下级商户查询 页面访问量"
A:{"intent":"single_page_analysis","chartType":"line","description":"下级商户查询页面访问量时间趋势","confidence":0.95}

Q:"类型分布"
A:{"intent":"distribution","chartType":"pie","description":"类型分布","confidence":0.9}

Q:"按钮点击热度分析"
A:{"intent":"click_analysis","chartType":"click_heatmap","description":"按钮点击热度分析","confidence":0.95}

Q:"访问到点击转化率"
A:{"intent":"conversion","chartType":"conversion_funnel","description":"访问到点击转化分析","confidence":0.95}

Q:"用户操作行为路径"
A:{"intent":"journey","chartType":"user_journey","description":"用户行为路径分析","confidence":0.9}

Q:"按钮点击UV/PV对比"
A:{"intent":"click_uv_pv","chartType":"click_uv_pv_chart","description":"按钮点击UV/PV对比分析","confidence":0.95}

现在分析："${requirement}"
只返回JSON：`
  }

  /**
   * 使用 Ollama 进行数据洞察
   * @param {Object} analysis - 分析结果
   * @param {Array} data - 数据样本
   * @returns {Promise<Object>}
   */
  async generateInsights(analysis, data) {
    // 取前 5 条数据作为样本
    const dataSample = data.slice(0, 5).map(item => ({
      pageName: item.pageName,
      type: item.type,
      pageBehavior: item.pageBehavior,
      stayTime: item.stayTime
    }))

    const prompt = `基于以下数据分析结果，生成洞察和建议：

分析意图: ${analysis.description}
图表类型: ${analysis.chartType}
数据总量: ${data.length} 条

数据样本:
${JSON.stringify(dataSample, null, 2)}

请用中文生成 3-5 条关键洞察和建议，每条不超过 50 字。
直接返回洞察列表，每行一条，格式如：
1. xxx
2. xxx
3. xxx`

    try {
      const response = await this.generate(prompt, {
        temperature: 0.5,
        num_predict: 300
      })
      
      // 提取洞察列表
      const insights = response
        .split('\n')
        .filter(line => line.trim().match(/^\d+\./))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
      
      return {
        success: true,
        insights
      }
    } catch (error) {
      console.error('生成洞察失败:', error)
      return {
        success: false,
        insights: []
      }
    }
  }

  /**
   * 与用户进行智能对话
   * @param {Object} params 对话参数
   * @returns {Promise<Object>}
   */
  async chatWithUser({ message, conversationHistory = [], context = {} }) {
    const systemPrompt = `你是一个专业的数据分析师助手，专门帮助用户明确数据分析需求。

你的任务：
1. 理解用户的分析需求
2. 通过提问澄清不明确的地方
3. 提供专业的分析建议
4. 生成可操作的分析方案

可用数据字段：${context.availableFields?.join(', ') || '页面访问量、UV、PV、点击量等'}
分析时间范围：${context.dateRange ? `${context.dateRange[0]} 至 ${context.dateRange[1]}` : '未设置'}

请用友好、专业的语调回复，并适时提供快捷操作按钮。`

    // 构建对话历史
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ]

    try {
      const response = await this.generateChat(messages, {
        temperature: 0.7,
        num_predict: 400
      })

      // 解析AI回复，提取可能的操作按钮
      const actions = this.extractActions(response)
      
      return {
        success: true,
        content: response,
        actions,
        rawResponse: response
      }
    } catch (error) {
      console.error('AI对话失败:', error)
      return {
        success: false,
        content: '抱歉，我遇到了一些技术问题。请稍后再试。',
        actions: []
      }
    }
  }

  /**
   * 生成聊天对话
   * @param {Array} messages 消息数组
   * @param {Object} options 生成选项
   * @returns {Promise<string>}
   */
  async generateChat(messages, options = {}) {
    const prompt = messages.map(msg => {
      const role = msg.role === 'system' ? 'System' : 
                   msg.role === 'user' ? 'Human' : 'Assistant'
      return `${role}: ${msg.content}`
    }).join('\n\n') + '\n\nAssistant:'

    return await this.generate(prompt, options)
  }

  /**
   * 从AI回复中提取可能的操作按钮
   * @param {string} response AI回复内容
   * @returns {Array} 操作按钮数组
   */
  extractActions(response) {
    const actions = []
    const text = response.toLowerCase()

    // 检测页面访问量相关
    if (text.includes('页面访问量') || text.includes('访问量')) {
      actions.push({
        text: '分析页面访问量',
        type: 'analyze',
        params: { type: 'page_visits', scope: 'all' }
      })
    }

    // 检测趋势分析
    if (text.includes('趋势') || text.includes('变化')) {
      actions.push({
        text: '显示访问趋势',
        type: 'analyze',
        params: { type: 'trend', scope: 'overall' }
      })
    }

    // 检测转化分析
    if (text.includes('转化') || text.includes('漏斗')) {
      actions.push({
        text: '分析转化流程',
        type: 'analyze',
        params: { type: 'conversion', scope: 'funnel' }
      })
    }

    // 检测设备分析
    if (text.includes('设备') || text.includes('浏览器')) {
      actions.push({
        text: '设备类型分析',
        type: 'analyze',
        params: { type: 'device', scope: 'type' }
      })
    }

    return actions
  }
}

export default OllamaService

