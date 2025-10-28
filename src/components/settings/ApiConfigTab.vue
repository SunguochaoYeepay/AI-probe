<template>
  <div class="api-config-tab">
    <a-card title="API配置" class="config-card">
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

      <a-form-item label="API超时时间(秒)">
        <a-input-number 
          v-model:value="apiConfigForm.timeout" 
          :min="5" 
          :max="60" 
          style="width: 100%" 
        />
        <div style="color: #999; font-size: 12px; margin-top: 4px;">
          API请求超时时间，建议设置为10-30秒
        </div>
      </a-form-item>

      <a-form-item label="重试次数">
        <a-input-number 
          v-model:value="apiConfigForm.retryCount" 
          :min="0" 
          :max="5" 
          style="width: 100%" 
        />
        <div style="color: #999; font-size: 12px; margin-top: 4px;">
          请求失败时的重试次数，0表示不重试
        </div>
      </a-form-item>

      <a-form-item label="请求间隔(毫秒)">
        <a-input-number 
          v-model:value="apiConfigForm.requestInterval" 
          :min="100" 
          :max="2000" 
          style="width: 100%" 
        />
        <div style="color: #999; font-size: 12px; margin-top: 4px;">
          连续请求之间的间隔时间，避免请求过于频繁
        </div>
      </a-form-item>

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
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { useStore } from 'vuex'

// Store
const store = useStore()

// 表单数据
const apiConfigForm = ref({
  pageSize: 1000,
  timeout: 30,
  retryCount: 2,
  requestInterval: 500
})

// 状态
const saving = ref(false)

// 初始化配置
onMounted(() => {
  loadConfig()
})

// 加载配置
const loadConfig = () => {
  const apiConfig = store.state.apiConfig
  apiConfigForm.value = {
    pageSize: apiConfig.pageSize || 1000,
    timeout: apiConfig.timeout || 30,
    retryCount: apiConfig.retryCount || 2,
    requestInterval: apiConfig.requestInterval || 500
  }
}

// 保存配置
const handleSave = async () => {
  try {
    saving.value = true
    
    // 更新store中的配置
    await store.dispatch('updateApiConfig', apiConfigForm.value)
    
    // 保存到数据库
    try {
      const response = await fetch('http://localhost:3004/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiConfig: apiConfigForm.value
        })
      })
      
      if (response.ok) {
        console.log('✅ API配置已保存到数据库')
      } else {
        console.warn('⚠️ API配置保存到数据库失败，但已保存到本地存储')
      }
    } catch (dbError) {
      console.warn('⚠️ 数据库连接失败，API配置仅保存到本地存储:', dbError.message)
    }
    
    message.success('API配置保存成功')
  } catch (error) {
    console.error('保存API配置失败:', error)
    message.error('保存API配置失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

// 重置配置
const handleReset = () => {
  loadConfig()
  message.info('API配置已重置')
}
</script>

<style scoped lang="less">
.api-config-tab {
  
  .config-card {
    margin-bottom: 16px;
  }
}
</style>
