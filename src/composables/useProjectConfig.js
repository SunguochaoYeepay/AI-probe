import { ref, computed } from 'vue'
import { useStore } from 'vuex'
import { probeService } from '@/api/probeService'
import { API_CONFIG } from '@/config/api'

/**
 * 动态项目配置管理 Composable
 */
export function useProjectConfig() {
  const store = useStore()
  
  // 响应式状态
  const projects = ref([])
  const currentProject = ref(null)
  const currentBuryPoints = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // 计算属性
  const availableProjects = computed(() => projects.value)
  const selectedProject = computed(() => currentProject.value)
  const selectedBuryPoints = computed(() => currentBuryPoints.value)
  const hasVisitPoint = computed(() => currentBuryPoints.value?.hasVisitPoint || false)
  const hasClickPoint = computed(() => currentBuryPoints.value?.hasClickPoint || false)
  const supportDualBuryPoint = computed(() => currentBuryPoints.value?.supportDualBuryPoint || false)
  
  // 当前埋点配置
  const visitPoint = computed(() => currentBuryPoints.value?.visitPoint)
  const clickPoint = computed(() => currentBuryPoints.value?.clickPoint)

  /**
   * 初始化 Probe 服务
   */
  const initProbeService = () => {
    // 从 store 中直接获取访问令牌
    const accessToken = store.state.apiConfig.accessToken
    if (accessToken) {
      probeService.setToken(accessToken)
      console.log('Probe 服务已初始化，使用当前环境的访问令牌')
    } else {
      console.warn('未找到访问令牌，Probe 服务初始化失败')
    }
  }

  /**
   * 加载项目列表
   */
  const loadProjects = async () => {
    try {
      loading.value = true
      error.value = null
      
      initProbeService()
      const projectList = await probeService.getProjectList()
      projects.value = projectList
      
      console.log(`加载项目列表成功: ${projectList.length} 个项目`)
      return projectList
    } catch (err) {
      error.value = err.message
      console.error('加载项目列表失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 选择项目
   * @param {string} projectId - 项目ID
   */
  const selectProject = async (projectId) => {
    try {
      loading.value = true
      error.value = null
      
      console.log(`选择项目: ${projectId}`)
      
      // 获取项目完整配置
      const config = await probeService.getProjectFullConfig(projectId)
      
      currentProject.value = {
        id: projectId,
        name: projects.value.find(p => p.id === projectId)?.name || projectId
      }
      currentBuryPoints.value = config
      
      // 检查是否已有正确的数据库配置（175, 172）
      const currentProjectConfig = store.state.projectConfig
      const hasCorrectDatabaseConfig = currentProjectConfig.visitBuryPointId === 175 && currentProjectConfig.clickBuryPointId === 172
      
      if (hasCorrectDatabaseConfig) {
        console.log('🔒 检测到数据库配置，保持现有配置不变')
        console.log('📊 当前数据库配置:', {
          visitBuryPointId: currentProjectConfig.visitBuryPointId,
          clickBuryPointId: currentProjectConfig.clickBuryPointId,
          behaviorBuryPointIds: currentProjectConfig.behaviorBuryPointIds
        })
        
        // 只更新项目基本信息，不覆盖埋点配置
        store.dispatch('updateProjectConfig', {
          projectId,
          buryPoints: config.buryPoints,
          hasVisitPoint: config.hasVisitPoint,
          hasClickPoint: config.hasClickPoint,
          supportDualBuryPoint: config.supportDualBuryPoint
        })
      } else {
        console.log('📥 无数据库配置，使用API配置')
        // 更新 Vuex 状态（包括埋点ID）
        store.dispatch('updateProjectConfig', {
          projectId,
          buryPoints: config.buryPoints,
          visitPoint: config.visitPoint,
          clickPoint: config.clickPoint,
          hasVisitPoint: config.hasVisitPoint,
          hasClickPoint: config.hasClickPoint,
          supportDualBuryPoint: config.supportDualBuryPoint,
          // 设置埋点ID
          visitBuryPointId: config.visitPoint?.id || null,
          clickBuryPointId: config.clickPoint?.id || null
        })
        
        // 强制设置默认选择点击埋点
        if (config.clickPoint?.id) {
          store.dispatch('updateApiConfig', {
            selectedPointId: config.clickPoint.id
          })
          console.log('✅ 强制设置默认选择点击埋点:', config.clickPoint.id)
        } else if (config.visitPoint?.id) {
          store.dispatch('updateApiConfig', {
            selectedPointId: config.visitPoint.id
          })
          console.log('✅ 强制设置默认选择访问埋点:', config.visitPoint.id)
        }
      }
      
      console.log('项目配置更新成功:', {
        projectId,
        visitPoint: config.visitPoint ? `${config.visitPoint.name} (ID: ${config.visitPoint.id})` : '无',
        clickPoint: config.clickPoint ? `${config.clickPoint.name} (ID: ${config.clickPoint.id})` : '无',
        supportDualBuryPoint: config.supportDualBuryPoint
      })
      
      return config
    } catch (err) {
      error.value = err.message
      console.error(`选择项目 ${projectId} 失败:`, err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据埋点类型获取埋点ID
   * @param {string} type - 埋点类型 ('visit' | 'click')
   * @returns {number|null} 埋点ID
   */
  const getBuryPointId = (type) => {
    if (!currentBuryPoints.value) {
      // 使用默认配置
      return API_CONFIG.defaultBuryPoints[type]?.id || null
    }
    
    const point = type === 'visit' ? visitPoint.value : clickPoint.value
    return point?.id || null
  }

  /**
   * 根据分析模式获取埋点ID
   * @param {string} analysisMode - 分析模式 ('single' | 'dual')
   * @returns {Object} 埋点配置
   */
  const getBuryPointsByMode = (analysisMode) => {
    if (!currentBuryPoints.value) {
      // 使用默认配置
      return {
        visit: API_CONFIG.defaultBuryPoints.visit.id,
        click: API_CONFIG.defaultBuryPoints.click.id
      }
    }
    
    if (analysisMode === 'dual') {
      return {
        visit: visitPoint.value?.id,
        click: clickPoint.value?.id
      }
    } else {
      // 单埋点模式，优先使用访问埋点
      return {
        visit: visitPoint.value?.id || clickPoint.value?.id
      }
    }
  }

  /**
   * 自动选择项目（使用默认项目）
   */
  const autoSelectProject = async () => {
    const defaultProjectId = API_CONFIG.dynamic.defaultProjectId
    try {
      await selectProject(defaultProjectId)
      console.log(`自动选择默认项目: ${defaultProjectId}`)
    } catch (err) {
      console.error(`自动选择项目失败:`, err)
      // 如果自动选择失败，使用默认配置
      currentProject.value = { id: defaultProjectId, name: defaultProjectId }
      currentBuryPoints.value = {
        projectId: defaultProjectId,
        buryPoints: [],
        visitPoint: API_CONFIG.defaultBuryPoints.visit,
        clickPoint: API_CONFIG.defaultBuryPoints.click,
        hasVisitPoint: true,
        hasClickPoint: true,
        supportDualBuryPoint: true
      }
    }
  }

  /**
   * 刷新当前项目配置
   */
  const refreshCurrentProject = async () => {
    if (currentProject.value?.id) {
      return await selectProject(currentProject.value.id)
    }
  }

  /**
   * 验证项目配置是否完整
   * @param {string} analysisMode - 分析模式
   * @returns {Object} 验证结果
   */
  const validateProjectConfig = (analysisMode) => {
    if (!currentBuryPoints.value) {
      return {
        valid: false,
        message: '项目配置未加载'
      }
    }

    if (analysisMode === 'dual') {
      if (!hasVisitPoint.value || !hasClickPoint.value) {
        return {
          valid: false,
          message: '双埋点模式需要访问和点击埋点，当前项目配置不完整'
        }
      }
    } else {
      if (!hasVisitPoint.value && !hasClickPoint.value) {
        return {
          valid: false,
          message: '单埋点模式需要至少一个埋点，当前项目配置不完整'
        }
      }
    }

    return {
      valid: true,
      message: '项目配置验证通过'
    }
  }

  return {
    // 状态
    projects: availableProjects,
    currentProject: selectedProject,
    currentBuryPoints: selectedBuryPoints,
    loading,
    error,
    
    // 计算属性
    hasVisitPoint,
    hasClickPoint,
    supportDualBuryPoint,
    visitPoint,
    clickPoint,
    
    // 方法
    loadProjects,
    selectProject,
    autoSelectProject,
    refreshCurrentProject,
    getBuryPointId,
    getBuryPointsByMode,
    validateProjectConfig,
    initProbeService
  }
}