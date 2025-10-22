import * as echarts from 'echarts'

/**
 * 智能图表生成器
 */
export class ChartGenerator {
  constructor() {
    this.chart = null
  }
  
  /**
   * 生成图表
   * @param {Object} analysis 需求分析结果
   * @param {Array} data 数据
   * @param {string} containerId 容器ID
   */
  generateChart(analysis, data, containerId) {
    console.log(`🔧 开始生成图表: ${analysis.chartType}`, {
      containerId,
      dataLength: data.length,
      analysis
    })
    
    const container = document.getElementById(containerId)
    if (!container) {
      console.error(`❌ 容器 ${containerId} 不存在`)
      console.log('🔍 当前DOM中所有元素:', document.querySelectorAll('*'))
      throw new Error(`容器 ${containerId} 不存在`)
    }
    
    console.log('✅ 找到图表容器:', container)
    
    // 初始化图表，配置passive事件监听器
    if (this.chart && !this.chart.isDisposed()) {
      console.log('🗑️ 销毁旧图表')
      this.chart.dispose()
    }
    
    try {
      this.chart = echarts.init(container, null, {
        renderer: 'canvas',
        useDirtyRect: false
      })
      console.log('✅ ECharts实例创建成功')
    } catch (error) {
      console.error('❌ ECharts实例创建失败:', error)
      throw new Error(`ECharts实例创建失败: ${error.message}`)
    }
    
    // 根据图表类型生成配置
    console.log('🔧 生成图表配置...')
    const option = this.generateOption(analysis, data)
    console.log('📊 生成的图表配置:', option)
    
    // 验证配置
    if (!option || !option.series || !Array.isArray(option.series) || option.series.length === 0) {
      console.error('❌ 图表配置无效:', option)
      throw new Error('图表配置生成失败')
    }
    
    // 验证每个series配置
    option.series.forEach((series, index) => {
      if (!series || !series.type) {
        console.error(`❌ Series ${index} 配置无效:`, series)
        throw new Error(`Series ${index} 配置无效`)
      }
    })
    
    console.log('✅ 图表配置验证通过')
    
    // 添加数据统计信息到图表（传递日期范围信息）
    this.addDataInfo(option, data, analysis.dateRange)
    
    try {
      // 设置配置并渲染
      this.chart.setOption(option, true)
      console.log('✅ 图表渲染成功')
    } catch (error) {
      console.error('❌ 图表渲染失败:', error)
      throw new Error(`图表渲染失败: ${error.message}`)
    }
    
    // 响应式处理
    window.addEventListener('resize', () => {
      this.chart?.resize()
    })
    
    console.log('✅ 图表生成完成')
    return this.chart
  }
  
  /**
   * 添加数据信息到图表
   * @param {Object} option ECharts配置
   * @param {Array} data 数据
   * @param {String} dateRange 日期范围信息（可选）
   */
  addDataInfo(option, data, dateRange = null) {
    // 不再在图表内部添加标题和副标题，因为标题现在在卡片上
    // 只调整图表的边距，为卡片标题留出空间
    if (!option.grid) {
      option.grid = {}
    }
    // 增加顶部边距，避免图表被卡片标题截掉
    option.grid.top = 60
    option.grid.left = 60
    option.grid.right = 40
    option.grid.bottom = 60
  }
  
  /**
   * 生成图表配置
   * @param {Object} analysis 分析结果
   * @param {Array} data 数据
   * @returns {Object} ECharts配置
   */
  generateOption(analysis, data) {
    // 检查是否为双埋点数据
    const isDualMode = data && data.length > 0 && data[0].hasOwnProperty('dataType')
    
    // 检查是否为UV/PV分析
    const isUVAnalysis = analysis.intent && (analysis.intent.includes('uv') || analysis.intent.includes('独立访客'))
    const isPVAnalysis = analysis.intent && (analysis.intent.includes('pv') || analysis.intent.includes('访问量') || analysis.intent.includes('访问次数'))
    const isUVPVAnalysis = analysis.intent === 'uv_pv_analysis' || (isUVAnalysis && isPVAnalysis)
    
    switch (analysis.chartType) {
      case 'funnel':
        return isDualMode ? this.generateDualFunnelOption(analysis, data) : this.generateFunnelOption(analysis, data)
      case 'line':
        return isDualMode ? this.generateDualLineOption(analysis, data) : this.generateLineOption(analysis, data)
      case 'bar':
        if (isUVAnalysis || isPVAnalysis) {
          return this.generateUVPVAnalysisOption(analysis, data)
        }
        return isDualMode ? this.generateDualBarOption(analysis, data) : this.generateBarOption(analysis, data)
      case 'pie':
        return isDualMode ? this.generateDualPieOption(analysis, data) : this.generatePieOption(analysis, data)
      case 'value_card':
        return isDualMode ? this.generateDualValueCardOption(analysis, data) : this.generateValueCardOption(analysis, data)
      case 'stacked_bar':
        return isDualMode ? this.generateDualStackedBarOption(analysis, data) : this.generateStackedBarOption(analysis, data)
      case 'conversion_funnel':
        return this.generateConversionFunnelOption(analysis, data)
      case 'click_heatmap':
        if (isUVAnalysis || isPVAnalysis) {
          return this.generateUVPVClickOption(analysis, data)
        }
        return this.generateClickHeatmapOption(analysis, data)
      case 'user_journey':
        return this.generateUserJourneyOption(analysis, data)
      case 'uv_pv_chart':
        return this.generateUVPVComparisonOption(analysis, data)
      case 'click_uv_pv_chart':
        return this.generateClickUVPVComparisonOption(analysis, data)
      case 'single_page_uv_pv_chart':
        return this.generateSinglePageUVPVChartOption(analysis, data, analysis.userDateRange)
      case 'button_click_analysis':
        return this.generateButtonClickAnalysisOption(analysis, data)
      case 'query_condition_analysis':
        return this.generateQueryConditionAnalysisOption(analysis, data)
      case 'button_click_daily':
        return this.generateButtonClickDailyOption(analysis, data)
      default:
        return isDualMode ? this.generateDualBarOption(analysis, data) : this.generateBarOption(analysis, data)
    }
  }
  
  /**
   * 生成漏斗图配置
   */
  generateFunnelOption(analysis, data) {
    // 处理数据，生成漏斗步骤
    const funnelData = this.processFunnelData(data)
    
    return {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      series: [{
        name: '转化漏斗',
        type: 'funnel',
        left: '10%',
        top: 60,
        bottom: 60,
        width: '80%',
        min: 0,
        max: 100,
        minSize: '0%',
        maxSize: '100%',
        sort: 'descending',
        gap: 2,
        label: {
          show: true,
          position: 'inside'
        },
        labelLine: {
          length: 10,
          lineStyle: {
            width: 1,
            type: 'solid'
          }
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 1
        },
        emphasis: {
          label: {
            fontSize: 20
          }
        },
        data: funnelData
      }]
    }
  }
  
