<template>
  <a-modal
    v-model:open="visible"
    :title="`选择按钮 - ${pageName}`"
    width="700px"
    :footer="null"
    @cancel="handleCancel"
  >
    <div class="button-selection-content">
      <p style="margin-bottom: 16px; color: #666;">
        该页面共有 {{ buttons.length }} 个按钮，请选择您要分析的按钮：
      </p>
      
      <div class="button-list-modal">
        <!-- 全部按钮点击量选项 -->
        <div 
          class="button-item all-buttons-option"
          @click="selectAllButtons"
        >
          <div class="button-info">
            <div class="button-name">📊 全部按钮点击量</div>
            <div class="button-stats">
              <a-tag color="orange">按天展示该页面所有按钮的点击量</a-tag>
            </div>
          </div>
          <div class="button-action">
            <a-button type="primary" size="small">选择分析</a-button>
          </div>
        </div>
        
        <!-- 按钮列表 -->
        <div 
          v-for="button in buttons" 
          :key="button.content"
          class="button-item"
          @click="selectButton(button)"
        >
          <div class="button-info">
            <div class="button-name">{{ button.content }}</div>
            <div class="button-stats">
              <a-tag color="blue">PV: {{ button.pv }}</a-tag>
              <a-tag color="green">UV: {{ button.uv }}</a-tag>
            </div>
          </div>
          <div class="button-action">
            <a-button type="primary" size="small">选择分析</a-button>
          </div>
        </div>
      </div>
      
      <div v-if="buttons.length === 0" class="no-buttons">
        <a-empty description="该页面暂无按钮点击数据" />
      </div>
    </div>
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
  pageName: {
    type: String,
    default: ''
  },
  buttons: {
    type: Array,
    default: () => []
  }
})

// Emits
const emit = defineEmits([
  'update:visible',
  'select-button'
])

// Computed
const visible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// Methods
const selectButton = (button) => {
  emit('select-button', button)
}

const selectAllButtons = () => {
  // 发送全部按钮点击量分析请求
  emit('select-button', { 
    content: '全部按钮点击量', 
    type: 'all_buttons',
    pageName: props.pageName 
  })
}

const handleCancel = () => {
  visible.value = false
}
</script>

<style scoped>
.button-selection-content {
  max-height: 500px;
}

.button-list-modal {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}

.button-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: all 0.2s;
}

.button-item:last-child {
  border-bottom: none;
}

.button-item:hover {
  background-color: #f5f5f5;
}

.button-info {
  flex: 1;
}

.button-name {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.button-stats {
  display: flex;
  gap: 8px;
}

.button-action {
  margin-left: 16px;
}

.no-buttons {
  text-align: center;
  padding: 40px 0;
}

.all-buttons-option {
  background-color: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 6px;
  margin-bottom: 8px;
}

.all-buttons-option:hover {
  background-color: #f0f9ff;
  border-color: #91d5ff;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .button-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .button-action {
    margin-left: 0;
    width: 100%;
  }
  
  .button-action .ant-btn {
    width: 100%;
  }
}
</style>
