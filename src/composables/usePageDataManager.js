import { ref } from 'vue'
import { useStore } from 'vuex'
import dayjs from 'dayjs'
import { dataPreloadService } from '@/services/dataPreloadService'
import { useDataFetch } from '@/composables/useDataFetch'
import { extractButtonsFromMultiDayData, extractQueryConditionsFromMultiDayData, groupQueryConditions } from '@/utils/buttonExtractor'

/**
 * 页面和按钮数据管理composable
 */
export function usePageDataManager() {
  const store = useStore()
  const { fetchMultiDayData } = useDataFetch()

  // 按钮选择相关
  const buttonSelectionModalVisible = ref(false)
  const selectedPageName = ref('')
  const availableButtons = ref([])
  const currentSelectionType = ref('buttons') // 'buttons' 或 'queries'

  // 漏斗步骤配置相关
  const showFunnelConfig = ref(false)
  const funnelSteps = ref([])
  const pendingFunnelAnalysis = ref(null) // 保存待执行的漏斗分析请求
  const availablePages = ref([]) // 可用的页面列表
  const pageButtons = ref(new Map()) // 页面按钮映射

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

  // 加载可用页面列表
  const loadAvailablePages = async () => {
    try {
      console.log('🔍 开始加载可用页面列表...')
      
      // 获取访问埋点数据（ID: 110）
      const dateRange = [dayjs().subtract(7, 'day'), dayjs()]
      const visitDataResult = await fetchMultiDayData(110, dateRange)
      const visitData = visitDataResult?.data || []
      
      console.log('📊 原始访问数据数量:', visitData.length)
      
      // 提取唯一的页面名称，确保都是字符串，并过滤掉"任意页面"
      const uniquePages = [...new Set(
        visitData
          .map(record => record.pageName)
          .filter(pageName => 
            typeof pageName === 'string' && 
            pageName.trim() !== '' && 
            pageName !== '任意页面'
          )
      )]
      
      console.log('📊 提取到的页面列表:', uniquePages)
      console.log('📊 页面数量:', uniquePages.length)
      
      // 按字母顺序排序
      availablePages.value = uniquePages.sort()
      
      console.log('✅ 页面列表加载完成:', availablePages.value.length, '个页面')
      console.log('✅ 最终页面列表:', availablePages.value)
      
      // 同时加载按钮数据
      await loadPageButtons(visitData)
    } catch (error) {
      console.error('❌ 加载页面列表失败:', error)
      // 如果加载失败，使用默认页面列表
      availablePages.value = [
        '企业付款-复核申请查询',
        '下级商户查询-appid 配置',
        '商户管理-基础信息',
        '支付配置-接口配置'
      ]
      console.log('⚠️ 使用默认页面列表:', availablePages.value)
    }
  }

  // 加载页面按钮数据
  const loadPageButtons = async (visitData) => {
    try {
      console.log('🔍 开始加载页面按钮数据...')
      
      // 获取点击埋点数据（ID: 109）
      const dateRange = [dayjs().subtract(7, 'day'), dayjs()]
      console.log('🔍 准备获取埋点ID 109的数据，日期范围:', dateRange)
      const clickDataResult = await fetchMultiDayData(109, dateRange)
      const clickData = clickDataResult?.data || []
      console.log('🔍 获取到的点击数据结果:', clickDataResult)
      
      console.log('📊 原始点击数据数量:', clickData.length)
      
      // 统计不同类型的数据
      const clickTypeStats = {}
      clickData.forEach(record => {
        const type = record.type || 'unknown'
        clickTypeStats[type] = (clickTypeStats[type] || 0) + 1
      })
      console.log('📊 点击数据类型统计:', clickTypeStats)
      
      // 查看前几条数据的结构
      console.log('🔍 前3条点击数据示例:', clickData.slice(0, 3))
      
      // 按页面分组按钮数据
      const buttonsMap = new Map()
      
      let processedCount = 0
      clickData.forEach(record => {
        // 处理按钮点击数据，type为"click"（点击埋点数据）
        if (record.pageName && record.content && record.type === 'click') {
          processedCount++
          if (processedCount <= 5) {
            console.log(`🔍 处理第${processedCount}条数据:`, {
              pageName: record.pageName,
              content: record.content,
              type: record.type
            })
          }
          
          const pageName = record.pageName
          if (!buttonsMap.has(pageName)) {
            buttonsMap.set(pageName, new Set())
          }
          
          // 解析content JSON来提取按钮名称
          try {
            const contentObj = JSON.parse(record.content)
            if (typeof contentObj === 'object' && contentObj !== null) {
              // 从JSON的键值对中提取按钮名称
              Object.keys(contentObj).forEach(key => {
                const buttonName = `${key}:${contentObj[key]}`
                buttonsMap.get(pageName).add(buttonName)
                if (processedCount <= 5) {
                  console.log(`🔍 页面 "${pageName}" 找到按钮: "${buttonName}"`)
                }
              })
            }
          } catch (e) {
            // 如果JSON解析失败，直接使用content作为按钮名称
            if (record.content && record.content.trim() !== '') {
              buttonsMap.get(pageName).add(record.content)
              if (processedCount <= 5) {
                console.log(`🔍 页面 "${pageName}" 找到按钮: "${record.content}"`)
              }
            }
          }
        }
      })
      
      console.log(`📊 总共处理了 ${processedCount} 条 type="click" 的数据`)
      
      // 转换为数组并保存
      const finalButtonsMap = new Map()
      buttonsMap.forEach((buttonSet, pageName) => {
        finalButtonsMap.set(pageName, Array.from(buttonSet).sort())
      })
      
      pageButtons.value = finalButtonsMap
      
      console.log('✅ 页面按钮数据加载完成:', finalButtonsMap.size, '个页面有按钮数据')
      console.log('📊 页面按钮映射:', finalButtonsMap)
      
      // 特别检查"下级商户查询-appid 配置"页面的按钮
      const targetPage = '下级商户查询-appid 配置'
      if (finalButtonsMap.has(targetPage)) {
        console.log(`🎯 目标页面 "${targetPage}" 的按钮:`, finalButtonsMap.get(targetPage))
      } else {
        console.log(`⚠️ 没有找到页面 "${targetPage}" 的按钮数据`)
        console.log('📋 所有可用的页面:', Array.from(finalButtonsMap.keys()))
      }
    } catch (error) {
      console.error('❌ 加载页面按钮数据失败:', error)
      pageButtons.value = new Map()
    }
  }

  // 调试按钮数据
  const debugButtonData = async () => {
    console.log('🔍 开始调试按钮数据...')
    console.log('📊 当前页面按钮映射:', pageButtons.value)
    console.log('📊 页面按钮映射大小:', pageButtons.value.size)
    
    // 检查特定页面
    const targetPage = '下级商户查询-appid 配置'
    if (pageButtons.value.has(targetPage)) {
      console.log(`✅ 找到页面 "${targetPage}" 的按钮:`, pageButtons.value.get(targetPage))
    } else {
      console.log(`❌ 没有找到页面 "${targetPage}" 的按钮数据`)
      console.log('📋 所有可用的页面:', Array.from(pageButtons.value.keys()))
    }
    
    // 重新加载按钮数据
    await loadPageButtons([])
  }

  // 重新加载按钮数据
  const reloadButtonData = async () => {
    console.log('🔄 [usePageDataManager] 重新加载按钮数据...')
    await loadPageButtons([])
  }

  // 漏斗步骤配置保存处理
  const onFunnelStepsSave = (steps, emit, addMessage) => {
    console.log('🎯 漏斗步骤配置保存:', steps)
    
    // 保存步骤配置
    funnelSteps.value = steps
    
    // 如果有待执行的漏斗分析请求，现在执行它
    if (pendingFunnelAnalysis.value) {
      // 将步骤配置添加到分析请求中
      const analysisRequest = {
        ...pendingFunnelAnalysis.value,
        funnelSteps: steps
      }
      
      // 触发分析
      emit('analyze-requirement', analysisRequest)
      
      // 添加确认消息
      addMessage('配置已保存，开始进行漏斗分析...', 'ai')
      
      // 清空待执行请求
      pendingFunnelAnalysis.value = null
    }
  }

  return {
    // 响应式数据
    buttonSelectionModalVisible,
    selectedPageName,
    availableButtons,
    currentSelectionType,
    showFunnelConfig,
    funnelSteps,
    pendingFunnelAnalysis,
    availablePages,
    pageButtons,
    
    // 方法
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
  }
}
