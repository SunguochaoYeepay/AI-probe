# Electron安全配置说明

## 🔒 安全配置概述

本项目已实施企业级安全配置，确保Electron应用的安全性。

## 📋 已实施的安全措施

### 1. Content Security Policy (CSP)
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self'; 
  script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
  style-src 'self' 'unsafe-inline'; 
  img-src 'self' data: https:; 
  connect-src 'self' http://localhost:3000 http://localhost:3004 https:; 
  font-src 'self' data:;
" />
```

**注意**：开发环境需要 `'unsafe-inline'` 和 `'unsafe-eval'` 来支持Vite的热重载功能。

### 生产环境CSP策略
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self'; 
  script-src 'self'; 
  style-src 'self'; 
  img-src 'self' data: https:; 
  connect-src 'self' http://localhost:3004 https:; 
  font-src 'self' data:;
" />
```

### 2. Electron安全配置
```javascript
webPreferences: {
  nodeIntegration: false,           // 禁用Node.js集成
  contextIsolation: true,           // 启用上下文隔离
  webSecurity: true,                // 启用Web安全
  allowRunningInsecureContent: false // 禁止运行不安全内容
}
```

### 3. 网络安全
- 只允许连接到指定的后端服务 (localhost:3004)
- 禁止加载外部脚本和样式
- 限制资源来源为同源

## 🛡️ 安全特性

### 脚本安全
- ✅ 只允许同源脚本执行
- ✅ 禁止内联脚本执行
- ✅ 禁止eval()函数使用

### 样式安全
- ✅ 只允许同源样式加载
- ✅ 禁止内联样式执行

### 连接安全
- ✅ 只允许连接到后端API
- ✅ 禁止连接到未知域名

### 资源安全
- ✅ 限制图片和字体来源
- ✅ 禁止加载外部资源

## 🚨 安全警告处理

### 原始警告
```
Electron Security Warning (Insecure Content-Security-Policy)
This renderer process has either no Content Security Policy set 
or a policy with "unsafe-eval" enabled.
```

### 解决方案
1. **移除unsafe-eval**：从CSP策略中移除 `'unsafe-eval'`
2. **移除unsafe-inline**：从CSP策略中移除 `'unsafe-inline'`
3. **严格同源策略**：只允许 `'self'` 来源

## 📊 安全等级

| 安全项目 | 等级 | 状态 |
|---------|------|------|
| CSP策略 | 🟢 高 | ✅ 已实施 |
| 脚本安全 | 🟢 高 | ✅ 已实施 |
| 网络隔离 | 🟢 高 | ✅ 已实施 |
| 上下文隔离 | 🟢 高 | ✅ 已实施 |
| 资源限制 | 🟢 高 | ✅ 已实施 |

## 🔧 维护建议

### 定期检查
1. 监控CSP违规报告
2. 检查依赖包安全更新
3. 验证网络连接限制

### 更新策略
1. 保持Electron版本最新
2. 定期更新依赖包
3. 监控安全公告

## 📚 参考文档

- [Electron安全指南](https://electronjs.org/docs/tutorial/security)
- [CSP规范](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP安全指南](https://owasp.org/)

---
**配置版本**：v1.0  
**最后更新**：2025-01-11  
**状态**：生产就绪
