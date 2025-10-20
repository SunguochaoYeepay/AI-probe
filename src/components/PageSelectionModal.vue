<template>
  <a-modal
    v-model:open="visible"
    title="选择页面查看访问量"
    width="600px"
    :footer="null"
    @cancel="handleCancel"
  >
    <div class="page-selection-content">
      <p style="margin-bottom: 16px; color: #666;">
        请选择要分析的页面，系统将生成该页面的UV（独立访客）和PV（浏览量）分析：
      </p>
      
      <div class="page-list-modal">
        <!-- 全部页面选项 -->
        <div 
          class="page-item page-item-all"
          @click="selectPage('__ALL__')"
        >
          <div class="page-name">
            <a-tag color="blue" style="margin-right: 8px;">推荐</a-tag>
            <strong>全部页面</strong>
            <span style="color: #999; margin-left: 8px; font-size: 12px;">查看整站UV/PV</span>
          </div>
          <div class="page-action">
            <a-button type="primary" size="small">选择分析</a-button>
          </div>
        </div>
        
        <!-- 具体页面列表 -->
        <div 
          v-for="page in availablePages" 
          :key="page"
          class="page-item"
          @click="selectPage(page)"
        >
          <div class="page-name">{{ page }}</div>
          <div class="page-action">
            <a-button type="primary" size="small">选择分析</a-button>
          </div>
        </div>
      </div>
      
      <div v-if="availablePages.length === 0" class="no-pages">
        <a-empty description="暂无可用页面数据" />
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { computed } from 'vue'

// Props
const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  availablePages: {
    type: Array,
    default: () => []
  }
})

// Emits
const emit = defineEmits([
  'update:open',
  'select-page'
])

// Computed
const visible = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

// Methods
const selectPage = (pageName) => {
  emit('select-page', pageName)
}

const handleCancel = () => {
  visible.value = false
}
</script>

<style scoped>
.page-selection-content {
  max-height: 500px;
}

.page-list-modal {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}

.page-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: all 0.2s;
}

.page-item:last-child {
  border-bottom: none;
}

.page-item:hover {
  background-color: #f5f5f5;
}

.page-item-all {
  background: linear-gradient(to right, #e6f7ff, #f0f5ff);
  border-bottom: 2px solid #1890ff !important;
}

.page-item-all:hover {
  background: linear-gradient(to right, #bae7ff, #d6e4ff);
}

.page-name {
  flex: 1;
  font-size: 14px;
  color: #333;
  word-break: break-all;
}

.page-action {
  margin-left: 12px;
}

.no-pages {
  text-align: center;
  padding: 40px 0;
}
</style>
