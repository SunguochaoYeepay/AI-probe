<template>
  <a-modal
    v-model:open="visible"
    :title="modalTitle"
    width="800px"
    :footer="null"
    @cancel="handleCancel"
  >
    <div class="page-selection-content">
      <p style="margin-bottom: 16px; color: #666;">
        我找到了 {{ totalPagesCount }} 个可用页面，请选择您要分析的页面：
      </p>
      
      <!-- 搜索框 -->
      <div class="search-section">
        <a-input
          v-model:value="searchKeyword"
          placeholder="搜索页面名称..."
          size="large"
          allow-clear
          @input="handleSearch"
        >
          <template #prefix>
            <SearchOutlined style="color: #999;" />
          </template>
        </a-input>
        <div class="search-stats">
          <span v-if="searchKeyword">
            找到 {{ filteredPages.length }} 个匹配的页面
          </span>
          <span v-else>
            共 {{ totalPagesCount }} 个页面
          </span>
        </div>
      </div>
      
      <div class="page-list-modal">
        <!-- 全部页面选项 -->
        <div 
          class="page-item page-item-all"
          @click="selectPage('__ALL__')"
        >
          <div class="page-name">
            <a-tag color="blue" style="margin-right: 8px;">推荐</a-tag>
            <strong>全部页面</strong>
            <span style="color: #999; margin-left: 8px; font-size: 12px;">查看整站UV/PV统计</span>
          </div>
          <div class="page-action">
            <a-button type="primary" size="small">选择分析</a-button>
          </div>
        </div>
        
        <!-- 具体页面列表 -->
        <div 
          v-for="page in displayPages" 
          :key="page"
          class="page-item"
          @click="selectPage(page)"
        >
          <div class="page-name">
            <span v-html="highlightSearchKeyword(page)"></span>
          </div>
          <div class="page-action">
            <a-button type="primary" size="small">选择分析</a-button>
          </div>
        </div>
      </div>
      
      <!-- 分页控制 -->
      <div v-if="totalPages > 1" class="pagination-section">
        <a-pagination
          v-model:current="currentPage"
          :total="filteredPages.length"
          :page-size="pageSize"
          :show-size-changer="false"
          :show-quick-jumper="true"
          size="small"
          @change="handlePageChange"
        />
      </div>
      
      <div v-if="filteredPages.length === 0 && searchKeyword" class="no-pages">
        <a-empty description="没有找到匹配的页面">
          <template #description>
            <span>没有找到包含 "{{ searchKeyword }}" 的页面</span>
            <br>
            <a-button type="link" @click="clearSearch">清除搜索条件</a-button>
          </template>
        </a-empty>
      </div>
      
      <div v-if="availablePages.length === 0" class="no-pages">
        <a-empty description="暂无可用页面数据" />
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { SearchOutlined } from '@ant-design/icons-vue'

// Props
const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  availablePages: {
    type: Array,
    default: () => []
  },
  analysisType: {
    type: String,
    default: 'page_visits'
  }
})

// Emits
const emit = defineEmits([
  'update:open',
  'select-page'
])

// 响应式数据
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = 20

// Computed
const visible = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

// 总页面数
const totalPagesCount = computed(() => props.availablePages.length)

// 弹窗标题
const modalTitle = computed(() => {
  switch (props.analysisType) {
    case 'user_click':
      return '🖱️ 选择页面进行点击分析'
    case 'query_condition':
      return '🔍 选择页面进行查询条件分析'
    case 'page_visits':
    default:
      return '📄 选择页面进行访问分析'
  }
})

// 过滤后的页面列表
const filteredPages = computed(() => {
  if (!searchKeyword.value.trim()) {
    return props.availablePages
  }
  
  const keyword = searchKeyword.value.toLowerCase().trim()
  return props.availablePages.filter(page => 
    page.toLowerCase().includes(keyword)
  )
})

// 分页后的显示页面
const displayPages = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filteredPages.value.slice(start, end)
})

// 总页数
const totalPages = computed(() => Math.ceil(filteredPages.value.length / pageSize))

// 监听搜索关键词变化，重置到第一页
watch(searchKeyword, () => {
  currentPage.value = 1
})

// 监听可用页面变化，重置搜索
watch(() => props.availablePages, () => {
  searchKeyword.value = ''
  currentPage.value = 1
})

// Methods
const selectPage = (pageName) => {
  emit('select-page', pageName)
}

const handleCancel = () => {
  visible.value = false
}

const handleSearch = () => {
  // 搜索逻辑在computed中处理，这里可以添加防抖等优化
}

const handlePageChange = (page) => {
  currentPage.value = page
}

const clearSearch = () => {
  searchKeyword.value = ''
}

// 高亮搜索关键词
const highlightSearchKeyword = (pageName) => {
  if (!searchKeyword.value.trim()) {
    return pageName
  }
  
  const keyword = searchKeyword.value.trim()
  const regex = new RegExp(`(${keyword})`, 'gi')
  return pageName.replace(regex, '<mark style="background-color: #ffeb3b; padding: 0 2px; border-radius: 2px;">$1</mark>')
}
</script>

<style scoped>
.page-selection-content {
  max-height: 600px;
}

.search-section {
  margin-bottom: 16px;
}

.search-stats {
  margin-top: 8px;
  font-size: 12px;
  color: #666;
  text-align: right;
}

.page-list-modal {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  margin-bottom: 16px;
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
  line-height: 1.4;
}

.page-name :deep(mark) {
  background-color: #ffeb3b;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 500;
}

.page-action {
  margin-left: 12px;
  flex-shrink: 0;
}

.pagination-section {
  text-align: center;
  padding: 16px 0;
  border-top: 1px solid #f0f0f0;
}

.no-pages {
  text-align: center;
  padding: 40px 0;
}

/* 搜索框样式优化 */
.search-section :deep(.ant-input) {
  border-radius: 6px;
}

.search-section :deep(.ant-input:focus) {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

/* 分页样式优化 */
.pagination-section :deep(.ant-pagination) {
  margin: 0;
}

.pagination-section :deep(.ant-pagination-item) {
  border-radius: 4px;
}

.pagination-section :deep(.ant-pagination-item-active) {
  background-color: #1890ff;
  border-color: #1890ff;
}

/* 响应式优化 */
@media (max-width: 768px) {
  .page-selection-content {
    max-height: 500px;
  }
  
  .page-list-modal {
    max-height: 300px;
  }
  
  .page-item {
    padding: 10px 12px;
  }
  
  .page-name {
    font-size: 13px;
  }
}
</style>
