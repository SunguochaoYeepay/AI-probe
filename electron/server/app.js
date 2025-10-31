import express from 'express'
import cors from 'cors'
import path from 'path'
import sqlite3 from 'sqlite3'
import cron from 'node-cron'
import { fileURLToPath } from 'url'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import BackendDataPreloadService from './dataPreloadService.js'

// 默认配置常量
const DEFAULT_CONFIG = {
  PORT: 3004,
  BACKEND_URL: 'http://localhost:3004',
  CONTACT_EMAIL: 'guochao.sun@yeepay.com'
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || DEFAULT_CONFIG.PORT

// Swagger配置
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '智能图表生成系统 API',
      version: '1.0.0',
      description: '基于SQLite的数据聚合和图表生成API',
      contact: {
        name: 'Yeepay Team',
        email: process.env.CONTACT_EMAIL || DEFAULT_CONFIG.CONTACT_EMAIL
      }
    },
    servers: [
      {
        url: process.env.BACKEND_URL || DEFAULT_CONFIG.BACKEND_URL,
        description: '开发环境'
      }
    ],
    components: {
      schemas: {
        Chart: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '图表ID' },
            name: { type: 'string', description: '图表名称' },
            config: { type: 'object', description: '图表配置' },
            chart_type: { type: 'string', description: '图表类型' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        ChartData: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: '数据ID' },
            chart_id: { type: 'string', description: '图表ID' },
            date: { type: 'string', format: 'date', description: '日期' },
            data: { type: 'object', description: '聚合数据' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        RawData: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            pageName: { type: 'string', description: '页面名称' },
            buttonName: { type: 'string', description: '按钮名称' },
            weCustomerKey: { type: 'string', description: '用户标识' },
            date: { type: 'string', format: 'date' },
            createTime: { type: 'string', format: 'date-time' }
          }
        },
        AggregateRequest: {
          type: 'object',
          required: ['rawData', 'chartConfig'],
          properties: {
            rawData: {
              type: 'array',
              items: { $ref: '#/components/schemas/RawData' },
              description: '原始数据数组'
            },
            chartConfig: {
              type: 'object',
              properties: {
                chartType: { type: 'string', description: '图表类型' },
                parameters: { type: 'object', description: '图表参数' },
                filters: { type: 'object', description: '过滤条件' }
              }
            }
          }
        },
        AggregateResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', description: '聚合后的数据' },
            processingTime: { type: 'integer', description: '处理时间(ms)' },
            originalCount: { type: 'integer', description: '原始数据条数' },
            aggregatedCount: { type: 'integer', description: '聚合数据条数' }
          }
        },
        DatabaseStats: {
          type: 'object',
          properties: {
            charts: { type: 'integer', description: '图表数量' },
            chartData: { type: 'integer', description: '数据条数' },
            rawDataCache: { type: 'integer', description: '缓存条数' },
            totalSize: { type: 'integer', description: '数据库大小(字节)' }
          }
        }
      }
    }
  },
  apis: ['./electron/server/app.js']
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)

// 中间件
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// 数据库初始化
const dbPath = path.join(__dirname, '..', 'database', 'charts.db')
const { Database } = sqlite3.verbose()
const db = new Database(dbPath)

// 创建数据预加载服务实例
const dataPreloadService = new BackendDataPreloadService(db)

// 创建系统配置表
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS system_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key TEXT UNIQUE NOT NULL,
      config_value TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // 创建索引
  db.run('CREATE INDEX IF NOT EXISTS idx_config_key ON system_config(config_key)')
})

