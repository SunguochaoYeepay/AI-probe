<template>
  <a-drawer
    v-model:open="visible"
    title="🎯 转化步骤配置"
    width="600px"
    placement="right"
    :mask="true"
    :mask-closable="true"
    :z-index="1000"
    @close="handleClose"
  >
    <div class="funnel-step-config">
      <!-- 配置说明 -->
     

      <!-- 步骤列表 -->
      <div class="steps-container">
        <div
          v-for="(step, index) in steps"
          :key="String(step.id || index)"
          class="step-item"
        >
          <div class="step-header">
            <span class="step-number">步骤{{ index + 1 }}</span>
            <a-input
              v-model:value="step.name"
              placeholder="请输入步骤名称"
              style="flex: 1; margin: 0 8px"
            />
            <a-button
              type="text"
              danger
              @click="removeStep(index)"
              :disabled="steps.length <= 1"
            >
              <template #icon><DeleteOutlined /></template>
            </a-button>
          </div>

          <div class="step-config">
            <!-- 步骤类型选择 -->
            <div class="config-row">
              <span class="label">步骤类型:</span>
              <a-radio-group v-model:value="step.type" @change="onStepTypeChange(step)">
                <a-radio value="page">页面访问</a-radio>
                <a-radio value="button">按钮点击</a-radio>
              </a-radio-group>
            </div>

            <!-- 页面访问配置 -->
            <div v-if="step.type === 'page'" class="config-row">
              <span class="label">页面行为:</span>
              <a-select
                v-model:value="step.pageBehavior"
                placeholder="选择页面行为"
                style="width: 200px"
              >
                <a-select-option value="打开">打开</a-select-option>
                <a-select-option value="关闭">关闭</a-select-option>
                <a-select-option value="任意">任意</a-select-option>
              </a-select>
            </div>

            <div v-if="step.type === 'page'" class="config-row">
              <span class="label">目标页面:</span>
              <a-select
                v-model:value="step.targetPage"
                placeholder="选择目标页面"
                style="width: 300px"
                show-search
                :filter-option="filterPageOption"
              >
                <a-select-option
                  v-for="page in availablePages"
                  :key="page"
                  :value="page"
                >
                  {{ page }}
                </a-select-option>
              </a-select>
            </div>

            <!-- 目标页面配置（按钮点击时放在最上面） -->
            <div v-if="step.type === 'button'" class="config-row">
              <span class="label">目标页面:</span>
              <a-select
                v-model:value="step.targetPage"
                placeholder="先选择目标页面"
                style="width: 300px"
                show-search
                :filter-option="filterPageOption"
                @change="onTargetPageChange(step)"
              >
                <a-select-option
                  v-for="page in availablePages"
                  :key="page"
                  :value="page"
                >
                  {{ page }}
                </a-select-option>
              </a-select>
            </div>

        <!-- 按钮选择（根据目标页面动态加载） -->
        <div v-if="step.type === 'button' && step.targetPage && step.targetPage !== '任意页面'" class="config-row">
          <span class="label">按钮操作:</span>
          <a-select
            v-if="getCurrentStepButtons(step).length > 0"
            v-model:value="step.contentCondition"
            placeholder="请选择按钮操作"
            style="width: 300px"
            show-search
            :filter-option="filterButtonOption"
            :key="`button-select-${String(step.targetPage || '')}-${getCurrentStepButtons(step).length}`"
          >
            <a-select-option
              v-for="(button, buttonIndex) in getCurrentStepButtons(step)"
              :key="`${String(step.targetPage || '')}-${String(button || '')}-${buttonIndex}`"
              :value="button"
            >
              {{ button }}
            </a-select-option>
          </a-select>
          <a-input
            v-else
            v-model:value="step.contentCondition"
            placeholder="手动输入按钮操作名称"
            style="width: 300px"
          />
        </div>

            <!-- 通用内容条件（当没有选择具体页面时） -->
            <div v-if="step.type === 'button' && (!step.targetPage || step.targetPage === '任意页面')" class="config-row">
              <span class="label">内容条件:</span>
              <a-input
                v-model:value="step.contentCondition"
                placeholder="例如: 申请时间,状态 (用逗号分隔)"
                style="width: 300px"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 添加步骤按钮 -->
      <a-button
        type="dashed"
        block
        @click="addStep"
        style="margin: 16px 0"
      >
        <template #icon><PlusOutlined /></template>
        添加步骤
      </a-button>


    </div>

    <!-- 底部操作按钮 -->
    <template #footer>
      <div style="text-align: right">
        <a-button @click="handleClose" style="margin-right: 8px">
          取消
        </a-button>
        <a-button type="primary" @click="handleSave">
          保存配置
        </a-button>
      </div>
    </template>
  </a-drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'

