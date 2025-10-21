/**
 * 定时更新服务
 * 负责按天定时拉取、计算并存储图表数据
 */

import { yeepayAPI } from '@/api'
import { chartDB } from '@/utils/indexedDBManager'
import { aggregationService } from '@/utils/aggregationService'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'

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
   */
  async checkAndUpdate() {
    try {
      console.log('🔍 检查需要更新的图表...')
      
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

      for (const chart of charts) {
        // 检查是否启用了定时更新
        if (!chart.config?.scheduledUpdate?.enabled) {
          continue
        }

        // 检查昨天的数据是否存在
        const hasYesterdayData = await chartDB.hasChartData(chart.id, yesterday)
        if (!hasYesterdayData) {
          chartsToUpdate.push({
            chart,
            date: yesterday,
            priority: 'high' // 昨天数据缺失，高优先级
          })
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

      // 按优先级排序：高优先级（昨天数据）优先处理
      chartsToUpdate.sort((a, b) => {
        if (a.priority === 'high' && b.priority === 'low') return -1
        if (a.priority === 'low' && b.priority === 'high') return 1
        return 0
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
      const projectId = task.chart.config.dataSource.projectId
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
        
        // 按日期分组，同一天的数据只获取一次
        const tasksByDate = new Map()
        for (const task of tasks) {
          if (!tasksByDate.has(task.date)) {
            tasksByDate.set(task.date, [])
          }
          tasksByDate.get(task.date).push(task)
        }

        // 逐天更新
        for (const [date, dayTasks] of tasksByDate) {
          try {
            // 获取该日期的原始数据（只获取一次）
            const rawData = await this.fetchDayData({
              date,
              projectId,
              selectedPointId: dayTasks[0].chart.config.dataSource.selectedPointId
            })

            // 为每个图表聚合数据
            for (const task of dayTasks) {
              try {
                const aggregated = aggregationService.aggregateForChart(
                  rawData,
                  task.chart.config,
                  date
                )

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
   */
  async fetchDayData({ date, projectId, selectedPointId }) {
    console.log(`📡 获取 ${date} 的原始数据...`)
    
    const response = await yeepayAPI.searchBuryPointData({
      date: date,
      pageSize: 1000,
      projectId: projectId,
      selectedPointId: selectedPointId
    })
    
    const data = response.data?.dataList || []
    console.log(`✅ 获取到 ${data.length} 条数据`)
    
    return data
  }

  /**
   * 更新图表的数据范围信息
   */
  async updateChartDataRange(chart, newDate) {
    const dataRange = chart.dataRange || {}
    
    // 更新最后数据更新时间
    dataRange.lastDataUpdate = newDate
    
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
   */
  async manualUpdate() {
    console.log('🔧 手动触发定时更新...')
    await this.checkAndUpdate()
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
