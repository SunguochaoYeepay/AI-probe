<template>
  <a-drawer
    v-model:open="visible"
    :title="selectionType === 'queries' ? `选择查询条件 - ${pageName}` : `选择按钮 - ${pageName}`"
    width="800px"
    placement="right"
    :mask="true"
    :mask-closable="true"
    :z-index="1000"
    @close="handleCancel"
  >
    <div class="selection-content">
      <p class="modal-description">
        该页面共有 {{ buttons.length }} 个{{ selectionType === 'queries' ? '查询条件' : '按钮' }}，请选择您要分析的{{ selectionType === 'queries' ? '查询条件' : '按钮' }}：
      </p>
      
      <!-- 表格展示 -->
      <a-table
        :columns="tableColumns"
        :data-source="tableData"
        :pagination="false"
        row-key="key"
        size="small"
        :expand-row-by-click="false"
        :default-expand-all-rows="true"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="condition-name">
              <template v-if="selectionType === 'queries'">
                <template v-if="record.isSummary">
                  <!-- 父节点显示 -->
                  <div class="group-summary-title">
                    <span class="group-type">{{ record.groupType }}</span>
                  </div>
                </template>
                <template v-else>
                  <!-- 子节点显示 -->
                  <div class="group-item-content">
                    <span class="group-indent">-</span>
                    <span class="item-name">{{ record.displayName }}</span>
                  </div>
                </template>
              </template>
              <template v-else>
                {{ record.content }}
              </template>
            </div>
          </template>
          
          <template v-else-if="column.key === 'type'">
            <a-tag color="blue">
              {{ selectionType === 'queries' ? '查询条件' : '按钮' }}
            </a-tag>
          </template>
          
          <template v-else-if="column.key === 'stats'">
            <div class="stats-tags">
              <a-tag color="blue">PV: {{ record.pv }}</a-tag>
              <a-tag color="green">UV: {{ record.uv }}</a-tag>
            </div>
          </template>
          
          <template v-else-if="column.key === 'action'">
            <template v-if="selectionType === 'queries' && !record.isSummary">
              <!-- 查询条件的子项支持多选 -->
              <a-checkbox 
                v-model:checked="record.selected"
                @change="handleSubItemSelection(record)"
              >
                选择
              </a-checkbox>
            </template>
            <template v-else-if="selectionType === 'queries' && record.isSummary">
              <!-- 查询条件的父级分类显示"全部"按钮 -->
              <a-button type="primary" size="small" @click="selectAllSubItems(record)">
                全部
              </a-button>
            </template>
            <template v-else>
              <!-- 其他情况使用单选按钮 -->
              <a-button type="primary" size="small" @click="selectButton(record)">
                选择分析
              </a-button>
            </template>
          </template>
        </template>
      </a-table>
      
      <div v-if="buttons.length === 0" class="no-data">
        <a-empty :description="selectionType === 'queries' ? '该页面暂无查询条件数据' : '该页面暂无按钮点击数据'" />
      </div>
      
      <!-- 多选确认区域 -->
      <div v-if="selectionType === 'queries' && selectedSubItems.length > 0" class="multi-selection-footer">
        <div class="selected-items">
          <span>已选择 {{ selectedSubItems.length }} 个条件：</span>
          <a-tag 
            v-for="item in selectedSubItems" 
            :key="item.key"
            closable
            @close="removeSelectedItem(item)"
          >
            {{ item.displayName }}
          </a-tag>
        </div>
        <div class="action-buttons">
          <a-button @click="clearSelection">清空选择</a-button>
          <a-button type="primary" @click="confirmMultiSelection">确认分析</a-button>
        </div>
      </div>
    </div>
  </a-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

// Props
const props = defineProps({
  open: {
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
  },
  selectionType: {
    type: String,
    default: 'buttons', // 'buttons' 或 'queries'
    validator: (value) => ['buttons', 'queries'].includes(value)
  }
})

// Emits
const emit = defineEmits([
  'update:open',
  'select-button',
  'select-multiple-conditions'
])

// 响应式数据
const selectedSubItems = ref([])

// Computed
const visible = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

