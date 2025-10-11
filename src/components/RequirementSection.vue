<template>
  <a-card class="requirement-card" title="智能分析需求" :bordered="false">
    <div class="requirement-section">
      <a-textarea
        v-model:value="currentRequirement"
        placeholder="请描述您想要的分析需求，或点击下方常用提示词快速填充..."
        :rows="3"
        :maxlength="500"
        show-count
      />
      
      <!-- 常用提示词 -->
      <div class="quick-prompts">
        <span class="prompt-label">常用需求：</span>
        <a-tag 
          v-for="prompt in quickPrompts" 
          :key="prompt.text"
          :color="prompt.color"
          class="prompt-tag"
          @click="fillPrompt(prompt.text)"
        >
          {{ prompt.text }}
        </a-tag>
      </div>
      
      <div class="requirement-actions">
        <a-button type="primary" @click="analyzeRequirement" :loading="analyzing">
          <BulbOutlined />
          智能分析
        </a-button>
        <a-button @click="clearRequirement">
          <ClearOutlined />
          清空
        </a-button>
      </div>
    </div>

  </a-card>
</template>

<script setup>
import { computed } from 'vue'
import { BulbOutlined, ClearOutlined } from '@ant-design/icons-vue'

// Props
const props = defineProps({
  currentRequirement: {
    type: String,
    default: ''
  },
  analyzing: {
    type: Boolean,
    default: false
  },
  analysisResult: {
    type: Object,
    default: null
  },
  quickPrompts: {
    type: Array,
    default: () => []
  }
})

// Emits
const emit = defineEmits([
  'update:currentRequirement',
  'analyze-requirement',
  'clear-requirement',
  'fill-prompt'
])

// Computed
const currentRequirement = computed({
  get: () => props.currentRequirement,
  set: (value) => emit('update:currentRequirement', value)
})

// Methods
const analyzeRequirement = () => {
  emit('analyze-requirement')
}

const clearRequirement = () => {
  emit('clear-requirement')
}

const fillPrompt = (text) => {
  emit('fill-prompt', text)
}
</script>

<style scoped>
.requirement-card {
  margin-bottom: 24px;
}

.requirement-section {
  margin-bottom: 16px;
}

.quick-prompts {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.prompt-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
  margin-right: 4px;
}

.prompt-tag {
  cursor: pointer;
  transition: all 0.3s;
  user-select: none;
}

.prompt-tag:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.requirement-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}

@media (max-width: 768px) {
  .quick-prompts {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .prompt-tag {
    font-size: 12px;
  }
}
</style>
