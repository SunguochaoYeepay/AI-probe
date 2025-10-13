# AI提示词统一管理说明

## 概述

为了解决AI提示词分散在各个文件中、难以维护的问题，我们创建了统一的AI提示词管理系统。

## 架构设计

### 核心文件

**`src/utils/aiPrompts.js`** - AI提示词统一管理中心

包含三个主要部分：

1. **AI_PROMPTS** - 提示词模板
2. **AI_RESPONSE_PARSERS** - 响应解析器
3. **AI_CONFIG** - AI配置参数

## 功能模块

### 1. 页面名称提取

**提示词**: `AI_PROMPTS.EXTRACT_PAGE_NAME(userInput)`

**解析器**: `AI_RESPONSE_PARSERS.parsePageName(response)`

**配置**: `AI_CONFIG.PAGE_NAME_EXTRACT_OPTIONS`

**功能**:
- 从用户输入中智能提取页面名称
- 自动去除"分析"、"页面访问量"等无关词汇
- 处理多行响应，只取第一个有效页面名称
- 验证页面名称的有效性

**使用示例**:
```javascript
const { OllamaService } = await import('@/utils/ollamaService')
const { AI_PROMPTS, AI_RESPONSE_PARSERS, AI_CONFIG } = await import('@/utils/aiPrompts')
const ollamaService = new OllamaService()

const prompt = AI_PROMPTS.EXTRACT_PAGE_NAME(userMessage)
const response = await ollamaService.generate(prompt, AI_CONFIG.PAGE_NAME_EXTRACT_OPTIONS)
const pageName = AI_RESPONSE_PARSERS.parsePageName(response)
```

### 2. 分析类型检测

**提示词**: `AI_PROMPTS.DETECT_ANALYSIS_TYPE(userInput)`

**解析器**: `AI_RESPONSE_PARSERS.parseAnalysisType(response)`

**配置**: `AI_CONFIG.ANALYSIS_TYPE_DETECT_OPTIONS`

**功能**:
- 识别用户意图的分析类型
- 支持的类型：page_visits（页面访问）、click_analysis（点击分析）、conversion_analysis（转化分析）、general（通用）

### 3. 页面存在性检查

**提示词**: `AI_PROMPTS.CHECK_PAGE_EXISTS(pageName)`

**解析器**: `AI_RESPONSE_PARSERS.parsePageExists(response)`

**配置**: `AI_CONFIG.PAGE_EXISTS_CHECK_OPTIONS`

**功能**:
- 智能判断页面是否存在于系统中
- 理解肯定和否定表达
- 处理模糊回答

### 4. 示例页面生成

**提示词**: `AI_PROMPTS.GENERATE_SAMPLE_PAGES()`

**解析器**: `AI_RESPONSE_PARSERS.parseSamplePages(response)`

**配置**: `AI_CONFIG.SAMPLE_PAGES_OPTIONS`

**功能**:
- 动态生成系统中的示例页面列表
- 用于错误提示和用户引导
- 完全替代硬编码的页面列表

## 重构改进

### 问题修复

1. **多行响应处理**
   - 问题：AI返回多个页面名称（用换行符分隔）
   - 解决：只取第一个有效的页面名称

2. **硬编码清除**
   - 移除所有硬编码的页面列表
   - 移除所有硬编码的关键词匹配
   - 所有示例页面改为AI动态生成

3. **提示词统一**
   - 所有AI提示词集中管理
   - 便于调整和优化AI行为
   - 避免重复代码

### 受影响的文件

- ✅ `src/components/AIChatInterface.vue` - 更新所有AI函数
- ✅ `src/composables/useChart.js` - 更新页面名称提取
- ✅ `src/utils/aiPrompts.js` - 新增统一管理文件

## 使用指南

### 添加新的AI功能

1. 在 `AI_PROMPTS` 中添加提示词模板
2. 在 `AI_RESPONSE_PARSERS` 中添加解析函数
3. 在 `AI_CONFIG` 中添加配置参数
4. 在业务代码中引入使用

**示例**:
```javascript
// 1. 在 aiPrompts.js 中添加
export const AI_PROMPTS = {
  // ... 其他提示词
  NEW_FEATURE: (input) => `提示词模板 ${input}`
}

export const AI_RESPONSE_PARSERS = {
  // ... 其他解析器
  parseNewFeature: (response) => {
    // 解析逻辑
    return result
  }
}

export const AI_CONFIG = {
  // ... 其他配置
  NEW_FEATURE_OPTIONS: {
    temperature: 0.1,
    num_predict: 50
  }
}

// 2. 在业务代码中使用
const { AI_PROMPTS, AI_RESPONSE_PARSERS, AI_CONFIG } = await import('@/utils/aiPrompts')
const prompt = AI_PROMPTS.NEW_FEATURE(input)
const response = await ollamaService.generate(prompt, AI_CONFIG.NEW_FEATURE_OPTIONS)
const result = AI_RESPONSE_PARSERS.parseNewFeature(response)
```

### 修改现有提示词

只需修改 `src/utils/aiPrompts.js` 中对应的提示词模板即可，所有使用该提示词的地方都会自动生效。

## 优势

1. **集中管理** - 所有AI相关配置在一个文件中
2. **易于维护** - 修改提示词不需要改动业务代码
3. **可复用** - 解析器和配置可以在多处使用
4. **易于测试** - 可以单独测试提示词和解析器
5. **智能化** - 完全AI驱动，无硬编码逻辑

## 注意事项

1. 所有AI函数都是异步的，需要使用 `await`
2. AI响应可能不稳定，需要做好错误处理
3. 解析器需要处理各种可能的AI响应格式
4. 温度参数影响AI的创造性，需根据场景调整

## 未来扩展

- [ ] 添加更多分析类型
- [ ] 支持多语言提示词
- [ ] 提示词版本管理
- [ ] AI响应缓存机制
- [ ] 提示词效果评估工具

