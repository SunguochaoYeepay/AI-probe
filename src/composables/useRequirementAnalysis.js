import { ref } from 'vue'
import { useStore } from 'vuex'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { RequirementParser } from '@/utils/requirementParser'
import { useDataFetch } from '@/composables/useDataFetch'
import { useChart } from '@/composables/useChart'
import { dataPreloadService } from '@/services/dataPreloadService'

/**
 * 需求分析相关的逻辑
 */
export function useRequirementAnalysis() {
  const store = useStore()
  const { fetchMultiDayData } = useDataFetch()
  const { generateChart, extractPageNames } = useChart()
  
  // 响应式数据
  const currentRequirement = ref('')
  const analyzing = ref(false)
  const analysisMode = ref('single')
  
  // 需求解析器
  let requirementParser = null

  /**
   * 初始化需求解析器
   */
  const initRequirementParser = () => {
    const ollamaConfig = store.state.ollamaConfig
    requirementParser = new RequirementParser({
      useAI: ollamaConfig.enabled,
      ollama: {
        baseURL: ollamaConfig.baseURL,
        model: ollamaConfig.model,
        timeout: ollamaConfig.timeout
      }
    })
    console.log('需求解析器初始化完成，AI 模式:', ollamaConfig.enabled ? '启用' : '禁用')
  }

  /**
   * 通用需求分析
   */
  const analyzeRequirement = async (dateRangeOrRequest) => {
    // 检查参数类型，支持直接传入分析请求对象
    let dateRange, analysisRequest
    if (dateRangeOrRequest && typeof dateRangeOrRequest === 'object' && dateRangeOrRequest.type) {
      // 传入的是分析请求对象
      analysisRequest = dateRangeOrRequest
      dateRange = analysisRequest.dateRange || [dayjs().subtract(6, 'day'), dayjs()] // 默认最近7天
      
      // 设置当前需求
      if (analysisRequest.type === 'page_visits' && analysisRequest.pageName) {
        currentRequirement.value = `#${analysisRequest.pageName} 页面访问量`
      }
    } else {
      // 传入的是日期范围
      dateRange = dateRangeOrRequest
    }
    
    if (!currentRequirement.value.trim()) {
      message.warning('请输入分析需求')
      return
    }
    
    if (!requirementParser) {
      console.log('需求解析器未初始化，正在自动初始化...')
      initRequirementParser()
    }
    
    analyzing.value = true
    
    // 开始图表生成loading状态
    store.dispatch('updateChartGenerationStatus', {
      isGenerating: true,
      currentStep: '正在分析需求...',
      progress: 10
    })
    
    try {
      // 构建上下文信息
      const context = {}
      
      // 如果当前需求包含页面名称信息，提取出来
      const pageNameMatch = currentRequirement.value.match(/(.+?)页面访问量/)
      if (pageNameMatch && pageNameMatch[1]) {
        context.pageName = pageNameMatch[1].trim()
      }
      
      // 解析需求（现在是异步的，支持 AI 理解）
      let analysis = await requirementParser.parse(currentRequirement.value, context)
      
      // 检测整站UV/PV分析并强制转换为UV/PV分析
      if (currentRequirement.value.includes('整站UV/PV趋势分析') || currentRequirement.value.includes('整站UV/PV')) {
        console.log('检测到整站UV/PV分析，强制转换为UV/PV分析')
        analysis = {
          ...analysis,
          intent: 'uv_pv_analysis',
          chartType: 'line',
          description: '整站UV/PV趋势分析'
        }
      }
      
      // 检测单页面查询并强制转换为正确的图表类型（排除按钮点击分析）
      const specifiedPages = await extractPageNames(currentRequirement.value)
      if (specifiedPages.length > 0 && 
          !analysis.chartType?.includes('button_click_analysis') && 
          !analysis.chartType?.includes('button_click_daily') &&
          analysis.chartType !== 'button_click_analysis' &&
          analysis.chartType !== 'button_click_daily') {
        console.log('检测到单页面查询，强制转换为UV/PV时间组合图')
        
        // 根据分析类型生成具体的描述
        const analysisType = store.state.apiConfig.selectedAnalysisType || 'page_analysis'
        let specificDescription = ''
        
        if (analysisType === 'page_analysis') {
          specificDescription = `分析页面"${specifiedPages[0]}"的访问量数据`
        } else if (analysisType === 'click_analysis') {
          specificDescription = `分析页面"${specifiedPages[0]}"的点击行为`
        } else if (analysisType === 'behavior_analysis') {
          specificDescription = `分析页面"${specifiedPages[0]}"的用户行为`
        } else {
          specificDescription = `分析页面"${specifiedPages[0]}"的数据`
        }
        
        analysis = {
          ...analysis,
          intent: 'single_page_uv_pv_analysis',
          chartType: 'single_page_uv_pv_chart',
          description: specificDescription, // 使用具体的页面分析描述
          parameters: {
            ...analysis.parameters,
            pageName: specifiedPages[0]
          }
        }
      } else {
        console.log('✅ 使用AI分析结果:', analysis)
      }
      
      console.log('需求分析结果:', analysis)
      
      // 更新生成状态 - 需求分析完成
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: true,
        currentStep: '正在获取数据...',
        progress: 30
      })
      
      // 根据分析结果自动设置埋点类型
      if (analysis.buryPointType) {
        analysisMode.value = analysis.buryPointType
        console.log(`自动设置埋点类型: ${analysis.buryPointType}`)
      }
      
      // 更新状态
      store.dispatch('updateRequirement', currentRequirement.value)
      store.dispatch('updateAnalysisResult', {
        ...analysis,
        summary: requirementParser.generateSummary(analysis)
      })
      
      // 检查预加载状态，如果正在进行中则等待完成
      const preloadStatus = dataPreloadService.getStatus()
      if (preloadStatus.isPreloading) {
        console.log('⏳ 数据预加载正在进行中，等待完成...')
        message.loading('数据预加载中，请稍候...', 0)
        
        // 等待预加载完成（最多等待30秒）
        let waitTime = 0
        const maxWaitTime = 30000 // 30秒
        
        while (preloadStatus.isPreloading && waitTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, 1000)) // 等待1秒
          waitTime += 1000
          
          // 更新状态
          const currentStatus = dataPreloadService.getStatus()
          if (!currentStatus.isPreloading) {
            break
          }
        }
        
        message.destroy() // 清除loading消息
        
        if (waitTime >= maxWaitTime) {
          console.warn('⏰ 预加载等待超时，继续使用API获取数据')
        } else {
          console.log('✅ 数据预加载已完成，继续分析')
        }
      }
      
      // 获取数据并生成图表（使用缓存机制）
      console.log('🔍 开始获取数据，优先使用预加载缓存...')
      
      // 更新生成状态 - 开始获取数据
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: true,
        currentStep: '正在获取数据...',
        progress: 50
      })
      
      // 添加调试信息
      console.log('🔍 数据获取前的配置状态:')
      console.log('  分析模式:', analysisMode.value)
      console.log('  项目配置:', store.state.projectConfig)
      console.log('  API配置:', store.state.apiConfig)
      console.log('  分析结果:', analysis)
      
      const result = await fetchMultiDayData(analysisMode.value, dateRange, analysis)
      
      // 检查是否使用了缓存数据
      if ((result.totalRequests || 0) === 0) {
        console.log('✅ 成功使用预加载缓存数据，无API调用')
        message.success('使用缓存数据，分析完成')
      } else {
        console.log(`⚠️ 调用了 ${(result.totalRequests || 0)} 个API请求`)
        message.warning(`调用了 ${(result.totalRequests || 0)} 个API请求，建议先完成数据预加载`)
      }
      
      // 更新生成状态 - 开始生成图表
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: true,
        currentStep: '正在生成图表...',
        progress: 80
      })
      
      await generateChart(analysis, result.data, dateRange)
      
      // 完成生成
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: false,
        currentStep: '图表生成完成',
        progress: 100
      })
      
    } catch (error) {
      console.error('分析失败:', error)
      
      // 检查是否是页面不存在的错误
      if (error.message && error.message.includes('未找到页面')) {
        // 显示详细的页面不存在错误信息
        message.error({
          content: error.message,
          duration: 10, // 显示更长时间让用户看到页面列表
          style: {
            whiteSpace: 'pre-line' // 支持换行显示
          }
        })
      } else {
        message.error('分析失败，请重试')
      }
      
      // 错误时也要清除loading状态
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: false,
        currentStep: '生成失败',
        progress: 0
      })
    } finally {
      analyzing.value = false
    }
  }

  /**
   * 按钮点击分析
   */
  const analyzeButtonClickRequirement = async (dateRangeOrRequest) => {
    // 检查参数类型，支持直接传入分析请求对象
    let dateRange, analysisRequest
    if (dateRangeOrRequest && typeof dateRangeOrRequest === 'object' && dateRangeOrRequest.type) {
      // 传入的是分析请求对象
      analysisRequest = dateRangeOrRequest
      dateRange = analysisRequest.dateRange || [dayjs().subtract(6, 'day'), dayjs()] // 默认最近7天
      console.log('🔍 按钮点击分析 - 使用默认日期范围:', dateRange)
    } else {
      // 传入的是日期范围
      dateRange = dateRangeOrRequest
      console.log('🔍 按钮点击分析 - 使用传入日期范围:', dateRange)
    }
    
    // 设置需求文本（如果为空）
    if (!currentRequirement.value.trim()) {
      if (analysisRequest?.requirement) {
        currentRequirement.value = analysisRequest.requirement
      } else {
        message.warning('请输入分析需求')
        return
      }
    }
    
    if (!requirementParser) {
      console.log('需求解析器未初始化，正在自动初始化...')
      initRequirementParser()
    }
    
    analyzing.value = true
    
    // 开始图表生成loading状态
    store.dispatch('updateChartGenerationStatus', {
      isGenerating: true,
      currentStep: '正在分析按钮点击需求...',
      progress: 10
    })
    
    try {
      // 构建按钮点击分析的固定配置
      const pageName = analysisRequest?.pageName || store.state.buttonAnalysisParams.pageName
      const buttonName = analysisRequest?.buttonName || store.state.buttonAnalysisParams.buttonName
      
      const analysis = {
        intent: 'button_click_analysis',
        chartType: 'button_click_analysis',
        description: `分析页面"${pageName}"的"${buttonName}"按钮点击情况`,
        confidence: 0.95,
        dataFields: [],
        dimensions: [],
        metrics: [],
        buryPointType: 'click',
        originalText: currentRequirement.value,
        source: 'button_selection',
        parameters: {
          pageName: pageName,
          buttonName: buttonName
        }
      }
      
      console.log('按钮点击分析配置:', analysis)
      
      // 更新生成状态 - 需求分析完成
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: true,
        currentStep: '需求分析完成，开始获取数据...',
        progress: 30
      })
      
      // 获取数据
      const result = await fetchMultiDayData(analysisMode.value, dateRange, analysis)
      
      // 检查是否使用了缓存数据
      if ((result.totalRequests || 0) === 0) {
        console.log('✅ 成功使用预加载缓存数据，无API调用')
        message.success('使用缓存数据，分析完成')
      } else {
        console.log(`⚠️ 调用了 ${(result.totalRequests || 0)} 个API请求`)
        message.warning(`调用了 ${(result.totalRequests || 0)} 个API请求，建议先完成数据预加载`)
      }
      
      // 更新生成状态 - 开始生成图表
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: true,
        currentStep: '正在生成图表...',
        progress: 80
      })
      
      await generateChart(analysis, result.data, dateRange)
      
      // 完成生成
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: false,
        currentStep: '图表生成完成',
        progress: 100
      })
      
    } catch (error) {
      console.error('按钮点击分析失败:', error)
      
      // 检查是否是页面不存在的错误
      if (error.message && error.message.includes('未找到页面')) {
        // 显示详细的页面不存在错误信息
        message.error({
          content: error.message,
          duration: 10, // 显示更长时间让用户看到页面列表
          style: {
            whiteSpace: 'pre-line' // 支持换行显示
          }
        })
      } else {
        message.error('按钮点击分析失败，请重试')
      }
      
      // 错误时也要清除loading状态
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: false,
        currentStep: '生成失败',
        progress: 0
      })
      
      analyzing.value = false
    }
  }

  /**
   * 查询条件分析
   */
  const analyzeQueryConditionRequirement = async (dateRangeOrRequest) => {
    // 检查参数类型，支持直接传入分析请求对象
    let dateRange, analysisRequest
    if (dateRangeOrRequest && typeof dateRangeOrRequest === 'object' && dateRangeOrRequest.type) {
      // 传入的是分析请求对象
      analysisRequest = dateRangeOrRequest
      dateRange = analysisRequest.dateRange || [dayjs().subtract(6, 'day'), dayjs()] // 默认最近7天
    } else {
      // 传入的是日期范围
      dateRange = dateRangeOrRequest
    }
    
    // 设置需求文本（如果为空）
    if (!currentRequirement.value.trim()) {
      if (analysisRequest?.requirement) {
        currentRequirement.value = analysisRequest.requirement
      } else {
        message.warning('请输入分析需求')
        return
      }
    }
    
    if (!requirementParser) {
      console.log('需求解析器未初始化，正在自动初始化...')
      initRequirementParser()
    }
    
    analyzing.value = true
    
    // 开始图表生成loading状态
    store.dispatch('updateChartGenerationStatus', {
      isGenerating: true,
      currentStep: '正在分析查询条件需求...',
      progress: 10
    })
    
    try {
      // 构建查询条件分析的固定配置
      const pageName = analysisRequest?.pageName || store.state.queryConditionAnalysisParams.pageName
      const queryCondition = analysisRequest?.queryCondition || store.state.queryConditionAnalysisParams.queryCondition
      const queryData = analysisRequest?.queryData || store.state.queryConditionAnalysisParams.queryData
      
      // 设置分析类型为查询条件分析
      store.dispatch('updateApiConfig', {
        selectedAnalysisType: 'query_condition_analysis'
      })
      
      const analysis = {
        intent: 'query_condition_analysis',
        chartType: 'query_condition_analysis',
        description: `分析页面"${pageName}"的"${queryCondition}"查询条件使用情况`,
        confidence: 0.95,
        dataFields: [],
        dimensions: [],
        metrics: [],
        buryPointType: 'click', // 查询条件分析使用点击埋点
        originalText: currentRequirement.value,
        source: 'query_condition_selection',
        parameters: {
          pageName: pageName,
          queryCondition: queryCondition,
          queryData: queryData
        }
      }
      
      console.log('查询条件分析配置:', analysis)
      
      // 更新生成状态 - 需求分析完成
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: true,
        currentStep: '需求分析完成，开始获取数据...',
        progress: 30
      })
      
      // 获取数据
      const result = await fetchMultiDayData(analysisMode.value, dateRange, analysis)
      
      // 检查是否使用了缓存数据
      if ((result.totalRequests || 0) === 0) {
        console.log('✅ 成功使用预加载缓存数据，无API调用')
        message.success('使用缓存数据，分析完成')
      } else {
        console.log(`⚠️ 调用了 ${(result.totalRequests || 0)} 个API请求`)
        message.warning(`调用了 ${(result.totalRequests || 0)} 个API请求，建议先完成数据预加载`)
      }
      
      // 更新生成状态 - 开始生成图表
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: true,
        currentStep: '正在生成图表...',
        progress: 80
      })
      
      await generateChart(analysis, result.data, dateRange)
      
      // 完成生成
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: false,
        currentStep: '图表生成完成',
        progress: 100
      })
      
    } catch (error) {
      console.error('查询条件分析失败:', error)
      
      // 检查是否是页面不存在的错误
      if (error.message && error.message.includes('未找到页面')) {
        // 显示详细的页面不存在错误信息
        message.error({
          content: error.message,
          duration: 10, // 显示更长时间让用户看到页面列表
          style: {
            whiteSpace: 'pre-line' // 支持换行显示
          }
        })
      } else {
        message.error('查询条件分析失败，请重试')
      }
      
      // 错误时也要清除loading状态
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: false,
        currentStep: '生成失败',
        progress: 0
      })
      
      analyzing.value = false
    }
  }

  /**
   * 清空需求
   */
  const clearRequirement = () => {
    currentRequirement.value = ''
    store.dispatch('updateRequirement', '')
    store.dispatch('updateAnalysisResult', null)
    store.dispatch('updateChartConfig', null)
  }

  /**
   * 选择页面进行分析
   */
  const selectPageForAnalysis = async (pageName) => {
    // 关闭弹窗
    const { pageSelectionModalVisible } = await import('@/views/Home.vue')
    if (pageSelectionModalVisible) {
      pageSelectionModalVisible.value = false
    }
    
    // 设置需求文本 - 页面访问量（UV/PV）
    if (pageName === '__ALL__') {
      // 全部页面：不添加页面过滤，查看整站UV/PV
      currentRequirement.value = '整站UV/PV趋势分析'
      message.success('开始分析整站UV/PV')
    } else {
      // 单个页面：添加页面标识符
      currentRequirement.value = `#${pageName} 页面访问量`
      message.success(`开始分析页面：${pageName}`)
    }
    
    // 自动开始分析
    try {
      await analyzeRequirement()
    } catch (error) {
      console.error('自动分析失败:', error)
      message.error('分析失败，请手动点击智能分析按钮')
    }
  }

  /**
   * 用户行为分析需求处理
   */
  const analyzeBehaviorRequirement = async (dateRangeOrRequest) => {
    // 检查参数类型，支持直接传入分析请求对象
    let dateRange, analysisRequest
    if (dateRangeOrRequest && typeof dateRangeOrRequest === 'object' && dateRangeOrRequest.type) {
      // 传入的是分析请求对象
      analysisRequest = dateRangeOrRequest
      dateRange = analysisRequest.dateRange || [dayjs().subtract(6, 'day'), dayjs()] // 默认最近7天
      console.log('🔍 用户行为分析 - 使用默认日期范围:', dateRange)
    } else {
      // 传入的是日期范围
      dateRange = dateRangeOrRequest
    }
    
    // 对于行为分析，如果传入了分析请求对象，则不需要检查用户输入的需求
    console.log('🔍 [analyzeBehaviorRequirement] 调试信息:', {
      currentRequirement: currentRequirement.value,
      analysisRequest: analysisRequest,
      hasRequirement: !!currentRequirement.value.trim(),
      hasAnalysisRequest: !!analysisRequest
    })
    
    if (!currentRequirement.value.trim() && !analysisRequest) {
      message.warning('请输入分析需求')
      return
    }
    
    if (!requirementParser) {
      console.log('需求解析器未初始化，正在自动初始化...')
      initRequirementParser()
    }
    
    analyzing.value = true
    
    // 开始图表生成loading状态
    store.dispatch('updateChartGenerationStatus', {
      isGenerating: true,
      currentStep: '正在分析用户行为需求...',
      progress: 10
    })
    
    try {
      // 根据分析请求类型设置分析参数
      const analysisType = analysisRequest?.type || 'behavior_funnel'
      const isPathAnalysis = analysisType === 'behavior_path'
      
      // 构建上下文信息
      const context = {
        analysisType: analysisType === 'behavior_funnel' ? 'conversion_analysis' : 'behavior_analysis'
      }
      
      // 解析需求
      let analysis = await requirementParser.parse(currentRequirement.value, context)
      
      analysis = {
        ...analysis,
        intent: isPathAnalysis ? 'behavior_path_analysis' : 'behavior_funnel_analysis',
        chartType: isPathAnalysis ? 'behavior_path' : 'behavior_funnel',
        description: isPathAnalysis ? '用户行为路径分析' : '用户行为转化漏斗分析'
      }
      
      console.log('🎯 用户行为分析结果:', analysis)
      
      // 更新图表生成状态
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: true,
        currentStep: '正在获取用户行为数据...',
        progress: 30
      })
      
      // 获取访问埋点数据（用户行为路径分析只使用页面浏览数据）
      const visitDataResult = await fetchMultiDayData(110, dateRange) // 访问埋点ID: 110
      
      // 提取数据数组
      const visitData = visitDataResult?.data || []
      const clickData = [] // 用户行为路径分析不使用点击数据
      
      console.log('📊 获取到的访问埋点数据:', {
        visitDataCount: visitData?.length || 0,
        clickDataCount: 0 // 不再使用点击数据
      })
      
      // 更新图表生成状态
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: true,
        currentStep: '正在分析用户行为路径...',
        progress: 60
      })
      
      // 使用数据处理器处理双埋点数据
      const { dataProcessorFactory } = await import('@/utils/dataProcessorFactory')
      
      // 🚀 调试：打印漏斗步骤配置
      console.log('🔍 [useRequirementAnalysis] 漏斗步骤配置:', analysisRequest?.funnelSteps)
      console.log('🔍 [useRequirementAnalysis] 分析请求对象:', analysisRequest)
      
      // 根据分析类型决定处理方式
      const requestType = analysisRequest?.type || 'behavior_funnel'
      const processorType = requestType === 'behavior_path' ? 'behavior_path_analysis' : 'behavior_funnel_analysis'
      
      // 获取页面菜单数据
      const pageMenuData = store.state.projectConfig?.pageMenuData || null
      
      const processedData = dataProcessorFactory.process(processorType, {
        visitData: visitData || [],
        clickData: clickData || []
      }, {
        format: 'raw',
        analysis: analysis,
        analysisType: requestType, // 传递分析类型
        dateRange: {
          startDate: dayjs(dateRange[0]).format('YYYY-MM-DD'),
          endDate: dayjs(dateRange[1]).format('YYYY-MM-DD')
        },
        funnelName: analysis.description || (requestType === 'behavior_path' ? '用户行为路径分析' : '用户行为转化漏斗'),
        funnelSteps: analysisRequest?.funnelSteps || null, // 🚀 修复：传递漏斗步骤配置
        pageMenuData: pageMenuData // 传递页面菜单数据
      })
      
      console.log('🎯 用户行为分析数据:', processedData)
      
      // 更新图表生成状态
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: true,
        currentStep: requestType === 'behavior_path' ? '正在生成行为路径图...' : '正在生成漏斗图...',
        progress: 80
      })
      
      // 生成图表
      await generateChart(analysis, processedData, 'chart-container')
      
      // 保存图表配置到 store，包括漏斗步骤数据
      const chartConfig = {
        analysis: {
          ...analysis,
          funnelSteps: analysisRequest?.funnelSteps || null // 保存漏斗步骤配置
        },
        data: processedData,
        rawData: processedData,
        timestamp: new Date().toISOString(),
        // 🚀 修复：在顶层也保存漏斗步骤配置
        funnelSteps: analysisRequest?.funnelSteps || null
      }
      store.commit('SET_CHART_CONFIG', chartConfig)
      console.log('图表配置已保存到 store:', chartConfig)
      
      // 完成图表生成
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: false,
        currentStep: '用户行为分析完成',
        progress: 100
      })
      
      message.success('用户行为分析完成')
      
    } catch (error) {
      console.error('❌ 用户行为分析失败:', error)
      message.error(`用户行为分析失败: ${error.message}`)
      
      // 重置图表生成状态
      store.dispatch('updateChartGenerationStatus', {
        isGenerating: false,
        currentStep: '分析失败',
        progress: 0
      })
    } finally {
      analyzing.value = false
    }
  }

  return {
    // 响应式数据
    currentRequirement,
    analyzing,
    analysisMode,
    
    // 方法
    initRequirementParser,
    analyzeRequirement,
    analyzeButtonClickRequirement,
    analyzeQueryConditionRequirement,
    analyzeBehaviorRequirement,
    clearRequirement,
    selectPageForAnalysis
  }
}
