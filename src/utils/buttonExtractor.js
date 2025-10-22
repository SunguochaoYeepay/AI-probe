/**
 * 按钮数据提取工具
 * 从页面数据中提取按钮点击信息
 */

/**
 * 从页面数据中提取按钮列表
 * @param {Array} pageData - 页面数据
 * @param {string} pageName - 页面名称
 * @returns {Array} 按钮列表，包含PV和UV统计
 */
export function extractButtonsFromPageData(pageData, pageName) {
  if (!pageData || !Array.isArray(pageData)) {
    console.warn('页面数据无效:', pageData)
    return []
  }

  // 过滤出该页面的点击数据
  const clickData = pageData.filter(item => 
    item.type === 'click' && 
    item.pageName === pageName && 
    item.content && 
    item.content.trim() !== ''
  )

  console.log(`🔍 从页面 "${pageName}" 提取到 ${clickData.length} 条点击数据`)

  if (clickData.length === 0) {
    return []
  }

  // 按按钮名称分组统计
  const buttonMap = new Map()

  clickData.forEach(item => {
    const buttonName = item.content.trim()
    
    if (!buttonMap.has(buttonName)) {
      buttonMap.set(buttonName, {
        content: buttonName,
        pv: 0,
        uvSet: new Set(),
        clickData: []
      })
    }

    const button = buttonMap.get(buttonName)
    
    // PV统计：直接计数
    button.pv++
    
    // UV统计：用weCustomerKey去重
    if (item.weCustomerKey) {
      button.uvSet.add(item.weCustomerKey)
    }
    
    // 保存原始点击数据
    button.clickData.push(item)
  })

  // 转换为数组并排序
  const buttons = Array.from(buttonMap.values())
    .map(button => ({
      content: button.content,
      pv: button.pv,
      uv: button.uvSet.size,
      clickData: button.clickData
    }))
    .sort((a, b) => b.pv - a.pv) // 按PV降序排列

  console.log(`📊 提取到 ${buttons.length} 个按钮:`, buttons.map(b => `${b.content}(PV:${b.pv}, UV:${b.uv})`))

  return buttons
}

/**
 * 获取页面的按钮统计信息
 * @param {Array} pageData - 页面数据
 * @param {string} pageName - 页面名称
 * @returns {Object} 按钮统计信息
 */
export function getPageButtonStats(pageData, pageName) {
  const buttons = extractButtonsFromPageData(pageData, pageName)
  
  const totalPv = buttons.reduce((sum, button) => sum + button.pv, 0)
  const totalUv = new Set(buttons.flatMap(button => 
    button.clickData.map(click => click.weCustomerKey).filter(Boolean)
  )).size

  return {
    pageName,
    buttonCount: buttons.length,
    totalPv,
    totalUv,
    buttons
  }
}

/**
 * 从多天数据中提取指定页面的按钮信息
 * @param {Array} multiDayData - 多天数据
 * @param {string} pageName - 页面名称
 * @returns {Array} 按钮列表
 */
export function extractButtonsFromMultiDayData(multiDayData, pageName) {
  if (!multiDayData || !Array.isArray(multiDayData)) {
    console.warn('多天数据无效:', multiDayData)
    return []
  }

  console.log(`🔍 从多天数据中提取页面 "${pageName}" 的按钮信息`)
  console.log(`📊 总数据量: ${multiDayData.length} 条`)

  return extractButtonsFromPageData(multiDayData, pageName)
}

/**
 * 从页面数据中提取查询条件列表
 * @param {Array} pageData - 页面数据
 * @param {string} pageName - 页面名称
 * @returns {Array} 查询条件列表，包含PV和UV统计
 */
