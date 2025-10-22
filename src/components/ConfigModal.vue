<template>
  <a-modal
    v-model:open="visible"
    title="系统配置管理"
    width="700px"
    @ok="handleSave"
    @cancel="handleCancel"
  >
    <a-tabs>
      <a-tab-pane key="project" tab="项目配置">
        <a-form :model="projectConfigForm" layout="vertical">
          <!-- 项目选择 -->
          <a-form-item label="当前项目">
            <div class="project-selection-container">
              <!-- 项目选择器 -->
              <div v-if="availableProjects.length > 0" class="project-selection">
                <div class="project-select-wrapper">
                  <a-select
                    v-model:value="projectConfigForm.selectedProjectId"
                    placeholder="请选择项目"
                    @change="onProjectSelect"
                    show-search
                    :filter-option="filterProject"
                  >
                    <a-select-option
                      v-for="project in availableProjects"
                      :key="project.id"
                      :value="project.id"
                    >
                      <div class="project-option">
                        <span class="project-name">{{ project.name }}</span>
                        <span class="project-team">({{ project.teamName }})</span>
                      </div>
                    </a-select-option>
                  </a-select>
                  <a-button 
                    @click="refreshProjects" 
                    :loading="projectLoading"
                    style="margin-left: 8px;"
                  >
                    <template #icon><ReloadOutlined /></template>
                    刷新
                  </a-button>
                </div>
              </div>
              
              <!-- 手动输入项目ID（当项目列表为空时） -->
              <div v-else class="manual-input">
                <a-input 
                  v-model:value="projectConfigForm.selectedProjectId" 
                  placeholder="请输入项目ID (如: event1021)"
                  @change="onProjectSelect"
                />
                <div style="color: #999; font-size: 12px; margin-top: 4px;">
                  手动输入项目ID，或点击下方按钮加载项目列表
                </div>
                <a-button 
                  size="small" 
                  @click="refreshProjects" 
                  :loading="projectLoading"
                  style="margin-top: 8px;"
                >
                  <template #icon><ReloadOutlined /></template>
                  加载项目列表
                </a-button>
              </div>
            </div>
          </a-form-item>
          
          <!-- 访问埋点配置 -->
          <a-form-item v-if="currentBuryPoints?.buryPoints?.length > 0" label="访问埋点">
            <a-select
              v-model:value="visitBuryPointId"
              placeholder="请选择访问埋点"
              style="width: 100%"
              @change="onVisitBuryPointChange"
              show-search
              :filter-option="filterBuryPoint"
              allow-clear
            >
              <a-select-option
                v-for="point in currentBuryPoints.buryPoints"
                :key="point.id"
                :value="point.id"
              >
                <div class="bury-point-option">
                  <span class="bury-point-name">{{ point.name }}</span>
                  <span class="bury-point-id">(ID: {{ point.id }})</span>
                </div>
              </a-select-option>
            </a-select>
            <div style="color: #999; font-size: 12px; margin-top: 4px;">
              选择用于记录页面访问行为的埋点
            </div>
          </a-form-item>

          <!-- 点击埋点配置 -->
          <a-form-item v-if="currentBuryPoints?.buryPoints?.length > 0" label="点击埋点">
            <a-select
              v-model:value="clickBuryPointId"
              placeholder="请选择点击埋点"
              style="width: 100%"
              @change="onClickBuryPointChange"
              show-search
              :filter-option="filterBuryPoint"
              allow-clear
            >
              <a-select-option
                v-for="point in currentBuryPoints.buryPoints"
                :key="point.id"
                :value="point.id"
              >
                <div class="bury-point-option">
                  <span class="bury-point-name">{{ point.name }}</span>
                  <span class="bury-point-id">(ID: {{ point.id }})</span>
                </div>
              </a-select-option>
            </a-select>
            <div style="color: #999; font-size: 12px; margin-top: 4px;">
              选择用于记录按钮点击行为的埋点
            </div>
          </a-form-item>

          <!-- 行为分析埋点配置 -->
          <a-form-item v-if="currentBuryPoints?.buryPoints?.length > 0" label="行为分析埋点">
            <a-select
              v-model:value="behaviorBuryPointIds"
              placeholder="请选择行为分析埋点（可多选）"
              style="width: 100%"
              @change="onBehaviorBuryPointChange"
              show-search
              :filter-option="filterBuryPoint"
              allow-clear
              mode="multiple"
              :max-tag-count="3"
            >
              <a-select-option
                v-for="point in currentBuryPoints.buryPoints"
                :key="point.id"
                :value="point.id"
              >
                <div class="bury-point-option">
                  <span class="bury-point-name">{{ point.name }}</span>
                  <span class="bury-point-id">(ID: {{ point.id }})</span>
                </div>
              </a-select-option>
            </a-select>
            <div style="color: #999; font-size: 12px; margin-top: 4px;">
              选择用于记录用户行为分析的埋点，支持多选
            </div>
          </a-form-item>
          
          <a-form-item label="访问令牌">
            <a-input-password v-model:value="projectConfigForm.accessToken" autocomplete="current-password" />
            <div style="color: #999; font-size: 12px; margin-top: 4px;">
              用于访问Probe API的访问令牌
            </div>
          </a-form-item>
        </a-form>
        
        <!-- 数据预加载操作 -->
        <a-divider>数据预加载</a-divider>
        <div class="data-preload-section">
          <a-alert
            message="数据预加载"
            description="配置完成后，可以预加载最近7天的数据到本地缓存，减少后续API调用次数。"
            type="info"
            show-icon
            style="margin-bottom: 16px;"
          />
          <a-button 
            type="primary" 
            @click="triggerDataPreload"
            :loading="false"
            block
          >
            <template #icon><DownloadOutlined /></template>
            启动数据预加载
          </a-button>
        </div>
      </a-tab-pane>
      
      <a-tab-pane key="api" tab="API配置">
        <a-form :model="apiConfigForm" layout="vertical">
          <a-form-item label="每次查询数据量">
            <a-input-number 
              v-model:value="apiConfigForm.pageSize" 
              :min="10" 
              :max="1000" 
              style="width: 100%" 
            />
            <div style="color: #999; font-size: 12px; margin-top: 4px;">
              每次从API获取的数据条数（10-1000），数量越大加载越慢
            </div>
          </a-form-item>
        </a-form>
      </a-tab-pane>
      
      <a-tab-pane key="ollama" tab="AI配置">
        <a-form :model="ollamaConfigForm" layout="vertical">
          <a-form-item label="启用AI理解">
            <a-switch v-model:checked="ollamaConfigForm.enabled" />
            <span style="margin-left: 8px; color: #999; font-size: 12px;">
              使用本地 Ollama 进行智能需求理解
            </span>
          </a-form-item>
          
          <a-form-item label="Ollama 服务地址">
            <a-input v-model:value="ollamaConfigForm.baseURL" placeholder="http://localhost:11434" />
          </a-form-item>
          
          <a-form-item label="使用的模型">
            <a-select v-model:value="ollamaConfigForm.model" style="width: 100%">
              <a-select-option value="qwen:latest">Qwen 4B (推荐，速度快)</a-select-option>
              <a-select-option value="llama3-cn:latest">Llama3 CN 8B (中文优化)</a-select-option>
              <a-select-option value="deepseek-v2:latest">DeepSeek V2 15.7B (强大)</a-select-option>
              <a-select-option value="gemma2:27b">Gemma2 27B (最强)</a-select-option>
            </a-select>
          </a-form-item>
          
          <a-form-item label="超时时间(毫秒)">
            <a-input-number v-model:value="ollamaConfigForm.timeout" :min="5000" :max="60000" style="width: 100%" />
          </a-form-item>
          
         
        </a-form>
      </a-tab-pane>

      <a-tab-pane key="cache" tab="缓存管理">
        <CacheManagementPanel />
      </a-tab-pane>
    </a-tabs>
  </a-modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import CacheManagementPanel from './CacheManagementPanel.vue'
