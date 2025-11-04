import { useStore } from 'vuex'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { backendChartService as chartDB } from '@/services/backendChartService'
import { useChartManager } from '@/composables/useChartManager'
import { useChart } from '@/composables/useChart'
import { aggregationService } from '@/utils/aggregationService'
import { buttonClickAnalysisSaveService } from '@/services/buttonClickAnalysisSaveService'

/**
 * 图表保存相关的逻辑
 */
export function useChartSave() {
  const store = useStore()
  const { saveChart: saveChartToManager } = useChartManager()
  const { extractPageNames } = useChart()

  /**
   * 保存图表到图表库
   */
  const saveChartToLibrary = async () => {
    if (!store.state.chartConfig) {
      message.warning('请先生成图表')
      return
    }
    
    try {
      console.groupCollapsed('💾 [Home] 保存图表 - 优化版本')
      console.time('saveChart')
      const chartData = store.state.chartConfig.data
      // 🚀 修复：优先使用 chartConfig.analysis，确保按钮点击分析等特殊类型正确识别
      const effectiveAnalysis = store.state.chartConfig.analysis || store.state.analysisResult || {}
      // 🚀 修复：优先使用 chartConfig.analysis 中的 chartType，确保按钮点击分析等特殊类型不被覆盖
      const chartType = store.state.chartConfig?.analysis?.chartType || effectiveAnalysis.chartType
      
      console.log('🔍 chartType 来源检查:', {
        fromAnalysisResult: store.state.analysisResult?.chartType,
        fromChartConfig: store.state.chartConfig?.analysis?.chartType,
        finalChartType: chartType,
        effectiveAnalysis: effectiveAnalysis
      })
      
      if (!chartData || (Array.isArray(chartData) && chartData.length === 0)) {
        message.warning('图表数据为空，无法保存')
        console.warn('⚠️ [Home] 数据为空，终止保存')
        console.groupEnd()
        return
      }
      
      // 从数据中提取日期范围
      let uniqueDates = []
      if (chartData && typeof chartData === 'object' && !Array.isArray(chartData)) {
        if (chartData.categories) {
          // 标准图表对象（有categories字段）
          uniqueDates = [...new Set(chartData.categories)].sort()
          console.log('🗓️ [Home] 使用图表对象中的categories作为日期范围', uniqueDates)
        } else if (chartData.steps && Array.isArray(chartData.steps)) {
          // 漏斗图数据对象（有steps字段）
          console.log('🗓️ [Home] 检测到漏斗图数据，使用当前日期作为日期范围')
          uniqueDates = [dayjs().format('YYYY-MM-DD')]
        } else {
          // 其他对象类型，使用当前日期
          console.log('🗓️ [Home] 检测到其他对象类型，使用当前日期作为日期范围')
          uniqueDates = [dayjs().format('YYYY-MM-DD')]
        }
      } else if (Array.isArray(chartData)) {
        // 数组类型数据
        const dates = chartData.map(d => dayjs(d.createdAt).format('YYYY-MM-DD')).filter(d => d)
        uniqueDates = [...new Set(dates)].sort()
        console.log('🗓️ [Home] 使用原始数组数据提取的日期范围', uniqueDates)
      } else {
        // 其他情况，使用当前日期
        console.log('🗓️ [Home] 未知数据类型，使用当前日期作为日期范围')
        uniqueDates = [dayjs().format('YYYY-MM-DD')]
      }
      
      // 优化策略：只保存最近7天的数据
      const maxInitialDays = 7
      const recentDates = uniqueDates.slice(-maxInitialDays)
      console.log(`📊 [Home] 优化策略：只保存最近${maxInitialDays}天数据 (${recentDates.length}/${uniqueDates.length}天)`)
      
      // 构造图表配置
      let chartName = effectiveAnalysis.description || store.state.currentRequirement
      
      if (!chartName || chartName === '数据分析' || chartName === '数据对比分析') {
        const pageName = extractPageNames(store.state.currentRequirement)[0]
        if (pageName && pageName !== '__ALL__') {
          const analysisType = store.state.apiConfig.selectedAnalysisType || 'page_analysis'
          if (analysisType === 'page_analysis') {
            chartName = `分析页面"${pageName}"的访问量数据`
          } else if (analysisType === 'click_analysis') {
            chartName = `分析页面"${pageName}"的点击行为`
          } else if (analysisType === 'behavior_analysis') {
            chartName = `分析页面"${pageName}"的用户行为`
          } else {
            chartName = `分析页面"${pageName}"的数据`
          }
        } else {
          chartName = store.state.currentRequirement || '数据分析'
        }
      }
      
      // 添加时间戳避免重复
      const timestamp = dayjs().format('MM-DD HH:mm')
      chartName = `${chartName} (${timestamp})`
      
      // 检查图表名称是否已存在
      const existingCharts = await chartDB.getAllCharts()
      const duplicateChart = existingCharts.find(chart => chart.name === chartName)
      
      if (duplicateChart) {
        console.warn('⚠️ [Home] 发现重复图表名称:', chartName)
        message.warning({
          content: `图表名称"${chartName}"已存在，请修改需求后重新生成图表`,
          duration: 5
        })
        console.groupEnd()
        return
      }
      
      
      // 🚀 修复：漏斗图使用正确的分类
      let chartCategory = getCategoryByAnalysisType(store.state.apiConfig.selectedAnalysisType || 'page_analysis')
      if (chartType === 'behavior_funnel' || chartType === 'conversion_funnel') {
        chartCategory = '转化分析'
      }
      
      const chartConfig = {
        name: chartName,
        description: store.state.currentRequirement || effectiveAnalysis.description || chartName,
        category: chartCategory,
        chartType: chartType,
        mode: store.state.analysisMode || 'single',
        selectedPointId: store.state.apiConfig.selectedPointId,
        埋点类型: (store.state.analysisMode || 'single') === 'dual' ? '访问+点击' : '访问',
        filters: {
          pageName: extractPageNames(store.state.currentRequirement)[0] || null
        },
        dimensions: ['date'],
        metrics: effectiveAnalysis.metrics || ['uv', 'pv'],
        dateRangeStrategy: 'last_30_days',
        scheduledUpdate: {
          enabled: true,
          frequency: 'daily',
          time: '01:00',
          maxHistoryDays: 365,
          batchSize: 10
        },
        dataRange: {
          totalDays: uniqueDates.length,
          initialDays: recentDates.length,
          pendingDays: uniqueDates.length - recentDates.length,
          lastDataUpdate: recentDates[recentDates.length - 1] || null
        }
      }
      
      // 保存特殊参数
      if (chartType === 'query_condition_analysis' && store.state.queryConditionAnalysisParams.pageName) {
        chartConfig.queryConditionParams = {
          pageName: store.state.queryConditionAnalysisParams.pageName,
          queryCondition: store.state.queryConditionAnalysisParams.queryCondition,
          queryData: store.state.queryConditionAnalysisParams.queryData
        }
      }
      
      if ((chartType === 'button_click_analysis' || chartType === 'button_click_daily') && store.state.buttonAnalysisParams.pageName) {
        chartConfig.buttonParams = {
          pageName: store.state.buttonAnalysisParams.pageName,
          buttonName: store.state.buttonAnalysisParams.buttonName,
          buttonData: store.state.buttonAnalysisParams.buttonData
        }
      }
      
      if (chartType === 'single_page_uv_pv_chart' && effectiveAnalysis.parameters?.pageName) {
        chartConfig.pageAccessParams = {
          pageName: effectiveAnalysis.parameters.pageName
        }
      }
      
      // 按日期聚合数据
      const initialData = {}
      
      const isButtonClickAnalysis = chartType === 'button_click_analysis' || chartType === 'button_click_daily'
      const isQueryConditionAnalysis = chartType === 'query_condition_analysis'
      
      if (isButtonClickAnalysis) {
        // 使用专门的按钮点击分析保存服务
        const saveResult = await buttonClickAnalysisSaveService.saveButtonClickAnalysis({
          chartData,
          effectiveAnalysis,
          recentDates,
          chartType,
          storeState: store.state
        })
        console.log('✅ [Home] 按钮点击分析保存完成:', saveResult)
        
        // 显示保存成功消息
        if (saveResult.success) {
          message.success(`图表"${saveResult.chartName}"已保存（${saveResult.dataCount}天数据）`)
          
          // 提示用户查看
          const key = `save-chart-${Date.now()}`
          message.info({
            content: '图表已保存，点击查看',
            duration: 5,
            key,
            onClick: () => {
              message.destroy(key)
              window.open('/my-charts', '_blank')
            }
          })
        }
        
        console.timeEnd('saveChart')
        console.groupEnd()
        return saveResult
      } else if (isQueryConditionAnalysis) {
        // 🚀 修复：检查是否已有处理好的多条件数据
        console.log('🔍 [Home] 查询条件分析 - chartData结构检查:', {
          type: typeof chartData,
          isArray: Array.isArray(chartData),
          hasCategories: !!(chartData && chartData.categories),
          hasConditionData: !!(chartData && chartData.conditionData),
          hasUvData: !!(chartData && chartData.uvData),
          hasPvData: !!(chartData && chartData.pvData),
          keys: chartData ? Object.keys(chartData).join(', ') : 'null'
        })
        console.log('🔍 [Home] chartData完整内容:', JSON.stringify(chartData, null, 2))
        const processedChartData = store.state.chartConfig.data
        if (processedChartData && typeof processedChartData === 'object' && !Array.isArray(processedChartData) && processedChartData.conditionData) {
          console.log('📊 [Home] 使用已处理的多条件数据保存')
          await processQueryConditionData(processedChartData, effectiveAnalysis, recentDates, initialData)
        } else {
          console.log('🔧 [Home] 使用原始数据重新处理查询条件')
          await processQueryConditionData(chartData, effectiveAnalysis, recentDates, initialData)
        }
      } else if (chartType === 'behavior_funnel' || chartType === 'conversion_funnel') {
        // 🚀 修复：漏斗图数据特殊处理
        console.log('📊 [Home] 检测到漏斗图数据，使用特殊处理逻辑')
        await processFunnelData(chartData, chartConfig, recentDates, initialData)
      } else {
        await processStandardData(chartData, chartConfig, recentDates, initialData)
      }
      
      console.log('📝 [Home] initialData 预览(前2天):', Object.entries(initialData).slice(0,2))
      
      // 确保chartConfig可序列化
      const serializableChartConfig = JSON.parse(JSON.stringify(chartConfig))
      
      // 保存图表
      const savedChart = await saveChartToManager(serializableChartConfig, initialData)
      
      // 显示保存状态
      const savedDays = Object.keys(initialData).length
      const pendingDays = chartConfig.dataRange.pendingDays
      
      message.success(`图表"${savedChart.name}"已保存（${savedDays}天数据）`)
      
      if (pendingDays > 0) {
        message.info({
          content: `历史数据（${pendingDays}天）将通过定时任务自动补充`,
          duration: 8
        })
      }
      
      console.timeEnd('saveChart')
      console.groupEnd()
      
      // 提示用户查看
      const key = `save-chart-${Date.now()}`
      message.info({
        content: '图表已保存，点击查看',
        duration: 5,
        key,
        onClick: () => {
          message.destroy(key)
          window.open('/my-charts', '_blank')
        }
      })
      
    } catch (error) {
      console.error('❌ [Home] 保存图表失败:', error)
      console.groupEnd()
      const errorMessage = error?.message || error?.toString() || '未知错误'
      message.error('保存图表失败: ' + errorMessage)
    }
  }


  /**
   * 处理按钮点击数据
   */
  const processButtonClickData = async (chartData, effectiveAnalysis, recentDates, initialData) => {
    console.log('🔍 [Home] 检测到按钮点击分析，使用特殊处理逻辑')
    
    if (chartData && typeof chartData === 'object' && !Array.isArray(chartData) && chartData.categories) {
      console.log('📊 [Home] 数据已经是图表格式，直接转换')
      
      chartData.categories.forEach((date, index) => {
        if (recentDates.includes(date)) {
          initialData[date] = {
            metrics: {
              uv: chartData.uvData[index] || 0,
              pv: chartData.pvData[index] || 0
            },
            dimensions: {},
            metadata: {
              rawRecordCount: 0,
              filteredRecordCount: 0,
              processedAt: new Date().toISOString(),
              dataQuality: 'good'
            }
          }
        }
      })
    } else {
      console.log('🔧 [Home] 按钮点击分析：直接从原始数据聚合UV/PV')
      
      // 🚀 修复：处理不同的数据格式
      let dataArray = chartData
      if (!Array.isArray(chartData)) {
        console.log('🔧 [Home] 按钮点击分析 - chartData不是数组，尝试转换:', typeof chartData, chartData)
        
        // 如果是对象，尝试提取数组数据
        if (chartData && typeof chartData === 'object') {
          if (chartData.rawData && Array.isArray(chartData.rawData)) {
            console.log('🔧 [Home] 按钮点击分析 - 使用rawData字段')
            dataArray = chartData.rawData
          } else {
            console.error('❌ [Home] 按钮点击分析 - 无法识别的数据格式:', chartData)
            return
          }
        } else {
          console.error('❌ [Home] 按钮点击分析 - chartData不是数组也不是对象:', typeof chartData, chartData)
          return
        }
      }
      
      for (const date of recentDates) {
        const dayData = dataArray.filter(d => 
          dayjs(d.createdAt).format('YYYY-MM-DD') === date
        )
        
        if (dayData.length > 0) {
          const buttonClickData = dayData.filter(item => 
            item.type === 'click' && 
            item.pageName === effectiveAnalysis.pageName && 
            item.content === effectiveAnalysis.buttonName
          )
          
          let uv = 0
          let pv = 0
          const uvSet = new Set()
          
          buttonClickData.forEach(item => {
            pv++
            if (item.weCustomerKey) {
              uvSet.add(item.weCustomerKey)
            }
          })
          
          uv = uvSet.size
          
          initialData[date] = {
            metrics: { uv, pv },
            dimensions: {},
            metadata: {
              rawRecordCount: dayData.length,
              filteredRecordCount: buttonClickData.length,
              processedAt: new Date().toISOString(),
              dataQuality: buttonClickData.length > 0 ? 'good' : 'no_data'
            }
          }
        }
      }
    }
  }

  /**
   * 处理查询条件数据
   */
  const processQueryConditionData = async (chartData, effectiveAnalysis, recentDates, initialData) => {
    console.log('🔍 [Home] 检测到查询条件分析，使用专门的保存逻辑')
    
    if (chartData && typeof chartData === 'object' && !Array.isArray(chartData) && chartData.conditionData && chartData.conditionData.length > 0) {
      console.log('📊 [Home] 查询条件数据已经是多条件格式，保存每个条件的分别数据')
      console.log('🔍 [Home] 数据结构检查:', {
        hasConditionData: !!chartData.conditionData,
        conditionDataLength: chartData.conditionData?.length,
        conditionDataSample: chartData.conditionData?.slice(0, 2),
        categoriesLength: chartData.categories?.length,
        categoriesSample: chartData.categories?.slice(0, 3)
      })
      
      // 保存每个条件的分别数据
      chartData.conditionData.forEach((condition, conditionIndex) => {
        const conditionName = condition.name
        
        chartData.categories.forEach((date, dateIndex) => {
          if (recentDates.includes(date)) {
            const pvValue = condition.data[dateIndex] || 0
            // 🚀 修复：使用临时ID，稍后会被正确的chartId替换
            const dataId = `temp_${date}_${conditionName}`
            
            initialData[dataId] = {
              date: date, // 🚀 修复：确保date字段正确
              conditionName: conditionName, // 🚀 修复：添加conditionName字段
              metrics: {
                pv: pvValue,
                uv: 0
              },
              dimensions: {
                condition: conditionName,
                date: date
              },
              metadata: {
                conditionIndex: conditionIndex,
                dateIndex: dateIndex,
                rawRecordCount: 0,
                filteredRecordCount: 0,
                processedAt: new Date().toISOString(),
                dataQuality: 'good'
              }
            }
          }
        })
      })
    } else {
      console.log('🔧 [Home] 查询条件分析：直接从原始数据聚合UV/PV')
      console.log('🔍 [Home] 原始数据结构检查:', {
        isArray: Array.isArray(chartData),
        dataLength: Array.isArray(chartData) ? chartData.length : 'N/A',
        dataType: typeof chartData,
        hasConditionData: !!(chartData && chartData.conditionData),
        sampleData: Array.isArray(chartData) ? chartData.slice(0, 2) : chartData
      })
      
      // 🚀 修复：检查数据格式，如果是对象且包含categories和uvData/pvData，说明是处理后的单条件数据
      if (chartData && typeof chartData === 'object' && !Array.isArray(chartData) && 
          chartData.categories && (chartData.uvData || chartData.pvData)) {
        console.log('📊 [Home] 检测到处理后的单条件数据，直接使用')
        
        // 提取条件名称
        const queryCondition = effectiveAnalysis.parameters?.queryCondition || ''
        let conditionName = '全部'
        if (queryCondition.includes(':')) {
          const parts = queryCondition.split(':')
          if (parts.length === 2) {
            const conditions = parts[1].split(/[、，]/).map(c => c.trim())
            if (conditions.length === 1) {
              conditionName = conditions[0]
            }
          }
        }
        
        // 使用处理后的数据
        chartData.categories.forEach((date, index) => {
          if (recentDates.includes(date)) {
            const uv = chartData.uvData ? chartData.uvData[index] || 0 : 0
            const pv = chartData.pvData ? chartData.pvData[index] || 0 : 0
            
            const dataId = `temp_${date}_${conditionName}`
            initialData[dataId] = {
              date: date,
              conditionName: conditionName,
              metrics: { uv, pv },
              dimensions: {
                condition: conditionName,
                date: date
              },
              metadata: {
                processedAt: new Date().toISOString(),
                dataQuality: 'good',
                source: 'processed_single_condition'
              }
            }
          }
        })
      } else if (Array.isArray(chartData)) {
        // 原始数组数据，需要重新聚合
        console.log('📊 [Home] 检测到原始数组数据，重新聚合')
        for (const date of recentDates) {
          const dayData = chartData.filter(d => 
            dayjs(d.createdAt).format('YYYY-MM-DD') === date
          )
        
        if (dayData.length > 0) {
          const queryCondition = effectiveAnalysis.parameters?.queryCondition || ''
          const queryConditionData = dayData.filter(item => {
            if (item.type !== 'click' || item.pageName !== effectiveAnalysis.parameters?.pageName) {
              return false
            }
            
            let conditions = []
            if (queryCondition.includes(':')) {
              const parts = queryCondition.split(':')
              if (parts.length === 2) {
                conditions = parts[1].split(/[、，]/).map(c => c.trim())
              }
            }
            
            if (conditions.length > 0) {
              let isMatch = conditions.some(condition => item.content === condition)
              
              if (!isMatch) {
                try {
                  const parsedContent = JSON.parse(item.content)
                  if (typeof parsedContent === 'object') {
                    const groupType = effectiveAnalysis.parameters?.queryData?.groupType
                    if (groupType && parsedContent[groupType]) {
                      const contentValue = parsedContent[groupType]
                      isMatch = conditions.some(condition => contentValue === condition)
                    }
                  }
                } catch (e) {
                  // 不是JSON格式
                }
              }
              
              if (!isMatch && item.content === '查询') {
                isMatch = true
              }
              
              return isMatch
            }
            
            return item.content === '查询'
          })
          
          let uv = 0
          let pv = 0
          const uvSet = new Set()
          
          queryConditionData.forEach(item => {
            pv++
            if (item.weCustomerKey) {
              uvSet.add(item.weCustomerKey)
            }
          })
          
          uv = uvSet.size
          
          // 🚀 修复：单条件数据也使用conditionName字段
          let conditionName = '全部'
          if (queryCondition.includes(':')) {
            const parts = queryCondition.split(':')
            if (parts.length === 2) {
              const conditions = parts[1].split(/[、，]/).map(c => c.trim())
              if (conditions.length === 1) {
                conditionName = conditions[0]
              }
            }
          }
          
          const dataId = `temp_${date}_${conditionName}`
          initialData[dataId] = {
            date: date,
            conditionName: conditionName,
            metrics: { uv, pv },
            dimensions: {
              condition: conditionName,
              date: date
            },
            metadata: {
              rawRecordCount: dayData.length,
              filteredRecordCount: queryConditionData.length,
              processedAt: new Date().toISOString(),
              dataQuality: queryConditionData.length > 0 ? 'good' : 'no_data'
            }
          }
        }
      }
      } else {
        console.log('⚠️ [Home] 查询条件分析：未知的数据格式')
      }
    }
  }

  /**
   * 处理漏斗图数据
   */
  const processFunnelData = async (chartData, chartConfig, recentDates, initialData) => {
    console.log('📊 [Home] 处理漏斗图数据')
    
    // 漏斗图数据是对象类型，直接保存
    if (chartData && typeof chartData === 'object' && chartData.steps) {
      // 🚀 修复：漏斗图也应该保存7天数据，生成最近7天的日期范围
      const dates = []
      const endDate = dayjs()
      for (let i = 6; i >= 0; i--) {
        dates.push(endDate.subtract(i, 'day').format('YYYY-MM-DD'))
      }
      console.log('📅 [Home] 漏斗图生成7天日期范围:', dates)
      
      // 为每个日期创建相同的漏斗图数据（因为漏斗图是基于整体数据的聚合结果）
      for (const date of dates) {
        // 🚀 修复：确保所有数据都可以被序列化
        initialData[date] = {
          date: date,
          metrics: {
            totalParticipants: chartData.totalParticipants || 0,
            overallConversionRate: chartData.overallConversionRate || 0,
            averageTotalDuration: chartData.averageTotalDuration || 0
          },
          dimensions: {
            byStep: JSON.parse(JSON.stringify(chartData.steps || []))
          },
          metadata: {
            funnelId: chartData.funnelId || '',
            funnelName: chartData.funnelName || '',
            chartType: 'behavior_funnel',
            // 🚀 修复：保存漏斗步骤配置
            funnelSteps: chartData.funnelSteps || null
          }
        }
      }
      console.log('✅ [Home] 漏斗图数据处理完成')
    } else {
      console.warn('⚠️ [Home] 漏斗图数据格式不正确:', chartData)
    }
  }

  /**
   * 处理标准数据
   */
  const processStandardData = async (chartData, chartConfig, recentDates, initialData) => {
    console.log('📈 [Home] 非按钮点击/查询条件图表，使用标准聚合')
    console.log('🔧 [Home] processStandardData - chartData类型:', typeof chartData, '是否为数组:', Array.isArray(chartData))
    
    // 🚀 修复：处理不同的数据格式
    let dataArray = chartData
    if (!Array.isArray(chartData)) {
      console.log('🔧 [Home] chartData不是数组，尝试转换:', typeof chartData, chartData)
      
      // 如果是对象，尝试提取数组数据
      if (chartData && typeof chartData === 'object') {
        // 检查是否有categories和uvData/pvData字段（聚合后的数据格式）
        if (chartData.categories && chartData.uvData && chartData.pvData) {
          console.log('🔧 [Home] 检测到聚合数据格式，转换为数组格式')
          dataArray = chartData.categories.map((date, index) => ({
            createdAt: date,
            date: date,
            uv: chartData.uvData[index] || 0,
            pv: chartData.pvData[index] || 0
          }))
        } else if (chartData.rawData && Array.isArray(chartData.rawData)) {
          console.log('🔧 [Home] 使用rawData字段')
          dataArray = chartData.rawData
        } else {
          console.error('❌ [Home] 无法识别的数据格式:', chartData)
          return
        }
      } else {
        console.error('❌ [Home] chartData不是数组也不是对象:', typeof chartData, chartData)
        return
      }
    }
    
    console.log('🔧 [Home] 处理后的数据数组长度:', dataArray.length)
    
    for (const date of recentDates) {
      const dayData = dataArray.filter(d => 
        dayjs(d.createdAt).format('YYYY-MM-DD') === date
      )
      
      if (dayData.length > 0) {
        const aggregated = aggregationService.aggregateForChart(
          dayData,
          chartConfig,
          date
        )
        
        initialData[date] = JSON.parse(JSON.stringify(aggregated))
      }
    }
  }

  /**
   * 根据分析类型获取分类
   */
  const getCategoryByAnalysisType = (analysisType) => {
    const categoryMap = {
      'page_analysis': '页面分析',
      'click_analysis': '用户行为',
      'behavior_analysis': '用户行为',
      'button_click_analysis': '用户行为',        // 添加按钮点击分析映射
      'button_click_daily': '用户行为',           // 添加按钮点击日分析映射
      'query_condition_analysis': '查询条件分析',
      'conversion_analysis': '转化分析'
    }
    return categoryMap[analysisType] || '页面分析'
  }

  return {
    saveChartToLibrary
  }
}