export function extractQueryConditionsFromPageData(pageData, pageName) {
  if (!pageData || !Array.isArray(pageData)) {
    console.warn('页面数据无效:', pageData)
    return []
  }

  // 先查看该页面的所有数据类型
  const pageDataForPage = pageData.filter(item => item.pageName === pageName)
  const typeCounts = {}
  pageDataForPage.forEach(item => {
    typeCounts[item.type] = (typeCounts[item.type] || 0) + 1
  })
  console.log(`🔍 页面 "${pageName}" 的数据类型统计:`, typeCounts)
  
  // 查看前几条数据的结构
  if (pageDataForPage.length > 0) {
    console.log(`🔍 页面 "${pageName}" 前3条数据示例:`, pageDataForPage.slice(0, 3))
    
    // 查看是否有包含JSON格式的content
    const jsonLikeData = pageDataForPage.filter(item => 
      item.content && 
      (item.content.includes('{') || item.content.includes('['))
    )
    console.log(`🔍 页面 "${pageName}" 包含JSON格式的数据:`, jsonLikeData.length, '条')
    if (jsonLikeData.length > 0) {
      console.log(`🔍 JSON格式数据示例:`, jsonLikeData.slice(0, 2))
    }
  }

  // 过滤出该页面的查询数据 - 先尝试所有包含JSON格式的数据
  let queryData = pageData.filter(item => 
    item.pageName === pageName && 
    item.content && 
    item.content.trim() !== '' &&
    (item.content.includes('{') || item.content.includes('['))
  )
  
  // 如果没找到JSON格式的数据，再尝试type为query的数据
  if (queryData.length === 0) {
    queryData = pageData.filter(item => 
      item.type === 'query' && 
      item.pageName === pageName && 
      item.content && 
      item.content.trim() !== ''
    )
  }

  console.log(`🔍 从页面 "${pageName}" 提取到 ${queryData.length} 条查询数据`)

  if (queryData.length === 0) {
    return []
  }

  // 按查询条件内容分组统计
  const conditionMap = new Map()

  queryData.forEach(item => {
    const queryContent = item.content.trim()
    
    if (!conditionMap.has(queryContent)) {
      conditionMap.set(queryContent, {
        content: queryContent,
        pv: 0,
        uvSet: new Set(),
        queryData: []
      })
    }

    const condition = conditionMap.get(queryContent)
    
    // PV统计：直接计数
    condition.pv++
    
    // UV统计：用weCustomerKey去重
    if (item.weCustomerKey) {
      condition.uvSet.add(item.weCustomerKey)
    }
    
    // 保存原始查询数据
    condition.queryData.push(item)
  })

  // 转换为数组并排序
  const conditions = Array.from(conditionMap.values())
    .map(condition => ({
      content: condition.content,
      pv: condition.pv,
      uv: condition.uvSet.size,
      queryData: condition.queryData,
      formattedContent: formatQueryCondition(condition.content)
    }))
    .sort((a, b) => b.pv - a.pv) // 按PV降序排列

  console.log(`📊 提取到 ${conditions.length} 个查询条件:`, conditions.map(c => `${c.content}(PV:${c.pv}, UV:${c.uv})`))

  return conditions
}

/**
 * 格式化查询条件JSON内容
 * @param {string} jsonContent - JSON字符串
 * @returns {Array} 格式化后的查询条件数组
 */
export function formatQueryCondition(jsonContent) {
  try {
    const parsed = JSON.parse(jsonContent)
    const formatted = []
    
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        // 数组值：每个元素都显示为"key::arrayItem"
        value.forEach(item => {
          formatted.push(`${key}::${item}`)
        })
      } else {
        // 字符串值：直接显示为"key::value"
        formatted.push(`${key}::${value}`)
      }
    }
    
    return formatted
  } catch (error) {
    console.warn('JSON解析失败:', error, '原始内容:', jsonContent)
    // 如果JSON解析失败，返回原始内容
    return [jsonContent]
  }
}

/**
 * 分组查询条件
 * @param {Array} conditions - 查询条件列表
 * @returns {Array} 分组后的查询条件列表
 */