// Props
const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  initialSteps: {
    type: Array,
    default: () => []
  },
  availablePages: {
    type: Array,
    default: () => []
  },
  pageButtons: {
    type: Map,
    default: () => new Map()
  }
})

// Emits
const emit = defineEmits(['update:open', 'save'])

// 响应式数据
const visible = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const steps = ref([])

// 页面按钮映射（从props中获取）
const pageButtons = computed(() => props.pageButtons)

// 可用的页面列表（从props中获取，如果没有则使用默认值）
const availablePages = computed(() => {
  if (props.availablePages && props.availablePages.length > 0) {
    // 确保所有页面名称都是字符串
    const validPages = props.availablePages.filter(page => 
      typeof page === 'string' && page.trim() !== ''
    )
    // 去重并确保"任意页面"在最前面
    const uniquePages = [...new Set(['任意页面', ...validPages])]
    return uniquePages
  }
  // 如果没有提供页面列表，使用默认示例
  return [
    '任意页面',
    '企业付款-复核申请查询',
    '下级商户查询-appid 配置',
    '商户管理-基础信息',
    '支付配置-接口配置'
  ]
})

// 初始化步骤
const initSteps = () => {
  if (props.initialSteps.length > 0) {
    // 确保每个步骤都有有效的数据结构
    steps.value = props.initialSteps.map((step, index) => 
      ensureStepValidity({ ...step, id: step.id || index + 1 })
    )
  } else {
    // 默认步骤配置
    steps.value = [
      {
        id: 1,
        name: '流程开始',
        type: 'page',
        pageBehavior: '打开',
        targetPage: '任意页面'
      },
      {
        id: 2,
        name: '发起查询',
        type: 'button',
        clickType: 'query',
        contentCondition: '申请时间,状态',
        targetPage: '任意页面'
      },
      {
        id: 3,
        name: '流程结束',
        type: 'page',
        pageBehavior: '关闭',
        targetPage: '任意页面'
      }
    ]
  }
}

// 监听打开状态
watch(() => props.open, (newVal) => {
  if (newVal) {
    initSteps()
  }
})

// 添加步骤
const addStep = () => {
  const newStep = {
    id: Date.now(),
    name: `步骤${steps.value.length + 1}`,
    type: 'page',
    pageBehavior: '任意',
    targetPage: '任意页面',
    clickType: '任意',
    contentCondition: ''
  }
  steps.value.push(newStep)
}

// 确保步骤数据有效性
const ensureStepValidity = (step) => {
  return {
    id: typeof step.id === 'number' ? step.id : Date.now(),
    name: typeof step.name === 'string' ? step.name : '未命名步骤',
    type: step.type || 'page',
    pageBehavior: step.pageBehavior || '任意',
    targetPage: step.targetPage || '任意页面',
    clickType: step.clickType || '任意',
    contentCondition: step.contentCondition || ''
  }
}

// 删除步骤
const removeStep = (index) => {
  if (steps.value.length > 1) {
    steps.value.splice(index, 1)
  }
}

// 步骤类型变化处理
const onStepTypeChange = (step) => {
  // 重置相关字段
  if (step.type === 'page') {
    step.clickType = ''
    step.contentCondition = ''
  } else {
    step.pageBehavior = ''
  }
}