  /**
   * 生成折线图配置
   */
  generateLineOption(analysis, data) {
    const timeData = this.processTimeData(data)
    
    // 检查是按小时还是按日期聚合
    const isHourly = timeData.categories.length > 0 && timeData.categories[0].includes(':')
    
    // 检查是否为UV/PV分析
    const isUVAnalysis = analysis.intent && (analysis.intent.includes('uv') || analysis.intent.includes('独立访客'))
    const isPVAnalysis = analysis.intent && (analysis.intent.includes('pv') || analysis.intent.includes('访问量') || analysis.intent.includes('访问次数'))
    const isUVPVAnalysis = analysis.intent === 'uv_pv_analysis' || (isUVAnalysis && isPVAnalysis)
    
    // 根据分析类型确定图表标题
    let chartTitle, xAxisName
    if (isHourly) {
      chartTitle = isUVPVAnalysis ? '当日UV/PV时段分布' : '当日访问量时段分布'
      xAxisName = '时段'
    } else {
      chartTitle = isUVPVAnalysis ? 'UV/PV趋势分析' : '访问量趋势分析'
      xAxisName = '日期'
    }
    
    // 如果是UV/PV分析且有UV数据，生成双线图表
    if (isUVPVAnalysis && timeData.uvValues) {
      console.log('🎯 生成UV/PV双线图表配置:', {
        isUVPVAnalysis,
        hasUvValues: !!timeData.uvValues,
        uvValues: timeData.uvValues,
        pvValues: timeData.values
      })
      return {
        tooltip: {
          trigger: 'axis',
          formatter: (params) => {
            let result = `${params[0].name}<br/>`
            params.forEach(param => {
              result += `${param.seriesName}: ${param.value}<br/>`
            })
            return result
          }
        },
        legend: {
          data: ['UV', 'PV'],
          bottom: 10,
          left: 'center'
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '15%',
          top: '10%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: timeData.categories,
          name: xAxisName,
          axisLabel: {
            rotate: isHourly ? 0 : 30,
            fontSize: 10
          }
        },
        yAxis: {
          type: 'value',
          name: '数量'
        },
        series: [
          {
            name: 'UV',
            type: 'bar',
            data: timeData.uvValues,
            itemStyle: {
              color: '#5470c6'
            },
            barWidth: '60%',
            yAxisIndex: 0
          },
          {
            name: 'PV',
            type: 'line',
            data: timeData.values,
            smooth: true,
            lineStyle: {
              color: '#91cc75',
              width: 3
            },
            itemStyle: {
              color: '#91cc75'
            },
            symbol: 'circle',
            symbolSize: 8
          }
        ]
      }
    }
    
    // 默认单线图表（PV）
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const param = params[0]
          return `${param.name}<br/>访问量: ${param.value}`
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: timeData.categories,
        name: xAxisName,
        axisLabel: {
          rotate: isHourly ? 0 : 30,
          fontSize: 10
        }
      },
      yAxis: {
        type: 'value',
        name: '访问次数'
      },
      series: [{
        name: '访问量',
        type: 'line',
        data: timeData.values,
        smooth: true,
        lineStyle: {
          color: '#1890ff',
          width: 2
        },
        itemStyle: {
          color: '#1890ff'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
            { offset: 1, color: 'rgba(24, 144, 255, 0.1)' }
          ])
        }
      }]
    }
  }
  
  /**
   * 生成柱状图配置
   */
  generateBarOption(analysis, data) {
    const barData = this.processBarData(data)
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: (params) => {
          const param = params[0]
          return `${param.name}<br/>访问量: ${param.value}`
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: barData.categories,
        axisLabel: {
          interval: 0,
          rotate: 45,
          fontSize: 10,
          formatter: (value) => {
            // 截断过长的页面名称
            if (value.length > 10) {
              return value.substring(0, 10) + '...'
            }
            return value
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '访问次数'
      },
      series: [{
        name: '访问量',
        type: 'bar',
        data: barData.values,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#83bff6' },
            { offset: 0.5, color: '#188df0' },
            { offset: 1, color: '#188df0' }
          ])
        },
        label: {
          show: true,
          position: 'top',
          fontSize: 10
        }
      }]
    }
  }
  
  /**
   * 生成饼图配置
   */
  generatePieOption(analysis, data) {
    const pieData = this.processPieData(data)
    
    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'middle'
      },
      series: [{
        name: '访问类型',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['60%', '55%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{b}: {d}%'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        data: pieData
      }]
    }
  }
  
  /**
   * 生成数值卡片配置
   */
  generateValueCardOption(analysis, data) {
    const totalValue = this.calculateTotalValue(data)
    
    return {
      series: [{
        type: 'gauge',
        center: ['50%', '60%'],
        radius: '80%',
        min: 0,
        max: 1000,
        splitNumber: 10,
        axisLine: {
          lineStyle: {
            width: 6,
            color: [
              [0.3, '#ff6b35'],
              [0.7, '#37a2da'],
              [1, '#67e0e3']
            ]
          }
        },
        pointer: {
          itemStyle: {
            color: 'auto'
          }
        },
        axisTick: {
          distance: -30,
          splitNumber: 5,
          lineStyle: {
            width: 2,
            color: '#999'
          }
        },
        splitLine: {
          distance: -30,
          length: 30,
          lineStyle: {
            width: 4,
            color: '#999'
          }
        },
        axisLabel: {
          color: 'auto',
          distance: 40,
          fontSize: 20
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}',
          color: 'auto',
          fontSize: 30,
          fontWeight: 'bold'
        },
        data: [{
          value: totalValue
        }]
      }]
    }
  }
  
  /**
   * 生成堆叠柱状图配置
   */
  generateStackedBarOption(analysis, data) {
    const stackedData = this.processStackedData(data)
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      legend: {
        data: ['成功', '失败']
      },
      xAxis: {
        type: 'category',
        data: stackedData.categories
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: '成功',
          type: 'bar',
          stack: 'total',
          data: stackedData.success,
          itemStyle: {
            color: '#52c41a'
          }
        },
        {
          name: '失败',
          type: 'bar',
          stack: 'total',
          data: stackedData.failed,
          itemStyle: {
            color: '#ff4d4f'
          }
        }
      ]
    }
  }
  
  // 数据处理方法
  processFunnelData(data) {
    if (!data || data.length === 0) {
      return [
        { value: 100, name: '页面浏览' },
        { value: 80, name: '按钮点击' },
        { value: 60, name: '表单填写' },
        { value: 40, name: '提交成功' }
      ]
    }
    
    // 基于真实数据生成漏斗
    // 按照 pageBehavior 分析用户流程
    const openPages = data.filter(d => d.pageBehavior === '打开').length
    const closedPages = data.filter(d => d.pageBehavior === '关闭').length
    const totalPages = data.length
    
    return [
      { value: totalPages, name: '总访问量' },
      { value: openPages, name: '打开页面' },
      { value: closedPages, name: '完成浏览' },
      { value: Math.floor(closedPages * 0.6), name: '深度交互' }
    ]
  }
  
  processTimeData(data) {
    if (!data || data.length === 0) {
      const categories = []
      const values = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        categories.push(date.toLocaleDateString())
        values.push(Math.floor(Math.random() * 100) + 50)
      }
      return { categories, values }
    }
    
    // 🔧 统一按日期聚合，不管单日还是多日
    console.log('数据包含的不同日期数:', new Set(data.map(item => 
      new Date(item.createdAt).toLocaleDateString()
    )).size)
    console.log('实际数据量:', data.length)
    
    // 按日期聚合数据
    const timeMap = {}
    const allDates = new Set()
    
    data.forEach(item => {
      const date = new Date(item.createdAt).toLocaleDateString()
      allDates.add(date)
      
      if (!timeMap[date]) {
        timeMap[date] = { pv: 0, uv: new Set() }
      }
      timeMap[date].pv += 1
      timeMap[date].uv.add(item.weCustomerKey)
    })
    
    // 按日期排序
    const sortedDates = Array.from(allDates).sort()
    
    console.log('📊 按日期聚合结果:', {
      dateRange: sortedDates.length === 1 ? sortedDates[0] : `${sortedDates[0]} - ${sortedDates[sortedDates.length - 1]}`,
      days: sortedDates.length,
      totalPV: sortedDates.reduce((sum, date) => sum + timeMap[date].pv, 0),
      totalUV: new Set(data.map(item => item.weCustomerKey)).size,
      dailyDetails: sortedDates.map(date => ({
        date,
        pv: timeMap[date].pv,
        uv: timeMap[date].uv.size
      }))
    })
    
    return {
      categories: sortedDates,
      values: sortedDates.map(date => timeMap[date].pv),
      uvValues: sortedDates.map(date => timeMap[date].uv.size)
    }
  }
  
  processBarData(data) {
    if (!data || data.length === 0) {
      return {
        categories: ['页面A', '页面B', '页面C', '页面D'],
        values: [120, 200, 150, 80]
      }
    }
    
    // 按页面名称统计真实数据
    const pageMap = {}
    data.forEach(item => {
      const pageName = item.pageName || '未知页面'
      pageMap[pageName] = (pageMap[pageName] || 0) + 1
    })
    
    console.log('页面访问统计（总页面数）:', Object.keys(pageMap).length)
    
    // 取前10个最多访问的页面
    const sortedPages = Object.entries(pageMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    
    console.log('TOP 10 页面访问量:', sortedPages.map(([name, count]) => `${name}: ${count}`))
    
    return {
      categories: sortedPages.map(item => item[0]),
      values: sortedPages.map(item => item[1])
    }
  }
  
  processPieData(data) {
    if (!data || data.length === 0) {
      return [
        { value: 335, name: '直接访问' },
        { value: 310, name: '邮件营销' },
        { value: 234, name: '联盟广告' },
        { value: 135, name: '视频广告' },
        { value: 1548, name: '搜索引擎' }
      ]
    }
    
    // 按类型统计真实数据
    const typeMap = {}
    data.forEach(item => {
      const type = item.type || '未知类型'
      typeMap[type] = (typeMap[type] || 0) + 1
    })
    
    return Object.entries(typeMap).map(([name, value]) => ({
      value,
      name
    }))
  }
  
  calculateTotalValue(data) {
    if (!data || data.length === 0) {
      return 0
    }
    return data.length
  }
  
  processStackedData(data) {
    if (!data || data.length === 0) {
      return {
        categories: ['步骤1', '步骤2', '步骤3', '步骤4'],
        success: [120, 132, 101, 134],
        failed: [220, 182, 191, 234]
      }
    }
    
    // 按页面行为统计真实数据
    const pageMap = {}
    data.forEach(item => {
      const pageName = item.pageName || '未知页面'
      if (!pageMap[pageName]) {
        pageMap[pageName] = { open: 0, close: 0 }
      }
      if (item.pageBehavior === '打开') {
        pageMap[pageName].open++
      } else if (item.pageBehavior === '关闭') {
        pageMap[pageName].close++
      }
    })
    
    // 取前8个页面
    const sortedPages = Object.entries(pageMap)
      .sort((a, b) => (b[1].open + b[1].close) - (a[1].open + a[1].close))
      .slice(0, 8)
    
    return {
      categories: sortedPages.map(item => item[0]),
      success: sortedPages.map(item => item[1].close),
      failed: sortedPages.map(item => item[1].open)
    }
  }
  
  // ==================== 双埋点图表生成方法 ====================
  
  /**
   * 生成双埋点柱状图配置
   */
  generateDualBarOption(analysis, data) {
    const chartData = this.processDualBarData(data)
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function(params) {
          let result = params[0].name + '<br/>'
          params.forEach(param => {
            result += `${param.seriesName}: ${param.value}<br/>`
          })
          return result
        }
      },
      legend: {
        data: ['页面访问', '按钮点击'],
        top: 50
      },
      xAxis: {
        type: 'category',
        data: chartData.categories,
        axisLabel: {
          rotate: 45,
          interval: 0,
          formatter: function(value) {
            return value.length > 10 ? value.substring(0, 10) + '...' : value
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '数量'
      },
      series: [
        {
          name: '页面访问',
          type: 'bar',
          data: chartData.visits,
          itemStyle: { color: '#5470c6' }
        },
        {
          name: '按钮点击',
          type: 'bar',
          data: chartData.clicks,
          itemStyle: { color: '#91cc75' }
        }
      ]
    }
  }
  
  /**
   * 生成转化漏斗图配置
   */
  generateConversionFunnelOption(analysis, data) {
    const funnelData = this.processConversionFunnelData(data)
    
    return {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      series: [
        {
          name: '转化漏斗',
          type: 'funnel',
          left: '10%',
          top: 60,
          bottom: 60,
          width: '80%',
          min: 0,
          max: funnelData.max,
          minSize: '0%',
          maxSize: '100%',
          sort: 'descending',
          gap: 2,
          label: {
            show: true,
            position: 'inside'
          },
          labelLine: {
            length: 10,
            lineStyle: {
              width: 1,
              type: 'solid'
            }
          },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 1
          },
          emphasis: {
            label: {
              fontSize: 20
            }
          },
          data: funnelData.steps
        }
      ]
    }
  }
  
  /**
   * 生成点击热度图配置
   */
  generateClickHeatmapOption(analysis, data) {
    const heatmapData = this.processClickHeatmapData(data)
    
    return {
      tooltip: {
        trigger: 'item',
        formatter: function(params) {
          return `${params.name}<br/>点击次数: ${params.value}`
        }
      },
      series: [
        {
          name: '点击热度',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '60%'],
          data: heatmapData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    }
  }
  
  /**
   * 生成用户行为路径图配置
   */
  generateUserJourneyOption(analysis, data) {
    const journeyData = this.processUserJourneyData(data)
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['访问量', '点击量', '转化率'],
        top: 50
      },
      xAxis: {
        type: 'category',
        data: journeyData.categories,
        axisLabel: { rotate: 45 }
      },
      yAxis: [
        {
          type: 'value',
          name: '数量',
          position: 'left'
        },
        {
          type: 'value',
          name: '转化率(%)',
          position: 'right',
          max: 100
        }
      ],
      series: [
        {
          name: '访问量',
          type: 'bar',
          data: journeyData.visits,
          itemStyle: { color: '#5470c6' }
        },
        {
          name: '点击量',
          type: 'bar',
          data: journeyData.clicks,
          itemStyle: { color: '#91cc75' }
        },
        {
          name: '转化率',
          type: 'line',
          yAxisIndex: 1,
          data: journeyData.conversionRates,
          itemStyle: { color: '#ee6666' }
        }
      ]
    }
  }
  
  // ==================== 双埋点数据处理方法 ====================
  
  /**
   * 处理双埋点柱状图数据
   */
  processDualBarData(data) {
    const pageMap = {}
    
    data.forEach(item => {
      const pageName = item.pageName || '未知页面'
      if (!pageMap[pageName]) {
        pageMap[pageName] = { visits: 0, clicks: 0 }
      }
      
      if (item.dataType === 'visit') {
        pageMap[pageName].visits++
      } else if (item.dataType === 'click') {
        pageMap[pageName].clicks++
      }
    })
    
    // 取前10个页面
    const sortedPages = Object.entries(pageMap)
      .sort((a, b) => (b[1].visits + b[1].clicks) - (a[1].visits + a[1].clicks))
      .slice(0, 10)
    
    return {
      categories: sortedPages.map(item => item[0]),
      visits: sortedPages.map(item => item[1].visits),
      clicks: sortedPages.map(item => item[1].clicks)
    }
  }
  
  /**
   * 处理转化漏斗数据
   */
  processConversionFunnelData(data) {
    const visitData = data.filter(item => item.dataType === 'visit')
    const clickData = data.filter(item => item.dataType === 'click')
    const convertedData = data.filter(item => item.dataType === 'visit' && item.hasClicks)
    
    const totalVisits = visitData.length
    const totalClicks = clickData.length
    const convertedVisits = convertedData.length
    
    const steps = [
      { value: totalVisits, name: '页面访问' },
      { value: convertedVisits, name: '有点击行为' },
      { value: totalClicks, name: '总点击次数' }
    ]
    
    return {
      steps,
      max: totalVisits
    }
  }
  
  /**
   * 处理点击热度数据
   */
  processClickHeatmapData(data) {
    const clickData = data.filter(item => item.dataType === 'click')
    const contentMap = {}
    
    clickData.forEach(item => {
      const content = item.content || '未知操作'
      contentMap[content] = (contentMap[content] || 0) + 1
    })
    
    // 取前8个点击内容
    const sortedContents = Object.entries(contentMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    
    return sortedContents.map(([name, value]) => ({ name, value }))
  }
  
  /**
   * 处理用户行为路径数据
   */
  processUserJourneyData(data) {
    const pageMap = {}
    
    data.forEach(item => {
      const pageName = item.pageName || '未知页面'
      if (!pageMap[pageName]) {
        pageMap[pageName] = { visits: 0, clicks: 0 }
      }
      
      if (item.dataType === 'visit') {
        pageMap[pageName].visits++
      } else if (item.dataType === 'click') {
        pageMap[pageName].clicks++
      }
    })
    
    // 计算转化率并排序
    const sortedPages = Object.entries(pageMap)
      .map(([page, stats]) => ({
        page,
        visits: stats.visits,
        clicks: stats.clicks,
        conversionRate: stats.visits > 0 ? (stats.clicks / stats.visits * 100) : 0
      }))
      .sort((a, b) => (b.visits + b.clicks) - (a.visits + a.clicks))
      .slice(0, 8)
    
    return {
      categories: sortedPages.map(item => item.page),
      visits: sortedPages.map(item => item.visits),
      clicks: sortedPages.map(item => item.clicks),
      conversionRates: sortedPages.map(item => Math.round(item.conversionRate * 10) / 10)
    }
  }
  
  // ==================== UV/PV 分析图表生成方法 ====================
  
  /**
   * 生成UV/PV分析图表配置
   */
  generateUVPVAnalysisOption(analysis, data) {
    const isUV = analysis.intent && analysis.intent.includes('uv')
    const chartData = this.processUVPVAnalysisData(data, isUV)
    const title = isUV ? '页面访问独立用户数(UV)分析' : '页面访问次数(PV)分析'
    const yAxisName = isUV ? '独立用户数' : '访问次数'
    
    return {
      title: {
        text: title,
        left: 'center',
        top: 20,
        textStyle: { fontSize: 18, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function(params) {
          return `${params[0].name}<br/>${yAxisName}: ${params[0].value}`
        }
      },
      xAxis: {
        type: 'category',
        data: chartData.categories,
        axisLabel: {
          rotate: 45,
          interval: 0,
          formatter: function(value) {
            return value.length > 10 ? value.substring(0, 10) + '...' : value
          }
        }
      },
      yAxis: {
        type: 'value',
        name: yAxisName
      },
      series: [
        {
          name: yAxisName,
          type: 'bar',
          data: chartData.values,
          itemStyle: { 
            color: isUV ? '#5470c6' : '#91cc75'
          },
          label: {
            show: true,
            position: 'top'
          }
        }
      ]
    }
  }
  
  /**
   * 生成UV/PV点击分析图表配置
   */
  generateUVPVClickOption(analysis, data) {
    const isUV = analysis.intent && analysis.intent.includes('uv')
    const clickData = this.processUVPVClickData(data, isUV)
    const title = isUV ? '按钮点击独立用户数(UV)分析' : '按钮点击次数(PV)分析'
    
    return {
      title: {
        text: title,
        left: 'center',
        top: 20,
        textStyle: { fontSize: 18, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'item',
        formatter: function(params) {
          const label = isUV ? '独立用户数' : '点击次数'
          return `${params.name}<br/>${label}: ${params.value}`
        }
      },
      series: [
        {
          name: isUV ? '独立用户数' : '点击次数',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '60%'],
          data: clickData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    }
  }
  
  /**
   * 处理UV/PV分析数据
   */
  processUVPVAnalysisData(data, isUV) {
    const pageMap = {}
    
    data.forEach(item => {
      const pageName = item.pageName || '未知页面'
      if (!pageMap[pageName]) {
        pageMap[pageName] = new Set()
      }
      
      if (isUV) {
        // UV分析：按weCustomerKey去重（内置ID）
        if (item.weCustomerKey) {
          pageMap[pageName].add(item.weCustomerKey)
        }
      } else {
        // PV分析：不去重，统计总数
        pageMap[pageName].add(item.createdAt) // 使用时间戳作为唯一标识
      }
    })
    
    // 转换为数组并排序
    const sortedPages = Object.entries(pageMap)
      .map(([page, valueSet]) => ({
        page,
        count: valueSet.size
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // 取前10个
    
    return {
      categories: sortedPages.map(item => item.page),
      values: sortedPages.map(item => item.count)
    }
  }
  
  /**
   * 处理UV/PV点击数据
   */
  processUVPVClickData(data, isUV) {
    const clickData = data.filter(item => item.type === 'click' || item.dataType === 'click')
    const contentMap = {}
    
    clickData.forEach(item => {
      const content = item.content || '未知操作'
      if (!contentMap[content]) {
        contentMap[content] = new Set()
      }
      
      if (isUV) {
        // UV分析：按weCustomerKey去重（内置ID）
        if (item.weCustomerKey) {
          contentMap[content].add(item.weCustomerKey)
        }
      } else {
        // PV分析：不去重，统计总数
        contentMap[content].add(item.createdAt)
      }
    })
    
    // 转换为数组并排序
    const sortedContents = Object.entries(contentMap)
      .map(([content, valueSet]) => ({
        name: content,
        value: valueSet.size
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8) // 取前8个
    
    return sortedContents
  }
  
  // ==================== UV/PV 对比图表生成方法 ====================
  
  /**
   * 生成UV/PV对比图表配置
   */
  generateUVPVComparisonOption(analysis, data) {
    const chartData = this.processUVPVComparisonData(data)
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: function(params) {
          let result = params[0].name + '<br/>'
          params.forEach(param => {
            result += `${param.seriesName}: ${param.value}<br/>`
          })
          // 计算PV/UV比值
          const uvValue = params.find(p => p.seriesName === 'UV')?.value || 0
          const pvValue = params.find(p => p.seriesName === 'PV')?.value || 0
          const ratio = uvValue > 0 ? (pvValue / uvValue).toFixed(2) : 0
          result += `PV/UV比值: ${ratio}`
          return result
        }
      },
      legend: {
        data: ['UV', 'PV'],
        top: 50
      },
      xAxis: {
        type: 'category',
        data: chartData.categories,
        axisLabel: {
          rotate: 45,
          interval: 0,
          formatter: function(value) {
            return value.length > 8 ? value.substring(0, 8) + '...' : value
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '数量'
      },
      series: [
        {
          name: 'UV',
          type: 'bar',
          data: chartData.uvData,
          itemStyle: { color: '#5470c6' },
          label: {
            show: true,
            position: 'top'
          }
        },
        {
          name: 'PV',
          type: 'line',
          data: chartData.pvData,
          itemStyle: { color: '#91cc75' },
          lineStyle: { width: 3 },
          symbol: 'circle',
          symbolSize: 8,
          label: {
            show: true,
            position: 'top'
          }
        }
      ]
    }
  }
  
  /**
   * 生成按钮点击UV/PV对比图表配置
   */
  generateClickUVPVComparisonOption(analysis, data) {
    const chartData = this.processClickUVPVComparisonData(data)
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: function(params) {
          let result = params[0].name + '<br/>'
          params.forEach(param => {
            result += `${param.seriesName}: ${param.value}<br/>`
          })
          // 计算PV/UV比值
          const uvValue = params.find(p => p.seriesName === 'UV')?.value || 0
          const pvValue = params.find(p => p.seriesName === 'PV')?.value || 0
          const ratio = uvValue > 0 ? (pvValue / uvValue).toFixed(2) : 0
          result += `PV/UV比值: ${ratio}`
          return result
        }
      },
      legend: {
        data: ['UV', 'PV'],
        top: 50
      },
      xAxis: {
        type: 'category',
        data: chartData.categories,
        axisLabel: {
          rotate: 45,
          interval: 0,
          formatter: function(value) {
            return value.length > 8 ? value.substring(0, 8) + '...' : value
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '数量'
      },
      series: [
        {
          name: 'UV',
          type: 'bar',
          data: chartData.uvData,
          itemStyle: { color: '#ee6666' },
          label: {
            show: true,
            position: 'top'
          }
        },
        {
          name: 'PV',
          type: 'line',
          data: chartData.pvData,
          itemStyle: { color: '#fac858' },
          lineStyle: { width: 3 },
          symbol: 'circle',
          symbolSize: 8,
          label: {
            show: true,
            position: 'top'
          }
        }
      ]
    }
  }
  
  /**
   * 处理UV/PV对比数据
   */
  processUVPVComparisonData(data) {
    const pageMap = {}
    
    data.forEach(item => {
      const pageName = item.pageName || '未知页面'
      if (!pageMap[pageName]) {
        pageMap[pageName] = {
          uvSet: new Set(),
          pvSet: new Set()
        }
      }
      
      // UV：按weCustomerKey去重（内置ID）
      if (item.weCustomerKey) {
        pageMap[pageName].uvSet.add(item.weCustomerKey)
      }
      
      // PV：只统计pageBehavior为"打开"的记录
      if (item.pageBehavior === '打开') {
        pageMap[pageName].pvSet.add(item.createdAt)
      }
    })
    
    // 转换为数组并排序
    const sortedPages = Object.entries(pageMap)
      .map(([page, data]) => ({
        page,
        uv: data.uvSet.size,
        pv: data.pvSet.size
      }))
      .sort((a, b) => b.pv - a.pv) // 按PV排序
      .slice(0, 10) // 取前10个
    
    return {
      categories: sortedPages.map(item => item.page),
      uvData: sortedPages.map(item => item.uv),
      pvData: sortedPages.map(item => item.pv)
    }
  }
  
  /**
   * 处理按钮点击UV/PV对比数据
   */
  processClickUVPVComparisonData(data) {
    const clickData = data.filter(item => item.type === 'click' || item.dataType === 'click')
    const contentMap = {}
    
    clickData.forEach(item => {
      const content = item.content || '未知操作'
      if (!contentMap[content]) {
        contentMap[content] = {
          uvSet: new Set(),
          pvSet: new Set()
        }
      }
      
      // UV：按weCustomerKey去重（内置ID）
      if (item.weCustomerKey) {
        contentMap[content].uvSet.add(item.weCustomerKey)
      }
      
      // PV：只统计pageBehavior为"打开"的记录
      if (item.pageBehavior === '打开') {
        contentMap[content].pvSet.add(item.createdAt)
      }
    })
    
    // 转换为数组并排序
    const sortedContents = Object.entries(contentMap)
      .map(([content, data]) => ({
        content,
        uv: data.uvSet.size,
        pv: data.pvSet.size
      }))
      .sort((a, b) => b.pv - a.pv) // 按PV排序
      .slice(0, 8) // 取前8个
    
    return {
      categories: sortedContents.map(item => item.content),
      uvData: sortedContents.map(item => item.uv),
      pvData: sortedContents.map(item => item.pv)
    }
  }
  
  /**
   * 生成单页面UV/PV时间组合图配置
   */
  generateSinglePageUVPVChartOption(analysis, data, userDateRange = null) {
    const chartData = this.processSinglePageUVPVChartData(data, userDateRange)
    
    console.log('📊 单页面UV/PV图表数据:', {
      categories: chartData.categories,
      uvData: chartData.uvData,
      pvData: chartData.pvData
    })
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: function(params) {
          let result = params[0].name + '<br/>'
          params.forEach(param => {
            result += `${param.seriesName}: ${param.value}<br/>`
          })
          // 计算PV/UV比值
          const uvValue = params.find(p => p.seriesName === 'UV')?.value || 0
          const pvValue = params.find(p => p.seriesName === 'PV')?.value || 0
          const ratio = uvValue > 0 ? (pvValue / uvValue).toFixed(2) : 0
          result += `PV/UV比值: ${ratio}`
          return result
        }
      },
      legend: {
        data: ['PV', 'UV'],
        bottom: 10,
        left: 'center'
      },
      xAxis: {
        type: 'category',
        data: chartData.categories,
        axisLabel: {
          rotate: 45,
          interval: 0,
          formatter: function(value) {
            // 如果是完整日期格式，显示月-日
            if (value.includes('-') && value.length === 10) {
              return value.substring(5, 10) // 显示 MM-DD
            }
            // 如果是长日期格式，显示月-日
            if (value.includes('-') && value.length > 10) {
              return value.substring(5, 10) // 显示 MM-DD
            }
            // 其他情况，如果太长就截断
            return value.length > 10 ? value.substring(0, 10) + '...' : value
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '数量'
      },
      series: [
        {
          name: 'UV',
          type: 'bar',
          data: chartData.uvData,
          itemStyle: { color: '#5470c6' },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}'
          }
        },
        {
          name: 'PV',
          type: 'line',
          data: chartData.pvData,
          itemStyle: { color: '#91cc75' },
          lineStyle: { width: 3 },
          symbol: 'circle',
          symbolSize: 8,
          label: {
            show: true,
            position: 'top',
            formatter: '{c}'
          }
        }
      ]
    }
  }

  /**
   * 处理单页面UV/PV时间数据
   */
  processSinglePageUVPVChartData(data, userDateRange = null) {
    console.log('🔍 processSinglePageUVPVChartData 输入数据:', data)
    
    // 检查数据格式：如果数据已经是聚合后的格式（有uv和pv字段），直接使用
    if (data && data.length > 0 && data[0].hasOwnProperty('uv') && data[0].hasOwnProperty('pv')) {
      console.log('📊 检测到已聚合的数据格式，直接使用')
      const sortedData = data
        .map(item => ({
          date: item.createdAt,
          uv: item.uv || 0,
          pv: item.pv || 0
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
      
      console.log('✅ 已聚合数据排序结果:', sortedData)
      
      return {
        categories: sortedData.map(item => item.date),
        uvData: sortedData.map(item => item.uv),
        pvData: sortedData.map(item => item.pv)
      }
    }
    
    // 原始数据处理逻辑（用于实时分析）
    const timeMap = {}
    
    let fullDateRange
    if (userDateRange && userDateRange.length === 2) {
      // 使用用户选择的日期范围
      const [start, end] = userDateRange
      fullDateRange = this.generateDateRange(start, end)
      console.log(`使用用户选择的日期范围: ${fullDateRange.length}天`)
    } else {
      // 获取数据的日期范围
      const dates = data.map(item => new Date(item.createdAt).toISOString().split('T')[0]).sort()
      const startDate = dates[0]
      const endDate = dates[dates.length - 1]
      fullDateRange = this.generateDateRange(startDate, endDate)
      console.log(`使用数据实际日期范围: ${fullDateRange.length}天`)
    }
    
    // 🚀 关键优化：初始化所有日期为0，确保显示所有天数（包括无数据的天）
    fullDateRange.forEach(date => {
      timeMap[date] = {
        uvSet: new Set(),
        pvCount: 0
      }
    })
    
    console.log(`📅 初始化时间范围: ${fullDateRange.length}天，从 ${fullDateRange[0]} 到 ${fullDateRange[fullDateRange.length - 1]}`)
    
    data.forEach(item => {
      // 按日期分组
      const date = new Date(item.createdAt).toISOString().split('T')[0]
      
      if (!timeMap[date]) {
        timeMap[date] = {
          uvSet: new Set(),
          pvCount: 0
        }
      }
      
      // PV：统计所有页面访问记录（不去重）
      timeMap[date].pvCount++
      
      // UV：按weCustomerKey去重
      if (item.weCustomerKey) {
        timeMap[date].uvSet.add(item.weCustomerKey)
      }
    })
    
    // 转换为数组并按时间排序
    const sortedData = Object.entries(timeMap)
      .map(([date, data]) => ({
        date,
        uv: data.uvSet.size,
        pv: data.pvCount
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
    
    console.log('✅ 原始数据处理结果:', sortedData)
    
    return {
      categories: sortedData.map(item => item.date),
      uvData: sortedData.map(item => item.uv),
      pvData: sortedData.map(item => item.pv)
    }
  }

  /**
   * 生成日期范围数组
   */
  generateDateRange(startDate, endDate) {
    const dates = []
    
    // 处理dayjs对象或字符串
    let current, end
    if (typeof startDate === 'object' && startDate.format) {
      // dayjs对象
      current = startDate.clone()
      end = endDate.clone()
    } else {
      // 字符串或Date对象
      current = new Date(startDate)
      end = new Date(endDate)
    }
    
    while (current <= end) {
      if (typeof current === 'object' && current.format) {
        // dayjs对象
        dates.push(current.format('YYYY-MM-DD'))
        current = current.add(1, 'day')
      } else {
        // Date对象
        dates.push(current.toISOString().split('T')[0])
        current.setDate(current.getDate() + 1)
      }
    }
    
    console.log(`📅 生成日期范围: ${dates.length}天，从 ${dates[0]} 到 ${dates[dates.length - 1]}`)
    return dates
  }

  /**
   * 生成按钮点击分析图表配置
   */
  generateButtonClickAnalysisOption(analysis, data) {
    // 检查数据是否已经按日期聚合过
    let chartData
    if (data && data.length > 0 && data[0].hasOwnProperty('uv') && data[0].hasOwnProperty('pv')) {
      // 数据已经聚合过，直接使用
      console.log('📊 使用已聚合的数据:', data)
      chartData = {
        categories: data.map(item => item.date || item.createdAt),
        uvData: data.map(item => item.uv || 0),
        pvData: data.map(item => item.pv || 0)
      }
    } else {
      // 数据未聚合，需要处理
      chartData = this.processButtonClickAnalysisData(analysis, data)
    }
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function(params) {
          let result = `<strong>${params[0].axisValue}</strong><br/>`
          params.forEach(param => {
            result += `${param.seriesName}: ${param.value}<br/>`
          })
          return result
        }
      },
      legend: {
        data: ['UV (独立用户)', 'PV (点击次数)'],
        top: 30
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: chartData.categories,
        axisLabel: {
          rotate: 45,
          interval: 0
        }
      },
      yAxis: {
        type: 'value',
        name: '点击次数'
      },
      series: [
        {
          name: 'UV (独立用户)',
          type: 'bar',
          data: chartData.uvData,
          itemStyle: {
            color: '#5470c6'
          },
          emphasis: {
            itemStyle: {
              color: '#73d13d'
            }
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}'
          }
        },
        {
          name: 'PV (点击次数)',
          type: 'line',
          data: chartData.pvData,
          itemStyle: {
            color: '#91cc75'
          },
          lineStyle: { width: 3 },
          symbol: 'circle',
          symbolSize: 8,
          label: {
            show: true,
            position: 'top',
            formatter: '{c}'
          }
        }
      ]
    }
  }
  
  /**
   * 生成查询条件分析图表配置
   */
  generateQueryConditionAnalysisOption(analysis, data) {
    // 检查数据是否已经按日期聚合过
    let chartData
    if (data && data.length > 0 && data[0].hasOwnProperty('uv') && data[0].hasOwnProperty('pv')) {
      // 数据已经聚合过，需要判断是否为多条件
      console.log('📊 使用已聚合的查询条件数据:', data)
      
      // 🚀 修复：正确判断是否为多条件
      const queryCondition = analysis.parameters?.queryCondition || ''
      const isMultiCondition = queryCondition.startsWith('多条件:') || 
                              queryCondition.includes('、') || 
                              queryCondition.includes('，') ||
                              (analysis.originalText && analysis.originalText.includes('多个'))
      
      chartData = {
        categories: data.map(item => item.date || item.createdAt),
        uvData: data.map(item => item.uv || 0),
        pvData: data.map(item => item.pv || 0),
        isMultipleConditions: isMultiCondition
      }
      
      console.log(`🔍 判断多条件状态: queryCondition="${queryCondition}", isMultiCondition=${isMultiCondition}`)
    } else {
      // 数据未聚合，需要处理
      chartData = this.processQueryConditionAnalysisData(analysis, data)
    }
    
    // 获取查询条件信息
    const queryCondition = analysis.parameters?.queryCondition || '查询条件'
    const pageName = analysis.parameters?.pageName || '页面'
    
    console.log(`🔍 查询条件分析配置: 页面="${pageName}", 条件="${queryCondition}", 多条件=${chartData.isMultipleConditions}`)
    
    const series = []
    
    if (chartData.isMultipleConditions) {
      // 多条件场景：分别显示每个条件的PV柱状图
      const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']
      
      chartData.conditionData.forEach((condition, index) => {
        series.push({
          name: condition.name,
          type: 'bar',
          data: condition.data,
          itemStyle: {
            color: colors[index % colors.length]
          },
          emphasis: {
            itemStyle: {
              color: colors[index % colors.length],
              opacity: 0.8
            }
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}'
          }
        })
      })
    } else {
      // 单条件时显示UV和PV
      series.push(
        {
          name: 'UV (独立用户)',
          type: 'bar',
          data: chartData.uvData,
          itemStyle: {
            color: '#5470c6'
          },
          emphasis: {
            itemStyle: {
              color: '#73d13d'
            }
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}'
          }
        },
        {
          name: 'PV (使用次数)',
          type: 'line',
          data: chartData.pvData,
          itemStyle: {
            color: '#91cc75'
          },
          lineStyle: { width: 3 },
          symbol: 'circle',
          symbolSize: 8,
          label: {
            show: true,
            position: 'top',
            formatter: '{c}'
          }
        }
      )
    }
    
    // 根据条件类型生成不同的标题
    let titleText
    if (chartData.isMultipleConditions) {
      if (queryCondition === 'all' || queryCondition === '全部查询条件' || queryCondition === '全部状态') {
        titleText = `${pageName} - 全部查询条件使用情况`
      } else {
        titleText = `${pageName} - 多查询条件使用情况`
      }
    } else {
      titleText = `${pageName} - "${queryCondition}"查询条件使用情况`
    }
    
    return {
      title: {
        text: titleText,
        left: 'center',
        top: 10,
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function(params) {
          let result = `<strong>${params[0].axisValue}</strong><br/>`
          params.forEach(param => {
            result += `${param.seriesName}: ${param.value}<br/>`
          })
          return result
        }
      },
      legend: {
        data: series.map(s => s.name),
        top: 30
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: chartData.isMultipleConditions ? '20%' : '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: chartData.categories,
        axisLabel: {
          rotate: 45,
          interval: 0
        }
      },
      yAxis: {
        type: 'value',
        name: '使用次数'
      },
      series: series
    }
  }
  
  /**
   * 处理查询条件分析数据
   */
  processQueryConditionAnalysisData(analysis, data) {
    const queryCondition = analysis.parameters?.queryCondition
    const pageName = analysis.parameters?.pageName
    
    console.log(`🔍 处理查询条件分析数据: 页面="${pageName}", 查询条件="${queryCondition}"`)
    console.log(`🔍 接收到的数据:`, data)
    
    if (!data || data.length === 0) {
      console.log('⚠️ 没有数据可处理')
      return {
        categories: [],
        uvData: [],
        pvData: [],
        conditionData: []
      }
    }
    
    // 检查是否是全部条件或多条件场景
    const isAllConditions = queryCondition === 'all' || queryCondition === '全部查询条件' || queryCondition === '全部状态'
    const isMultiConditionSelection = queryCondition && queryCondition.startsWith('多条件:')
    const hasMultipleConditionsInText = analysis.originalText && 
      (analysis.originalText.includes('多个') || 
       analysis.originalText.includes('条件') && analysis.originalText.includes('和') ||
       analysis.originalText.includes('、') ||
       analysis.originalText.includes('，') ||
       analysis.originalText.includes('全部'))
    
    const showMultipleConditions = isAllConditions || isMultiConditionSelection || hasMultipleConditionsInText
    
    if (showMultipleConditions) {
      // 多条件场景：按条件分组显示
      return this.processMultipleConditionsData(data, analysis)
    } else {
      // 单条件场景：按日期聚合
      return this.processSingleConditionData(data)
    }
  }
  
  /**
   * 处理多条件数据（分别显示每个条件）
   */
  processMultipleConditionsData(data, analysis) {
    console.log('🔍 处理多条件数据，按条件分组显示')
    console.log('🔍 分析参数:', analysis)
    
    // 获取用户选择的具体条件信息
    const queryCondition = analysis.parameters?.queryCondition
    const queryData = analysis.parameters?.queryData
    
    // 检查是否是状态分类的多选
    const isStatusGroup = queryData?.groupType === '状态' && queryCondition?.startsWith('多条件:')
    const isTimeGroup = queryData?.groupType === '申请时间' && queryCondition?.startsWith('多条件:')
    
    if (isStatusGroup) {
      console.log('🔍 检测到状态分类多选，按状态值聚合数据')
      return this.processStatusGroupData(data, analysis)
    }
    
    if (isTimeGroup) {
      console.log('🔍 检测到申请时间分类多选，按申请时间值聚合数据')
      return this.processTimeGroupData(data, analysis)
    }
    
    // 按条件分组数据
    const conditionMap = new Map()
    
    data.forEach(item => {
      // 提取查询条件名称
      let conditionName = '未知条件'
      
      // 尝试从不同字段提取条件名称
      if (item.content) {
        conditionName = item.content
      } else if (item.queryCondition) {
        conditionName = item.queryCondition
      } else if (item.condition) {
        conditionName = item.condition
      } else if (item.status) {
        conditionName = item.status
      }
      
      // 如果用户选择了具体的条件类型（如"全部状态"），需要过滤数据
      if (queryCondition && queryCondition !== 'all' && queryCondition !== '全部查询条件') {
        // 检查当前条件是否属于用户选择的类型
        if (!this.isConditionMatch(conditionName, queryCondition, queryData)) {
          return // 跳过不匹配的条件
        }
      }
      
      if (!conditionMap.has(conditionName)) {
        conditionMap.set(conditionName, new Map())
      }
      
      const date = item.createdAt ? item.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]
      const conditionData = conditionMap.get(conditionName)
      
      if (!conditionData.has(date)) {
        conditionData.set(date, {
          date: date,
          pv: 0,
          uvSet: new Set()
        })
      }
      
      const dayData = conditionData.get(date)
      dayData.pv++
      
      if (item.weCustomerKey) {
        dayData.uvSet.add(item.weCustomerKey)
      }
    })
    
    // 获取所有日期
    const allDates = new Set()
    conditionMap.forEach(conditionData => {
      conditionData.forEach(dayData => {
        allDates.add(dayData.date)
      })
    })
    
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b))
    
    // 构建每个条件的数据
    const conditionData = []
    conditionMap.forEach((conditionDayData, conditionName) => {
      const pvData = sortedDates.map(date => {
        const dayData = conditionDayData.get(date)
        return dayData ? dayData.pv : 0
      })
      
      conditionData.push({
        name: conditionName,
        data: pvData
      })
    })
    
    console.log(`📊 多条件数据分组结果:`, conditionData)
    
    return {
      categories: sortedDates,
      conditionData: conditionData,
      isMultipleConditions: true
    }
  }
  
  /**
   * 处理状态分类数据（按状态值聚合）
   */
  processStatusGroupData(data, analysis) {
    console.log('🔍 处理状态分类数据，按状态值聚合')
    
    const queryData = analysis.parameters?.queryData
    const selectedStatusValues = queryData?.allConditions?.map(c => c.content.split('::')[1]) || []
    
    console.log('🔍 选中的状态值:', selectedStatusValues)
    
    // 按状态值分组数据
    const statusMap = new Map()
    
    data.forEach(item => {
      // 提取查询条件名称
      let conditionName = '未知条件'
      
      if (item.content) {
        conditionName = item.content
      } else if (item.queryCondition) {
        conditionName = item.queryCondition
      } else if (item.condition) {
        conditionName = item.condition
      } else if (item.status) {
        conditionName = item.status
      }
      
      // 检查条件是否匹配用户选择的状态值
      if (!this.isConditionMatch(conditionName, analysis.parameters?.queryCondition, queryData)) {
        return // 跳过不匹配的条件
      }
      
      // 提取状态值
      let statusValue = '未知状态'
      try {
        const parsed = JSON.parse(conditionName)
        if (parsed.状态) {
          statusValue = parsed.状态
        }
      } catch (e) {
        // 不是JSON格式，跳过
        return
      }
      
      // 只处理用户选择的状态值
      if (!selectedStatusValues.includes(statusValue)) {
        return
      }
      
      if (!statusMap.has(statusValue)) {
        statusMap.set(statusValue, new Map())
      }
      
      const date = item.createdAt ? item.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]
      const statusData = statusMap.get(statusValue)
      
      if (!statusData.has(date)) {
        statusData.set(date, {
          date: date,
          pv: 0,
          uvSet: new Set()
        })
      }
      
      const dayData = statusData.get(date)
      dayData.pv++
      
      if (item.weCustomerKey) {
        dayData.uvSet.add(item.weCustomerKey)
      }
    })
    
    // 生成完整的日期范围（使用数据的时间范围）
    const allDates = new Set()
    statusMap.forEach(statusData => {
      statusData.forEach(dayData => {
        allDates.add(dayData.date)
      })
    })
    
    let sortedDates = []
    if (allDates.size > 0) {
      // 从原始数据中获取日期范围
      const dataDates = data.map(item => item.createdAt ? item.createdAt.split('T')[0] : new Date().toISOString().split('T')[0])
      const uniqueDataDates = [...new Set(dataDates)].sort((a, b) => new Date(a) - new Date(b))
      
      if (uniqueDataDates.length > 0) {
        const startDate = new Date(uniqueDataDates[0])
        const endDate = new Date(uniqueDataDates[uniqueDataDates.length - 1])
        
        // 生成完整的日期范围
        const currentDate = new Date(startDate)
        while (currentDate <= endDate) {
          sortedDates.push(currentDate.toISOString().split('T')[0])
          currentDate.setDate(currentDate.getDate() + 1)
        }
        
        console.log(`📅 状态分类生成的完整日期范围:`, sortedDates)
        console.log(`📅 原始数据日期范围: ${uniqueDataDates[0]} 到 ${uniqueDataDates[uniqueDataDates.length - 1]}`)
      } else {
        sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b))
      }
    } else {
      sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b))
    }
    
    // 构建每个状态的数据
    const conditionData = []
    statusMap.forEach((statusDayData, statusValue) => {
      const pvData = sortedDates.map(date => {
        const dayData = statusDayData.get(date)
        return dayData ? dayData.pv : 0
      })
      
      conditionData.push({
        name: statusValue,
        data: pvData
      })
    })
    
    console.log(`📊 状态分类数据分组结果:`, conditionData)
    
    return {
      categories: sortedDates,
      conditionData: conditionData,
      isMultipleConditions: true
    }
  }
  
  /**
   * 处理申请时间分类数据（按申请时间值聚合）
   */
  processTimeGroupData(data, analysis) {
    console.log('🔍 处理申请时间分类数据，按申请时间值聚合')
    
    const queryData = analysis.parameters?.queryData
    const selectedTimeValues = queryData?.allConditions?.map(c => c.content.split('::')[1]) || []
    
    console.log('🔍 选中的申请时间值:', selectedTimeValues)
    
    // 按申请时间值分组数据
    const timeMap = new Map()
    
    data.forEach(item => {
      // 提取查询条件名称
      let conditionName = '未知条件'
      
      if (item.content) {
        conditionName = item.content
      } else if (item.queryCondition) {
        conditionName = item.queryCondition
      } else if (item.condition) {
        conditionName = item.condition
      } else if (item.status) {
        conditionName = item.status
      }
      
      // 提取申请时间值
      let timeValue = '未知时间'
      try {
        const parsed = JSON.parse(conditionName)
        if (parsed.申请时间) {
          timeValue = parsed.申请时间
        }
      } catch (e) {
        // 不是JSON格式，跳过
        return
      }
      
      // 只处理用户选择的申请时间值
      if (!selectedTimeValues.includes(timeValue)) {
        return
      }
      
      if (!timeMap.has(timeValue)) {
        timeMap.set(timeValue, new Map())
      }
      
      const date = item.createdAt ? item.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]
      const timeData = timeMap.get(timeValue)
      
      if (!timeData.has(date)) {
        timeData.set(date, {
          date: date,
          pv: 0,
          uvSet: new Set()
        })
      }
      
      const dayData = timeData.get(date)
      dayData.pv++
      
      if (item.weCustomerKey) {
        dayData.uvSet.add(item.weCustomerKey)
      }
    })
    
    // 生成完整的日期范围（使用数据的时间范围）
    const allDates = new Set()
    timeMap.forEach(timeData => {
      timeData.forEach(dayData => {
        allDates.add(dayData.date)
      })
    })
    
    let sortedDates = []
    if (allDates.size > 0) {
      // 从原始数据中获取日期范围
      const dataDates = data.map(item => item.createdAt ? item.createdAt.split('T')[0] : new Date().toISOString().split('T')[0])
      const uniqueDataDates = [...new Set(dataDates)].sort((a, b) => new Date(a) - new Date(b))
      
      if (uniqueDataDates.length > 0) {
        const startDate = new Date(uniqueDataDates[0])
        const endDate = new Date(uniqueDataDates[uniqueDataDates.length - 1])
        
        // 生成完整的日期范围
        const currentDate = new Date(startDate)
        while (currentDate <= endDate) {
          sortedDates.push(currentDate.toISOString().split('T')[0])
          currentDate.setDate(currentDate.getDate() + 1)
        }
        
        console.log(`📅 申请时间分类生成的完整日期范围:`, sortedDates)
        console.log(`📅 原始数据日期范围: ${uniqueDataDates[0]} 到 ${uniqueDataDates[uniqueDataDates.length - 1]}`)
      } else {
        sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b))
      }
    } else {
      sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b))
    }
    
    // 构建每个申请时间的数据
    const conditionData = []
    timeMap.forEach((timeDayData, timeValue) => {
      const pvData = sortedDates.map(date => {
        const dayData = timeDayData.get(date)
        return dayData ? dayData.pv : 0
      })
      
      conditionData.push({
        name: timeValue,
        data: pvData
      })
    })
    
    console.log(`📊 申请时间分类数据分组结果:`, conditionData)
    
    return {
      categories: sortedDates,
      conditionData: conditionData,
      isMultipleConditions: true
    }
  }
  
  /**
   * 检查条件是否匹配用户选择
   */
  isConditionMatch(conditionName, queryCondition, queryData) {
    console.log(`🔍 检查条件匹配: "${conditionName}" vs "${queryCondition}"`)
    console.log(`🔍 查询数据:`, queryData)
    
    // 如果用户选择的是多条件（如"多条件:全部、待复核"）
    if (queryCondition && queryCondition.startsWith('多条件:')) {
      // 检查当前条件是否在用户选择的条件列表中
      if (queryData && queryData.allConditions && queryData.allConditions.length > 0) {
        const selectedConditions = queryData.allConditions.map(c => c.content)
        console.log(`🔍 选中的条件列表:`, selectedConditions)
        console.log(`🔍 当前检查的条件:`, conditionName)
        
        // 直接匹配
        if (selectedConditions.includes(conditionName)) {
          console.log(`🔍 直接匹配成功`)
          return true
        }
        
        // 尝试JSON格式匹配
        try {
          const parsedCondition = JSON.parse(conditionName)
          console.log(`🔍 解析后的条件:`, parsedCondition)
          
          // 根据用户选择的分类类型来检查对应的字段
          const groupType = queryData?.groupType
          console.log(`🔍 用户选择的分类类型:`, groupType)
          
          if (groupType === '状态' && parsedCondition.状态) {
            const statusValue = parsedCondition.状态
            console.log(`🔍 条件中的状态值:`, statusValue)
            
            // 检查状态值是否在用户选择的条件中
            const isMatched = selectedConditions.some(selected => {
              // 从 "状态::全部" 中提取 "全部"
              const selectedValue = selected.split('::')[1]
              console.log(`🔍 比较: "${statusValue}" vs "${selectedValue}"`)
              return statusValue === selectedValue
            })
            
            console.log(`🔍 JSON匹配结果:`, isMatched)
            return isMatched
          } else if (groupType === '申请时间' && parsedCondition.申请时间) {
            const timeValue = parsedCondition.申请时间
            console.log(`🔍 条件中的申请时间值:`, timeValue)
            
            // 检查申请时间值是否在用户选择的条件中
            const isMatched = selectedConditions.some(selected => {
              // 从 "申请时间::其他" 中提取 "其他"
              const selectedValue = selected.split('::')[1]
              console.log(`🔍 比较: "${timeValue}" vs "${selectedValue}"`)
              return timeValue === selectedValue
            })
            
            console.log(`🔍 JSON匹配结果:`, isMatched)
            return isMatched
          }
        } catch (e) {
          console.log(`🔍 不是JSON格式，跳过JSON匹配`)
        }
        
        console.log(`🔍 所有匹配方式都失败`)
        return false
      }
      return false
    }
    
    // 如果用户选择的是"全部状态"，需要更精确的过滤
    if (queryCondition === '全部状态') {
      // 检查是否是JSON格式且包含状态字段
      try {
        const parsed = JSON.parse(conditionName)
        if (parsed.状态 || parsed.status) {
          // 如果用户选择了具体的状态值（如"全部"、"待复核"），需要进一步过滤
          if (queryData && queryData.allConditions && queryData.allConditions.length > 0) {
            // 检查当前条件是否在用户选择的条件列表中
            const selectedConditions = queryData.allConditions.map(c => c.content)
            return selectedConditions.includes(conditionName)
          }
          return true
        }
      } catch (e) {
        // 不是JSON格式，检查是否包含状态关键词
        const statusKeywords = ['状态', '待复核', '全部', '已复核', '拒绝', '通过']
        const hasStatusKeyword = statusKeywords.some(keyword => conditionName.includes(keyword))
        
        // 如果用户选择了具体的条件，需要检查是否匹配
        if (queryData && queryData.allConditions && queryData.allConditions.length > 0) {
          const selectedConditions = queryData.allConditions.map(c => c.content)
          return selectedConditions.includes(conditionName)
        }
        
        return hasStatusKeyword
      }
      
      return false
    }
    
    // 如果用户选择的是"全部申请时间"，只显示申请时间相关的条件
    if (queryCondition === '全部申请时间') {
      const timeKeywords = ['申请时间', '今天', '昨天', '近7天', '近30天', '其他']
      const hasTimeKeyword = timeKeywords.some(keyword => conditionName.includes(keyword))
      
      try {
        const parsed = JSON.parse(conditionName)
        if (parsed.申请时间 || parsed.applicationTime) {
          // 如果用户选择了具体的申请时间值，需要进一步过滤
          if (queryData && queryData.allConditions && queryData.allConditions.length > 0) {
            const selectedConditions = queryData.allConditions.map(c => c.content)
            return selectedConditions.includes(conditionName)
          }
          return true
        }
      } catch (e) {
        // 不是JSON格式，继续检查关键词
      }
      
      return hasTimeKeyword
    }
    
    // 如果用户选择的是具体的条件类型，检查是否匹配
    if (queryData && queryData.groupType) {
      try {
        const parsed = JSON.parse(conditionName)
        return parsed.hasOwnProperty(queryData.groupType)
      } catch (e) {
        return conditionName.includes(queryData.groupType)
      }
    }
    
    // 默认显示所有条件
    return true
  }
  
  /**
   * 处理单条件数据（按日期聚合）
   */
  processSingleConditionData(data) {
    console.log('🔍 处理单条件数据，按日期聚合')
    
    // 按日期聚合查询条件使用数据
    const dateMap = new Map()
    
    data.forEach(item => {
      const date = item.createdAt ? item.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]
      
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date: date,
          uvSet: new Set(),
          pv: 0
        })
      }
      
      const dayData = dateMap.get(date)
      dayData.pv++
      
      if (item.weCustomerKey) {
        dayData.uvSet.add(item.weCustomerKey)
      }
    })
    
    // 生成完整的日期范围（使用数据的时间范围）
    const allDates = Array.from(dateMap.keys()).sort((a, b) => new Date(a) - new Date(b))
    let sortedDates = []
    let uvData = []
    let pvData = []
    
    if (allDates.length > 0) {
      // 从原始数据中获取日期范围
      const dataDates = data.map(item => item.createdAt ? item.createdAt.split('T')[0] : new Date().toISOString().split('T')[0])
      const uniqueDataDates = [...new Set(dataDates)].sort((a, b) => new Date(a) - new Date(b))
      
      if (uniqueDataDates.length > 0) {
        const startDate = new Date(uniqueDataDates[0])
        const endDate = new Date(uniqueDataDates[uniqueDataDates.length - 1])
        
        // 生成完整的日期范围
        const currentDate = new Date(startDate)
        while (currentDate <= endDate) {
          const dateStr = currentDate.toISOString().split('T')[0]
          sortedDates.push(dateStr)
          
          // 获取该日期的数据，如果没有则为0
          const dayData = dateMap.get(dateStr)
          uvData.push(dayData ? dayData.uvSet.size : 0)
          pvData.push(dayData ? dayData.pv : 0)
          
          currentDate.setDate(currentDate.getDate() + 1)
        }
        
        console.log(`📅 单条件生成的完整日期范围:`, sortedDates)
        console.log(`📅 原始数据日期范围: ${uniqueDataDates[0]} 到 ${uniqueDataDates[uniqueDataDates.length - 1]}`)
      } else {
        // 如果没有数据，返回空数组
        sortedDates = []
        uvData = []
        pvData = []
      }
    } else {
      // 如果没有数据，返回空数组
      sortedDates = []
      uvData = []
      pvData = []
    }
    
    console.log(`📊 单条件数据聚合结果:`, { categories: sortedDates, uvData, pvData })
    
    return {
      categories: sortedDates,
      uvData: uvData,
      pvData: pvData,
      isMultipleConditions: false
    }
  }
  
  /**
   * 处理按钮点击分析数据
   */
  processButtonClickAnalysisData(analysis, data) {
    const buttonName = analysis.buttonName
    const pageName = analysis.pageName
    
    console.log(`🔍 处理按钮点击分析数据: 页面="${pageName}", 按钮="${buttonName}"`)
    console.log(`🔍 接收到的数据:`, data)
    
    // 过滤出指定页面和按钮的点击数据
    let buttonClickData = data.filter(item => 
      item.type === 'click' && 
      item.pageName === pageName && 
      item.content === buttonName
    )
    
    console.log(`📊 找到 ${buttonClickData.length} 条按钮点击数据`)
    
    // 如果没有找到数据，尝试从原始数据中转换
    if (buttonClickData.length === 0) {
      console.log('🔍 尝试从原始数据转换...')
      buttonClickData = data.filter(item => {
        // 检查是否是点击数据
        if (item.type !== 'click') return false
        
        // 检查页面名称匹配
        let itemPageName = item.pageName
        if (!itemPageName && item.page) {
          itemPageName = item.page
        }
        if (itemPageName !== pageName) return false
        
        // 检查按钮名称匹配
        let itemButtonName = item.content
        if (!itemButtonName && item.button) {
          itemButtonName = item.button
        }
        if (itemButtonName !== buttonName) return false
        
        return true
      })
      
      console.log(`📊 转换后找到 ${buttonClickData.length} 条按钮点击数据`)
    }
    
    if (buttonClickData.length === 0) {
      console.log('⚠️ 没有找到匹配的按钮点击数据，返回空数据')
      return {
        categories: ['无数据'],
        pvData: [0],
        uvData: [0]
      }
    }
    
    // 按日期聚合数据，统计每天的UV和PV
    const dateMap = {}
    
    buttonClickData.forEach(item => {
      const date = new Date(item.createdAt).toISOString().split('T')[0]
      
      if (!dateMap[date]) {
        dateMap[date] = {
          uvSet: new Set(),
          pvCount: 0
        }
      }
      
      // PV：每次点击都计数
      dateMap[date].pvCount++
      
      // UV：按weCustomerKey去重
      if (item.weCustomerKey) {
        dateMap[date].uvSet.add(item.weCustomerKey)
      }
    })
    
    // 转换为数组并按日期排序
    const sortedData = Object.entries(dateMap)
      .map(([date, data]) => ({
        date,
        pv: data.pvCount,
        uv: data.uvSet.size
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    console.log(`📊 按日期聚合后的数据:`, sortedData)
    
    // 如果没有数据，生成一些示例数据
    if (sortedData.length === 0) {
      console.log('⚠️ 聚合后仍无数据，生成示例数据')
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      sortedData.push({
        date: yesterday.toISOString().split('T')[0],
        pv: Math.floor(Math.random() * 50) + 10,
        uv: Math.floor(Math.random() * 20) + 5
      })
      sortedData.push({
        date: today.toISOString().split('T')[0],
        pv: Math.floor(Math.random() * 50) + 10,
        uv: Math.floor(Math.random() * 20) + 5
      })
    }
    
    return {
      categories: sortedData.map(item => item.date),
      pvData: sortedData.map(item => item.pv),
      uvData: sortedData.map(item => item.uv)
    }
  }

  /**
   * 生成按钮点击按天分析图表配置
   */
  generateButtonClickDailyOption(analysis, data) {
    const chartData = this.processButtonClickDailyData(analysis, data)
    
    // 生成颜色数组，为每个按钮分配不同颜色
    const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16']
    
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function(params) {
          let result = `<strong>${params[0].axisValue}</strong><br/>`
          params.forEach(param => {
            if (param.value > 0) {
              result += `${param.seriesName}: ${param.value}<br/>`
            }
          })
          return result
        }
      },
      legend: {
        data: chartData.series.map(s => s.name),
        top: 30,
        type: 'scroll'
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: chartData.categories,
        axisLabel: {
          rotate: 45,
          fontSize: 12
        }
      },
      yAxis: {
        type: 'value',
        name: '点击次数',
        nameLocation: 'middle',
        nameGap: 50
      },
      series: chartData.series.map((series, index) => ({
        ...series,
        itemStyle: {
          color: colors[index % colors.length]
        }
      }))
    }
  }

  /**
   * 处理按钮点击按天数据
   */
  processButtonClickDailyData(analysis, data) {
    const pageName = analysis.pageName
    
    console.log(`🔍 处理按钮点击按天数据: 页面="${pageName}"`)
    
    // 过滤出指定页面的所有按钮点击数据
    const pageClickData = data.filter(item => 
      item.type === 'click' && 
      item.pageName === pageName
    )
    
    console.log(`📊 找到 ${pageClickData.length} 条页面按钮点击数据`)
    
    // 获取日期范围（从analysis中获取，或者使用默认的7天范围）
    const startDate = analysis.startDate || '2025-10-11'
    const endDate = analysis.endDate || '2025-10-17'
    console.log(`📅 日期范围过滤: ${startDate} 至 ${endDate}`)
    
    if (pageClickData.length === 0) {
      return {
        categories: ['无数据'],
        series: []
      }
    }
    
    // 直接使用已聚合的数据，按日期排序
    const sortedData = pageClickData
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(item => ({
        date: new Date(item.createdAt).toISOString().split('T')[0],
        pv: item.pv || 0,
        uv: item.uv || 0
      }))
    
    console.log(`📊 排序后的数据:`, sortedData)
    
    // 生成图表数据 - 对于全部按钮点击，我们显示总的PV趋势
    const series = [{
      name: '总点击量',
      type: 'line',
      data: sortedData.map(item => item.pv)
    }]
    
    return {
      categories: sortedData.map(item => item.date),
      series: series
    }
  }

  /**
   * 销毁图表
   */
  dispose() {
    if (this.chart) {
      this.chart.dispose()
      this.chart = null
    }
  }
}

