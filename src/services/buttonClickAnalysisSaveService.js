import dayjs from 'dayjs'
import { chartDB } from '@/utils/indexedDBManager'

/**
 * 按钮点击分析保存服务
 */
export class ButtonClickAnalysisSaveService {
  constructor() {
    // 不需要在构造函数中初始化store
  }

  /**
   * 保存按钮点击分析图表
   * @param {Object} params - 保存参数
   * @param {Object} params.chartData - 图表数据
   * @param {Object} params.effectiveAnalysis - 分析配置
   * @param {Array} params.recentDates - 最近日期列表
   * @param {string} params.chartType - 图表类型
   * @returns {Promise<Object>} 保存结果
   */
  async saveButtonClickAnalysis(params) {
    const { chartData, effectiveAnalysis, recentDates, chartType } = params
    
    console.log('🔧 [ButtonClickSaveService] 开始保存按钮点击分析')
    console.log('🔍 [ButtonClickSaveService] 分析参数:', {
      pageName: effectiveAnalysis?.pageName,
      buttonName: effectiveAnalysis?.buttonName,
      chartType,
      dataLength: chartData?.length || 0
    })

    try {
      // 1. 处理数据
      const processedData = await this.processButtonClickData(chartData, effectiveAnalysis, recentDates)
      
      // 2. 构建图表配置
      const chartConfig = this.buildChartConfig(effectiveAnalysis, chartType)
      
      // 3. 构建图表信息
      const chartInfo = this.buildChartInfo(effectiveAnalysis, chartType)
      
      // 4. 保存到数据库
      const saveResult = await this.saveToDatabase(processedData, chartConfig, chartInfo)
      
      console.log('✅ [ButtonClickSaveService] 按钮点击分析保存成功')
      return saveResult
      
    } catch (error) {
      console.error('❌ [ButtonClickSaveService] 保存失败:', error)
      throw error
    }
  }

  /**
   * 处理按钮点击数据
   * @param {Array} chartData - 原始图表数据
   * @param {Object} effectiveAnalysis - 分析配置
   * @param {Array} recentDates - 最近日期列表
   * @returns {Object} 处理后的数据
   */
  async processButtonClickData(chartData, effectiveAnalysis, recentDates) {
    console.log('🔧 [ButtonClickSaveService] 处理按钮点击数据')
    
    const initialData = {}
    
    if (chartData && typeof chartData === 'object' && !Array.isArray(chartData) && chartData.categories) {
      console.log('📊 [ButtonClickSaveService] 数据已经是图表格式，直接转换')
      
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
      console.log('🔧 [ButtonClickSaveService] 从原始数据聚合UV/PV')
      
      for (const date of recentDates) {
        const dayData = chartData.filter(d => 
          dayjs(d.createdAt).format('YYYY-MM-DD') === date
        )
        
        if (dayData.length > 0) {
          // 安全获取页面名称和按钮名称
          const pageName = effectiveAnalysis.pageName || effectiveAnalysis.parameters?.pageName
          const buttonName = effectiveAnalysis.buttonName || effectiveAnalysis.parameters?.buttonName
          
          const buttonClickData = dayData.filter(item => 
            item.type === 'click' && 
            item.pageName === pageName && 
            item.content === buttonName
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
            metrics: {
              uv,
              pv
            },
            dimensions: {
              pageName: pageName,
              buttonName: buttonName
            },
            metadata: {
              rawRecordCount: dayData.length,
              filteredRecordCount: buttonClickData.length,
              processedAt: new Date().toISOString(),
              dataQuality: buttonClickData.length > 0 ? 'good' : 'no_data'
            }
          }
        } else {
          // 没有数据的日期，填充0值
          // 安全获取页面名称和按钮名称
          const pageName = effectiveAnalysis.pageName || effectiveAnalysis.parameters?.pageName || '未知页面'
          const buttonName = effectiveAnalysis.buttonName || effectiveAnalysis.parameters?.buttonName || '未知按钮'
          
          initialData[date] = {
            metrics: {
              uv: 0,
              pv: 0
            },
            dimensions: {
              pageName: pageName,
              buttonName: buttonName
            },
            metadata: {
              rawRecordCount: 0,
              filteredRecordCount: 0,
              processedAt: new Date().toISOString(),
              dataQuality: 'no_data'
            }
          }
        }
      }
    }
    
    console.log('✅ [ButtonClickSaveService] 数据处理完成:', {
      totalDays: Object.keys(initialData).length,
      sampleData: Object.keys(initialData).slice(0, 2).map(date => ({
        date,
        ...initialData[date]
      }))
    })
    
    return initialData
  }