import { 
  ReloadOutlined,
  DownloadOutlined
} from '@ant-design/icons-vue'
import { useStore } from 'vuex'
import { useProjectConfig } from '@/composables/useProjectConfig'
import { dataPreloadService } from '@/services/dataPreloadService'

// Store
const store = useStore()

// Props
const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  apiConfigForm: {
    type: Object,
    default: () => ({})
  },
  ollamaConfigForm: {
    type: Object,
    default: () => ({})
  },
  projectConfigForm: {
    type: Object,
    default: () => ({})
  }
})

// Emits
const emit = defineEmits([
  'update:open',
  'save-config',
  'project-config-updated'
])

// 使用项目配置 composable
const {
  projects: availableProjects,
  currentProject,
  currentBuryPoints,
  loading: projectLoading,
  loadProjects,
  selectProject
} = useProjectConfig()

// 选中的埋点ID列表（保持向后兼容）
const selectedBuryPointIds = ref([])

// 访问埋点ID
const visitBuryPointId = ref(null)

// 点击埋点ID
const clickBuryPointId = ref(null)

// 行为分析埋点ID列表
const behaviorBuryPointIds = ref([])

// 监听props变化，初始化选中的埋点
watch(() => props.projectConfigForm.selectedBuryPointIds, (newIds) => {
  if (newIds && Array.isArray(newIds)) {
    selectedBuryPointIds.value = [...newIds]
    console.log('从props初始化选中的埋点:', selectedBuryPointIds.value)
  }
}, { immediate: true })