export function groupQueryConditions(conditions) {
  if (!conditions || conditions.length === 0) {
    return []
  }

  // 按条件类型分组
  const groupedConditions = new Map()
  
  conditions.forEach(condition => {
    try {
      const parsed = JSON.parse(condition.content)
      
      // 遍历JSON中的每个键值对
      for (const [key, value] of Object.entries(parsed)) {
        if (!groupedConditions.has(key)) {
          groupedConditions.set(key, {
            type: key,
            items: new Map(),
            totalPv: 0,
            totalUv: new Set(),
            allConditions: []
          })
        }
        
        const group = groupedConditions.get(key)
        
        if (Array.isArray(value)) {
          // 数组值：每个元素作为一个子项
          value.forEach(item => {
            // 使用更安全的分隔符，避免与内容中的"-"冲突
            const itemKey = `${key}::${item}`
            if (!group.items.has(itemKey)) {
              group.items.set(itemKey, {
                key: itemKey,
                displayName: item,
                pv: 0,
                uv: new Set(),
                conditions: []
              })
            }
            
            const itemData = group.items.get(itemKey)
            itemData.pv += condition.pv
            condition.queryData.forEach(qd => {
              if (qd.weCustomerKey) {
                itemData.uv.add(qd.weCustomerKey)
              }
            })
            itemData.conditions.push(condition)
          })
        } else {
          // 字符串值：作为一个子项
          // 使用更安全的分隔符，避免与内容中的"-"冲突
          const itemKey = `${key}::${value}`
          if (!group.items.has(itemKey)) {
            group.items.set(itemKey, {
              key: itemKey,
              displayName: value,
              pv: 0,
              uv: new Set(),
              conditions: []
            })
          }
          
          const itemData = group.items.get(itemKey)
          itemData.pv += condition.pv
          condition.queryData.forEach(qd => {
            if (qd.weCustomerKey) {
              itemData.uv.add(qd.weCustomerKey)
            }
          })
          itemData.conditions.push(condition)
        }
        
        // 更新组的总计
        group.totalPv += condition.pv
        condition.queryData.forEach(qd => {
          if (qd.weCustomerKey) {
            group.totalUv.add(qd.weCustomerKey)
          }
        })
        group.allConditions.push(condition)
      }
    } catch (error) {
      console.warn('解析查询条件失败:', error, '原始内容:', condition.content)
    }
  })
  
  // 转换为数组格式
  const result = []
  
  groupedConditions.forEach((group, type) => {
    // 添加汇总项
    result.push({
      type: 'group_summary',
      groupType: type,
      content: `全部${type}`,
      displayName: `全部${type}`,
      pv: group.totalPv,
      uv: group.totalUv.size,
      isSummary: true,
      groupType: type,
      allConditions: group.allConditions
    })
    
    // 添加子项
    const sortedItems = Array.from(group.items.values())
      .sort((a, b) => b.pv - a.pv) // 按PV降序排列
    
    sortedItems.forEach(item => {
      result.push({
        type: 'group_item',
        groupType: type,
        content: item.key,
        displayName: item.displayName,
        pv: item.pv,
        uv: item.uv.size,
        isSummary: false,
        parentType: type,
        conditions: item.conditions
      })
    })
  })
  
  return result
}

/**
 * 从多天数据中提取指定页面的查询条件信息
 * @param {Array} multiDayData - 多天数据
 * @param {string} pageName - 页面名称
 * @returns {Array} 查询条件列表
 */
export function extractQueryConditionsFromMultiDayData(multiDayData, pageName) {
  if (!multiDayData || !Array.isArray(multiDayData)) {
    console.warn('多天数据无效:', multiDayData)
    return []
  }

  console.log(`🔍 从多天数据中提取页面 "${pageName}" 的查询条件信息`)
  console.log(`📊 总数据量: ${multiDayData.length} 条`)

  return extractQueryConditionsFromPageData(multiDayData, pageName)
}
