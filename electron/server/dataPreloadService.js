/**
 * 后端数据预加载服务
 * 负责定时从API获取数据并存储到数据库
 */

import axios from 'axios'
import cron from 'node-cron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class BackendDataPreloadService {
  constructor(db = null) {
    this.isRunning = true  // 服务启动后就是运行状态
    this.isTaskRunning = false  // 任务执行状态
    this.probeApiUrl = null
    this.accessToken = null
    this.projectId = null
    this.buryPointIds = []
    this.db = db
    
    // 定时任务配置
    this.scheduleConfig = {
      // 每小时执行一次数据预加载
      preloadSchedule: '0 * * * *',
      // 每天凌晨2点执行全量同步
      fullSyncSchedule: '0 2 * * *'
    }
  }

  /**
   * 初始化服务
   */
  async init() {
    try {
      console.log('🚀 后端数据预加载服务初始化...')
      
      // 从数据库加载配置
      await this.loadConfig()
      
      // 启动定时任务
      this.startScheduledTasks()
      
      console.log('✅ 后端数据预加载服务启动成功')
    } catch (error) {
      console.error('❌ 后端数据预加载服务初始化失败:', error)
    }
  }

  /**
   * 从数据库加载配置
   */
  async loadConfig() {
    return new Promise((resolve, reject) => {
      const db = this.db
      
      // 加载API配置
      db.get('SELECT config_value FROM system_config WHERE config_key = ?', ['apiConfig'], (err, row) => {
        if (err) {
          console.error('❌ 加载API配置失败:', err)
          reject(err)
          return
        }
        
        if (row) {
          const apiConfig = JSON.parse(row.config_value)
          this.accessToken = apiConfig.accessToken
          this.projectId = apiConfig.projectId
          // 🚀 修复：支持多种URL字段名
          this.probeApiUrl = apiConfig.baseUrl || apiConfig.probeApiUrl || 'https://probe.yeepay.com'
          console.log('✅ API配置已加载:')
          console.log('🔑 项目ID:', this.projectId)
          console.log('🌐 API地址:', this.probeApiUrl)
          console.log('🎫 访问令牌状态:', this.accessToken ? '已配置' : '未配置')
        } else {
          console.warn('⚠️ 未找到API配置，使用默认值')
          this.probeApiUrl = 'https://probe.yeepay.com'
          this.projectId = 'event1021'
        }
        
        // 加载项目配置
        db.get('SELECT config_value FROM system_config WHERE config_key = ?', ['projectConfig'], (err, row) => {
          if (err) {
            console.error('❌ 加载项目配置失败:', err)
            reject(err)
            return
          }
          
          if (row) {
            const projectConfig = JSON.parse(row.config_value)
            this.buryPointIds = [
              projectConfig.visitBuryPointId,
              projectConfig.clickBuryPointId,
              ...(projectConfig.behaviorBuryPointIds || [])
            ].filter(id => id) // 过滤掉null/undefined
            
            // 去重处理，避免重复的埋点ID
            this.buryPointIds = [...new Set(this.buryPointIds)]
            
            console.log('✅ 项目配置已加载:')
            console.log('🎯 访问埋点ID:', projectConfig.visitBuryPointId)
            console.log('🖱️ 点击埋点ID:', projectConfig.clickBuryPointId)
            console.log('🔄 行为分析埋点ID列表:', projectConfig.behaviorBuryPointIds)
            console.log('📋 最终埋点ID列表:', this.buryPointIds)
            console.log('📈 埋点总数:', this.buryPointIds.length)
          } else {
            console.warn('⚠️ 未找到项目配置，埋点ID列表为空')
            this.buryPointIds = []
          }
          
          // 验证配置完整性
          if (!this.accessToken) {
            console.warn('⚠️ 缺少访问令牌，数据预加载可能失败')
          }
          if (this.buryPointIds.length === 0) {
            console.warn('⚠️ 没有配置埋点ID，数据预加载将跳过')
          }
          
          resolve()
        })
      })
    })
  }

  /**
   * 启动定时任务
   */
  startScheduledTasks() {
    // 每小时预加载数据
    cron.schedule(this.scheduleConfig.preloadSchedule, async () => {
      console.log('⏰ 定时任务：开始预加载数据...')
      // 重新加载配置，确保使用最新配置
      await this.loadConfig()
      await this.preloadRecentData()
    })

    // 每天全量同步
    cron.schedule(this.scheduleConfig.fullSyncSchedule, async () => {
      console.log('⏰ 定时任务：开始全量同步...')
      // 重新加载配置，确保使用最新配置
      await this.loadConfig()
      await this.fullSyncData()
    })

    // 每5分钟重新加载配置（确保配置变更及时生效）
    cron.schedule('*/5 * * * *', async () => {
      console.log('🔄 定时任务：重新加载配置...')
      await this.loadConfig()
    })

    console.log('⏰ 定时任务已启动')
  }

  /**
   * 预加载最近数据（最近7天）
   */
  async preloadRecentData() {
    if (this.isTaskRunning) {
      console.log('⚠️ 数据预加载正在进行中，跳过本次任务')
      return
    }

    this.isTaskRunning = true
    console.log('🔄 开始预加载最近数据...')

    try {
      const dates = this.getLast7Days()
      
      for (const pointId of this.buryPointIds) {
        for (const date of dates) {
          await this.preloadDateData(date, pointId)
          // 避免请求过于频繁
          await this.sleep(1000)
        }
      }
      
      console.log('✅ 最近数据预加载完成')
    } catch (error) {
      console.error('❌ 预加载最近数据失败:', error)
    } finally {
      this.isTaskRunning = false
    }
  }

  /**
   * 全量同步数据（最近30天）
   */
  async fullSyncData() {
    if (this.isTaskRunning) {
      console.log('⚠️ 数据同步正在进行中，跳过本次任务')
      return
    }

    this.isTaskRunning = true
    console.log('🔄 开始全量同步数据...')

    try {
      const dates = this.getLast30Days()
      
      for (const pointId of this.buryPointIds) {
        for (const date of dates) {
          await this.preloadDateData(date, pointId)
          // 避免请求过于频繁
          await this.sleep(2000)
        }
      }
      
      console.log('✅ 全量数据同步完成')
    } catch (error) {
      console.error('❌ 全量数据同步失败:', error)
    } finally {
      this.isTaskRunning = false
    }
  }

  /**
   * 预加载指定日期的数据
   */
  async preloadDateData(date, pointId) {
    try {
      console.log(`🔍 [DEBUG] 开始预加载 ${date} - 埋点${pointId}`)
      
      // 检查是否已有缓存
      console.log(`🔍 [DEBUG] 检查缓存是否存在...`)
      const hasCache = await this.checkCacheExists(date, pointId)
      console.log(`🔍 [DEBUG] 缓存检查结果: ${hasCache}`)
      
      if (hasCache) {
        console.log(`📦 ${date} - 埋点${pointId} 已有缓存，跳过`)
        return
      }

      console.log(`📡 获取 ${date} - 埋点${pointId} 数据...`)
      console.log(`🔍 [DEBUG] API配置:`, {
        probeApiUrl: this.probeApiUrl,
        projectId: this.projectId,
        hasToken: !!this.accessToken
      })
      
      // 从API获取数据
      const data = await this.fetchApiData(date, pointId)
      console.log(`🔍 [DEBUG] API返回数据长度: ${data ? data.length : 0}`)
      
      if (data && data.length > 0) {
        console.log(`🔍 [DEBUG] 开始保存到数据库...`)
        // 存储到数据库
        await this.saveToDatabase(date, pointId, data)
        console.log(`💾 ${date} - 埋点${pointId} 数据已缓存 (${data.length}条)`)
        
        // 验证保存结果
        const verifyCache = await this.checkCacheExists(date, pointId)
        console.log(`🔍 [DEBUG] 保存后验证缓存: ${verifyCache}`)
      } else {
        console.log(`⚠️ ${date} - 埋点${pointId} 无数据`)
      }
    } catch (error) {
      console.error(`❌ 预加载 ${date} - 埋点${pointId} 失败:`, error)
      console.error(`❌ 错误详情:`, error.stack)
    }
  }

  /**
   * 从API获取数据
   */
  async fetchApiData(date, pointId) {
    try {
      console.log(`🔍 [DEBUG] 开始API调用: ${this.probeApiUrl}/tracker/buryPointTest/search`)
      console.log(`🔍 [DEBUG] 请求参数:`, {
        projectId: this.projectId,
        selectedPointId: pointId,
        date: date
      })
      
      const response = await axios.post(`${this.probeApiUrl}/tracker/buryPointTest/search`, {
        projectId: this.projectId,
        selectedPointId: pointId,
        calcInfo: {},
        dataType: "list",
        filterList: [],
        page: 1,
        pageSize: 10000,
        order: "descend",
        date: date
      }, {
        headers: {
          'Accept': '*/*',
          'Accept-Language': 'en,zh-CN;q=0.9,zh;q=0.8',
          'Connection': 'keep-alive',
          'Origin': 'https://probe.yeepay.com',
          'Referer': 'https://probe.yeepay.com/webfunny_event/eventSearch.html',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
          'access-token': this.accessToken,
          'Content-Type': 'text/plain;charset=UTF-8',
          'wf-t': '78d60508-8149-4109-94b0-d80c412647e1'
        },
        timeout: 30000
      })

      console.log(`🔍 [DEBUG] API响应状态: ${response.status}`)
      console.log(`🔍 [DEBUG] API响应数据结构:`, {
        hasData: !!response.data,
        hasDataData: !!response.data?.data,
        hasDataList: !!response.data?.data?.dataList,
        dataListLength: response.data?.data?.dataList?.length || 0,
        total: response.data?.data?.total || 0
      })

      const result = response.data.data.dataList || []
      console.log(`🔍 [DEBUG] 返回数据长度: ${result.length}`)
      return result
    } catch (error) {
      console.error(`❌ API请求失败 ${date} - 埋点${pointId}:`, error.message)
      console.error(`❌ 错误详情:`, {
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      })
      return []
    }
  }

  /**
   * 保存数据到数据库
   */
  async saveToDatabase(date, pointId, data) {
    return new Promise((resolve, reject) => {
      const db = this.db
      
      console.log(`🔍 [DEBUG] 开始保存到数据库: ${pointId} - ${date}`)
      console.log(`🔍 [DEBUG] 数据长度: ${data.length}`)
      
      const jsonData = JSON.stringify(data)
      console.log(`🔍 [DEBUG] JSON数据长度: ${jsonData.length}`)
      
      db.run(
        'INSERT OR REPLACE INTO raw_data_cache (bury_point_id, date, data) VALUES (?, ?, ?)',
        [pointId, date, jsonData],
        function(err) {
          if (err) {
            console.error(`❌ 数据库保存失败:`, err)
            reject(err)
          } else {
            console.log(`✅ 数据库保存成功，影响行数: ${this.changes}`)
            resolve()
          }
        }
      )
    })
  }

  /**
   * 检查缓存是否存在
   */
  async checkCacheExists(date, pointId) {
    return new Promise((resolve, reject) => {
      const db = this.db
      
      db.get(
        'SELECT id FROM raw_data_cache WHERE bury_point_id = ? AND date = ?',
        [pointId, date],
        (err, row) => {
          if (err) {
            reject(err)
          } else {
            resolve(!!row)
          }
        }
      )
    })
  }

  /**
   * 获取最近7天的日期
   */
  getLast7Days() {
    const dates = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      dates.push(date.toISOString().split('T')[0])
    }
    return dates
  }

  /**
   * 获取最近30天的日期
   */
  getLast30Days() {
    const dates = []
    for (let i = 29; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      dates.push(date.toISOString().split('T')[0])
    }
    return dates
  }

  /**
   * 睡眠函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 手动触发预加载
   */
  async triggerPreload() {
    console.log('🔄 手动触发数据预加载...')
    await this.preloadRecentData()
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isTaskRunning: this.isTaskRunning,
      buryPointIds: this.buryPointIds,
      projectId: this.projectId,
      hasToken: !!this.accessToken
    }
  }
}

export default BackendDataPreloadService
