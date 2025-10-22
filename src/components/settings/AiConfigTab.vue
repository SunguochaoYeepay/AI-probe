<template>
  <div class="ai-config-tab">
    <a-card title="AI配置" class="config-card">
      <a-form :model="ollamaConfigForm" layout="vertical">
      <a-form-item label="启用AI理解">
        <a-switch v-model:checked="ollamaConfigForm.enabled" />
        <span style="margin-left: 8px; color: #999; font-size: 12px;">
          使用本地 Ollama 进行智能需求理解
        </span>
      </a-form-item>
      
      <a-form-item label="Ollama 服务地址">
        <a-input v-model:value="ollamaConfigForm.baseURL" placeholder="http://localhost:11434" />
        <div style="color: #999; font-size: 12px; margin-top: 4px;">
          Ollama服务的地址，确保服务正在运行
        </div>
      </a-form-item>
      
      <a-form-item label="使用的模型">
        <a-select v-model:value="ollamaConfigForm.model" style="width: 100%">
          <a-select-option value="qwen:latest">Qwen 4B (推荐，速度快)</a-select-option>
          <a-select-option value="llama3-cn:latest">Llama3 CN 8B (中文优化)</a-select-option>
          <a-select-option value="deepseek-v2:latest">DeepSeek V2 15.7B (强大)</a-select-option>
          <a-select-option value="gemma2:27b">Gemma2 27B (最强)</a-select-option>
        </a-select>
        <div style="color: #999; font-size: 12px; margin-top: 4px;">
          选择要使用的AI模型，模型越大能力越强但速度越慢
        </div>
      </a-form-item>
      
      <a-form-item label="超时时间(毫秒)">
        <a-input-number v-model:value="ollamaConfigForm.timeout" :min="5000" :max="60000" style="width: 100%" />
        <div style="color: #999; font-size: 12px; margin-top: 4px;">
          AI请求的超时时间，建议设置为10-30秒
        </div>
      </a-form-item>

      <a-form-item label="最大重试次数">
        <a-input-number v-model:value="ollamaConfigForm.maxRetries" :min="0" :max="3" style="width: 100%" />
        <div style="color: #999; font-size: 12px; margin-top: 4px;">
          AI请求失败时的最大重试次数
        </div>
      </a-form-item>

      <!-- 测试连接 -->
      <a-form-item>
        <a-space>
          <a-button @click="testConnection" :loading="testing">
            测试连接
          </a-button>
          <a-button type="primary" @click="handleSave" :loading="saving">
            保存配置
          </a-button>
          <a-button @click="handleReset">
            重置
          </a-button>
        </a-space>
      </a-form-item>
      </a-form>

      <!-- 连接状态 -->
      <a-divider>连接状态</a-divider>
      <a-alert
        :message="connectionStatus.message"
        :type="connectionStatus.type"
        :description="connectionStatus.description"
        show-icon
      />
    </a-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { useStore } from 'vuex'
import OllamaService from '@/utils/ollamaService'

// Store
const store = useStore()

// 创建 ollamaService 实例
const ollamaService = new OllamaService()

// 表单数据
const ollamaConfigForm = ref({
  enabled: false,
  baseURL: 'http://localhost:11434',
  model: 'qwen:latest',
  timeout: 30000,
  maxRetries: 2
})

// 状态
const saving = ref(false)
const testing = ref(false)
const connectionStatus = ref({
  message: '未测试',
  type: 'info',
  description: '点击"测试连接"按钮检查AI服务状态'
})

// 初始化配置
onMounted(() => {
  loadConfig()
})

// 加载配置
const loadConfig = () => {
  const ollamaConfig = store.state.ollamaConfig || {}
  ollamaConfigForm.value = {
    enabled: ollamaConfig.enabled || false,
    baseURL: ollamaConfig.baseURL || 'http://localhost:11434',
    model: ollamaConfig.model || 'qwen:latest',
    timeout: ollamaConfig.timeout || 30000,
    maxRetries: ollamaConfig.maxRetries || 2
  }
}

// 测试连接
const testConnection = async () => {
  try {
    testing.value = true
    connectionStatus.value = {
      message: '正在测试连接...',
      type: 'info',
      description: '请稍候...'
    }

    // 创建新的ollama服务实例并测试连接
    const testService = new OllamaService(ollamaConfigForm.value)
    const isAvailable = await testService.checkAvailability()
    
    if (isAvailable) {
      connectionStatus.value = {
        message: '连接成功',
        type: 'success',
        description: `AI服务运行正常，模型: ${ollamaConfigForm.value.model}`
      }
      message.success('AI服务连接成功')
    } else {
      connectionStatus.value = {
        message: '连接失败',
        type: 'error',
        description: '无法连接到AI服务，请检查服务是否运行'
      }
      message.error('AI服务连接失败')
    }
  } catch (error) {
    console.error('测试AI连接失败:', error)
    connectionStatus.value = {
      message: '连接失败',
      type: 'error',
      description: error.message || '测试连接时发生错误'
    }
    message.error('测试连接失败: ' + error.message)
  } finally {
    testing.value = false
  }
}

// 保存配置
const handleSave = async () => {
  try {
    saving.value = true
    
    // 更新store中的配置
    await store.dispatch('updateOllamaConfig', ollamaConfigForm.value)
    
    // 更新ollama服务实例配置
    ollamaService.baseURL = ollamaConfigForm.value.baseURL
    ollamaService.model = ollamaConfigForm.value.model
    ollamaService.timeout = ollamaConfigForm.value.timeout
    
    message.success('AI配置保存成功')
  } catch (error) {
    console.error('保存AI配置失败:', error)
    message.error('保存AI配置失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

// 重置配置
const handleReset = () => {
  loadConfig()
  connectionStatus.value = {
    message: '未测试',
    type: 'info',
    description: '点击"测试连接"按钮检查AI服务状态'
  }
  message.info('AI配置已重置')
}
</script>

<style scoped lang="less">
.ai-config-tab {
  max-width: 600px;
  
  .config-card {
    margin-bottom: 16px;
  }
}
</style>