  /**
   * 构建图表配置
   * @param {Object} effectiveAnalysis - 分析配置
   * @param {string} chartType - 图表类型
   * @returns {Object} 图表配置
   */
  buildChartConfig(effectiveAnalysis, chartType) {
    console.log('🔧 [ButtonClickSaveService] 构建图表配置')
    
    // 安全获取页面名称和按钮名称，避免 undefined
    const pageName = effectiveAnalysis.pageName || effectiveAnalysis.parameters?.pageName || '未知页面'
    const buttonName = effectiveAnalysis.buttonName || effectiveAnalysis.parameters?.buttonName || '未知按钮'
    
    const config = {
      chartType,
      dataSource: {
        type: 'button_click_analysis',
        pageName: pageName,
        buttonName: buttonName
      },
      filters: {
        dateRange: {
          startDate: dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
          endDate: dayjs().format('YYYY-MM-DD')
        }
      },
      dimensions: [
        {
          name: 'pageName',
          value: pageName,
          displayName: pageName
        },
        {
          name: 'buttonName', 
          value: buttonName,
          displayName: buttonName
        }
      ],
      metrics: [
        {
          name: 'uv',
          displayName: '独立访客数',
          type: 'count'
        },
        {
          name: 'pv',
          displayName: '点击次数',
          type: 'count'
        }
      ],
      analysis: {
        type: 'button_click_analysis',
        pageName: pageName,
        buttonName: buttonName,
        description: `分析页面"${pageName}"的"${buttonName}"按钮点击情况`
      }
    }
    
    console.log('✅ [ButtonClickSaveService] 图表配置构建完成:', config)
    return config
  }

  /**
   * 构建图表信息
   * @param {Object} effectiveAnalysis - 分析配置
   * @param {string} chartType - 图表类型
   * @returns {Object} 图表信息
   */
  buildChartInfo(effectiveAnalysis, chartType) {
    console.log('🔧 [ButtonClickSaveService] 构建图表信息')
    
    // 安全获取页面名称和按钮名称，避免 undefined
    const pageName = effectiveAnalysis.pageName || effectiveAnalysis.parameters?.pageName || '未知页面'
    const buttonName = effectiveAnalysis.buttonName || effectiveAnalysis.parameters?.buttonName || '未知按钮'
    
    const timestamp = dayjs().format('MM-DD HH:mm')
    const chartName = `分析页面"${pageName}"的"${buttonName}"按钮点击情况 (${timestamp})`
    
    const chartInfo = {
      name: chartName,
      description: `分析页面"${pageName}"的"${buttonName}"按钮点击情况`,
      category: '用户行为',
      chartType,
      tags: ['按钮点击', '用户行为', pageName],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // 保存关键参数，确保详情页能正确解析
      parameters: {
        pageName: pageName,
        buttonName: buttonName,
        analysisType: 'button_click_analysis'
      }
    }
    
    console.log('✅ [ButtonClickSaveService] 图表信息构建完成:', chartInfo)
    return chartInfo
  }

  /**
   * 保存到数据库
   * @param {Object} processedData - 处理后的数据
   * @param {Object} chartConfig - 图表配置
   * @param {Object} chartInfo - 图表信息
   * @returns {Promise<Object>} 保存结果
   */
  async saveToDatabase(processedData, chartConfig, chartInfo) {
    console.log('🔧 [ButtonClickSaveService] 保存到数据库')
    
    try {
      // 生成图表ID
      const chartId = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // 保存图表配置 - 确保包含必需的 id 字段
      const chartToSave = {
        id: chartId,
        ...chartInfo,
        config: chartConfig,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastDataUpdate: null
      }
      await chartDB.saveChart(chartToSave)
      console.log('✅ [ButtonClickSaveService] 图表配置已保存')
      
      // 保存数据 - 使用正确的格式
      const dataEntries = Object.entries(processedData).map(([date, data]) => ({
        chartId: chartId,
        date: date,
        ...data
      }))
      
      await chartDB.batchSaveChartData(dataEntries)
      console.log(`✅ [ButtonClickSaveService] 数据已保存: ${dataEntries.length}天`)
      
      return {
        success: true,
        chartId: chartId,
        chartName: chartInfo.name,
        dataCount: dataEntries.length,
        message: '按钮点击分析保存成功'
      }
      
    } catch (error) {
      console.error('❌ [ButtonClickSaveService] 数据库保存失败:', error)
      throw error
    }
  }
}

// 创建单例实例
export const buttonClickAnalysisSaveService = new ButtonClickAnalysisSaveService()