// 初始化数据库表
db.serialize(() => {
  // 图表配置表
  db.run(`
    CREATE TABLE IF NOT EXISTS charts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      config TEXT NOT NULL,
      chart_type TEXT NOT NULL,
      tags TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // 聚合数据表
  db.run(`
    CREATE TABLE IF NOT EXISTS chart_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chart_id TEXT NOT NULL,
      date TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chart_id) REFERENCES charts (id)
    )
  `)
  
  // 原始数据缓存表
  db.run(`
    CREATE TABLE IF NOT EXISTS raw_data_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bury_point_id TEXT NOT NULL,
      date TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(bury_point_id, date)
    )
  `)
  
  // 数据库迁移：为现有表添加缺失的字段
  db.run(`ALTER TABLE charts ADD COLUMN description TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('添加 description 字段失败:', err)
    }
  })
  
  db.run(`ALTER TABLE charts ADD COLUMN category TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('添加 category 字段失败:', err)
    }
  })
  
  db.run(`ALTER TABLE charts ADD COLUMN tags TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('添加 tags 字段失败:', err)
    }
  })
  
  db.run(`ALTER TABLE charts ADD COLUMN status TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('添加 status 字段失败:', err)
    }
  })

  // 一次性回填：根据 chart_type 为缺失或错误的 category 赋值
  db.run(`UPDATE charts SET category = '用户行为' WHERE (category IS NULL OR category = '' OR category = '页面分析') AND chart_type IN ('button_click_analysis','button_click_daily')`)
  db.run(`UPDATE charts SET category = '查询条件分析' WHERE (category IS NULL OR category = '' OR category = '页面分析') AND chart_type = 'query_condition_analysis'`)
  db.run(`UPDATE charts SET category = '转化分析' WHERE (category IS NULL OR category = '' OR category = '页面分析') AND chart_type IN ('behavior_funnel','conversion_funnel')`)
})

console.log('📊 数据库初始化完成')

// 数据聚合服务
class DataAggregationService {
  constructor() {
    this.processors = new Map()
    this.initProcessors()
  }
  
  initProcessors() {
    // 注册各种数据处理器
    this.processors.set('page_visit', this.processPageVisitData.bind(this))
    this.processors.set('user_click', this.processUserClickData.bind(this))
    this.processors.set('behavior_analysis', this.processBehaviorAnalysisData.bind(this))
    
    // 添加前端图表类型的支持
    this.processors.set('single_page_uv_pv_chart', this.processPageVisitData.bind(this))
    this.processors.set('button_click_analysis', this.processUserClickData.bind(this))
    this.processors.set('query_condition_analysis', this.processQueryConditionData.bind(this))
    this.processors.set('page_analysis', this.processPageVisitData.bind(this))
    this.processors.set('uv_pv_chart', this.processPageVisitData.bind(this))
    this.processors.set('button_click_daily', this.processUserClickData.bind(this))
  }
  
  async processPageVisitData(rawData, config) {
    const dateMap = new Map()
    let matchedCount = 0
    const { pageName, dateRange } = config.parameters || {}
    
    console.log(`🔍 [Backend] 开始处理页面访问数据: ${rawData.length} 条，目标页面: ${pageName}`)
    
    rawData.forEach((item, index) => {
      const isMatch = this.isDataMatch(item, config)
      if (isMatch) {
        matchedCount++
        if (matchedCount <= 3) {
          console.log(`✅ [Backend] 数据项 ${index} 匹配成功:`, {
            pageName: item.pageName,
            targetPageName: pageName,
            weCustomerKey: item.weCustomerKey
          })
        }
      }
      
      if (!isMatch) return
      
      const date = this.extractDate(item)
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, pv: 0, uvSet: new Set() })
      }
      
      const dayData = dateMap.get(date)
      dayData.pv++
      if (item.weCustomerKey) {
        dayData.uvSet.add(item.weCustomerKey)
      }
    })
    
    console.log(`📊 [Backend] 数据匹配结果: ${matchedCount}/${rawData.length} 条数据匹配`)
    
    // 转换为数组格式
    const result = Array.from(dateMap.values()).map(day => ({
      date: day.date,
      pv: day.pv,
      uv: day.uvSet.size
    }))
    
    console.log(`📈 [Backend] 聚合结果: ${result.length} 个日期，样本数据:`, result.slice(0, 3))
    
    // 转换为前端期望的格式
    const sortedResult = result.sort((a, b) => new Date(a.date) - new Date(b.date))
    
    // 如果有日期范围，生成完整的时间轴
    let categories, uvData, pvData
    if (dateRange && dateRange.startDate && dateRange.endDate) {
      console.log(`📅 [Backend] 使用用户选择的日期范围: ${dateRange.startDate} 至 ${dateRange.endDate}`)
      const fullDateRange = this.generateDateRange(dateRange.startDate, dateRange.endDate)
      const dataMap = new Map(sortedResult.map(item => [item.date, item]))
      
      categories = fullDateRange
      uvData = fullDateRange.map(date => {
        const dayData = dataMap.get(date)
        return dayData ? dayData.uv : 0
      })
      pvData = fullDateRange.map(date => {
        const dayData = dataMap.get(date)
        return dayData ? dayData.pv : 0
      })
    } else {
      // 使用实际数据日期
      categories = sortedResult.map(item => item.date)
      uvData = sortedResult.map(item => item.uv)
      pvData = sortedResult.map(item => item.pv)
    }
    
    const frontendFormat = {
      categories: categories,
      uvData: uvData,
      pvData: pvData,
      isMultipleConditions: false,
      conditionData: []
    }
    
    console.log(`📊 [Backend] 转换为前端格式:`, {
      categoriesCount: categories.length,
      uvDataCount: uvData.length,
      pvDataCount: pvData.length,
      sampleData: {
        categories: categories.slice(0, 3),
        uvData: uvData.slice(0, 3),
        pvData: pvData.slice(0, 3)
      }
    })
    
    return frontendFormat
  }
  
  async processUserClickData(rawData, config) {
    const dateMap = new Map()
    
    rawData.forEach(item => {
      if (!this.isDataMatch(item, config)) return
      
      const date = this.extractDate(item)
      if (!dateMap.has(date)) {
        dateMap.set(date, { date, clickCount: 0, buttonStats: new Map() })
      }
      
      const dayData = dateMap.get(date)
      dayData.clickCount++
      
      // 统计按钮点击
      const buttonName = item.buttonName || '未知按钮'
      if (!dayData.buttonStats.has(buttonName)) {
        dayData.buttonStats.set(buttonName, 0)
      }
      dayData.buttonStats.set(buttonName, dayData.buttonStats.get(buttonName) + 1)
    })
    
    // 转换为数组格式
    const result = Array.from(dateMap.values()).map(day => ({
      date: day.date,
      clickCount: day.clickCount,
      buttonStats: Object.fromEntries(day.buttonStats)
    }))
    
    const sortedResult = result.sort((a, b) => new Date(a.date) - new Date(b.date))
    
    // 转换为前端期望的格式
    const categories = sortedResult.map(item => item.date)
    const clickData = sortedResult.map(item => item.clickCount)
    
    return {
      categories: categories,
      clickData: clickData,
      isMultipleConditions: false,
      conditionData: []
    }
  }
  
  async processBehaviorAnalysisData(rawData, config) {
    // 行为分析数据处理逻辑
    // 这里可以复用现有的 behaviorAnalysisDataProcessor 逻辑
    return []
  }
  
  async processQueryConditionData(rawData, config) {
    // 查询条件分析数据处理逻辑
    // 复用页面访问数据处理逻辑
    return this.processPageVisitData(rawData, config)
  }
  
  isDataMatch(item, config) {
    const { pageName, buttonName } = config.parameters || {}
    
    // 页面名称匹配 - 支持智能匹配
    if (pageName) {
      const itemPageName = item.pageName || item.url || item.path || item.title
      if (!itemPageName) {
        return false
      }
      
      // 智能匹配逻辑：移除#号、空格，转换为小写进行比较
      const normalizePageName = (name) => {
        return name.replace(/^#+/, '').replace(/\s+/g, '').toLowerCase()
      }
      
      const normalizedTarget = normalizePageName(pageName)
      const normalizedItem = normalizePageName(itemPageName)
      
      // 支持包含匹配和精确匹配
      if (!normalizedItem.includes(normalizedTarget) && normalizedItem !== normalizedTarget) {
        return false
      }
    }
    
    // 按钮名称匹配
    if (buttonName && item.buttonName !== buttonName) {
      return false
    }
    
    return true
  }
  
  extractDate(item) {
    if (item.date) return item.date
    if (item.createTime) return item.createTime.split(' ')[0]
    return new Date().toISOString().split('T')[0]
  }
  
  // 生成日期范围
  generateDateRange(startDate, endDate) {
    const dates = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    let current = new Date(start)
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }
    
    return dates
  }
  
  async aggregate(rawData, chartConfig) {
    const processor = this.processors.get(chartConfig.chartType)
    if (!processor) {
      throw new Error(`未知的图表类型: ${chartConfig.chartType}`)
    }
    
    return await processor(rawData, chartConfig)
  }
}

const aggregationService = new DataAggregationService()

// API 路由

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: 健康检查
 *     description: 检查API服务是否正常运行
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 服务正常
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-01-11T10:00:00.000Z
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

/**
 * @swagger
 * /api/charts:
 *   get:
 *     summary: 获取图表列表
 *     description: 获取所有图表配置信息
 *     tags: [Charts]
 *     responses:
 *       200:
 *         description: 图表列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Chart'
 *       500:
 *         description: 服务器错误
 */
app.get('/api/charts', (req, res) => {
  db.all('SELECT * FROM charts ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    
    // 解析config字段并提取category信息
    const charts = rows.map(row => {
      try {
        const config = JSON.parse(row.config)
        // 后端兜底：当category缺失时依据chart_type推断
        let resolvedCategory = row.category || config.category
        if (!resolvedCategory) {
          const t = row.chart_type || config.chartType
          if (t === 'button_click_analysis' || t === 'button_click_daily') {
            resolvedCategory = '用户行为'
          } else if (t === 'query_condition_analysis') {
            resolvedCategory = '查询条件分析'
          } else if (t === 'behavior_funnel' || t === 'conversion_funnel') {
            resolvedCategory = '转化分析'
          } else {
            resolvedCategory = '页面分析'
          }
        }

        return {
          id: row.id,
          name: row.name,
          description: row.description,
          config: config,
          chartType: row.chart_type,
          category: resolvedCategory,
          tags: row.tags ? JSON.parse(row.tags) : [],
          status: row.status || 'active',
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      } catch (error) {
        console.error('解析图表配置失败:', error)
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          config: {},
          chartType: row.chart_type,
          category: row.category || '页面分析',
          tags: row.tags ? JSON.parse(row.tags) : [],
          status: row.status || 'active',
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      }
    })
    
    res.json(charts)
  })
})

// 创建图表
app.post('/api/charts', (req, res) => {
  let { id, name, description, category, config, chartType, tags, status, createdAt, updatedAt } = req.body
  // 保存兜底：当未提供或提供为默认“页面分析”但类型明确时，依据 chartType 纠正分类
  if (!category || category === '' || category === '页面分析') {
    const t = chartType || (config && config.chartType)
    if (t === 'button_click_analysis' || t === 'button_click_daily') {
      category = '用户行为'
    } else if (t === 'query_condition_analysis') {
      category = '查询条件分析'
    } else if (t === 'behavior_funnel' || t === 'conversion_funnel') {
      category = '转化分析'
    }
  }
  
  console.log('🔍 [Backend] 接收到的图表数据:', {
    id, name, description, category, chartType, tags, status
  })
  
  db.run(
    'INSERT OR REPLACE INTO charts (id, name, description, category, config, chart_type, tags, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, description, category, JSON.stringify(config), chartType, JSON.stringify(tags), status, createdAt, updatedAt],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      res.json({ id, message: '图表创建成功' })
    }
  )
})

// 获取图表统计信息 - 必须在 /api/charts/:id 之前
app.get('/api/charts/stats', (req, res) => {
  console.log('📊 [Backend] 收到统计信息请求')
  
  try {
    const stats = {
      charts: 0,
      chartData: 0,
      totalSize: 0
    }

    // 统计图表数量
    db.get('SELECT COUNT(*) as count FROM charts', (err, row) => {
      if (err) {
        console.error('统计图表数量失败:', err)
        res.status(500).json({ error: err.message })
        return
      }
      stats.charts = row.count
      console.log('📊 [Backend] 图表数量:', stats.charts)

      // 统计图表数据数量
      db.get('SELECT COUNT(*) as count FROM chart_data', (err, row) => {
        if (err) {
          console.error('统计图表数据数量失败:', err)
          res.status(500).json({ error: err.message })
          return
        }
        stats.chartData = row.count
        console.log('📊 [Backend] 图表数据数量:', stats.chartData)

        // 计算数据库文件大小
        import('fs').then(fs => {
          try {
            const stats_file = fs.statSync(dbPath)
            stats.totalSize = stats_file.size
          } catch (error) {
            console.error('获取数据库文件大小失败:', error)
            stats.totalSize = 0
          }
          
          console.log('📊 [Backend] 返回统计信息:', stats)
          res.json(stats)
        }).catch((error) => {
          console.error('导入fs模块失败:', error)
          stats.totalSize = 0
          console.log('📊 [Backend] 返回统计信息:', stats)
          res.json(stats)
        })
      })
    })
  } catch (error) {
    console.error('获取统计信息失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// 获取单个图表配置
app.get('/api/charts/:id', (req, res) => {
  const { id } = req.params
  
  db.get('SELECT * FROM charts WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    
    if (!row) {
      res.status(404).json({ error: '图表不存在' })
      return
    }
    
    const parsedConfig = JSON.parse(row.config)
    // 后端兜底：当category缺失时依据chart_type/配置推断
    let resolvedCategory = row.category || parsedConfig.category
    if (!resolvedCategory) {
      const t = row.chart_type || parsedConfig.chartType
      if (t === 'button_click_analysis' || t === 'button_click_daily') {
        resolvedCategory = '用户行为'
      } else if (t === 'query_condition_analysis') {
        resolvedCategory = '查询条件分析'
      } else if (t === 'behavior_funnel' || t === 'conversion_funnel') {
        resolvedCategory = '转化分析'
      } else {
        resolvedCategory = '页面分析'
      }
    }

    const chart = {
      id: row.id,
      name: row.name,
      description: row.description,
      category: resolvedCategory,
      config: parsedConfig,
      chartType: row.chart_type,
      tags: row.tags ? JSON.parse(row.tags) : [],
      status: row.status || 'active',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
    
    res.json(chart)
  })
})

// 获取图表数据
app.get('/api/charts/:id/data', (req, res) => {
  const { id } = req.params
  const { startDate, endDate, limit } = req.query
  
  let query = 'SELECT * FROM chart_data WHERE chart_id = ?'
  let params = [id]
  
  if (startDate && endDate) {
    query += ' AND date BETWEEN ? AND ?'
    params.push(startDate, endDate)
  }
  
  query += ' ORDER BY date ASC'
  
  if (limit) {
    query += ' LIMIT ?'
    params.push(parseInt(limit))
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    
    const data = rows.map(row => ({
      date: row.date,
      ...JSON.parse(row.data)
    }))
    
    res.json(data)
  })
})

// 保存单天图表数据
app.post('/api/charts/:id/data', (req, res) => {
  const { id } = req.params
  const { date, data } = req.body
  
  db.run(
    'INSERT OR REPLACE INTO chart_data (chart_id, date, data) VALUES (?, ?, ?)',
    [id, date, JSON.stringify(data)],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      res.json({ success: true, message: '数据保存成功' })
    }
  )
})

// 批量保存图表数据
app.post('/api/charts/data/batch', (req, res) => {
  const { dataList } = req.body
  
  if (!Array.isArray(dataList) || dataList.length === 0) {
    return res.status(400).json({ error: '数据列表不能为空' })
  }
  
  const stmt = db.prepare('INSERT OR REPLACE INTO chart_data (chart_id, date, data) VALUES (?, ?, ?)')
  
  try {
    dataList.forEach(item => {
      stmt.run(item.chartId, item.date, JSON.stringify(item))
    })
    stmt.finalize()
    res.json({ success: true, message: `成功保存 ${dataList.length} 条数据` })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 删除图表
app.delete('/api/charts/:id', (req, res) => {
  const { id } = req.params
  
  db.run('DELETE FROM charts WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: '图表不存在' })
      return
    }
    
    // 同时删除相关数据
    db.run('DELETE FROM chart_data WHERE chart_id = ?', [id], (err) => {
      if (err) {
        console.warn('删除图表数据时出错:', err.message)
      }
    })
    
    res.json({ success: true, message: '图表删除成功' })
  })
})

// 更新图表配置
app.put('/api/charts/:id', (req, res) => {
  const { id } = req.params
  const { name, description, category, chartType, config, tags, status } = req.body

  if (!chartType || !config) {
    res.status(400).json({ error: '缺少必要参数: chartType 和 config' })
    return
  }

  const updateQuery = `
    UPDATE charts 
    SET name = ?, description = ?, category = ?, chart_type = ?, config = ?, tags = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `

  db.run(updateQuery, [name, description, category, chartType, JSON.stringify(config), JSON.stringify(tags), status, id], function(err) {
    if (err) {
      console.error('更新图表失败:', err)
      res.status(500).json({ error: err.message })
      return
    }

    if (this.changes === 0) {
      res.status(404).json({ error: '图表不存在' })
      return
    }

    res.json({ 
      success: true, 
      message: '图表更新成功',
      id: id
    })
  })
})


// 清理数据库
app.post('/api/charts/clear', (req, res) => {
  try {
    db.run('DELETE FROM charts', (err) => {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      
      db.run('DELETE FROM chart_data', (err) => {
        if (err) {
          res.status(500).json({ error: err.message })
          return
        }
        
        res.json({ success: true, message: '数据库清理完成' })
      })
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: 获取数据库统计信息
 *     description: 获取SQLite数据库的统计信息，包括图表数量、数据条数等
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 统计信息
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DatabaseStats'
 *             example:
 *               charts: 5
 *               chartData: 1200
 *               rawDataCache: 50000
 *               totalSize: 1048576
 *       500:
 *         description: 服务器错误
 */
app.get('/api/stats', (req, res) => {
  const stats = {
    charts: 0,
    chartData: 0,
    rawDataCache: 0,
    totalSize: 0
  }

  // 统计图表数量
  db.get('SELECT COUNT(*) as count FROM charts', (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    stats.charts = row.count

    // 统计图表数据数量
    db.get('SELECT COUNT(*) as count FROM chart_data', (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      stats.chartData = row.count

      // 统计原始数据缓存数量
      db.get('SELECT COUNT(*) as count FROM raw_data_cache', (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message })
          return
        }
        stats.rawDataCache = row.count

        // 计算数据库文件大小
        import('fs').then(fs => {
          try {
            const stats_file = fs.statSync(dbPath)
            stats.totalSize = stats_file.size
          } catch (error) {
            stats.totalSize = 0
          }
          res.json(stats)
        }).catch(() => {
          stats.totalSize = 0
          res.json(stats)
        })
      })
    })
  })
})

// 清理数据库
app.post('/api/clear', (req, res) => {
  db.serialize(() => {
    db.run('DELETE FROM chart_data')
    db.run('DELETE FROM charts')
    db.run('DELETE FROM raw_data_cache')
    
    res.json({ 
      success: true, 
      message: 'Database cleared successfully',
      timestamp: new Date().toISOString()
    })
  })
})

/**
 * @swagger
 * /api/config:
 *   get:
 *     summary: 获取系统配置
 *     description: 获取所有系统配置项
 *     tags: [System Config]
 *     responses:
 *       200:
 *         description: 配置列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties: true
 *       500:
 *         description: 服务器错误
 */
app.get('/api/config', (req, res) => {
  db.all('SELECT config_key, config_value, description FROM system_config', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    
    const config = {}
    rows.forEach(row => {
      try {
        config[row.config_key] = JSON.parse(row.config_value)
      } catch (e) {
        config[row.config_key] = row.config_value
      }
    })
    
    res.json(config)
  })
})

/**
 * @swagger
 * /api/config:
 *   post:
 *     summary: 保存系统配置
 *     description: 保存或更新系统配置项
 *     tags: [System Config]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *           example:
 *             projectConfig:
 *               visitBuryPointId: 175
 *               clickBuryPointId: 172
 *               behaviorBuryPointIds: [175, 172]
 *             apiConfig:
 *               pageSize: 1000
 *               timeout: 30
 *     responses:
 *       200:
 *         description: 保存成功
 *       500:
 *         description: 服务器错误
 */
app.post('/api/config', (req, res) => {
  const configs = req.body
  
  if (!configs || typeof configs !== 'object') {
    return res.status(400).json({ error: 'Invalid config data' })
  }
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO system_config (config_key, config_value, description, updated_at) 
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `)
  
  try {
    Object.keys(configs).forEach(key => {
      const value = typeof configs[key] === 'object' 
        ? JSON.stringify(configs[key]) 
        : String(configs[key])
      
      const description = getConfigDescription(key)
      stmt.run(key, value, description)
    })
    
    stmt.finalize()
    res.json({ success: true, message: '配置保存成功' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * @swagger
 * /api/config/{key}:
 *   get:
 *     summary: 获取指定配置
 *     description: 根据配置键获取配置值
 *     tags: [System Config]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: 配置键
 *     responses:
 *       200:
 *         description: 配置值
 *       404:
 *         description: 配置不存在
 *       500:
 *         description: 服务器错误
 */
app.get('/api/config/:key', (req, res) => {
  const { key } = req.params
  
  db.get('SELECT config_value FROM system_config WHERE config_key = ?', [key], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message })
      return
    }
    
    if (!row) {
      res.status(404).json({ error: 'Config not found' })
      return
    }
    
    try {
      const value = JSON.parse(row.config_value)
      res.json(value)
    } catch (e) {
      res.json(row.config_value)
    }
  })
})

