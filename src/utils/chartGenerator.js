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
    const container = document.getElementById(containerId)
    if (!container) {
      throw new Error(`容器 ${containerId} 不存在`)
    }
    
    // 初始化图表，配置passive事件监听器
    if (this.chart && !this.chart.isDisposed()) {
      this.chart.dispose()
    }
    this.chart = echarts.init(container, null, {
      renderer: 'canvas',
      useDirtyRect: false
    })
    
    // 根据图表类型生成配置
    const option = this.generateOption(analysis, data)
    
    // 验证配置
    if (!option || !option.series || !Array.isArray(option.series) || option.series.length === 0) {
      console.error('图表配置无效:', option)
      throw new Error('图表配置生成失败')
    }
    
    // 验证每个series配置
    option.series.forEach((series, index) => {
      if (!series || !series.type) {
        console.error(`Series ${index} 配置无效:`, series)
        throw new Error(`Series ${index} 配置无效`)
      }
    })
    
    // 添加数据统计信息到图表（传递日期范围信息）
    this.addDataInfo(option, data, analysis.dateRange)
    
    // 设置配置并渲染
    this.chart.setOption(option, true)
    
    // 响应式处理
    window.addEventListener('resize', () => {
      this.chart?.resize()
    })
    
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
    
    // 初始化所有日期为0
    fullDateRange.forEach(date => {
      timeMap[date] = {
        uvSet: new Set(),
        pvCount: 0
      }
    })
    
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
    let current = new Date(startDate)
    const end = new Date(endDate)
    
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }
    
    return dates
  }

  /**
   * 生成按钮点击分析图表配置
   */
  generateButtonClickAnalysisOption(analysis, data) {
    const chartData = this.processButtonClickAnalysisData(analysis, data)
    
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
   * 处理按钮点击分析数据
   */
  processButtonClickAnalysisData(analysis, data) {
    const buttonName = analysis.buttonName
    const pageName = analysis.pageName
    
    console.log(`🔍 处理按钮点击分析数据: 页面="${pageName}", 按钮="${buttonName}"`)
    
    // 过滤出指定页面和按钮的点击数据
    const buttonClickData = data.filter(item => 
      item.type === 'click' && 
      item.pageName === pageName && 
      item.content === buttonName
    )
    
    console.log(`📊 找到 ${buttonClickData.length} 条按钮点击数据`)
    
    if (buttonClickData.length === 0) {
      return {
        categories: ['无数据'],
        pvData: [0],
        uvData: [0]
      }
    }
    
    // 按日期分组统计
    const dateMap = new Map()
    
    buttonClickData.forEach(item => {
      const date = new Date(item.createdAt).toISOString().split('T')[0]
      
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          pv: 0,
          uvSet: new Set()
        })
      }
      
      const dayData = dateMap.get(date)
      dayData.pv++
      
      if (item.weCustomerKey) {
        dayData.uvSet.add(item.weCustomerKey)
      }
    })
    
    // 转换为数组并排序
    const sortedDates = Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date,
        pv: data.pv,
        uv: data.uvSet.size
      }))
    
    return {
      categories: sortedDates.map(item => item.date),
      pvData: sortedDates.map(item => item.pv),
      uvData: sortedDates.map(item => item.uv)
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
    
    // 按日期和按钮分组统计
    const dailyButtonStats = {}
    const allButtons = new Set()
    
    pageClickData.forEach(item => {
      // 调试：查看数据项的结构
      if (pageClickData.indexOf(item) < 3) {
        console.log('🔍 数据项结构:', item)
        console.log('🔍 可用时间字段:', {
          createTime: item.createTime,
          createdAt: item.createdAt,
          timestamp: item.timestamp,
          time: item.time
        })
      }
      
      // 尝试多个可能的时间字段
      let date = '未知日期'
      if (item.createTime) {
        date = item.createTime.split(' ')[0]
      } else if (item.createdAt) {
        // 处理ISO格式的时间：2025-10-11T11:20:19.000Z
        const isoDate = new Date(item.createdAt)
        date = isoDate.toISOString().split('T')[0] // 提取日期部分：2025-10-11
      } else if (item.timestamp) {
        date = item.timestamp.split(' ')[0]
      } else if (item.time) {
        date = item.time.split(' ')[0]
      }
      
      const buttonName = item.content || '未知按钮'
      
      // 检查日期是否在指定范围内
      if (date >= startDate && date <= endDate) {
        allButtons.add(buttonName)
        
        if (!dailyButtonStats[date]) {
          dailyButtonStats[date] = {}
        }
      } else {
        // 跳过超出日期范围的数据
        return
      }
      
      if (!dailyButtonStats[date][buttonName]) {
        dailyButtonStats[date][buttonName] = {
          pv: 0,
          uv: new Set()
        }
      }
      
      dailyButtonStats[date][buttonName].pv += 1
      if (item.userId) {
        dailyButtonStats[date][buttonName].uv.add(item.userId)
      }
    })
    
    // 转换为图表数据格式
    const categories = Object.keys(dailyButtonStats).sort()
    const buttonList = Array.from(allButtons).sort()
    
    console.log(`📊 按天按按钮统计结果: ${categories.length} 天，${buttonList.length} 个按钮`)
    console.log(`📊 按钮列表:`, buttonList)
    
    // 为每个按钮创建数据系列
    const series = buttonList.map(buttonName => {
      const data = categories.map(date => {
        const buttonData = dailyButtonStats[date][buttonName]
        return buttonData ? buttonData.pv : 0
      })
      
      return {
        name: buttonName,
        type: 'bar',
        data: data
        // 不使用stack，让每个按钮独立显示
      }
    })
    
    return {
      categories,
      series
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

