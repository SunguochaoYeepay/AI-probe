/**
 * 定时更新服务
 * 负责按天定时拉取、计算并存储图表数据
 */

import { yeepayAPI } from '@/api'
import { backendChartService as chartDB } from '@/services/backendChartService'
import { aggregationService } from '@/utils/aggregationService'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'

/**
 * 格式化最后更新时间
 * @param {string} date - 日期字符串 (YYYY-MM-DD)
 * @returns {string} - 格式化的时间戳 (YYYY-MM-DD HH:mm:ss)
 */
function formatLastUpdateTime(date) {
  return dayjs(date).endOf('day').format('YYYY-MM-DD HH:mm:ss')
}

class ScheduledUpdateService {
  constructor() {
    this.isRunning = false
    this.updateInterval = null
    this.lastUpdateTime = null
    this.updateQueue = new Map() // 存储待更新的图表任务
  }

  /**
   * 启动定时更新服务
   */
  start() {
    if (this.isRunning) {
      console.log('⏰ 定时更新服务已在运行')
      return
    }

    console.log('🚀 启动定时更新服务...')
    this.isRunning = true

    // 立即执行一次检查
    this.checkAndUpdate()

    // 设置定时检查（每小时检查一次）
    this.updateInterval = setInterval(() => {
      this.checkAndUpdate()
    }, 60 * 60 * 1000) // 1小时

    console.log('✅ 定时更新服务已启动')
  }

  /**
   * 停止定时更新服务
   */
  stop() {
    if (!this.isRunning) {
      return
    }

    console.log('⏹️ 停止定时更新服务...')
    this.isRunning = false

    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }

