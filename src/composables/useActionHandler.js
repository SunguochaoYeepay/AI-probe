import { ref } from 'vue'
import { useStore } from 'vuex'
import { dataPreloadService } from '@/services/dataPreloadService'
import { extractButtonsFromMultiDayData, extractQueryConditionsFromMultiDayData, groupQueryConditions } from '@/utils/buttonExtractor'

/**
 * 动作处理器composable
 */
export function useActionHandler(selectedBuryPointId) {
  const store = useStore()

  // 处理分析类型选择
  const handleAnalysisTypeSelection = async (params, addMessage) => {
    const { type, description } = params
    
    switch (type) {
      case 'page_visit':
        await handlePageVisitAnalysis(addMessage)
        break
      case 'user_click':
        await handleUserClickAnalysis(addMessage)
        break
      case 'conversion':
        await handleConversionAnalysis(addMessage)
        break
      case 'user_behavior':
        await handleUserBehaviorAnalysis(addMessage)
        break
      case 'multi_bury_point':
        await handleMultiBuryPointAnalysis(addMessage)
        break
      default:
        addMessage('我理解了您的需求，让我为您进行分析。', 'ai')
    }
  }

  const handlePageVisitAnalysis = async (addMessage) => {
    const content = `📊 页面访问分析

请选择您要分析的页面范围：`

    const actions = [
      { text: '整体页面访问量', type: 'analyze', params: { type: 'page_visits', scope: 'all' } },
      { text: '选择页面分析', type: 'show_page_list', params: { type: 'page_visits', scope: 'specific' } }
    ]

    addMessage(content, 'ai', actions)
  }

  const handleUserClickAnalysis = async (addMessage) => {
    const content = `🖱️ 用户点击分析

请选择您要分析的页面：`

    const actions = [
      { text: '选择页面进行点击分析', type: 'show_page_list', params: { type: 'user_click', scope: 'page' } },
      { text: '按钮点击热度分析', type: 'analyze', params: { type: 'button_heatmap', scope: 'all' } }
    ]

    addMessage(content, 'ai', actions)
  }

  const handleConversionAnalysis = async (addMessage) => {
    const content = `🔄 行为转化分析

请选择转化分析类型：`

    const actions = [
      { text: '用户注册转化流程', type: 'analyze', params: { type: 'conversion', scope: 'registration' } },
      { text: '购买转化漏斗', type: 'analyze', params: { type: 'conversion', scope: 'purchase' } },
      { text: '自定义转化路径', type: 'custom_conversion', params: { type: 'conversion', scope: 'custom' } }
    ]

    addMessage(content, 'ai', actions)
  }

  const handleUserBehaviorAnalysis = async (addMessage) => {
    const content = `🎯 用户行为分析

请选择您想要进行的用户行为分析类型：`

    const actions = [
      { text: '🎯 行为转化漏斗', type: 'analyze', params: { type: 'behavior_funnel', scope: 'funnel' } },
      { text: '👤 用户行为路径', type: 'analyze', params: { type: 'user_behavior', scope: 'path' } },
      { text: '📈 行为趋势分析', type: 'analyze', params: { type: 'user_behavior', scope: 'trend' } },
      { text: '📊 多埋点综合分析', type: 'analyze', params: { type: 'multi_bury_point', scope: 'comprehensive' } }
    ]

    addMessage(content, 'ai', actions)
  }

  const handleMultiBuryPointAnalysis = async (addMessage) => {
    const content = `📊 多埋点综合分析

综合分析多个埋点的数据，发现用户行为模式。请选择分析类型：`

    const actions = [
      { text: '🎯 行为转化漏斗', type: 'analyze', params: { type: 'behavior_funnel', scope: 'funnel' } },
      { text: '👤 用户行为路径', type: 'analyze', params: { type: 'user_behavior', scope: 'path' } },
      { text: '📈 行为趋势分析', type: 'analyze', params: { type: 'user_behavior', scope: 'trend' } }
    ]

    addMessage(content, 'ai', actions)
  }

  // 处理页面选择
  const handlePageSelection = async (params, addMessage) => {
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

  // 处理自定义转化
  const handleCustomConversion = async (params, addMessage) => {
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

  // 处理页面信息输入
  const handleInputPage = async (params, addMessage) => {
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

  // 处理页面列表显示
  const handleShowPageList = async (params, addMessage, dateRange) => {
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
        } else if (type === 'query_condition') {
          // 查询条件分析 - 使用"查询"关键词过滤页面
          const queryPages = availablePages.filter(page => 
            page.toLowerCase().includes('查询') || 
            page.toLowerCase().includes('query') ||
            page.toLowerCase().includes('search')
          )
          
          content = `📄 可用页面列表 - 查询条件分析

我找到了 ${queryPages.length} 个包含查询功能的页面，请选择您要分析查询条件的页面：`

          const quickPages = queryPages.slice(0, 10)
          actions = [
            ...quickPages.map(page => ({
              text: page.length > 20 ? page.substring(0, 17) + '...' : page,
              type: 'select_page_for_queries',
              params: { type: 'query_condition', scope: 'specific', pageName: page }
            }))
          ]
          
          // 如果过滤后的页面超过10个，添加查看更多选项
          if (queryPages.length > 10) {
            actions.push({
              text: `查看更多查询页面 (${queryPages.length - 10}个)`,
              type: 'show_all_pages',
              params: { type: 'query_condition', scope: 'specific', allPages: queryPages }
            })
          }
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

  // 处理按钮选择
  const handleButtonSelection = (button, selectedPageName, currentSelectionType, buttonSelectionModalVisible, emit, addMessage) => {
    // 根据选择类型进行不同处理
    if (currentSelectionType === 'queries') {
      // 查询条件分析
      if (button.isSummary) {
        // 汇总项分析（如"全部状态"、"全部申请时间"等）
        const requirement = `#${selectedPageName} 页面的"${button.displayName}"查询条件分析`
        
        emit('analyze-requirement', {
          requirement,
          type: 'query_condition_analysis',
          pageName: selectedPageName,
          queryCondition: button.displayName,
          queryData: button
        })
        
        addMessage(`✅ 开始分析页面 "${selectedPageName}" 的"${button.displayName}"查询条件使用情况。`, 'ai')
      } else {
        // 具体查询条件分析
        const requirement = `#${selectedPageName} 页面的"${button.displayName || button.content}"查询条件分析`
        
        emit('analyze-requirement', {
          requirement,
          type: 'query_condition_analysis',
          pageName: selectedPageName,
          queryCondition: button.displayName || button.content,
          queryData: button
        })
        
        addMessage(`✅ 开始分析页面 "${selectedPageName}" 的"${button.displayName || button.content}"查询条件使用情况。`, 'ai')
      }
    } else {
      // 按钮点击分析
      if (button.type === 'all_buttons') {
        // 设置需求文本
        const requirement = `#${selectedPageName} 页面的全部按钮点击量分析（按天展示）`
        
        // 触发分析
        emit('analyze-requirement', {
          requirement,
          type: 'button_click_daily',
          scope: 'all_buttons',
          pageName: selectedPageName
        })
        
        // 添加确认消息
        addMessage(`✅ 开始分析页面 "${selectedPageName}" 的全部按钮点击量（按天展示）。`, 'ai')
      } else {
        // 设置需求文本
        const requirement = `#${selectedPageName} 页面的"${button.content}"按钮点击分析`
        
        // 触发分析
        emit('analyze-requirement', {
          requirement,
          type: 'button_click_analysis',
          pageName: selectedPageName,
          buttonName: button.content,
          buttonData: button
        })
        
        // 添加确认消息
        addMessage(`✅ 开始分析页面 "${selectedPageName}" 的"${button.content}"按钮点击情况。`, 'ai')
      }
    }
    
    // 关闭按钮选择弹窗
    buttonSelectionModalVisible.value = false
  }

  // 处理多条件选择
  const handleMultipleConditionsSelection = (selectedItems, selectedPageName, emit, addMessage) => {
    // 构建多条件分析需求
    const conditionNames = selectedItems.map(item => item.displayName).join('、')
    const requirement = `#${selectedPageName} 页面的"${conditionNames}"查询条件分析`
    
    // 构建查询数据，包含所有选中的条件
    const queryData = {
      type: 'multiple_conditions',
      conditions: selectedItems,
      groupType: selectedItems[0]?.groupType || selectedItems[0]?.parentType,
      allConditions: selectedItems
    }
    
    // 🚀 修复：使用具体的条件类型而不是"多条件"
    const groupType = selectedItems[0]?.groupType || selectedItems[0]?.parentType
    const properQueryCondition = groupType ? `${groupType}:${conditionNames}` : conditionNames
    
    emit('analyze-requirement', {
      requirement,
      type: 'query_condition_analysis',
      pageName: selectedPageName,
      queryCondition: properQueryCondition,
      queryData: queryData
    })
    
    addMessage(`✅ 开始分析页面 "${selectedPageName}" 的"${conditionNames}"查询条件使用情况。`, 'ai')
  }

  // 处理页面选择（按钮分析）
  const handleSelectPageForButtons = async (params, selectedPageName, availableButtons, currentSelectionType, buttonSelectionModalVisible, dateRange, addMessage) => {
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
      currentSelectionType.value = 'buttons'
      buttonSelectionModalVisible.value = true
      
      // 添加确认消息
      addMessage(`✅ 找到页面 "${pageName}" 的 ${buttons.length} 个按钮，请选择要分析的按钮。`, 'ai')
      
    } catch (error) {
      console.error('加载按钮数据失败:', error)
      addMessage(`❌ 加载按钮数据失败: ${error.message}`, 'ai')
    }
  }

  // 处理页面选择（查询条件分析）
  const handleSelectPageForQueries = async (params, selectedPageName, availableButtons, currentSelectionType, buttonSelectionModalVisible, dateRange, addMessage) => {
    const { pageName } = params
    
    try {
      // 显示加载状态
      addMessage(`正在加载页面 "${pageName}" 的查询条件数据...`, 'ai')
      
      // 获取当前埋点配置
      const currentPointId = store.state.apiConfig?.selectedPointId
      
      // 获取缓存数据
      const cachedData = await dataPreloadService.getMultiDayCachedData(dateRange.value, currentPointId)
      
      if (!cachedData || cachedData.length === 0) {
        addMessage(`❌ 未找到页面 "${pageName}" 的数据，请检查数据预加载状态。`, 'ai')
        return
      }
      
      // 提取查询条件信息
      const queries = extractQueryConditionsFromMultiDayData(cachedData, pageName)
      
      if (queries.length === 0) {
        addMessage(`❌ 页面 "${pageName}" 没有找到查询条件数据。`, 'ai')
        return
      }
      
      // 分组查询条件
      const groupedQueries = groupQueryConditions(queries)
      
      // 设置查询条件选择弹窗数据
      selectedPageName.value = pageName
      availableButtons.value = groupedQueries // 使用分组后的数据
      currentSelectionType.value = 'queries'
      buttonSelectionModalVisible.value = true
      
      // 添加确认消息
      addMessage(`✅ 找到页面 "${pageName}" 的 ${groupedQueries.length} 个查询条件（已分组），请选择要分析的查询条件。`, 'ai')
      
    } catch (error) {
      console.error('加载查询条件数据失败:', error)
      addMessage(`❌ 加载查询条件数据失败: ${error.message}`, 'ai')
    }
  }

  // 处理页面列表显示（简化版本）
  const handleShowAllPages = async (params, addMessage) => {
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

  // 处理页面批次显示
  const handleShowPageBatch = async (params, addMessage) => {
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

  // 处理数据预加载触发
  const handleTriggerPreload = async (params, addMessage) => {
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

  // 处理配置显示
  const handleShowConfig = async (params, addMessage, dateRange) => {
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

  return {
    // 方法
    handleAnalysisTypeSelection,
    handlePageSelection,
    handleCustomConversion,
    handleInputPage,
    handleShowPageList,
    handleButtonSelection,
    handleMultipleConditionsSelection,
    handleSelectPageForButtons,
    handleSelectPageForQueries,
    handleShowAllPages,
    handleShowPageBatch,
    handleTriggerPreload,
    handleShowConfig
  }
}