// 监听访问埋点变化
watch(() => props.projectConfigForm.visitBuryPointId, (newId) => {
  if (newId) {
    visitBuryPointId.value = newId
    console.log('从props初始化访问埋点:', visitBuryPointId.value)
  }
}, { immediate: true })

// 监听点击埋点变化
watch(() => props.projectConfigForm.clickBuryPointId, (newId) => {
  if (newId) {
    clickBuryPointId.value = newId
    console.log('从props初始化点击埋点:', clickBuryPointId.value)
  }
}, { immediate: true })

// 监听行为分析埋点变化
watch(() => props.projectConfigForm.behaviorBuryPointIds, (newIds) => {
  if (newIds && Array.isArray(newIds)) {
    behaviorBuryPointIds.value = [...newIds]
    console.log('从props初始化行为分析埋点:', behaviorBuryPointIds.value)
  }
}, { immediate: true })

// 组件挂载时，从store加载埋点选择
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    // 从store加载保存的埋点选择
    const storeSelectedIds = store.state.projectConfig.selectedBuryPointIds
    if (storeSelectedIds && storeSelectedIds.length > 0) {
      selectedBuryPointIds.value = [...storeSelectedIds]
      console.log('从store加载选中的埋点:', selectedBuryPointIds.value)
    }
    
    // 从store加载访问埋点和点击埋点配置
    const storeVisitBuryPointId = store.state.projectConfig.visitBuryPointId
    const storeClickBuryPointId = store.state.projectConfig.clickBuryPointId
    
    if (storeVisitBuryPointId) {
      visitBuryPointId.value = storeVisitBuryPointId
      console.log('从store加载访问埋点:', visitBuryPointId.value)
    }
    
    if (storeClickBuryPointId) {
      clickBuryPointId.value = storeClickBuryPointId
      console.log('从store加载点击埋点:', clickBuryPointId.value)
    }
  }
})

// Computed
const visible = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

// 方法
const refreshProjects = async () => {
  try {
    await loadProjects()
    message.success('项目列表刷新成功')
  } catch (err) {
    message.error(`刷新项目列表失败: ${err.message}`)
  }
}

const loadProjectPoints = async () => {
  const projectId = props.projectConfigForm.selectedProjectId || props.projectConfigForm.defaultProjectId
  if (!projectId) {
    message.warning('请先选择项目')
    return
  }
  
  try {
    await selectProject(projectId)
    message.success('项目埋点配置加载成功')
    
    // 发送配置更新事件
    emit('project-config-updated', {
      projectId,
      config: currentBuryPoints.value
    })
  } catch (err) {
    message.error(`加载项目埋点配置失败: ${err.message}`)
  }
}

