# API 使用示例

## 概述

本文档介绍如何使用新增的团队列表和项目点位列表 API。

## 新增接口

### 1. 获取团队列表

**接口地址**: `/wfManage/getSimpleTeamList`  
**请求方法**: `POST`  
**请求参数**: `{}`

**使用方法**:

```javascript
import { yeepayAPI } from '@/api'

// 直接调用
const response = await yeepayAPI.getTeamList()
console.log('团队列表:', response.data)
```

### 2. 获取项目和点位列表

**接口地址**: `/tracker/buryPointWarehouse/getProjectAndWeList`  
**请求方法**: `POST`  
**请求参数**: `{ "projectId": "event1021" }`

**使用方法**:

```javascript
import { yeepayAPI } from '@/api'

// 使用默认项目ID
const response = await yeepayAPI.getProjectAndPoints()
console.log('项目点位列表:', response.data)

// 指定项目ID
const response = await yeepayAPI.getProjectAndPoints('event1021')
console.log('项目点位列表:', response.data)
```

## 使用 Composable

推荐使用 `useProjectConfig` composable 来管理项目配置：

```vue
<script setup>
import { onMounted } from 'vue'
import { useProjectConfig } from '@/composables/useProjectConfig'

const {
  teamList,
  projectList,
  pointList,
  loading,
  error,
  fetchTeamList,
  fetchProjectAndPoints,
  findPointByName,
  getAllPointIds
} = useProjectConfig()

onMounted(async () => {
  // 获取团队列表
  try {
    await fetchTeamList()
    console.log('团队列表:', teamList.value)
  } catch (err) {
    console.error('获取团队列表失败:', err)
  }
  
  // 获取项目点位列表
  try {
    const result = await fetchProjectAndPoints()
    console.log('项目信息:', result.project)
    console.log('点位列表:', result.points)
    
    // 查找特定点位
    const visitPoint = findPointByName('页面访问埋点')
    console.log('访问埋点信息:', visitPoint)
    
    // 获取所有点位ID
    const pointIds = getAllPointIds()
    console.log('所有点位ID:', pointIds)
  } catch (err) {
    console.error('获取项目点位失败:', err)
  }
})
</script>

<template>
  <div v-loading="loading">
    <div v-if="error" class="error">{{ error }}</div>
    
    <!-- 团队列表 -->
    <div v-if="teamList.length">
      <h3>团队列表</h3>
      <ul>
        <li v-for="team in teamList" :key="team.id">
          {{ team.name }}
        </li>
      </ul>
    </div>
    
    <!-- 点位列表 -->
    <div v-if="pointList.length">
      <h3>点位列表</h3>
      <ul>
        <li v-for="point in pointList" :key="point.id">
          {{ point.name }} (ID: {{ point.id }})
        </li>
      </ul>
    </div>
  </div>
</template>
```

## 完整示例：获取所有配置

```javascript
import { useProjectConfig } from '@/composables/useProjectConfig'

async function loadAllConfig() {
  const { 
    fetchTeamList, 
    fetchProjectAndPoints,
    teamList,
    pointList 
  } = useProjectConfig()
  
  try {
    // 1. 获取团队列表
    console.log('步骤 1: 获取团队列表')
    await fetchTeamList()
    console.log(`成功获取 ${teamList.value.length} 个团队`)
    
    // 2. 获取项目点位列表
    console.log('步骤 2: 获取项目点位列表')
    const result = await fetchProjectAndPoints('event1021')
    console.log(`成功获取 ${pointList.value.length} 个点位`)
    
    // 3. 返回所有配置
    return {
      teams: teamList.value,
      project: result.project,
      points: result.points
    }
  } catch (error) {
    console.error('加载配置失败:', error)
    throw error
  }
}

// 使用
loadAllConfig().then(config => {
  console.log('所有配置:', config)
})
```

## API 配置

在 `src/config/api.js` 中已配置：

```javascript
endpoints: {
  // 获取团队列表
  getTeamList: {
    path: "/wfManage/getSimpleTeamList",
    method: "POST",
    description: "获取简单的团队列表"
  },
  // 获取项目和点位列表
  getProjectAndPoints: {
    path: "/tracker/buryPointWarehouse/getProjectAndWeList",
    method: "POST",
    description: "获取项目下的所有点位列表"
  }
}
```

## 调试技巧

1. **查看请求日志**：所有 API 请求都会在控制台输出详细日志
2. **错误处理**：使用 try-catch 捕获错误并查看 error.message
3. **响应格式**：根据实际返回的数据结构调整代码

## 注意事项

1. 所有请求都会自动添加 `access-token` 请求头
2. 项目ID默认使用配置文件中的值，也可以手动指定
3. 接口返回的数据结构可能需要根据实际情况调整 composable 的解析逻辑

