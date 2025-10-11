<template>
  <a-modal
    v-model:open="visible"
    title="系统配置管理"
    width="700px"
    @ok="handleSave"
    @cancel="handleCancel"
  >
    <a-tabs>
      <a-tab-pane key="api" tab="API配置">
        <a-form :model="apiConfigForm" layout="vertical">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="项目ID">
                <a-input v-model:value="apiConfigForm.projectId" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="埋点ID">
                <a-input-number v-model:value="apiConfigForm.selectedPointId" style="width: 100%" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-form-item label="基础URL">
            <a-input v-model:value="apiConfigForm.baseUrl" />
          </a-form-item>
          <a-form-item label="访问令牌">
            <a-input-password v-model:value="apiConfigForm.accessToken" autocomplete="current-password" />
          </a-form-item>
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
          
          <a-alert 
            message="提示" 
            description="请确保 Ollama 服务已启动。如果 AI 理解失败，系统会自动降级到关键词匹配模式。" 
            type="info" 
            show-icon 
          />
        </a-form>
      </a-tab-pane>
    </a-tabs>
  </a-modal>
</template>

<script setup>
import { computed } from 'vue'

// Props
const props = defineProps({
  visible: {
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
  }
})

// Emits
const emit = defineEmits([
  'update:visible',
  'save-config'
])

// Computed
const visible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// Methods
const handleSave = () => {
  emit('save-config')
}

const handleCancel = () => {
  visible.value = false
}
</script>
