# Content Security Policy (CSP) 配置说明

## 问题描述

在测试AI配置连接时，出现CSP错误：
```
Refused to connect to 'http://localhost:11434/api/tags' because it violates the following Content Security Policy directive: "connect-src 'self' http://localhost:3000 http://localhost:3004 https:".
```

## 解决方案

### 1. 更新CSP配置

在以下文件中添加Ollama服务端口 `http://localhost:11434` 到 `connect-src` 指令：

#### vite.config.js
```javascript
headers: {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://localhost:3000 http://localhost:3004 http://localhost:11434 https:; font-src 'self' data:;"
}
```

#### index.html
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' http://localhost:3000 http://localhost:3004 http://localhost:11434 https:; font-src 'self' data:;" />
```

### 2. 当前CSP配置

| 指令 | 允许的内容 | 说明 |
|------|-----------|------|
| `default-src` | `'self'` | 默认只允许同源资源 |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval'` | 允许同源脚本、内联脚本和eval |
| `style-src` | `'self' 'unsafe-inline'` | 允许同源样式和内联样式 |
| `img-src` | `'self' data: https:` | 允许同源图片、data URI和HTTPS图片 |
| `connect-src` | `'self' http://localhost:3000 http://localhost:3004 http://localhost:11434 https:` | 允许连接到指定端口和HTTPS |
| `font-src` | `'self' data:` | 允许同源字体和data URI |

### 3. 允许的连接

- `'self'` - 同源连接
- `http://localhost:3000` - Vite开发服务器
- `http://localhost:3004` - 后端API服务器
- `http://localhost:11434` - Ollama AI服务
- `https:` - 所有HTTPS连接

### 4. 安全考虑

#### 开发环境
- 使用 `'unsafe-inline'` 和 `'unsafe-eval'` 支持Vite热重载
- 允许本地开发服务器连接

#### 生产环境
- 移除 `'unsafe-inline'` 和 `'unsafe-eval'`
- 只允许必要的连接
- 使用更严格的CSP策略

### 5. 验证修复

修复后，AI配置测试连接应该能够正常工作：

1. 打开系统设置 → AI配置
2. 点击"测试连接"按钮
3. 应该能够成功连接到Ollama服务

### 6. 常见CSP错误

| 错误类型 | 原因 | 解决方案 |
|---------|------|---------|
| `Refused to connect` | 连接被CSP阻止 | 添加目标URL到 `connect-src` |
| `Refused to load script` | 脚本被CSP阻止 | 添加脚本源到 `script-src` |
| `Refused to load style` | 样式被CSP阻止 | 添加样式源到 `style-src` |
| `Refused to load image` | 图片被CSP阻止 | 添加图片源到 `img-src` |

### 7. 调试CSP

在浏览器开发者工具中：
1. 打开Console标签
2. 查看CSP违规错误
3. 根据错误信息调整CSP配置
4. 使用 `Content-Security-Policy-Report-Only` 进行测试

## 总结

通过将 `http://localhost:11434` 添加到CSP的 `connect-src` 指令中，解决了Ollama服务连接被阻止的问题。这确保了AI配置功能能够正常工作，同时保持了适当的安全策略。