const onProjectSelect = async (projectId) => {
  if (!projectId) return
  
  try {
    await selectProject(projectId)
    
    // 清空选中的埋点，让用户自己选择
    selectedBuryPointIds.value = []
    visitBuryPointId.value = null
    clickBuryPointId.value = null
    behaviorBuryPointIds.value = []
    
    message.success(`项目 ${projectId} 配置加载成功，已加载 ${currentBuryPoints.value?.buryPoints?.length || 0} 个埋点`)
    
    // 发送配置更新事件
    emit('project-config-updated', {
      projectId,
      config: currentBuryPoints.value,
      selectedBuryPointIds: [],
      visitBuryPointId: null,
      clickBuryPointId: null,
      behaviorBuryPointIds: []
    })
  } catch (err) {
    message.error(`加载项目配置失败: ${err.message}`)
  }
}


const onBuryPointsChange = (checkedValues) => {
  console.log('选中的埋点:', checkedValues)
  
  // 立即更新 store 中的埋点选择和 apiConfig
  store.dispatch('updateProjectConfig', {
    selectedBuryPointIds: checkedValues
  })
  
  // 同时更新 apiConfig.selectedPointId（取第一个选中的埋点）
  if (checkedValues && checkedValues.length > 0) {
    const firstSelectedPointId = checkedValues[0]
    store.dispatch('updateApiConfig', {
      selectedPointId: firstSelectedPointId
    })
    console.log(`✅ 埋点选择已更新，同步更新 apiConfig.selectedPointId: ${firstSelectedPointId}`)
  }
  
  // 发送配置更新事件
  if (currentProject.value) {
    emit('project-config-updated', {
      projectId: currentProject.value.id,
      config: currentBuryPoints.value,
      selectedBuryPointIds: checkedValues,
      visitBuryPointId: visitBuryPointId.value,
      clickBuryPointId: clickBuryPointId.value,
      behaviorBuryPointIds: behaviorBuryPointIds.value
    })
  }
}

// 访问埋点变化处理
const onVisitBuryPointChange = (pointId) => {
  console.log('选中的访问埋点:', pointId)
  
  // 更新 store 中的访问埋点配置
  store.dispatch('updateProjectConfig', {
    visitBuryPointId: pointId
  })
  
  // 如果当前没有设置点击埋点，同时更新 apiConfig.selectedPointId
  if (pointId && !clickBuryPointId.value) {
    store.dispatch('updateApiConfig', {
      selectedPointId: pointId
    })
    console.log(`✅ 访问埋点已更新，同步更新 apiConfig.selectedPointId: ${pointId}`)
  }
  
  // 发送配置更新事件
  if (currentProject.value) {
    emit('project-config-updated', {
      projectId: currentProject.value.id,
      config: currentBuryPoints.value,
      visitBuryPointId: pointId,
      clickBuryPointId: clickBuryPointId.value,
      behaviorBuryPointIds: behaviorBuryPointIds.value
    })
  }
}

// 点击埋点变化处理
const onClickBuryPointChange = (pointId) => {
  console.log('选中的点击埋点:', pointId)
  
  // 更新 store 中的点击埋点配置
  store.dispatch('updateProjectConfig', {
    clickBuryPointId: pointId
  })
  
  // 如果当前没有设置访问埋点，同时更新 apiConfig.selectedPointId
  if (pointId && !visitBuryPointId.value) {
    store.dispatch('updateApiConfig', {
      selectedPointId: pointId
    })
    console.log(`✅ 点击埋点已更新，同步更新 apiConfig.selectedPointId: ${pointId}`)
  }
  
  // 发送配置更新事件
  if (currentProject.value) {
    emit('project-config-updated', {
      projectId: currentProject.value.id,
      config: currentBuryPoints.value,
      visitBuryPointId: visitBuryPointId.value,
      clickBuryPointId: pointId,
      behaviorBuryPointIds: behaviorBuryPointIds.value
    })
  }
}

