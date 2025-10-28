# CS架构迁移技术方案

## 1. 项目背景

### 1.1 当前问题
- **数据量大**：查询10天数据 = 10次API调用 × 每次3万条 = 30万条数据
- **处理慢**：前端处理30万条数据需要5-10秒，可能导致浏览器卡顿
- **重复查询**：用户每次打开都要重新获取和处理数据
- **内存压力**：30万条数据占用大量内存，尤其双埋点关联计算

### 1.2 解决方案
从"前端全量处理"架构迁移到"CS架构（单机部署）"

## 2. 技术架构设计

### 2.1 整体架构
```
用户机器：
├── 客户端应用 (Electron)
│   ├── 前端界面 (Vue 3)
│   ├── 本地服务端 (Node.js)
│   └── 本地数据库 (SQLite)
└── 配置文件
```

### 2.2 数据流设计
```
当前：前端 → API → 42万条原始数据 → 前端聚合 → 存储
目标：客户端 → 本地服务端 → 服务端聚合 → 1条聚合数据 → 客户端存储
```

## 3. 技术栈选择

### 3.1 客户端 (Electron)
- **主进程**：Electron + Node.js
- **渲染进程**：Vue 3 + Vite（保持现有技术栈）
- **通信**：IPC + HTTP

### 3.2 服务端 (内置Node.js)
- **框架**：Express
- **数据库**：SQLite
- **任务调度**：node-cron
- **数据处理**：复用现有聚合逻辑

### 3.3 数据库设计
```sql
-- 图表配置表
CREATE TABLE charts (
  id TEXT PRIMARY KEY,
  name TEXT,
  config TEXT,  -- JSON配置
  created_at DATETIME,
  updated_at DATETIME
);

-- 聚合数据表
CREATE TABLE chart_data (
  id INTEGER PRIMARY KEY,
  chart_id TEXT,
  date TEXT,
  data TEXT,  -- JSON数据
  created_at DATETIME
);
```

## 4. 核心服务设计

### 4.1 数据聚合服务
```javascript
class DataAggregationService {
  async aggregate(rawData, chartConfig) {
    // 1. 应用过滤条件
    const filtered = this.applyFilters(rawData, chartConfig.filters)
    
    // 2. 根据图表类型聚合
    let result
    switch (chartConfig.chartType) {
      case 'line':
        result = this.aggregateForLine(filtered, chartConfig)
        break
      case 'bar':
        result = this.aggregateForBar(filtered, chartConfig)
        break
      // ... 其他图表类型
    }
    
    return result
  }
}
```

### 4.2 定时更新服务
```javascript
class ScheduledUpdateService {
  startScheduler() {
    // 每天凌晨2点自动更新
    cron.schedule('0 2 * * *', async () => {
      await this.updateAllCharts()
    })
  }
}
```

## 5. 项目结构

```
yeepay-charts-desktop/
├── electron/
│   ├── main.js                 # Electron主进程
│   ├── preload.js             # 预加载脚本
│   └── server/                # 内置服务端
│       ├── app.js             # Express应用
│       ├── services/          # 业务服务
│       └── routes/            # API路由
├── src/                       # 现有前端代码
├── database/
│   └── init.sql              # 数据库初始化
└── package.json
```

## 6. 迁移策略

### 6.1 阶段1：服务端开发（2-3周）
1. 开发数据聚合API
2. 实现定时更新服务
3. 设计数据库结构

### 6.2 阶段2：客户端改造（1-2周）
1. 集成Electron
2. 改造数据获取逻辑
3. 实现本地缓存

### 6.3 阶段3：测试优化（1周）
1. 性能测试
2. 稳定性测试
3. 用户体验优化

## 7. 性能优势

### 7.1 数据处理
- **服务端聚合**：42万条数据 → 1条聚合数据
- **本地缓存**：毫秒级响应
- **增量更新**：只处理新数据

### 7.2 用户体验
- **离线使用**：本地数据支持离线查看
- **快速启动**：本地服务启动快
- **数据安全**：数据不离开用户机器

## 8. 风险评估

| 风险类型 | 风险等级 | 影响程度 | 发生概率 |
|---------|---------|---------|---------|
| 技术复杂度 | 🟡 中等 | 中等 | 中等 |
| 开发周期 | 🟡 中等 | 中等 | 低 |
| 学习成本 | 🟡 中等 | 低 | 高 |
| 部署复杂度 | 🟢 低 | 低 | 低 |
| 数据安全 | 🟢 低 | 低 | 低 |
| 用户体验 | 🟢 低 | 低 | 低 |

## 9. 实施建议

### 9.1 立即开始
1. **设计API接口**：定义客户端与服务端的通信协议
2. **开发服务端**：先实现核心的数据聚合功能
3. **保持兼容**：确保现有功能不受影响

### 9.2 渐进迁移
1. **并行开发**：服务端和客户端同时开发
2. **功能对等**：确保新架构功能完整
3. **平滑切换**：支持一键切换架构

## 10. 总结

CS架构迁移方案能够：
- 解决当前性能瓶颈
- 提供更好的用户体验
- 支持离线使用
- 保证数据安全

**建议**：开始迁移，分阶段实施，风险可控。

---
**文档版本**：v1.0  
**创建时间**：2025-01-11  
**作者**：AI助手  
**状态**：待审核
