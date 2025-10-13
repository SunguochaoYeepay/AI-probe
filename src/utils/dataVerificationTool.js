/**
 * 数据准确性验证工具
 * 用于对比缓存数据与API真实数据
 */

import dayjs from 'dayjs'
import { yeepayAPI } from '@/api'
import { dataPreloadService } from '@/services/dataPreloadService'
import { chartDB } from '@/utils/indexedDBManager'

class DataVerificationTool {
  constructor() {
    this.verificationResults = []
  }

  /**
   * 验证指定日期和埋点的数据准确性
   */
  async verifyDataAccuracy(date, pointId, options = {}) {
    const { detailed = false, sampleSize = 100 } = options
    
    console.log('====================================')
    console.log(`🔍 开始验证数据准确性`)
    console.log(`📅 日期: ${date}`)
    console.log(`🎯 埋点: ${pointId}`)
    console.log('====================================')

    const result = {
      date,
      pointId,
      timestamp: new Date().toISOString(),
      checks: [],
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0
      }
    }

    try {
      // 1. 获取缓存数据
      console.log('📦 获取缓存数据...')
      const cachedData = await dataPreloadService.getCachedRawData(date, pointId)
      console.log(`  ✓ 缓存数据: ${cachedData.length} 条`)

      // 2. 获取API数据（第一页作为样本）
      console.log('📡 获取API数据...')
      const apiResponse = await yeepayAPI.searchBuryPointData({
        pageSize: 1000,
        page: 1,
        date,
        selectedPointId: pointId
      })
      const apiFirstPage = apiResponse.data?.dataList || []
      const apiTotal = apiResponse.data?.total || 0
      console.log(`  ✓ API总数: ${apiTotal} 条`)
      console.log(`  ✓ API第一页: ${apiFirstPage.length} 条`)

      // 3. 数据量对比
      const countCheck = this.checkDataCount(cachedData, apiTotal)
      result.checks.push(countCheck)
      this.updateSummary(result.summary, countCheck)

      // 4. 数据结构完整性检查
      if (cachedData.length > 0 && apiFirstPage.length > 0) {
        const structureCheck = this.checkDataStructure(cachedData[0], apiFirstPage[0])
        result.checks.push(structureCheck)
        this.updateSummary(result.summary, structureCheck)
      }

      // 5. 时间戳一致性检查
      if (cachedData.length > 0 && apiFirstPage.length > 0) {
        const timestampCheck = this.checkTimestamps(cachedData, apiFirstPage)
        result.checks.push(timestampCheck)
        this.updateSummary(result.summary, timestampCheck)
      }

      // 6. 内容抽样对比
      if (detailed && cachedData.length > 0 && apiFirstPage.length > 0) {
        const contentCheck = await this.checkContentSamples(
          cachedData, 
          apiFirstPage, 
          Math.min(sampleSize, cachedData.length)
        )
        result.checks.push(contentCheck)
        this.updateSummary(result.summary, contentCheck)
      }

      // 7. 用户去重一致性检查
      if (cachedData.length > 0 && apiFirstPage.length > 0) {
        const uniqueCheck = this.checkUniqueUsers(cachedData, apiFirstPage)
        result.checks.push(uniqueCheck)
        this.updateSummary(result.summary, uniqueCheck)
      }

      // 8. 缓存元数据检查
      const metadataCheck = await this.checkCacheMetadata(date, pointId)
      result.checks.push(metadataCheck)
      this.updateSummary(result.summary, metadataCheck)

      console.log('====================================')
      console.log(`✅ 验证完成`)
      console.log(`  通过: ${result.summary.passed}`)
      console.log(`  失败: ${result.summary.failed}`)
      console.log(`  警告: ${result.summary.warnings}`)
      console.log('====================================')

      return result

    } catch (error) {
      console.error('❌ 验证过程出错:', error)
      return {
        ...result,
        error: error.message,
        checks: [{
          name: 'verification_error',
          status: 'failed',
          message: `验证失败: ${error.message}`
        }]
      }
    }
  }

  /**
   * 检查数据量
   */
  checkDataCount(cachedData, apiTotal) {
    const cachedCount = cachedData.length
    const difference = Math.abs(cachedCount - apiTotal)
    const differencePercent = apiTotal > 0 ? (difference / apiTotal * 100).toFixed(2) : 0

    let status = 'passed'
    let message = `数据量一致: 缓存 ${cachedCount} 条 = API ${apiTotal} 条`

    if (difference > 0) {
      if (differencePercent > 10) {
        status = 'failed'
        message = `数据量严重不一致: 缓存 ${cachedCount} 条, API ${apiTotal} 条, 差异 ${difference} 条 (${differencePercent}%)`
      } else if (differencePercent > 1) {
        status = 'warning'
        message = `数据量轻微不一致: 缓存 ${cachedCount} 条, API ${apiTotal} 条, 差异 ${difference} 条 (${differencePercent}%)`
      } else {
        status = 'passed'
        message = `数据量基本一致: 缓存 ${cachedCount} 条, API ${apiTotal} 条, 差异可忽略 (${differencePercent}%)`
      }
    }

    console.log(`  ${this.getStatusIcon(status)} 数据量检查: ${message}`)

    return {
      name: 'data_count',
      status,
      message,
      details: {
        cachedCount,
        apiTotal,
        difference,
        differencePercent: parseFloat(differencePercent)
      }
    }
  }

  /**
   * 检查数据结构
   */
  checkDataStructure(cachedSample, apiSample) {
    const cachedKeys = Object.keys(cachedSample).sort()
    const apiKeys = Object.keys(apiSample).sort()

    const missingInCache = apiKeys.filter(key => !cachedKeys.includes(key))
    const extraInCache = cachedKeys.filter(key => !apiKeys.includes(key) && key !== '_buryPointId')

    let status = 'passed'
    let message = '数据结构一致'

    if (missingInCache.length > 0 || extraInCache.length > 0) {
      status = 'warning'
      message = `数据结构有差异: 缓存缺少 ${missingInCache.length} 个字段, 多出 ${extraInCache.length} 个字段`
    }

    console.log(`  ${this.getStatusIcon(status)} 数据结构检查: ${message}`)

    return {
      name: 'data_structure',
      status,
      message,
      details: {
        cachedFields: cachedKeys.length,
        apiFields: apiKeys.length,
        missingInCache,
        extraInCache
      }
    }
  }

  /**
   * 检查时间戳
   */
  checkTimestamps(cachedData, apiData) {
    const getLatestTime = (data) => {
      const times = data
        .map(d => d.createdAt)
        .filter(t => t)
        .map(t => new Date(t).getTime())
      return times.length > 0 ? Math.max(...times) : 0
    }

    const cachedLatest = getLatestTime(cachedData)
    const apiLatest = getLatestTime(apiData)
    const timeDiff = Math.abs(cachedLatest - apiLatest)
    const timeDiffMinutes = Math.round(timeDiff / (1000 * 60))

    let status = 'passed'
    let message = '时间戳一致'

    if (timeDiff > 5 * 60 * 1000) { // 超过5分钟
      status = 'warning'
      message = `时间戳有差异: ${timeDiffMinutes} 分钟`
    }

    if (timeDiff > 60 * 60 * 1000) { // 超过1小时
      status = 'failed'
      message = `时间戳严重过时: ${Math.round(timeDiffMinutes / 60)} 小时`
    }

    console.log(`  ${this.getStatusIcon(status)} 时间戳检查: ${message}`)

    return {
      name: 'timestamps',
      status,
      message,
      details: {
        cachedLatest: new Date(cachedLatest).toISOString(),
        apiLatest: new Date(apiLatest).toISOString(),
        timeDiffMinutes
      }
    }
  }

  /**
   * 检查内容样本
   */
  async checkContentSamples(cachedData, apiData, sampleSize) {
    // 随机抽样对比
    const samples = Math.min(sampleSize, Math.min(cachedData.length, apiData.length))
    let matchCount = 0
    let mismatchCount = 0

    for (let i = 0; i < samples; i++) {
      const cachedItem = cachedData[i]
      const apiItem = apiData[i]

      // 对比关键字段
      const keyFields = ['id', 'pageName', 'type', 'weCustomerKey']
      const fieldsMatch = keyFields.every(field => 
        cachedItem[field] === apiItem[field]
      )

      if (fieldsMatch) {
        matchCount++
      } else {
        mismatchCount++
      }
    }

    const matchRate = (matchCount / samples * 100).toFixed(2)
    let status = 'passed'
    let message = `内容抽样一致: ${matchCount}/${samples} (${matchRate}%)`

    if (mismatchCount > samples * 0.1) {
      status = 'failed'
      message = `内容抽样不一致: ${mismatchCount}/${samples} 不匹配`
    } else if (mismatchCount > 0) {
      status = 'warning'
      message = `内容抽样基本一致: ${mismatchCount}/${samples} 有差异`
    }

    console.log(`  ${this.getStatusIcon(status)} 内容抽样检查: ${message}`)

    return {
      name: 'content_samples',
      status,
      message,
      details: {
        sampleSize: samples,
        matchCount,
        mismatchCount,
        matchRate: parseFloat(matchRate)
      }
    }
  }

  /**
   * 检查唯一用户数
   */
  checkUniqueUsers(cachedData, apiData) {
    const getCachedUniqueUsers = () => {
      return new Set(cachedData.map(d => d.weCustomerKey).filter(k => k)).size
    }

    const getApiUniqueUsers = () => {
      return new Set(apiData.map(d => d.weCustomerKey).filter(k => k)).size
    }

    const cachedUV = getCachedUniqueUsers()
    const apiUV = getApiUniqueUsers()
    const difference = Math.abs(cachedUV - apiUV)

    let status = 'passed'
    let message = `UV一致: 缓存 ${cachedUV}, API ${apiUV}`

    if (difference > apiUV * 0.1) {
      status = 'warning'
      message = `UV有差异: 缓存 ${cachedUV}, API ${apiUV}, 差异 ${difference}`
    }

    console.log(`  ${this.getStatusIcon(status)} UV检查: ${message}`)

    return {
      name: 'unique_users',
      status,
      message,
      details: {
        cachedUV,
        apiUV,
        difference
      }
    }
  }

  /**
   * 检查缓存元数据
   */
  async checkCacheMetadata(date, pointId) {
    try {
      const cacheId = `raw_${pointId}_${date}`
      const cacheData = await chartDB.getRawDataCache(cacheId)

      if (!cacheData) {
        return {
          name: 'cache_metadata',
          status: 'failed',
          message: '缓存不存在',
          details: {}
        }
      }

      const now = new Date()
      const cachedAt = new Date(cacheData.cachedAt)
      const expiresAt = new Date(cacheData.expiresAt)
      const ageHours = ((now - cachedAt) / (1000 * 60 * 60)).toFixed(2)

      let status = 'passed'
      let message = `缓存正常: ${ageHours} 小时前创建`

      if (now > expiresAt) {
        status = 'failed'
        message = `缓存已过期: ${ageHours} 小时前创建`
      } else if (ageHours > 12) {
        status = 'warning'
        message = `缓存较旧: ${ageHours} 小时前创建`
      }

      console.log(`  ${this.getStatusIcon(status)} 缓存元数据检查: ${message}`)

      return {
        name: 'cache_metadata',
        status,
        message,
        details: {
          cachedAt: cacheData.cachedAt,
          expiresAt: cacheData.expiresAt,
          ageHours: parseFloat(ageHours),
          isExpired: now > expiresAt
        }
      }
    } catch (error) {
      return {
        name: 'cache_metadata',
        status: 'warning',
        message: `无法读取缓存元数据: ${error.message}`,
        details: {}
      }
    }
  }

  /**
   * 批量验证多天数据
   */
  async verifyMultipleDays(dates, pointIds, options = {}) {
    console.log('====================================')
    console.log(`🔍 批量验证数据准确性`)
    console.log(`📅 日期: ${dates.length} 天`)
    console.log(`🎯 埋点: ${pointIds.length} 个`)
    console.log('====================================')

    const results = []
    let totalChecks = dates.length * pointIds.length
    let currentCheck = 0

    for (const date of dates) {
      for (const pointId of pointIds) {
        currentCheck++
        console.log(`\n[${currentCheck}/${totalChecks}] 验证 ${date} - 埋点 ${pointId}`)
        
        const result = await this.verifyDataAccuracy(date, pointId, options)
        results.push(result)

        // 短暂延迟，避免API请求过快
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    // 汇总结果
    const summary = this.summarizeResults(results)

    console.log('\n====================================')
    console.log('📊 批量验证汇总')
    console.log(`  总验证数: ${results.length}`)
    console.log(`  全部通过: ${summary.allPassed}`)
    console.log(`  有警告: ${summary.hasWarnings}`)
    console.log(`  有失败: ${summary.hasFailed}`)
    console.log('====================================')

    return {
      results,
      summary
    }
  }

  /**
   * 汇总验证结果
   */
  summarizeResults(results) {
    return {
      total: results.length,
      allPassed: results.filter(r => r.summary.failed === 0 && r.summary.warnings === 0).length,
      hasWarnings: results.filter(r => r.summary.warnings > 0).length,
      hasFailed: results.filter(r => r.summary.failed > 0).length
    }
  }

  /**
   * 更新统计
   */
  updateSummary(summary, check) {
    if (check.status === 'passed') {
      summary.passed++
    } else if (check.status === 'warning') {
      summary.warnings++
    } else if (check.status === 'failed') {
      summary.failed++
    }
  }

  /**
   * 获取状态图标
   */
  getStatusIcon(status) {
    switch (status) {
      case 'passed': return '✅'
      case 'warning': return '⚠️'
      case 'failed': return '❌'
      default: return '❓'
    }
  }

  /**
   * 生成验证报告
   */
  generateReport(verificationResults) {
    const report = {
      timestamp: new Date().toISOString(),
      totalChecks: verificationResults.checks.length,
      summary: verificationResults.summary,
      details: verificationResults.checks.map(check => ({
        name: check.name,
        status: check.status,
        message: check.message
      })),
      recommendation: this.getRecommendation(verificationResults)
    }

    return report
  }

  /**
   * 获取建议
   */
  getRecommendation(results) {
    if (results.summary.failed > 0) {
      return '发现严重问题，建议立即强制刷新缓存'
    } else if (results.summary.warnings > 0) {
      return '发现轻微问题，建议在空闲时刷新缓存'
    } else {
      return '数据一致性良好，无需操作'
    }
  }
}

export const dataVerificationTool = new DataVerificationTool()

