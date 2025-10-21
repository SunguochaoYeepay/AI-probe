import { ref, nextTick } from 'vue'
import { useStore } from 'vuex'
import { message } from 'ant-design-vue'
import { ChartGenerator } from '@/utils/chartGenerator'

export function useChart() {
  const store = useStore()
  const chartGenerator = ref(null)

  // 初始化图表生成器
  const initChartGenerator = () => {
    chartGenerator.value = new ChartGenerator()
  }

  // 使用统一的AI智能提取页面名称函数
  const extractPageNames = async (requirement) => {
    console.log(`🔍 开始AI智能提取页面名称，原始需求: "${requirement}"`)
    
    try {
      // 使用统一的AI提取工具函数
      const { extractPageNameWithAI } = await import('@/utils/aiExtractor')
      
      const extractedName = await extractPageNameWithAI(requirement)
      
      if (!extractedName) {
        console.log('AI未提取到页面名称')
        return []
      }
      
      console.log(`📋 AI提取的页面名称:`, extractedName)
      return [extractedName]
      
    } catch (error) {
      console.error('AI提取页面名称失败:', error)
      return []
    }
  }

  // 生成图表
  const generateChart = async (analysis, data, dateRange) => {
    try {
      console.log('========== 数据查询信息 ==========')
      console.log('查询模式: 日期范围')
      console.log('用户选择的日期范围:', dateRange)
      console.log('获取到真实数据:', data.length, '条')
      
      // 显示数据的时间范围
      if (data.length > 0) {
        const dates = data.map(d => d.createdAt).filter(d => d)
        if (dates.length > 0) {
          console.log('数据时间范围:', dates[0], '至', dates[dates.length - 1])
          console.log('前3条数据样本:', data.slice(0, 3).map(d => ({
            id: d.id,
            pageName: d.pageName,
            createdAt: d.createdAt,
            type: d.type,
            hasAllFields: !!(d.id && d.pageName && d.type && d.createdAt),
            allKeys: Object.keys(d)
          })))
          
          // 检查数据完整性
          const validData = data.filter(d => d.id && d.pageName && d.type && d.createdAt)
          console.log(`数据完整性检查: 总计 ${data.length} 条，有效数据 ${validData.length} 条`)
        }
      }
      console.log('====================================')
      
      // 如果需求中指定了页面，过滤数据
      let specifiedPages = await extractPageNames(analysis.originalText || analysis.description)
      
      // 如果analysis中有pageName参数，优先使用
      if (analysis.parameters?.pageName) {
        console.log('使用AI分析的页面名称:', analysis.parameters.pageName)
        specifiedPages = [analysis.parameters.pageName, ...specifiedPages]
      }
      
      if (specifiedPages.length > 0 && data.length > 0) {
        console.log('检测到指定页面:', specifiedPages)
        
        // 调试：显示实际数据中的页面名称
        const actualPageNames = [...new Set(data.map(item => item.pageName).filter(name => name))]
        console.log('🔍 可用页面数量:', actualPageNames.length, '个')
        
        const filteredData = data.filter(item => 
          specifiedPages.some(page => {
            if (!item.pageName) return false
            
            // 智能匹配函数 - 优化匹配逻辑，提高匹配成功率
            const smartMatch = (target, source) => {
              // 1. 精确匹配
              if (target === source) return true
              
              // 2. 去除常见后缀后的精确匹配
              const cleanTarget = target.replace(/(的访问|访问|页面|page)$/gi, '').trim()
              const cleanSource = source.replace(/(的访问|访问|页面|page)$/gi, '').trim()
              if (cleanTarget === cleanSource) return true
              
              // 3. 去除横线字符后的精确匹配
              const normalizedTarget = target.replace(/[—_\-]/g, '')
              const normalizedSource = source.replace(/[—_\-]/g, '')
              if (normalizedTarget === normalizedSource) return true
              
              // 4. 简单的包含匹配 - 优先使用更宽松的匹配策略
              if (source.includes(target) || target.includes(source)) {
                return true
              }
              
              // 5. 关键词匹配 - 检查目标关键词是否在源页面名称中
              const targetKeywords = target.split(/[—_\-的访问页面page]/gi).filter(k => k.trim().length > 1)
              const sourceKeywords = source.split(/[—_\-的访问页面page]/gi).filter(k => k.trim().length > 1)
              
              // 检查目标关键词是否都包含在源页面名称中
              let matchCount = 0
              for (const targetKeyword of targetKeywords) {
                if (sourceKeywords.some(sourceKeyword => 
                  sourceKeyword.includes(targetKeyword) || targetKeyword.includes(sourceKeyword)
                )) {
                  matchCount++
                }
              }
              
              // 如果目标关键词全部匹配，则认为是匹配的
              if (targetKeywords.length > 0 && matchCount === targetKeywords.length) {
                return true
              }
              
              // 对于较长的关键词列表，至少60%的关键词要匹配（降低阈值）
              if (targetKeywords.length >= 3 && sourceKeywords.length >= 3) {
                const matchRatio = matchCount / Math.min(targetKeywords.length, sourceKeywords.length)
                return matchRatio >= 0.6
              }
              
              // 6. 对于短页面名称，使用更宽松的匹配
              if (targetKeywords.length <= 2 && sourceKeywords.length <= 2) {
                return target.includes(source) || source.includes(target)
              }
              
              // 7. 最后尝试：检查是否有任何关键词匹配
              if (matchCount > 0) {
                return true
              }
              
              return false
            }
            
            if (smartMatch(item.pageName, page)) {
              return true
            }
            
            return false
          })
        )
        
        // 匹配结果汇总
        console.log(`🔍 页面匹配结果: 指定${specifiedPages.length}个页面，匹配到${filteredData.length}条数据`)
        
        // 检查精确匹配的结果
        const exactMatches = data.filter(item => 
          specifiedPages.some(page => item.pageName === page)
        )
        console.log(`精确匹配结果: ${exactMatches.length} 条`)
        
        // 检查模糊匹配的结果
        const fuzzyMatches = data.filter(item => 
          specifiedPages.some(page => item.pageName && item.pageName.includes(page))
        )
        console.log(`模糊匹配结果: ${fuzzyMatches.length} 条`)
        
        // 调试：显示匹配的页面名称样本
        if (filteredData.length > 0) {
          const matchedPageNames = [...new Set(filteredData.map(item => item.pageName))]
          console.log(`✅ 匹配到的页面名称样本:`, matchedPageNames.slice(0, 5))
        }
        
        // 调试：显示匹配的页面名称
        if (filteredData.length === 0) {
          console.log('❌ 未找到匹配的页面，尝试的匹配规则:')
          specifiedPages.forEach(specifiedPage => {
            const exactMatches = actualPageNames.filter(actualPage => actualPage.includes(specifiedPage))
            const fuzzyMatches = actualPageNames.filter(actualPage => {
              const normalizedPageName = actualPage.replace(/[—_\-]/g, '')
              const normalizedTarget = specifiedPage.replace(/[—_\-]/g, '')
              return normalizedPageName.includes(normalizedTarget)
            })
            console.log(`  "${specifiedPage}" -> 精确匹配:`, exactMatches.slice(0, 3))
            console.log(`  "${specifiedPage}" -> 模糊匹配:`, fuzzyMatches.slice(0, 3))
            
            // 显示最相似的页面名称
            const similarPages = actualPageNames.filter(actualPage => {
              const targetKeywords = specifiedPage.split(/[—_\-]/gi).filter(k => k.trim().length > 1)
              const sourceKeywords = actualPage.split(/[—_\-]/gi).filter(k => k.trim().length > 1)
              return targetKeywords.some(targetKeyword => 
                sourceKeywords.some(sourceKeyword => 
                  sourceKeyword.includes(targetKeyword) || targetKeyword.includes(sourceKeyword)
                )
              )
            })
            console.log(`  "${specifiedPage}" -> 相似页面:`, similarPages.slice(0, 5))
          })
          
          // 显示所有可用的页面名称，帮助用户选择
          console.log('=== 所有可用的页面名称（前20个） ===')
          actualPageNames.slice(0, 20).forEach((pageName, index) => {
            console.log(`${index + 1}. ${pageName}`)
          })
          if (actualPageNames.length > 20) {
            console.log(`...还有${actualPageNames.length - 20}个页面`)
          }
          console.log('========================')
        }
        
        if (filteredData.length > 0) {
          data = filteredData
          console.log('使用过滤后的数据:', filteredData.length, '条')
        } else {
          // 对于单页面分析，如果找不到匹配的页面，尝试更宽松的匹配策略
          if (analysis.chartType === 'single_page_uv_pv_chart') {
            console.log('🔍 尝试更宽松的匹配策略...')
            
            // 尝试更宽松的匹配：只要包含任何一个关键词就匹配
            const relaxedMatches = data.filter(item => 
              specifiedPages.some(page => {
                if (!item.pageName) return false
                
                // 将页面名称和指定页面都转换为关键词
                const pageKeywords = page.split(/[—_\-]/gi).filter(k => k.trim().length > 1)
                const itemKeywords = item.pageName.split(/[—_\-]/gi).filter(k => k.trim().length > 1)
                
                // 检查是否有任何关键词匹配
                return pageKeywords.some(pageKeyword => 
                  itemKeywords.some(itemKeyword => 
                    itemKeyword.includes(pageKeyword) || pageKeyword.includes(itemKeyword)
                  )
                )
              })
            )
            
            if (relaxedMatches.length > 0) {
              console.log(`✅ 宽松匹配成功: 找到${relaxedMatches.length}条数据`)
              data = relaxedMatches
            } else {
              // 如果宽松匹配也失败，提供错误提示
              const availablePages = actualPageNames.slice(0, 5).join('、')
              const suggestedPages = actualPageNames.filter(page => 
                specifiedPages.some(specified => 
                  page.includes(specified) || specified.includes(page)
                )
              ).slice(0, 5)
              
              let errorMsg = `❌ 抱歉，系统中没有找到"${specifiedPages.join(', ')}"这个页面。\n\n`
              
              if (suggestedPages.length > 0) {
                errorMsg += `💡 建议的页面名称：\n${suggestedPages.map(page => `• ${page}`).join('\n')}\n\n`
              }
              
              errorMsg += `📋 当前可用的页面包括：\n${actualPageNames.slice(0, 10).map(page => `• ${page}`).join('\n')}${actualPageNames.length > 10 ? `\n\n...还有${actualPageNames.length - 10}个页面` : ''}\n\n`
              errorMsg += `请从上述页面中选择一个正确的页面名称。`
              throw new Error(errorMsg)
            }
          } else {
            message.warning(`未找到指定页面的数据，将显示所有数据`)
            console.log('使用所有数据（未过滤）:', data.length, '条')
          }
        }
      }
      
      // 如果没有数据，抛出错误
      if (data.length === 0) {
        throw new Error('API返回数据为空，请检查日期范围或埋点配置')
      }

      // 构造日期范围字符串
      let dateRangeStr = null
      if (dateRange && dateRange.length === 2) {
        try {
          dateRangeStr = `${dateRange[0].format('YYYY-MM-DD')} 至 ${dateRange[1].format('YYYY-MM-DD')}`
        } catch (e) {
          console.warn('日期格式化失败:', e)
          dateRangeStr = '日期范围'
        }
      }
      console.log('生成的日期范围字符串:', dateRangeStr)
      
      // 创建包含日期范围的 analysis 对象
      const analysisWithDateRange = {
        ...analysis,
        dateRange: dateRangeStr, // 传递日期范围信息
        userDateRange: dateRange // 传递用户选择的日期范围（用于图表生成）
      }
      
      // 根据图表类型处理数据，为表格显示准备聚合后的数据
      let processedData = data
      if (analysisWithDateRange.chartType === 'single_page_uv_pv_chart') {
        // 对于单页面UV/PV图表，图表生成器会自己处理数据聚合
        // 这里不需要预处理，保持原始数据格式
        console.log('📊 单页面UV/PV图表，使用原始数据:', data.length, '条')
      } else if (analysisWithDateRange.chartType?.includes('button_click_analysis') || analysisWithDateRange.chartType === 'button_click_daily' || analysis.type === 'button_click_daily') {
        // 对于按钮点击分析，设置正确的图表类型和参数
        // 优先使用原始analysis.type，因为Ollama AI可能理解错误
        if (analysis.type === 'button_click_daily') {
          analysisWithDateRange.chartType = 'button_click_daily'
          console.log('📊 按钮点击按天分析图表，使用原始数据:', data.length, '条')
        } else if (analysisWithDateRange.chartType === 'button_click_daily') {
          analysisWithDateRange.chartType = 'button_click_daily'
          console.log('📊 按钮点击按天分析图表，使用原始数据:', data.length, '条')
        } else {
          analysisWithDateRange.chartType = 'button_click_analysis'
          console.log('📊 按钮点击分析图表，使用原始数据:', data.length, '条')
        }
        
        // 从store中获取按钮分析参数
        const buttonParams = store.state.buttonAnalysisParams
        
        // 优先使用store中保存的原始type
        if (buttonParams.type) {
          analysisWithDateRange.chartType = buttonParams.type
          console.log('🔍 使用store中保存的原始type:', buttonParams.type)
        }
        
        // 确保按钮名称正确传递
        if (!analysisWithDateRange.buttonName) {
          if (analysis.buttonName) {
            analysisWithDateRange.buttonName = analysis.buttonName
          } else if (buttonParams.buttonName) {
            analysisWithDateRange.buttonName = buttonParams.buttonName
          }
        }
        
        if (!analysisWithDateRange.pageName) {
          if (analysis.pageName) {
            analysisWithDateRange.pageName = analysis.pageName
          } else if (buttonParams.pageName) {
            analysisWithDateRange.pageName = buttonParams.pageName
          }
        }
        
        console.log('🎯 按钮信息:', {
          pageName: analysisWithDateRange.pageName,
          buttonName: analysisWithDateRange.buttonName
        })
        console.log('🔍 原始analysis对象:', {
          type: analysis.type,
          pageName: analysis.pageName,
          buttonName: analysis.buttonName
        })
        console.log('🔍 完整分析对象:', analysisWithDateRange)
        
        // 清除store中的按钮分析参数，避免影响后续分析
        store.dispatch('updateButtonAnalysisParams', {
          pageName: null,
          buttonName: null,
          buttonData: null
        })
      }
      
      // 先保存图表配置，触发 hasChart 变为 true
      store.dispatch('updateChartConfig', {
        analysis: analysisWithDateRange,
        data: processedData, // 使用处理后的数据
        rawData: data, // 保留原始数据
        timestamp: new Date().toISOString()
      })
      
      // 等待 DOM 更新后再生成图表
      await nextTick()
      await nextTick() // 双重 nextTick 确保 DOM 完全更新
      
      // 先销毁旧图表，确保重新渲染
      if (chartGenerator.value.chart) {
        console.log('销毁旧图表，准备重新生成')
        chartGenerator.value.chart.dispose()
        chartGenerator.value.chart = null // 清空引用，避免重复dispose
      }
      
      // 等待更长时间确保DOM完全渲染
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // 确认容器存在
      const container = document.getElementById('chart-container')
      console.log('🔍 查找图表容器 chart-container:', container)
      
      if (!container) {
        console.error('图表容器未找到，延迟重试')
        // 延迟更长时间再试
        setTimeout(async () => {
          const retryContainer = document.getElementById('chart-container')
          console.log('🔍 重试查找图表容器:', retryContainer)
          
          if (retryContainer) {
            try {
              // 检查是否已经dispose过，避免重复dispose
              if (chartGenerator.value.chart && !chartGenerator.value.chart.isDisposed()) {
                chartGenerator.value.chart.dispose()
              }
              chartGenerator.value.generateChart(analysisWithDateRange, data, 'chart-container')
              message.success('图表生成完成', 3)
            } catch (error) {
              console.error('重试生成图表失败:', error)
              message.error('图表生成失败')
            }
          } else {
            console.error('重试后仍未找到图表容器')
            message.error('图表容器加载失败')
          }
        }, 300)
        return
      }
      
      // 生成新图表
      console.log('最终传递给图表的数据量:', data.length, '条')
      console.log('图表类型:', analysisWithDateRange.chartType)
      
      // 调试：显示最终数据的详细信息
      if (data.length > 0) {
        console.log('最终数据样本:', data.slice(0, 3).map(d => ({
          id: d.id,
          pageName: d.pageName,
          type: d.type,
          createdAt: d.createdAt,
          weCustomerKey: d.weCustomerKey,
          content: d.content,
          allKeys: Object.keys(d)
        })))
      }
      
      try {
        // 生成图表
        console.log('🔧 开始生成图表')
        chartGenerator.value.generateChart(analysisWithDateRange, data, 'chart-container')
        console.log('✅ 图表生成成功')
        
        message.success(`分析完成（${data.length}条数据）`)
      } catch (error) {
        console.error('❌ 图表生成失败:', error)
        message.error(`图表生成失败: ${error.message}`)
        throw error
      }
      
    } catch (error) {
      console.error('图表生成失败:', error)
      throw error
    }
  }


  return {
    chartGenerator,
    initChartGenerator,
    generateChart,
    extractPageNames
  }
}