// 页面过滤
const filterPageOption = (input, option) => {
  // 🚀 修复：直接使用option.value进行搜索，避免option.children的类型问题
  const searchText = option.value || ''
  return searchText.toLowerCase().indexOf(input.toLowerCase()) >= 0
}

// 按钮过滤
const filterButtonOption = (input, option) => {
  // 🚀 修复：直接使用option.value进行搜索，避免option.children的类型问题
  const searchText = option.value || ''
  return searchText.toLowerCase().indexOf(input.toLowerCase()) >= 0
}

// 获取指定页面的按钮列表
const getButtonsForPage = (pageName) => {
  if (!pageName || pageName === '任意页面') {
    return []
  }
  
  console.log(`🔍 [getButtonsForPage] 被调用，页面名称: "${pageName}"`)
  console.log(`🔍 [getButtonsForPage] 页面按钮映射大小:`, pageButtons.value.size)
  console.log(`🔍 [getButtonsForPage] 所有页面:`, Array.from(pageButtons.value.keys()))
  
  // 从页面按钮映射中获取按钮列表
  const buttons = pageButtons.value.get(pageName) || []
  
  console.log(`🔍 [getButtonsForPage] 页面 "${pageName}" 的按钮:`, buttons)
  console.log(`🔍 [getButtonsForPage] 按钮数量:`, buttons.length)
  
  // 如果没有找到真实按钮数据，返回空数组，让用户手动输入
  if (buttons.length === 0) {
    console.log(`⚠️ 页面 "${pageName}" 没有找到按钮数据`)
    return []
  }
  
  return buttons
}

// 计算属性：获取当前步骤的按钮列表（用于响应式更新）
const getCurrentStepButtons = computed(() => {
  return (step) => {
    if (!step || !step.targetPage || step.targetPage === '任意页面') {
      return []
    }
    return pageButtons.value.get(step.targetPage) || []
  }
})

// 目标页面变化处理
const onTargetPageChange = (step) => {
  // 清空之前的内容条件
  step.contentCondition = ''
  
  // 如果选择了具体页面，可以在这里预加载该页面的按钮
  if (step.targetPage && step.targetPage !== '任意页面') {
    // 这里可以触发按钮数据的加载
  }
}

// 保存配置
const handleSave = () => {
  // 验证配置
  for (let i = 0; i < steps.value.length; i++) {
    const step = steps.value[i]
    if (!step.name.trim()) {
      message.error(`步骤${i + 1}的名称不能为空`)
      return
    }
    
    // 验证按钮操作
    if (step.type === 'button') {
      if (!step.contentCondition || step.contentCondition.trim() === '') {
        message.error(`步骤${i + 1}的按钮操作不能为空`)
        return
      }
      
      // 检查是否选择了该页面实际存在的按钮
      const availableButtons = getButtonsForPage(step.targetPage)
      if (availableButtons.length > 0 && !availableButtons.includes(step.contentCondition)) {
        message.error(`步骤${i + 1}选择的按钮操作无效`)
        return
      }
    }
  }

  // 发送保存事件
  emit('save', steps.value)
  message.success('配置保存成功')
  handleClose()
}



// 关闭抽屉
const handleClose = () => {
  visible.value = false
}
</script>

<style scoped>
.funnel-step-config {
  padding: 16px 0;
}

.steps-container {
  overflow-y: auto;
}

.step-item {
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 16px;
  background: #fafafa;
}

.step-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.step-number {
  background: #1890ff;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  min-width: 50px;
  text-align: center;
}

.config-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.label {
  width: 80px;
  font-weight: 500;
  color: #666;
}

.config-preview {
  margin-top: 24px;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 6px;
}

.config-preview h4 {
  margin-bottom: 8px;
  color: #333;
}

.config-preview pre {
  background: white;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  max-height: 200px;
  overflow-y: auto;
}
</style>