    console.log('✅ 定时更新服务已停止')
  }

  /**
   * 检查并更新所有需要更新的图表
   * @param {boolean} isManualUpdate - 是否为手动更新，手动更新时会更新最近7天
   */
  async checkAndUpdate(isManualUpdate = false) {
    try {
      console.log(`🔍 检查需要更新的图表... (${isManualUpdate ? '手动更新' : '定时更新'})`)
      
      // 获取所有激活的图表
      const charts = await chartDB.getAllCharts({ status: 'active' })
      console.log(`📊 找到 ${charts.length} 个激活图表`)

      if (charts.length === 0) {
        console.log('📭 没有需要更新的图表')
        return
      }

      // 检查每个图表是否需要更新
      const chartsToUpdate = []
      const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
      const today = dayjs().format('YYYY-MM-DD')

      for (const chart of charts) {
        console.log(`🔍 检查图表: ${chart.name} (ID: ${chart.id})`)
        console.log(`  - 定时更新启用: ${chart.config?.scheduledUpdate?.enabled}`)
        
        // 检查是否启用了定时更新
        let isScheduledUpdateEnabled = chart.config?.scheduledUpdate?.enabled
        
        // 兼容旧的配置格式
        if (isScheduledUpdateEnabled === undefined && chart.updateStrategy?.enabled) {
          isScheduledUpdateEnabled = chart.updateStrategy.enabled
          console.log(`  - 使用旧配置格式: ${isScheduledUpdateEnabled}`)
        }
        
        // 如果都没有配置，默认启用定时更新
        if (isScheduledUpdateEnabled === undefined) {
          isScheduledUpdateEnabled = true
          console.log(`  - 默认启用定时更新`)
          
          // 更新图表配置，添加scheduledUpdate配置
          try {
            await chartDB.updateChart(chart.id, {
              config: {
                ...chart.config,
                scheduledUpdate: {
                  enabled: true,
                  frequency: 'daily',
                  time: '01:00',
                  maxHistoryDays: 365,
                  batchSize: 10
                }
              }
            })
            console.log(`  - 已更新图表配置，添加定时更新设置`)
          } catch (error) {
            console.warn(`  - 更新图表配置失败:`, error)
          }
        }
        
        if (!isScheduledUpdateEnabled) {
          console.log(`  - 跳过: 定时更新未启用`)
          continue
        }

        if (isManualUpdate) {
          // 🚀 手动更新：维护滚动窗口（最近7天），立即查看时确保数据完整
          const windowSize = 7 // 滚动窗口大小：7天
          const windowDates = []
          for (let i = windowSize - 1; i >= 0; i--) {
            windowDates.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'))
          }
          
          console.log(`📅 手动更新：检查滚动窗口（最近${windowSize}天）: ${windowDates.join(', ')}`)
          
          for (const date of windowDates) {
            const hasData = await chartDB.hasChartData(chart.id, date)
            // 检查数据是否有效（不是空数据）
            const isValidData = await this.hasValidChartData(chart.id, date)

            console.log(`  - ${date} 数据: ${hasData ? '存在' : '缺失'}, 有效: ${isValidData ? '是' : '否'}`)

            const alreadyQueued = chartsToUpdate.some(task => task.chart.id === chart.id && task.date === date)
            if (!alreadyQueued) {
              chartsToUpdate.push({
                chart,
                date,
                priority: 'high', // 手动更新时都是高优先级
                forceRefresh: true
              })
              if (hasData && isValidData) {
                console.log(`  - 添加更新任务: ${date}（强制刷新）`)
              } else {
                console.log(`  - 添加更新任务: ${date}`)
              }
            }
          }
        } else {
          // 🚀 定时更新：增量更新 - 每天只更新昨天的数据
          // 这是正确的逻辑：历史数据持续累积，50天后应该有50天的数据
          console.log(`📅 定时更新：增量更新昨天数据 (${yesterday})`)
          
          const hasYesterdayData = await chartDB.hasChartData(chart.id, yesterday)
          const isValidYesterdayData = await this.hasValidChartData(chart.id, yesterday)
          
          console.log(`  - 昨天数据 (${yesterday}): ${hasYesterdayData ? '存在' : '缺失'}, 有效: ${isValidYesterdayData ? '是' : '否'}`)
          
          // 如果昨天的数据不存在或无效，添加到更新列表
          if (!hasYesterdayData || !isValidYesterdayData) {
            chartsToUpdate.push({
              chart,
              date: yesterday,
              priority: 'high' // 昨天的数据，高优先级
            })
            console.log(`  - 添加更新任务: 昨天数据`)
          }
          
          // 可选：检查今天的数据（如果今天已经有数据了）
          const hasTodayData = await chartDB.hasChartData(chart.id, today)
          if (!hasTodayData) {
            // 今天的数据优先级较低，因为可能还在收集中
            chartsToUpdate.push({
              chart,
              date: today,
              priority: 'normal'
            })
            console.log(`  - 添加更新任务: 今天数据（可选）`)
          }
        }

        // 检查是否有历史数据需要补充
        if (chart.dataRange?.pendingDays > 0) {
          const pendingDates = this.getPendingDates(chart)
          for (const date of pendingDates.slice(0, chart.config.scheduledUpdate.batchSize || 10)) {
            chartsToUpdate.push({
              chart,
              date,
              priority: 'low' // 历史数据补充，低优先级
            })
          }
        }
      }

      console.log(`📋 需要更新的任务: ${chartsToUpdate.length} 个`)

      if (chartsToUpdate.length === 0) {
        console.log('✅ 所有图表数据都是最新的')
        return
      }

      // 按优先级排序：高优先级（今天、昨天）优先处理，然后是普通优先级，最后是低优先级
      chartsToUpdate.sort((a, b) => {
        const priorityOrder = { 'high': 0, 'normal': 1, 'low': 2 }
        const orderA = priorityOrder[a.priority] || 1
        const orderB = priorityOrder[b.priority] || 1
        if (orderA !== orderB) return orderA - orderB
        // 相同优先级时，按日期排序（新的日期优先）
        return b.date.localeCompare(a.date)
      })

      // 批量更新
      await this.batchUpdateCharts(chartsToUpdate)

    } catch (error) {
      console.error('❌ 定时更新检查失败:', error)
    }
  }

  /**
   * 获取图表待补充的历史日期
   */
  getPendingDates(chart) {
    const pendingDates = []
    const totalDays = chart.dataRange?.totalDays || 0
    const initialDays = chart.dataRange?.initialDays || 0
    const lastUpdate = chart.dataRange?.lastDataUpdate

    if (totalDays <= initialDays) {
      return pendingDates
    }

    // 从最早日期开始补充
    const startDate = dayjs().subtract(totalDays, 'day')
    const endDate = dayjs(lastUpdate || dayjs().subtract(initialDays, 'day'))

    let currentDate = startDate
    while (currentDate.isBefore(endDate)) {
      const dateStr = currentDate.format('YYYY-MM-DD')
      pendingDates.push(dateStr)
      currentDate = currentDate.add(1, 'day')
    }

    return pendingDates
  }

  /**
   * 批量更新图表
   */
  async batchUpdateCharts(updateTasks) {
    console.log(`🔄 开始批量更新 ${updateTasks.length} 个任务...`)

    // 按项目分组，优化API调用
    const tasksByProject = new Map()
    for (const task of updateTasks) {
      // 🚀 修复：添加防护代码，检查对象是否存在
      if (!task || !task.chart || !task.chart.config || !task.chart.config.dataSource) {
        console.warn('⚠️ [ScheduledUpdateService] 跳过无效的图表任务:', task)
        continue
      }
      
      const projectId = task.chart.config.dataSource.projectId
      if (!projectId) {
        console.warn('⚠️ [ScheduledUpdateService] 图表缺少 projectId:', task.chart.id)
        continue
      }
      
      if (!tasksByProject.has(projectId)) {
        tasksByProject.set(projectId, [])
      }
      tasksByProject.get(projectId).push(task)
    }

    console.log(`📦 按项目分组: ${tasksByProject.size} 个项目`)

    let successCount = 0
    let failCount = 0

    // 逐个项目更新
    for (const [projectId, tasks] of tasksByProject) {
      try {
        console.log(`🔄 更新项目 ${projectId} 的 ${tasks.length} 个任务`)
        
        // 🚀 修复：按日期和埋点ID分组，确保每个埋点使用正确的数据
        const tasksByDateAndPoint = new Map()
        for (const task of tasks) {
          const selectedPointId = task.chart.config.dataSource.selectedPointId
          const key = `${task.date}_${selectedPointId}`
          if (!tasksByDateAndPoint.has(key)) {
            tasksByDateAndPoint.set(key, {
              date: task.date,
              selectedPointId: selectedPointId,
              tasks: []
            })
          }
          tasksByDateAndPoint.get(key).tasks.push(task)
        }

        // 逐天、逐埋点更新
        for (const [key, group] of tasksByDateAndPoint) {
          try {
            const { date, selectedPointId, tasks: dayTasks } = group
            // 获取该日期和埋点的原始数据
            const { data: rawData, dataAvailable } = await this.fetchDayData({
              date,
              projectId,
              selectedPointId
            })

            // 🚀 修复：如果后端缓存没有数据（404），跳过保存，等待下次重试
            if (!dataAvailable) {
              console.log(`⏸️ ${date} 后端缓存数据尚未准备好，跳过保存，等待下次重试`)
              // 不增加失败计数，因为这是正常的延迟情况
              continue
            }

            // 为每个图表聚合数据
            for (const task of dayTasks) {
              try {
                console.log(`🔧 开始聚合图表数据: ${task.chart.name} (${date})`)
                console.log(`  - 原始数据量: ${rawData.length}条`)
                console.log(`  - 图表配置:`, task.chart.config)
                
                const aggregated = aggregationService.aggregateForChart(
                  rawData,
                  task.chart.config,
                  date
                )

                console.log(`  - 聚合结果:`, aggregated)

                // 🚀 修复：如果原始数据为空且是过滤后为空，检查是否需要保存
                // 如果原始数据量>0但过滤后为0，说明过滤条件不匹配，保存空记录用于记录
                // 如果原始数据量为0，说明后端确实没有数据，不应该保存
                if (aggregated.metadata?.rawRecordCount === 0 && rawData.length === 0) {
                  console.log(`⏸️ ${task.chart.name} (${date}) 后端确实无数据，跳过保存空记录，等待数据准备`)
                  continue
                }

                await chartDB.saveChartData({
                  chartId: task.chart.id,
                  date: date,
                  ...aggregated
                })

                // 更新图表的数据范围信息
                await this.updateChartDataRange(task.chart, date)

                successCount++
                console.log(`  ✅ ${task.chart.name} (${date}) 更新成功`)

              } catch (error) {
                failCount++
                console.error(`  ❌ ${task.chart.name} (${date}) 更新失败:`, error)
              }
            }

          } catch (error) {
            console.error(`❌ 获取 ${date} 数据失败:`, error)
            failCount += dayTasks.length
          }
        }

      } catch (error) {
        console.error(`❌ 更新项目 ${projectId} 失败:`, error)
        failCount += tasks.length
      }
    }

    console.log(`✅ 批量更新完成: 成功 ${successCount} 个，失败 ${failCount} 个`)
    
    // 显示更新结果
    if (successCount > 0) {
      message.success(`定时更新完成: ${successCount} 个图表已更新`)
    }
    if (failCount > 0) {
      message.warning(`定时更新部分失败: ${failCount} 个任务失败`)
    }

    this.lastUpdateTime = new Date().toISOString()
  }

  /**
   * 获取指定日期的原始数据
   * @returns {Object} { data: Array, dataAvailable: boolean } - 数据和数据是否可用的标志
   */
  async fetchDayData({ date, projectId, selectedPointId }) {
    console.log(`📡 从后端SQLite获取 ${date} 的原始数据...`)
    
    // 🚀 修复：使用后端SQLite缓存，不再直接调用API
    const { dataPreloadService } = await import('@/services/dataPreloadService')
    
    // 🚀 修复：检查后端缓存是否存在，区分404和数据为空
    try {
      // 使用debugMode获取更详细的信息
      const response = await dataPreloadService.getBackendCachedData(date, selectedPointId, true)
      
      // 如果响应是数组且长度>0，说明有数据
      if (Array.isArray(response) && response.length > 0) {
        console.log(`✅ 从后端SQLite获取到 ${response.length} 条数据`)
        
        // 🚀 如果数据量达到10000条，可能需要分页获取更多数据
        if (response.length >= 10000) {
          console.warn(`⚠️ 数据量达到上限 (${response.length}条)，可能存在数据截断`)
        }
        
        return { data: response, dataAvailable: true }
      } else {
        // 数组为空，说明后端缓存存在但数据为空（可能是该日期真的没有数据）
        console.log(`⚠️ 后端缓存存在但数据为空 (${date})，可能是该日期确实没有数据`)
        return { data: [], dataAvailable: true } // 缓存存在但为空，可以保存空记录表示该日期无数据
      }
    } catch (error) {
      // 检查是否是404错误（后端缓存不存在）
      if (error.isNotFound || error.status === 404 || (error.message && error.message.includes('404'))) {
        console.log(`⏸️ 后端缓存不存在 (${date})，数据尚未准备好，等待下次重试`)
        return { data: [], dataAvailable: false } // 缓存不存在，不保存，等待重试
      }
      // 其他错误，输出错误但不保存
      console.error(`❌ 获取后端缓存数据失败:`, error)
      return { data: [], dataAvailable: false } // 发生错误时也不保存，等待重试
    }
  }


  /**
   * 检查图表数据是否有效（不是空数据）
   * @param {string} chartId - 图表ID
   * @param {string} date - 日期
   * @returns {boolean} 数据是否有效
   */
  async hasValidChartData(chartId, date) {
    try {
      const data = await chartDB.getChartData(chartId, {
        startDate: date,
        endDate: date,
        limit: 1
      })
      
      if (!data || data.length === 0) {
        return false
      }
      
      // 检查数据是否有效（metadata中的rawRecordCount > 0）
      const firstData = data[0]
      const metadata = firstData.metadata || {}
      const rawRecordCount = metadata.rawRecordCount || 0
      
      // 如果rawRecordCount为0，说明是空数据
      return rawRecordCount > 0
    } catch (error) {
      console.error(`检查数据有效性失败:`, error)
      return false
    }
  }

  /**
   * 更新图表的数据范围信息
   */
  async updateChartDataRange(chart, newDate) {
    const dataRange = chart.dataRange || {}
    
    // 更新最后数据更新时间
    // 设置为当天的结束时间（23:59:59），表示该天的数据已完整
    dataRange.lastDataUpdate = formatLastUpdateTime(newDate)
    
    // 减少待补充天数
    if (dataRange.pendingDays > 0) {
      dataRange.pendingDays--
    }
    
    // 增加已保存天数
    dataRange.initialDays = (dataRange.initialDays || 0) + 1

    // 更新图表配置
    await chartDB.updateChart(chart.id, {
      dataRange: dataRange,
      updatedAt: new Date().toISOString()
    })
  }

  /**
   * 手动触发更新
   * 🚀 修复：手动更新时，更新最近7天的数据，而不仅仅是昨天和今天
   */
  async manualUpdate() {
    console.log('🔧 手动触发定时更新...')
    await this.checkAndUpdate(true) // 传入true表示手动更新
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastUpdateTime: this.lastUpdateTime,
      updateQueueSize: this.updateQueue.size
    }
  }
}

// 创建单例
export const scheduledUpdateService = new ScheduledUpdateService()

// 在应用启动时自动启动服务
if (typeof window !== 'undefined') {
  // 延迟启动，确保其他服务已初始化
  setTimeout(() => {
    scheduledUpdateService.start()
  }, 5000)
}
