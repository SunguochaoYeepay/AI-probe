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