// 行为分析埋点变化处理
const onBehaviorBuryPointChange = (pointIds) => {
  console.log('选中的行为分析埋点:', pointIds)
  
  // 更新 store 中的行为分析埋点配置
  store.dispatch('updateProjectConfig', {
    behaviorBuryPointIds: pointIds
  })
  
  // 如果当前没有设置访问埋点和点击埋点，使用第一个行为分析埋点作为默认选择
  if (pointIds && pointIds.length > 0 && !visitBuryPointId.value && !clickBuryPointId.value) {
    store.dispatch('updateApiConfig', {
      selectedPointId: pointIds[0]
    })
    console.log(`✅ 行为分析埋点已更新，同步更新 apiConfig.selectedPointId: ${pointIds[0]}`)
  }
  
  // 发送配置更新事件
  if (currentProject.value) {
    emit('project-config-updated', {
      projectId: currentProject.value.id,
      config: currentBuryPoints.value,
      visitBuryPointId: visitBuryPointId.value,
      clickBuryPointId: clickBuryPointId.value,
      behaviorBuryPointIds: pointIds
    })
  }
}

const filterProject = (input, option) => {
  const project = availableProjects.value.find(p => p.id === option.value)
  if (!project) return false
  
  const searchText = input.toLowerCase()
  return (
    project.name.toLowerCase().includes(searchText) ||
    project.teamName.toLowerCase().includes(searchText) ||
    project.id.toLowerCase().includes(searchText)
  )
}

const filterBuryPoint = (input, option) => {
  const point = currentBuryPoints.value?.buryPoints?.find(p => p.id === option.value)
  if (!point) return false
  
  const searchText = input.toLowerCase()
  return (
    point.name.toLowerCase().includes(searchText) ||
    point.id.toString().toLowerCase().includes(searchText) ||
    (point.description && point.description.toLowerCase().includes(searchText))
  )
}

const handleSave = () => {
  // 在保存前，确保选中的埋点信息被传递
  emit('save-config', {
    selectedBuryPointIds: selectedBuryPointIds.value
  })
}

// 数据预加载
const triggerDataPreload = async () => {
  try {
    // 不显示loading消息，让右侧状态组件处理
    await dataPreloadService.triggerPreload()
    // 不显示success消息，让右侧状态组件处理
  } catch (error) {
    console.error('启动数据预加载失败:', error)
    message.error('启动数据预加载失败: ' + error.message)
  }
}

const handleCancel = () => {
  visible.value = false
}

// 监听配置变化，自动加载项目列表和当前项目埋点
watch(() => props.visible, async (newVisible) => {
  if (newVisible) {
    try {
      await loadProjects()
      
      // 如果当前已经有选中的项目，自动加载其埋点配置
      const currentProjectId = props.projectConfigForm.selectedProjectId || props.projectConfigForm.defaultProjectId
      if (currentProjectId) {
        try {
          await selectProject(currentProjectId)
          console.log(`自动加载项目 ${currentProjectId} 的埋点配置`)
        } catch (err) {
          console.warn(`加载项目 ${currentProjectId} 埋点配置失败:`, err)
        }
      }
    } catch (err) {
      console.warn('自动加载项目列表失败:', err)
    }
  }
})
</script>

<style scoped>
.project-selection-container {
  width: 100%;
}

.project-selection,
.manual-input {
  width: 100%;
}

.project-select-wrapper {
  display: flex;
  align-items: center;
}

.project-select-wrapper .ant-select {
  flex: 1;
}

.project-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.project-name {
  font-weight: 500;
  color: #333;
}

.project-team {
  font-size: 12px;
  color: #999;
}

/* 埋点选择项样式 */
.bury-point-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bury-point-name {
  font-weight: 500;
  color: #333;
}

.bury-point-id {
  font-size: 12px;
  color: #999;
}

/* 行为分析埋点多选样式 */
:deep(.ant-select-multiple .ant-select-selection-item) {
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  color: #1890ff;
}

:deep(.ant-select-multiple .ant-select-selection-item-remove) {
  color: #1890ff;
}

:deep(.ant-select-multiple .ant-select-selection-item-remove:hover) {
  color: #40a9ff;
}

</style>

