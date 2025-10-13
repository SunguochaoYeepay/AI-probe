# 移除基础URL配置说明

## 变更概述

从系统配置管理的"API配置"标签页中移除了"基础URL"配置项，将 API 基础地址直接在代码中写死。

## 变更原因

1. **简化配置界面**：减少不必要的配置项，降低用户配置复杂度
2. **提高稳定性**：避免用户误修改基础URL导致功能异常
3. **减少维护成本**：基础URL相对固定，不需要动态配置

## 变更内容

### 1. 移除的配置项
- ✅ 删除了"基础URL"输入框
- ✅ 移除了 `baseUrl` 字段
- ✅ 简化了API配置表单

### 2. 保留的配置项
- ✅ **每次查询数据量**：控制API查询的数据条数

## 界面对比

### 变更前
```
API配置
├── 基础URL (输入框) ❌ 移除
└── 每次查询数据量 (数字输入框)
```

### 变更后
```
API配置
└── 每次查询数据量 (数字输入框)
```

## 技术实现

### 1. 基础URL写死在代码中

**src/api/index.js**：
```javascript
// 设置 baseURL（如果在请求配置中没有完整的 URL）
if (!config.url.startsWith('http')) {
  config.baseURL = API_CONFIG.environments.development.baseUrl // 直接使用写死的 URL
}
```

**src/config/api.js**：
```javascript
environments: {
  development: {
    baseUrl: "https://probe.yeepay.com", // 写死在配置文件中
    // ... 其他配置
  }
}
```

### 2. 配置表单简化

**变更前**：
```javascript
const apiConfigForm = computed({
  get: () => ({
    baseUrl: store.state.apiConfig.baseUrl, // ❌ 移除
    pageSize: store.state.apiConfig.pageSize
  }),
  set: (value) => {
    store.dispatch('updateApiConfig', value)
  }
})
```

**变更后**：
```javascript
const apiConfigForm = computed({
  get: () => ({
    pageSize: store.state.apiConfig.pageSize
  }),
  set: (value) => {
    store.dispatch('updateApiConfig', value)
  }
})
```

## 优势

### 1. 界面简化
- ✅ 减少了配置项数量
- ✅ 降低了用户配置复杂度
- ✅ 界面更加简洁

### 2. 稳定性提升
- ✅ 避免用户误修改基础URL
- ✅ 减少配置错误导致的故障
- ✅ 提高系统稳定性

### 3. 维护便利
- ✅ 减少了配置管理复杂度
- ✅ 基础URL集中管理在代码中
- ✅ 降低维护成本

## 影响范围

### 1. 用户界面
- ✅ API配置界面更加简洁
- ✅ 用户只需要关注数据量配置
- ✅ 减少了配置错误的可能性

### 2. 功能影响
- ✅ 所有功能保持不变
- ✅ API调用正常
- ✅ 数据获取功能完整

### 3. 代码维护
- ✅ 配置逻辑简化
- ✅ 减少了状态管理复杂度
- ✅ 代码更加清晰

## 相关文件

### 修改的文件
- `src/components/ConfigModal.vue` - 移除基础URL配置项
- `src/views/Home.vue` - 简化API配置表单
- `src/api/index.js` - 直接使用写死的URL

### 保持不变的文件
- `src/config/api.js` - 基础URL写死在配置文件中
- `src/store/index.js` - 状态管理保持不变

## 总结

通过移除基础URL配置项，我们成功地：

- ✅ **简化了配置界面**
- ✅ **提高了系统稳定性**
- ✅ **降低了维护成本**
- ✅ **保持了功能完整性**

现在API配置界面只保留最重要的配置项：每次查询数据量，用户操作更加简单！