// 配置描述映射
function getConfigDescription(key) {
  const descriptions = {
    'projectConfig': '项目配置信息',
    'apiConfig': 'API配置信息',
    'aiConfig': 'AI配置信息',
    'pageMenuData': '页面菜单数据',
    'cacheConfig': '缓存管理配置',
    'scheduledUpdateConfig': '定时更新配置',
    'chartManagementConfig': '图表管理配置',
    'selectedBuryPointIds': '选中的埋点ID列表',
    'visitBuryPointId': '访问埋点ID',
    'clickBuryPointId': '点击埋点ID',
    'behaviorBuryPointIds': '行为分析埋点ID列表'
  }
  return descriptions[key] || '系统配置'
}

/**
 * @swagger
 * /api/aggregate:
 *   post:
 *     summary: 数据聚合
 *     description: 对原始数据进行聚合处理，生成图表数据
 *     tags: [Data Processing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AggregateRequest'
 *           example:
 *             rawData:
 *               - id: 1
 *                 pageName: "首页"
 *                 buttonName: "登录按钮"
 *                 weCustomerKey: "user123"
 *                 date: "2025-01-11"
 *                 createTime: "2025-01-11T10:00:00.000Z"
 *             chartConfig:
 *               chartType: "page_visit"
 *               parameters:
 *                 pageName: "首页"
 *     responses:
 *       200:
 *         description: 聚合成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AggregateResponse'
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
app.post('/api/aggregate', async (req, res) => {
  try {
    const { rawData, chartConfig } = req.body
    
    console.log(`🔄 开始聚合数据: ${rawData.length} 条原始数据`)
    const startTime = Date.now()
    
    const aggregatedData = await aggregationService.aggregate(rawData, chartConfig)
    
    const endTime = Date.now()
    console.log(`✅ 数据聚合完成: ${aggregatedData.categories ? aggregatedData.categories.length : 0} 条聚合数据，耗时 ${endTime - startTime}ms`)
    
    res.json({
      success: true,
      data: aggregatedData,
      processingTime: endTime - startTime,
      originalCount: rawData.length,
      aggregatedCount: aggregatedData.categories ? aggregatedData.categories.length : 0
    })
  } catch (error) {
    console.error('❌ 数据聚合失败:', error)
    res.status(500).json({ error: error.message })
  }
})

// 缓存原始数据
app.post('/api/cache/raw-data', (req, res) => {
  const { buryPointId, date, data } = req.body
  
  db.run(
    'INSERT OR REPLACE INTO raw_data_cache (bury_point_id, date, data) VALUES (?, ?, ?)',
    [buryPointId, date, JSON.stringify(data)],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      res.json({ message: '数据缓存成功' })
    }
  )
})

// 获取缓存的原始数据
app.get('/api/cache/raw-data/:buryPointId/:date', (req, res) => {
  const { buryPointId, date } = req.params
  
  db.get(
    'SELECT data FROM raw_data_cache WHERE bury_point_id = ? AND date = ?',
    [buryPointId, date],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message })
        return
      }
      
      if (!row) {
        res.status(404).json({ error: '数据不存在' })
        return
      }
      
      res.json(JSON.parse(row.data))
    }
  )
})

// 手动触发数据预加载
app.post('/api/preload/trigger', (req, res) => {
  dataPreloadService.triggerPreload()
    .then(() => {
      res.json({ 
        success: true, 
        message: '数据预加载已触发',
        timestamp: new Date().toISOString()
      })
    })
    .catch(error => {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      })
    })
})

// 获取数据预加载服务状态
app.get('/api/preload/status', (req, res) => {
  const status = dataPreloadService.getStatus()
  res.json({
    success: true,
    data: status,
    timestamp: new Date().toISOString()
  })
})

// 重新加载数据预加载服务配置
app.post('/api/preload/reload-config', (req, res) => {
  dataPreloadService.loadConfig()
    .then(() => {
      res.json({ 
        success: true, 
        message: '配置已重新加载',
        timestamp: new Date().toISOString()
      })
    })
    .catch(error => {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      })
    })
})

// 启动服务器
app.listen(PORT, async () => {
  const serverUrl = process.env.BACKEND_URL || DEFAULT_CONFIG.BACKEND_URL
  console.log(`🚀 本地服务器启动成功: ${serverUrl}`)
  console.log(`📊 数据库路径: ${dbPath}`)
  
  // 初始化数据预加载服务
  try {
    await dataPreloadService.init()
    console.log('✅ 数据预加载服务已启动')
  } catch (error) {
    console.error('❌ 数据预加载服务启动失败:', error)
  }
})

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭服务器...')
  db.close((err) => {
    if (err) {
      console.error('❌ 关闭数据库失败:', err.message)
    } else {
      console.log('✅ 数据库连接已关闭')
    }
    process.exit(0)
  })
})
