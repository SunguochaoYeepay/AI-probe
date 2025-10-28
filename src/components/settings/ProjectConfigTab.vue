<template>
  <div class="project-config-tab">
    <a-card title="项目配置" class="config-card">
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
                style="width: 100%"
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
              placeholder="手动输入项目ID"
              style="width: 100%"
            />
            <div style="color: #999; font-size: 12px; margin-top: 4px;">
              手动输入项目ID，或点击下方按钮加载项目列表
            </div>
            <a-button 
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

      <!-- 埋点配置 -->
   
      
      <!-- 访问埋点 -->
      <a-form-item label="访问埋点ID">
        <a-select
          v-model:value="visitBuryPointId"
          placeholder="请选择访问埋点"
          style="width: 100%"
          :loading="projectLoading"
        >
          <template v-for="point in (currentBuryPoints?.buryPoints || [])" :key="point?.id">
            <a-select-option
              v-if="point"
              :value="point.id"
            >
              {{ point.name }} (ID: {{ point.id }})
            </a-select-option>
          </template>
        </a-select>
        <div style="color: #999; font-size: 12px; margin-top: 4px;">
          选择用于记录页面访问行为的埋点
        </div>
      </a-form-item>

      <!-- 点击埋点 -->
      <a-form-item label="点击埋点ID">
        <a-select
          v-model:value="clickBuryPointId"
          placeholder="请选择点击埋点"
          style="width: 100%"
          :loading="projectLoading"
        >
          <template v-for="point in (currentBuryPoints?.buryPoints || [])" :key="point?.id">
            <a-select-option
              v-if="point"
              :value="point.id"
            >
              {{ point.name }} (ID: {{ point.id }})
            </a-select-option>
          </template>
        </a-select>
        <div style="color: #999; font-size: 12px; margin-top: 4px;">
          选择用于记录按钮点击行为的埋点
        </div>
      </a-form-item>

      <!-- 行为分析埋点 -->
      <a-form-item label="行为分析埋点">
        <a-select
          v-model:value="behaviorBuryPointIds"
          placeholder="请选择行为分析埋点（可多选）"
          style="width: 100%"
          :loading="projectLoading"
          mode="multiple"
          :max-tag-count="3"
          show-search
          :filter-option="filterBuryPoint"
          allow-clear
        >
          <template v-for="point in (currentBuryPoints?.buryPoints || [])" :key="point?.id">
            <a-select-option
              v-if="point"
              :value="point.id"
            >
              {{ point.name }} (ID: {{ point.id }})
            </a-select-option>
          </template>
        </a-select>
        <div style="color: #999; font-size: 12px; margin-top: 4px;">
          选择用于记录用户行为分析的埋点，支持多选
        </div>
      </a-form-item>

      <!-- 访问令牌 -->
      <a-form-item label="访问令牌">
        <a-input-password
          v-model:value="projectConfigForm.accessToken"
          placeholder="用于访问Probe API的访问令牌"
          style="width: 100%"
        />
        <div style="color: #999; font-size: 12px; margin-top: 4px;">
          用于访问Probe API的访问令牌
        </div>
      </a-form-item>

      <!-- 保存按钮 -->
      <a-form-item>
        <a-space>
          <a-button type="primary" @click="handleSave" :loading="saving">
            保存配置
          </a-button>
          <a-button @click="handleReset">
            重置
          </a-button>
        </a-space>
      </a-form-item>
      </a-form>
    </a-card>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { 
  ReloadOutlined
} from '@ant-design/icons-vue'
import { useStore } from 'vuex'
import { useProjectConfig } from '@/composables/useProjectConfig'

// Store
const store = useStore()

// 使用项目配置 composable
const {
  projects: availableProjects,
  currentProject,
  currentBuryPoints,
  loading: projectLoading,
  loadProjects,
  selectProject
} = useProjectConfig()

// 表单数据
const projectConfigForm = ref({
  selectedProjectId: '',
  accessToken: ''
})

// 埋点配置
const visitBuryPointId = ref(null)
const clickBuryPointId = ref(null)
const behaviorBuryPointIds = ref([])

// 状态
const saving = ref(false)

// 初始化配置
onMounted(async () => {
  console.log('🔧 初始化项目配置页面...')
  await loadProjects()
  loadConfig()
  
  // 等待数据库配置同步完成
  await waitForDatabaseConfig()
  
  // 检查是否有正确的数据库配置（175, 172）
  const projectConfig = store.state.projectConfig
  const hasCorrectDatabaseConfig = projectConfig.visitBuryPointId === 175 && projectConfig.clickBuryPointId === 172
  
  if (hasCorrectDatabaseConfig) {
    console.log('🔒 检测到数据库配置，跳过自动项目选择')
    console.log('📊 当前数据库配置:', {
      visitBuryPointId: projectConfig.visitBuryPointId,
      clickBuryPointId: projectConfig.clickBuryPointId,
      behaviorBuryPointIds: projectConfig.behaviorBuryPointIds
    })
  } else if (projectConfigForm.value.selectedProjectId) {
    console.log(`🔄 无数据库配置，自动选择项目: ${projectConfigForm.value.selectedProjectId}`)
    await selectProject(projectConfigForm.value.selectedProjectId)
  } else {
    console.log('⚠️ 没有选中的项目且无数据库配置')
  }
})

