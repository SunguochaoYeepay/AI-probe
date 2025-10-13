# 移除 Probe API 地址配置说明

## 变更概述

从系统配置管理的"项目配置"标签页中移除了"Probe API 地址"配置项，将 API 地址直接在代码中写死。

## 变更原因

1. **简化配置界面**：减少不必要的配置项，降低用户配置复杂度
2. **提高安全性**：避免用户误修改 API 地址导致功能异常
3. **减少维护成本**：API 地址相对固定，不需要动态配置

## 变更内容

### 1. 移除的配置项
- ✅ 删除了"Probe API 地址"输入框
- ✅ 删除了相关的说明文字
- ✅ 移除了 `probeApiUrl` 字段

### 2. 保留的配置项
- ✅ **当前项目**：项目选择器
- ✅ **访问令牌**：API 认证令牌
- ✅ **操作按钮**：加载埋点配置

## 界面对比

### 变更前
```
项目配置
├── 当前项目 (项目选择器)
├── Probe API 地址 (输入框) ❌ 移除
├── 访问令牌 (密码框)
├── 操作按钮
└── 埋点配置状态
```

### 变更后
```
项目配置
├── 当前项目 (项目选择器)
├── 访问令牌 (密码框)
├── 操作按钮
└── 埋点配置状态
```

## 技术实现

### 1. API 地址写死在代码中

**probeService.js**：
```javascript
class ProbeService {
  constructor() {
    this.baseURL = 'https://probe.yeepay.com' // 写死在代码中
    this.token = null
  }
}
```

### 2. 配置表单简化

**变更前**：
```javascript
const projectConfigForm = computed({
  get: () => ({
    probeApiUrl: store.state.apiConfig.baseUrl || 'https://probe.yeepay.com', // ❌ 移除
    accessToken: store.state.apiConfig.accessToken,
    selectedProjectId: '...'
  }),
  set: (value) => {
    store.dispatch('updateApiConfig', {
      projectId: value.selectedProjectId,
      baseUrl: value.probeApiUrl, // ❌ 移除
      accessToken: value.accessToken
    })
  }
})
```

**变更后**：
```javascript
const projectConfigForm = computed({
  get: () => ({
    accessToken: store.state.apiConfig.accessToken,
    selectedProjectId: '...'
  }),
  set: (value) => {
    store.dispatch('updateApiConfig', {
      projectId: value.selectedProjectId,
      accessToken: value.accessToken
    })
  }
})
```

## 优势

### 1. 界面简化
- ✅ 减少了配置项数量
- ✅ 降低了用户配置复杂度
- ✅ 界面更加简洁

### 2. 安全性提升
- ✅ 避免用户误修改 API 地址
- ✅ 减少配置错误导致的故障
- ✅ 提高系统稳定性

### 3. 维护便利
- ✅ 减少了配置管理复杂度
- ✅ API 地址集中管理
- ✅ 降低维护成本

## 影响范围

### 1. 用户界面
- ✅ 配置界面更加简洁
- ✅ 用户操作更加简单
- ✅ 减少了配置错误的可能性

### 2. 功能影响
- ✅ 所有功能保持不变
- ✅ API 调用正常
- ✅ 项目配置功能完整

### 3. 代码维护
- ✅ 配置逻辑简化
- ✅ 减少了状态管理复杂度
- ✅ 代码更加清晰

## 相关文件

### 修改的文件
- `src/components/ConfigModal.vue` - 移除 API 地址配置项
- `src/views/Home.vue` - 简化配置表单

### 保持不变的文件
- `src/api/probeService.js` - API 地址写死在代码中
- `src/composables/useProjectConfig.js` - 核心逻辑不变
- `src/store/index.js` - 状态管理保持不变

## 总结

通过移除 Probe API 地址配置项，我们成功地：

- ✅ **简化了配置界面**
- ✅ **提高了系统安全性**
- ✅ **降低了维护成本**
- ✅ **保持了功能完整性**

现在用户只需要配置访问令牌和选择项目，操作更加简单直观！
