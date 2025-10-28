<template>
  <div class="cache-management-panel">
    <div class="panel-header">
      <div class="header-left">
        <h3 class="title">
          <DatabaseOutlined />
          数据缓存管理
        </h3>
        <div class="health-indicator">
          <div 
            class="health-dot" 
            :style="{ backgroundColor: healthStatusColor }"
          />
          <span class="health-text">{{ healthStatusText }}</span>
          <span v-if="lastCheckTime" class="last-check">
            最后检查: {{ formatTime(lastCheckTime) }}
          </span>
        </div>
      </div>
      <div class="header-actions">
        <a-button 
          size="small" 
          @click="quickCheck"
          :loading="isChecking"
        >
          <ReloadOutlined />
          快速检查
        </a-button>
        <a-dropdown>
          <template #overlay>
            <a-menu @click="handleMenuClick">
              <a-menu-item key="full-check">
                <ScanOutlined />
                完整检查
              </a-menu-item>
              <a-menu-item key="auto-fix">
                <ToolOutlined />
                自动修复
              </a-menu-item>
              <a-menu-item key="force-refresh">
                <ReloadOutlined />
                强制刷新
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item key="cache-stats">
                <BarChartOutlined />
                缓存统计
              </a-menu-item>
              <a-menu-item key="settings">
                <SettingOutlined />
                缓存设置
              </a-menu-item>
            </a-menu>
          </template>
          <a-button size="small">
            更多操作
            <DownOutlined />
          </a-button>
        </a-dropdown>
      </div>
    </div>

    <!-- 问题概览 -->
    <div v-if="issuesSummary.total > 0" class="issues-overview">
      <a-alert
        :type="healthStatus === 'critical' ? 'error' : 'warning'"
        :message="getIssuesMessage()"
        show-icon
        closable
      />
      <div class="issues-stats">
        <div v-if="issuesSummary.critical > 0" class="stat-item critical">
          <ExclamationCircleOutlined />
          <span>严重: {{ issuesSummary.critical }}</span>
        </div>
        <div v-if="issuesSummary.warning > 0" class="stat-item warning">
          <WarningOutlined />
          <span>警告: {{ issuesSummary.warning }}</span>
        </div>
        <div v-if="issuesSummary.info > 0" class="stat-item info">
          <InfoCircleOutlined />
          <span>提示: {{ issuesSummary.info }}</span>
        </div>
      </div>
    </div>

    <!-- 问题详情 -->
    <div v-if="diagnosticResults.length > 0" class="issues-detail">
      <h4>发现的问题</h4>
      <div class="issues-list">
        <div 
          v-for="(issue, index) in diagnosticResults" 
          :key="index"
          class="issue-item"
          :class="['severity-' + issue.severity.toLowerCase()]"
        >
          <div class="issue-header">
            <div class="issue-icon">
              <ExclamationCircleOutlined v-if="issue.severity === 'HIGH'" />
              <WarningOutlined v-else-if="issue.severity === 'MEDIUM'" />
              <InfoCircleOutlined v-else />
            </div>
            <div class="issue-info">
              <div class="issue-title">{{ getIssueTypeText(issue.type) }}</div>
              <div class="issue-description">{{ issue.description }}</div>
            </div>
            <div class="issue-actions">
              <a-button 
                size="small" 
                type="primary" 
                @click="fixSingleIssue(issue)"
                :loading="fixingIssues.includes(issue)"
              >
                修复
              </a-button>
            </div>
          </div>
          <div v-if="issue.dates && issue.dates.length > 0" class="issue-details">
            <span class="detail-label">影响日期:</span>
            <a-tag v-for="date in issue.dates" :key="date" size="small">
              {{ date }}
            </a-tag>
          </div>
        </div>
      </div>
    </div>

    <!-- 缓存统计 -->
    <div v-if="cacheStats" class="cache-stats">
      <h4>缓存统计</h4>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-title">埋点数量</div>
          <div class="stat-value">{{ cacheStats.totalPoints }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">缓存天数</div>
          <div class="stat-value">{{ cacheStats.cachedDays }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">总记录数</div>
          <div class="stat-value">{{ formatNumber(cacheStats.totalRecords) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">缓存效率</div>
          <div class="stat-value">
            {{ ((cacheStats.cachedDays / (cacheStats.totalPoints * 7)) * 100).toFixed(1) }}%
          </div>
        </div>
      </div>
    </div>

    <!-- 缓存设置Modal -->
    <a-modal
      v-model:open="settingsModalVisible"
      title="缓存设置"
      @ok="saveSettings"
      @cancel="settingsModalVisible = false"
    >
      <a-form layout="vertical">
        <a-form-item label="智能缓存失效">
          <a-switch 
            v-model:checked="settings.smartInvalidation"
            checked-children="启用"
            un-checked-children="禁用"
          />
          <div class="setting-description">
            启用后会自动检测缓存是否过期，确保数据新鲜度
          </div>
        </a-form-item>
        
        <a-form-item label="缓存有效期（小时）">
          <a-input-number 
            v-model:value="settings.validityPeriod"
            :min="1"
            :max="24"
            style="width: 100%"
          />
          <div class="setting-description">
            最近数据的缓存有效期，超过此时间会检查是否有更新
          </div>
        </a-form-item>
        
        <a-form-item label="自动检查">
          <a-switch 
            v-model:checked="settings.autoCheck"
            checked-children="启用"
            un-checked-children="禁用"
          />
          <div class="setting-description">
            每10分钟自动进行健康检查
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 统计详情Modal -->
    <a-modal
      v-model:open="statsModalVisible"
      title="缓存统计详情"
      width="800px"
      :footer="null"
    >
      <div v-if="detailedStats" class="detailed-stats">
        <!-- 这里可以添加更详细的统计图表 -->
        <p>详细统计功能开发中...</p>
      </div>
    </a-modal>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import { 
  DatabaseOutlined,
  ReloadOutlined,
  ScanOutlined,
  ToolOutlined,
  SettingOutlined,
  BarChartOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons-vue'
import { useDataConsistency } from '@/composables/useDataConsistency'
import { dataPreloadService } from '@/services/dataPreloadService'
import { cacheConsistencyManager } from '@/utils/cacheConsistencyManager'
import dayjs from 'dayjs'
import { useStore } from 'vuex'

export default {
  name: 'CacheManagementPanel',
  components: {
    DatabaseOutlined,
    ReloadOutlined,
    ScanOutlined,
    ToolOutlined,
    SettingOutlined,
    BarChartOutlined,
    DownOutlined,
    ExclamationCircleOutlined,
    WarningOutlined,
    InfoCircleOutlined
  },
  setup() {
    const store = useStore()
    
    const {
      isChecking,
      diagnosticResults,
      lastCheckTime,
      autoCheckEnabled,
      healthStatus,
      issuesSummary,
      healthStatusText,
      healthStatusColor,
      runFullCheck,
      quickHealthCheck,
      autoFixIssues,
      forceRefreshData,
      startAutoCheck,
      getCacheStats
    } = useDataConsistency()

    // 本地状态
    const cacheStats = ref(null)
    const settingsModalVisible = ref(false)
    const statsModalVisible = ref(false)
    const detailedStats = ref(null)
    const fixingIssues = ref([])
    
    /**
     * 获取所有配置的埋点ID
     */
    const getSelectedPointIds = () => {
      const projectConfig = store.state.projectConfig
      const pointIds = new Set()
      
      // 添加访问埋点
      if (projectConfig.visitBuryPointId) {
        pointIds.add(projectConfig.visitBuryPointId)
      }
      
      // 添加点击埋点
      if (projectConfig.clickBuryPointId) {
        pointIds.add(projectConfig.clickBuryPointId)
      }
      
      // 添加行为分析埋点
      if (projectConfig.behaviorBuryPointIds && Array.isArray(projectConfig.behaviorBuryPointIds)) {
        projectConfig.behaviorBuryPointIds.forEach(id => pointIds.add(id))
      }
      
      // 兼容旧的配置格式
      if (projectConfig.selectedBuryPointIds && Array.isArray(projectConfig.selectedBuryPointIds)) {
        projectConfig.selectedBuryPointIds.forEach(id => pointIds.add(id))
      }
      
      return Array.from(pointIds)
    }
    
    // 设置
    const settings = ref({
      smartInvalidation: true,
      validityPeriod: 4,
      autoCheck: true
    })

    // 自动检查定时器
    let autoCheckInterval = null

    /**
     * 快速检查
     */
    const quickCheck = async () => {
      await quickHealthCheck()
      await loadCacheStats()
    }

    /**
     * 处理菜单点击
     */
    const handleMenuClick = async ({ key }) => {
      switch (key) {
        case 'full-check':
          await runFullCheck()
          await loadCacheStats()
          break
        case 'auto-fix':
          await autoFixIssues()
          break
        case 'force-refresh':
          await forceRefreshData()
          break
        case 'cache-stats':
          await loadDetailedStats()
          statsModalVisible.value = true
          break
        case 'settings':
          loadSettings()
          settingsModalVisible.value = true
          break
      }
    }

    /**
     * 修复单个问题
     */
    const fixSingleIssue = async (issue) => {
      fixingIssues.value.push(issue)
      
      const hideLoading = message.loading(`正在修复: ${issue.description}...`, 0)
      
      try {
        // 获取所有配置的埋点ID
        const selectedPointIds = getSelectedPointIds()
        
        if (selectedPointIds.length === 0) {
          message.error('请先选择埋点')
          return
        }
        
        // 调用修复逻辑
        const results = await cacheConsistencyManager.autoFixIssues([issue], selectedPointIds)
        
        hideLoading()
        
        const fixedCount = results.filter(r => r.status === 'FIXED').length
        const failedCount = results.filter(r => r.status === 'FAILED').length
        
        if (fixedCount > 0) {
          message.success(`修复成功！`)
          
          // 从列表中移除已修复的问题
          const index = diagnosticResults.value.findIndex(i => 
            i.type === issue.type && 
            i.pointId === issue.pointId && 
            i.date === issue.date
          )
          if (index > -1) {
            diagnosticResults.value.splice(index, 1)
          }
          
          // 延迟重新检查
          setTimeout(() => {
            quickHealthCheck()
          }, 2000)
        } else if (failedCount > 0) {
          message.error(`修复失败，请查看控制台获取详细信息`)
        } else {
          message.warning(`无法修复此问题`)
        }
        
      } catch (error) {
        hideLoading()
        message.error(`修复失败: ${error.message}`)
        console.error('单个问题修复失败:', error)
      } finally {
        const index = fixingIssues.value.indexOf(issue)
        if (index > -1) {
          fixingIssues.value.splice(index, 1)
        }
      }
    }

    /**
     * 加载缓存统计
     */
    const loadCacheStats = async () => {
      try {
        cacheStats.value = await getCacheStats()
      } catch (error) {
        console.error('加载缓存统计失败:', error)
      }
    }

    /**
     * 加载详细统计
     */
    const loadDetailedStats = async () => {
      try {
        detailedStats.value = await getCacheStats()
      } catch (error) {
        message.error('加载详细统计失败')
      }
    }

    /**
     * 加载设置
     */
    const loadSettings = () => {
      const status = dataPreloadService.getStatus()
      settings.value = {
        smartInvalidation: status.smartInvalidationEnabled,
        validityPeriod: status.cacheValidityPeriod,
        autoCheck: autoCheckEnabled.value
      }
    }

    /**
     * 保存设置
     */
    const saveSettings = async () => {
      dataPreloadService.setSmartInvalidation(settings.value.smartInvalidation)
      dataPreloadService.setCacheValidityPeriod(settings.value.validityPeriod)
      autoCheckEnabled.value = settings.value.autoCheck
      
      // 重启自动检查
      if (autoCheckInterval) {
        clearInterval(autoCheckInterval)
      }
      if (settings.value.autoCheck) {
        autoCheckInterval = startAutoCheck()
      }
      
      // 保存到数据库
      try {
        const response = await fetch('http://localhost:3004/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            cacheConfig: {
              smartInvalidation: settings.value.smartInvalidation,
              validityPeriod: settings.value.validityPeriod,
              autoCheck: settings.value.autoCheck
            }
          })
        })
        
        if (response.ok) {
          console.log('✅ 缓存管理配置已保存到数据库')
        } else {
          console.warn('⚠️ 缓存管理配置保存到数据库失败，但已保存到本地存储')
        }
      } catch (dbError) {
        console.warn('⚠️ 数据库连接失败，缓存管理配置仅保存到本地存储:', dbError.message)
      }
      
      settingsModalVisible.value = false
      message.success('设置已保存')
    }

    /**
     * 格式化时间
     */
    const formatTime = (time) => {
      return dayjs(time).format('MM-DD HH:mm:ss')
    }

    /**
     * 格式化数字
     */
    const formatNumber = (num) => {
      return num.toLocaleString()
    }

    /**
     * 获取问题消息
     */
    const getIssuesMessage = () => {
      if (issuesSummary.value.critical > 0) {
        return `发现 ${issuesSummary.value.critical} 个严重问题，${issuesSummary.value.warning} 个警告，建议立即处理`
      }
      return `发现 ${issuesSummary.value.warning} 个警告，${issuesSummary.value.info} 个提示`
    }

    /**
     * 获取问题类型文本
     */
    const getIssueTypeText = (type) => {
      const typeMap = {
        'CACHE_MISSING': '缓存缺失',
        'DATA_COUNT_MISMATCH': '数据量不匹配',
        'DATA_FRESHNESS_ISSUE': '数据不够新鲜',
        'CACHE_EXPIRED': '缓存已过期',
        'CACHE_STALE': '缓存陈旧',
        'CONFIG_MISMATCH': '配置不匹配',
        'CONFIG_ERROR': '配置错误'
      }
      return typeMap[type] || type
    }

    // 生命周期
    onMounted(() => {
      // 初始化时进行快速检查
      setTimeout(() => {
        quickCheck()
      }, 1000)

      // 启动自动检查
      if (autoCheckEnabled.value) {
        autoCheckInterval = startAutoCheck()
      }
    })

    onUnmounted(() => {
      if (autoCheckInterval) {
        clearInterval(autoCheckInterval)
      }
    })

    return {
      // 状态
      isChecking,
      diagnosticResults,
      lastCheckTime,
      healthStatus,
      healthStatusText,
      healthStatusColor,
      issuesSummary,
      cacheStats,
      settingsModalVisible,
      statsModalVisible,
      detailedStats,
      fixingIssues,
      settings,

      // 方法
      quickCheck,
      handleMenuClick,
      fixSingleIssue,
      saveSettings,
      formatTime,
      formatNumber,
      getIssuesMessage,
      getIssueTypeText
    }
  }
}
</script>

<style scoped>
.cache-management-panel {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.header-left .title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.health-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: #666;
}

.health-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.health-text {
  font-weight: 500;
}

.last-check {
  color: #999;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.issues-overview {
  margin-bottom: 16px;
}

.issues-stats {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.stat-item.critical {
  color: #f5222d;
}

.stat-item.warning {
  color: #faad14;
}

.stat-item.info {
  color: #1890ff;
}

.issues-detail {
  margin-bottom: 16px;
}

.issues-detail h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
}

.issues-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-item {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px;
}

.issue-item.severity-high {
  border-color: #ffccc7;
  background-color: #fff2f0;
}

.issue-item.severity-medium {
  border-color: #ffe7ba;
  background-color: #fffbe6;
}

.issue-item.severity-low {
  border-color: #d6f7ff;
  background-color: #f6ffed;
}

.issue-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.issue-icon {
  margin-top: 2px;
}

.issue-info {
  flex: 1;
}

.issue-title {
  font-weight: 500;
  font-size: 13px;
}

.issue-description {
  color: #666;
  font-size: 12px;
  margin-top: 4px;
}

.issue-details {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-label {
  font-size: 12px;
  color: #999;
}

.cache-stats {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.cache-stats h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.stat-card {
  background: #fafafa;
  border-radius: 6px;
  padding: 12px;
  text-align: center;
}

.stat-title {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 500;
  color: #333;
}

.setting-description {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.detailed-stats {
  padding: 20px 0;
  text-align: center;
  color: #666;
}
</style>