// 等待数据库配置同步完成
const waitForDatabaseConfig = async () => {
  const maxWaitTime = 5000 // 最多等待5秒
  const checkInterval = 100 // 每100ms检查一次
  let waitTime = 0
  
  while (waitTime < maxWaitTime) {
    // 检查是否有数据库配置（175, 172）而不是API配置（171, 174）
    const projectConfig = store.state.projectConfig
    const hasCorrectConfig = projectConfig.visitBuryPointId === 175 && projectConfig.clickBuryPointId === 172
    
    if (hasCorrectConfig) {
      console.log('✅ 数据库配置已同步完成')
      return
    }
    
    // 如果配置同步服务可用，尝试手动触发
    if (window.configSyncService && waitTime === 0) {
      console.log('🔄 手动触发配置同步...')
      await window.configSyncService.loadConfigFromDatabase()
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval))
    waitTime += checkInterval
  }
  
  console.log('⚠️ 等待数据库配置同步超时')
}

// 加载配置
const loadConfig = () => {
  const apiConfig = store.state.apiConfig
  const projectConfig = store.state.projectConfig
  
  console.log('📋 加载配置:', {
    apiConfig: { projectId: apiConfig.projectId, hasToken: !!apiConfig.accessToken },
    projectConfig: { 
      visitBuryPointId: projectConfig.visitBuryPointId,
      clickBuryPointId: projectConfig.clickBuryPointId,
      behaviorBuryPointIds: projectConfig.behaviorBuryPointIds
    }
  })
  
  projectConfigForm.value = {
    selectedProjectId: apiConfig.projectId || '',
    accessToken: apiConfig.accessToken || ''
  }
  
  visitBuryPointId.value = projectConfig.visitBuryPointId || null
  clickBuryPointId.value = projectConfig.clickBuryPointId || null
  behaviorBuryPointIds.value = projectConfig.behaviorBuryPointIds || []
}

// 项目选择处理
const onProjectSelect = async (projectId) => {
  await selectProject(projectId)
}

// 监听项目选择变化，自动加载埋点数据
watch(() => projectConfigForm.value.selectedProjectId, async (newProjectId) => {
  if (newProjectId) {
    await selectProject(newProjectId)
  }
})

// 刷新项目列表
const refreshProjects = () => {
  loadProjects()
}

// 项目过滤
const filterProject = (input, option) => {
  const project = option.children[0].children
  const name = project[0].children
  const team = project[1].children
  return name.toLowerCase().includes(input.toLowerCase()) || 
         team.toLowerCase().includes(input.toLowerCase())
}

// 埋点过滤
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


// 保存配置
const handleSave = async () => {
  try {
    saving.value = true
    
    // 准备配置数据
    const projectConfig = {
      visitBuryPointId: visitBuryPointId.value,
      clickBuryPointId: clickBuryPointId.value,
      behaviorBuryPointIds: behaviorBuryPointIds.value
    }
    
    const apiConfig = {
      projectId: projectConfigForm.value.selectedProjectId,
      accessToken: projectConfigForm.value.accessToken
    }
    
    // 更新store中的配置
    await store.dispatch('updateApiConfig', apiConfig)
    await store.dispatch('updateProjectConfig', projectConfig)
    
    // 保存到数据库
    try {
      const response = await fetch('http://localhost:3004/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectConfig,
          apiConfig
        })
      })
      
      if (response.ok) {
        console.log('✅ 配置已保存到数据库')
      } else {
        console.warn('⚠️ 配置保存到数据库失败，但已保存到本地存储')
      }
    } catch (dbError) {
      console.warn('⚠️ 数据库连接失败，配置仅保存到本地存储:', dbError.message)
    }
    
    message.success('配置保存成功')
  } catch (error) {
    console.error('保存配置失败:', error)
    message.error('保存配置失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

// 重置配置
const handleReset = () => {
  loadConfig()
  message.info('配置已重置')
}
</script>

<style scoped lang="less">
.project-config-tab {
  .config-card {
    margin-bottom: 16px;
  }
  .project-selection-container {
    .project-selection {
      .project-select-wrapper {
        display: flex;
        align-items: center;
      }
    }
    
    .manual-input {
      .ant-input {
        margin-bottom: 8px;
      }
    }
  }
  
  .project-option {
    display: flex;
    justify-content: space-between;
    
    .project-name {
      font-weight: 500;
    }
    
    .project-team {
      color: #999;
      font-size: 12px;
    }
  }
  
}
</style>
