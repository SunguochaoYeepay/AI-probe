# 更新日志

## [2025-10-11] - API 扩展与项目配置管理

### 新增功能

#### 1. 新增 API 接口支持

添加了两个新的 API 接口：

- **获取团队列表** (`/wfManage/getSimpleTeamList`)
  - 用于获取系统中所有团队的列表
  - 支持团队信息查询和管理

- **获取项目点位列表** (`/tracker/buryPointWarehouse/getProjectAndWeList`)
  - 用于获取指定项目下的所有埋点配置
  - 支持动态加载项目的点位信息

#### 2. API 配置增强

**文件**: `src/config/api.js`

新增 `endpoints` 配置项，集中管理所有 API 端点：

```javascript
endpoints: {
  getTeamList: {
    path: "/wfManage/getSimpleTeamList",
    method: "POST",
    description: "获取简单的团队列表"
  },
  getProjectAndPoints: {
    path: "/tracker/buryPointWarehouse/getProjectAndWeList",
    method: "POST",
    description: "获取项目下的所有点位列表"
  },
  searchBuryPoint: {
    path: "/tracker/buryPointTest/search",
    method: "POST",
    description: "搜索埋点测试数据"
  }
}
```

#### 3. API 方法实现

**文件**: `src/api/index.js`

新增两个 API 方法：

- `getTeamList()`: 获取团队列表
- `getProjectAndPoints(projectId)`: 获取项目和点位列表

特点：
- 自动注入 access-token
- 支持动态项目ID
- 完整的错误处理
- 详细的日志输出

#### 4. 项目配置管理 Composable

**文件**: `src/composables/useProjectConfig.js`

创建了专门的 composable 来管理项目配置，提供以下功能：

**状态管理**:
- `teamList`: 团队列表
- `projectList`: 项目列表
- `pointList`: 点位列表
- `loading`: 加载状态
- `error`: 错误信息

**方法**:
- `fetchTeamList()`: 获取团队列表
- `fetchProjectAndPoints(projectId)`: 获取项目点位列表
- `findPointByName(pointName)`: 根据名称查找点位
- `findPointById(pointId)`: 根据ID查找点位
- `getAllPointIds()`: 获取所有点位ID
- `getAllPointNames()`: 获取所有点位名称

#### 5. 项目配置管理界面

**组件**: `src/components/ProjectConfigPanel.vue`

创建了一个完整的项目配置管理面板，包含：

**功能**:
- ✅ 一键获取团队列表
- ✅ 一键获取项目点位信息
- ✅ 刷新所有配置数据
- ✅ 点位搜索功能
- ✅ 点位选择功能
- ✅ 统计信息展示

**界面特点**:
- 使用 Ant Design Vue 组件库
- 响应式布局设计
- 实时加载状态显示
- 友好的错误提示
- 分页展示支持

#### 6. 测试页面

**文件**: 
- `src/views/ProjectConfigTest.vue`: 测试页面
- 路由路径: `/project-config`

### 文档

#### 1. API 使用示例文档

**文件**: `doc/API使用示例.md`

包含：
- API 接口说明
- 使用方法示例
- Composable 使用指南
- 完整示例代码
- 调试技巧
- 注意事项

### 技术细节

#### API 请求配置

所有新增接口都遵循以下配置：

```javascript
{
  baseURL: "https://probe.yeepay.com",
  headers: {
    'Content-Type': 'text/plain;charset=UTF-8',
    'Accept': '*/*',
    'access-token': '自动注入'
  }
}
```

#### 错误处理

- 统一的错误捕获机制
- 详细的错误日志输出
- 友好的用户提示
- 支持错误恢复

#### 日志系统

- 请求前日志
- 响应后日志
- 错误日志
- 性能日志

### 使用示例

#### 基础使用

```javascript
import { useProjectConfig } from '@/composables/useProjectConfig'

const { fetchTeamList, fetchProjectAndPoints } = useProjectConfig()

// 获取团队列表
await fetchTeamList()

// 获取项目点位
await fetchProjectAndPoints('event1021')
```

#### 在组件中使用

```vue
<script setup>
import { onMounted } from 'vue'
import { useProjectConfig } from '@/composables/useProjectConfig'

const { 
  teamList, 
  pointList, 
  fetchTeamList, 
  fetchProjectAndPoints 
} = useProjectConfig()

onMounted(async () => {
  await fetchTeamList()
  await fetchProjectAndPoints()
})
</script>
```

### 测试方法

1. 启动开发服务器：
   ```bash
   npm run dev
   ```

2. 访问测试页面：
   ```
   http://localhost:5173/project-config
   ```

3. 点击按钮测试各项功能

### 兼容性

- ✅ 与现有 API 完全兼容
- ✅ 不影响现有功能
- ✅ 可独立使用
- ✅ 支持与其他模块集成

### 后续计划

- [ ] 添加团队切换功能
- [ ] 添加项目切换功能
- [ ] 支持点位配置编辑
- [ ] 添加配置导入导出
- [ ] 优化性能和缓存

### 相关文件

**配置文件**:
- `src/config/api.js` - API 配置
- `src/api/index.js` - API 实现

**业务逻辑**:
- `src/composables/useProjectConfig.js` - 项目配置 Composable

**界面组件**:
- `src/components/ProjectConfigPanel.vue` - 配置管理面板
- `src/views/ProjectConfigTest.vue` - 测试页面

**路由**:
- `src/router/index.js` - 路由配置

**文档**:
- `doc/API使用示例.md` - API 使用文档
- `CHANGELOG.md` - 更新日志