// 表格列配置
const tableColumns = computed(() => {
  if (props.selectionType === 'queries') {
    return [
      {
        title: '查询条件',
        key: 'name',
        width: '45%',
        ellipsis: true
      },
      {
        title: '类型',
        key: 'type',
        width: '15%',
        align: 'center'
      },
      {
        title: '统计',
        key: 'stats',
        width: '25%',
        align: 'left'
      },
      {
        title: '操作',
        key: 'action',
        width: '15%',
        align: 'center'
      }
    ]
  } else {
    return [
      {
        title: '按钮名称',
        key: 'name',
        width: '45%',
        ellipsis: true
      },
      {
        title: '类型',
        key: 'type',
        width: '15%',
        align: 'center'
      },
      {
        title: '统计',
        key: 'stats',
        width: '25%',
        align: 'left'
      },
      {
        title: '操作',
        key: 'action',
        width: '15%',
        align: 'center'
      }
    ]
  }
})

// 表格数据
const tableData = computed(() => {
  if (props.selectionType === 'queries') {
    // 查询条件：构建树形结构
    console.log('🔍 构建查询条件树形结构，原始数据:', props.buttons)
    
    const treeData = []
    const groupMap = new Map()
    
    // 先按组分类所有数据
    const groups = new Map()
    
    props.buttons.forEach((button, index) => {
      const groupType = button.groupType || button.parentType
      if (!groups.has(groupType)) {
        groups.set(groupType, {
          summary: null,
          items: []
        })
      }
      
      if (button.isSummary) {
        groups.get(groupType).summary = button
      } else {
        groups.get(groupType).items.push(button)
      }
    })
    
    console.log('🔍 分组后的数据:', groups)
    
    // 为每个组构建树形结构
    groups.forEach((group, groupType) => {
      const parentKey = `group_${groupType}`
      
      // 创建父节点（汇总项）
      const parentNode = {
        key: parentKey,
        content: group.summary ? group.summary.content : `全部${groupType}`,
        displayName: group.summary ? group.summary.displayName : `全部${groupType}`,
        groupType: groupType,
        pv: group.summary ? group.summary.pv : group.items.reduce((sum, item) => sum + item.pv, 0),
        uv: group.summary ? group.summary.uv : group.items.reduce((sum, item) => sum + item.uv, 0),
        isSummary: true,
        children: []
      }
      
      // 添加子节点
      group.items.forEach((item, index) => {
        const childNode = {
          key: item.content || `item_${groupType}_${index}`,
          content: item.content,
          displayName: item.displayName,
          groupType: item.groupType,
          parentType: item.parentType || groupType,
          pv: item.pv,
          uv: item.uv,
          isSummary: false,
          selected: false
        }
        parentNode.children.push(childNode)
      })
      
      treeData.push(parentNode)
    })
    
    console.log('🔍 构建完成的树形数据:', treeData)
    return treeData
  } else {
    // 按钮：保持原有结构，但移除"全部"选项
    return props.buttons.map((button, index) => ({
      key: button.content || `item_${index}`,
      ...button
    }))
  }
})

// Methods
const selectButton = (button) => {
  emit('select-button', button)
}

const handleSubItemSelection = (item) => {
  if (item.selected) {
    // 添加到选中列表
    if (!selectedSubItems.value.find(selected => selected.key === item.key)) {
      selectedSubItems.value.push(item)
    }
  } else {
    // 从选中列表移除
    const index = selectedSubItems.value.findIndex(selected => selected.key === item.key)
    if (index > -1) {
      selectedSubItems.value.splice(index, 1)
    }
  }
}

const removeSelectedItem = (item) => {
  // 从选中列表移除
  const index = selectedSubItems.value.findIndex(selected => selected.key === item.key)
  if (index > -1) {
    selectedSubItems.value.splice(index, 1)
  }
  
  // 更新表格中的选中状态
  const currentTableData = tableData.value
  currentTableData.forEach(group => {
    if (group.children) {
      group.children.forEach(child => {
        if (child.key === item.key) {
          child.selected = false
        }
      })
    }
  })
}

const clearSelection = () => {
  selectedSubItems.value = []
  
  // 清空表格中的选中状态
  const currentTableData = tableData.value
  currentTableData.forEach(group => {
    if (group.children) {
      group.children.forEach(child => {
        child.selected = false
      })
    }
  })
}

const selectAllSubItems = (parentRecord) => {
  console.log('🔍 选择全部子项:', parentRecord)
  
  // 找到对应的父级分组
  const currentTableData = tableData.value
  const parentGroup = currentTableData.find(group => group.key === parentRecord.key)
  
  if (parentGroup && parentGroup.children) {
    // 勾选所有子项
    parentGroup.children.forEach(child => {
      child.selected = true
      
      // 添加到选中列表（如果还没有的话）
      if (!selectedSubItems.value.find(selected => selected.key === child.key)) {
        selectedSubItems.value.push(child)
      }
    })
    
    console.log('✅ 已勾选所有子项:', parentGroup.children.length, '个')
  }
}

