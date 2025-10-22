<template>
  <a-drawer
    v-model:open="visible"
    :title="selectionType === 'queries' ? `选择查询条件 - ${pageName}` : `选择按钮 - ${pageName}`"
    width="800px"
    placement="right"
    @close="handleCancel"
  >
    <div class="selection-content">
      <p style="margin-bottom: 16px; color: #666;">
        该页面共有 {{ buttons.length }} 个{{ selectionType === 'queries' ? '查询条件' : '按钮' }}，请选择您要分析的{{ selectionType === 'queries' ? '查询条件' : '按钮' }}：
      </p>
      
      <!-- 表格展示 -->
      <a-table
        :columns="tableColumns"
        :data-source="tableData"
        :pagination="false"
        :scroll="{ y: 500 }"
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
            <a-button type="primary" size="small" @click="selectButton(record)">
              选择分析
            </a-button>
          </template>
        </template>
      </a-table>
      
      <div v-if="buttons.length === 0" class="no-data">
        <a-empty :description="selectionType === 'queries' ? '该页面暂无查询条件数据' : '该页面暂无按钮点击数据'" />
      </div>
    </div>
  </a-drawer>
</template>

<script setup>
import { computed } from 'vue'

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
  'select-button'
])

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
    const treeData = []
    const groupMap = new Map()
    
    // 按组分类
    props.buttons.forEach((button, index) => {
      if (button.isSummary) {
        // 汇总项作为父节点
        const parentKey = `group_${button.groupType}`
        if (!groupMap.has(parentKey)) {
          groupMap.set(parentKey, {
            key: parentKey,
            content: `${button.groupType}:全部${button.groupType}`,
            displayName: `全部${button.groupType}`,
            groupType: button.groupType,
            pv: button.pv,
            uv: button.uv,
            isSummary: true,
            children: []
          })
        }
      } else {
        // 子项
        const parentKey = `group_${button.parentType || button.groupType}`
        if (groupMap.has(parentKey)) {
          groupMap.get(parentKey).children.push({
            key: button.content || `item_${index}`,
            content: button.content,
            displayName: button.displayName,
            groupType: button.groupType,
            parentType: button.parentType,
            pv: button.pv,
            uv: button.uv,
            isSummary: false
          })
        } else {
          // 如果没有对应的父节点，创建一个
          groupMap.set(parentKey, {
            key: parentKey,
            content: `${button.parentType || button.groupType}:全部${button.parentType || button.groupType}`,
            displayName: `全部${button.parentType || button.groupType}`,
            groupType: button.parentType || button.groupType,
            pv: 0,
            uv: 0,
            isSummary: true,
            children: [{
              key: button.content || `item_${index}`,
              content: button.content,
              displayName: button.displayName,
              groupType: button.groupType,
              parentType: button.parentType,
              pv: button.pv,
              uv: button.uv,
              isSummary: false
            }]
          })
        }
      }
    })
    
    // 转换为数组
    groupMap.forEach(group => {
      treeData.push(group)
    })
    
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

const handleCancel = () => {
  visible.value = false
}
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
</style>