const confirmMultiSelection = () => {
  if (selectedSubItems.value.length > 0) {
    emit('select-multiple-conditions', selectedSubItems.value)
    visible.value = false
  }
}

const handleCancel = () => {
  clearSelection()
  visible.value = false
}

// 监听弹窗关闭，清空选择
watch(visible, (newVal) => {
  if (!newVal) {
    clearSelection()
  }
})
</script>

<style scoped>
.selection-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.condition-name {
  font-size: 14px;
}

.stats-tags {
  display: flex;
  gap: 4px;
  justify-content: flex-start;
}

.no-data {
  text-align: center;
  padding: 40px 0;
}

/* 查询条件分组样式 */
.group-summary-title {
  font-size: 14px;
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 2px;
}

.group-type {
  color: #1890ff;
  font-weight: 600;
}

.group-item-content {
  font-size: 13px;
  color: #333;
  display: flex;
  align-items: center;
  margin-left: 16px;
}

.group-indent {
  color: #999;
  margin-right: 8px;
  font-weight: bold;
}

.item-name {
  color: #333;
}

/* 多选确认区域样式 */
.multi-selection-footer {
  margin-top: 16px;
  padding: 16px;
  background-color: #f5f5f5;
  border-radius: 6px;
  border: 1px solid #d9d9d9;
}

.selected-items {
  margin-bottom: 12px;
}

.selected-items span {
  margin-right: 8px;
  font-weight: 500;
  color: #333;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* 树形表格样式 */
:deep(.ant-table-tbody > tr.ant-table-row-level-0 > td) {
  background-color: #f6ffed;
  border-bottom: 1px solid #b7eb8f;
}

:deep(.ant-table-tbody > tr.ant-table-row-level-1 > td) {
  background-color: #fafafa;
}

:deep(.ant-table-tbody > tr.ant-table-row-level-0:hover > td) {
  background-color: #f0f9ff;
}

:deep(.ant-table-tbody > tr.ant-table-row-level-1:hover > td) {
  background-color: #f5f5f5;
}

/* 表格行样式 */
:deep(.ant-table-tbody > tr > td) {
  padding: 8px 12px;
}

:deep(.ant-table-tbody > tr:hover > td) {
  background-color: #f5f5f5;
}

/* 暗色主题支持 */
.dark-theme .modal-description {
  color: #cccccc !important;
}

.dark-theme .group-summary-title {
  color: #1890ff !important;
}

.dark-theme .group-type {
  color: #1890ff !important;
}

.dark-theme .group-item-content {
  color: #ffffff !important;
}

.dark-theme .group-indent {
  color: #999999 !important;
}

.dark-theme .item-name {
  color: #ffffff !important;
}

.dark-theme .multi-selection-footer {
  background-color: #1f1f1f !important;
  border-color: #303030 !important;
}

.dark-theme .selected-items span {
  color: #ffffff !important;
}

/* 表格暗色主题 */
.dark-theme :deep(.ant-table-tbody > tr.ant-table-row-level-0 > td) {
  background-color: #1f1f1f !important;
  border-bottom-color: #303030 !important;
}

.dark-theme :deep(.ant-table-tbody > tr.ant-table-row-level-1 > td) {
  background-color: #1f1f1f !important;
}

.dark-theme :deep(.ant-table-tbody > tr.ant-table-row-level-0:hover > td) {
  background-color: #303030 !important;
}

.dark-theme :deep(.ant-table-tbody > tr.ant-table-row-level-1:hover > td) {
  background-color: #303030 !important;
}

.dark-theme :deep(.ant-table-tbody > tr:hover > td) {
  background-color: #303030 !important;
}

/* 统计标签暗色主题 */
.dark-theme :deep(.ant-tag) {
  color: #ffffff !important;
}

.dark-theme :deep(.ant-tag-blue) {
  background-color: #1890ff !important;
  color: #ffffff !important;
}

.dark-theme :deep(.ant-tag-green) {
  background-color: #52c41a !important;
  color: #ffffff !important;
}

/* 复选框暗色主题 */
.dark-theme :deep(.ant-checkbox-wrapper) {
  color: #ffffff !important;
}

.dark-theme :deep(.ant-checkbox) {
  color: #ffffff !important;
}

.dark-theme :deep(.ant-checkbox-checked .ant-checkbox-inner) {
  background-color: #1890ff !important;
  border-color: #1890ff !important;
}

.dark-theme :deep(.ant-checkbox-inner) {
  background-color: #1f1f1f !important;
  border-color: #303030 !important;
}
</style>
