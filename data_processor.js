/**
 * 余额分账流程数据处理器
 * 将API数据转换为设计界面格式
 */

class YeepayDataProcessor {
    constructor() {
        // 业务规则配置
        this.businessRules = {
            // 易分账相关流程
            "易分账-分账-分账查询": {
                processNode: "余额分账查询",
                step: 1,
                result: "成功",
                category: "分账流程"
            },
            "易分账-分账-分账复核": {
                processNode: "分账复核",
                step: 4,
                result: "成功",
                category: "分账流程"
            },
            "易分账-分账-分账": {
                processNode: "分账操作",
                step: 3,
                result: "成功",
                category: "分账流程"
            },
            
            // 对账管理相关流程
            "对账管理-对账中心-交易查询": {
                processNode: "交易查询",
                step: 2,
                result: "成功",
                category: "对账流程"
            },
            "对账管理-对账中心-结算查询": {
                processNode: "结算查询",
                step: 2,
                result: "成功",
                category: "对账流程"
            },
            "对账管理-对账中心-交易汇总": {
                processNode: "交易汇总",
                step: 2,
                result: "成功",
                category: "对账流程"
            },
            
            // 商户变更相关流程
            "老板管账-商户变更": {
                processNode: "商户变更",
                step: 1,
                result: "成功",
                category: "商户管理"
            },
            "易订货-商户变更": {
                processNode: "商户变更",
                step: 1,
                result: "成功",
                category: "商户管理"
            },
            
            // 安全验证相关
            "复核通过": {
                processNode: "安全验证",
                step: 4,
                result: "成功",
                category: "安全流程"
            },
            "提示": {
                processNode: "系统提示",
                step: 5,
                result: "成功",
                category: "系统流程"
            }
        };

        // 操作类型映射
        this.typeMapping = {
            "query": "查询",
            "click": "点击",
            "页面": "访问",
            "窗口": "弹窗",
            "完成": "完成"
        };

        // 行为映射
        this.behaviorMapping = {
            "打开": "打开",
            "关闭": "关闭",
            "操作": "操作"
        };
    }

    /**
     * 转换单个API数据记录
     * @param {Object} apiData - API数据记录
     * @returns {Object} 转换后的设计界面格式数据
     */
    convertSingleRecord(apiData) {
        const pageName = apiData.pageName;
        const rule = this.findBusinessRule(pageName);
        
        return {
            // 流程节点 - 根据业务规则推断
            "流程节点": rule ? rule.processNode : this.inferProcessNode(pageName),
            
            // 页面名称 - 直接映射
            "页面名称": pageName,
            
            // 类型 - 映射操作类型
            "类型": this.typeMapping[apiData.type] || apiData.type,
            
            // 行为 - 映射页面行为
            "行为": this.behaviorMapping[apiData.pageBehavior] || apiData.pageBehavior || "操作",
            
            // 自定义内容 - 直接映射
            "自定义内容": this.parseContent(apiData.content),
            
            // 结果 - 根据业务规则推断
            "结果": rule ? rule.result : this.inferResult(apiData),
            
            // 版本 - 默认V1，可配置
            "版本": "V1",
            
            // 耗时 - 直接映射
            "耗时": apiData.stayTime || "0",
            
            // 页面地址 - 直接映射
            "页面地址": apiData.wePath,
            
            // 用户标识 - 直接映射
            "用户标识": apiData.weUserId,
            
            // 商户标识 - 用户ID即商户ID
            "商户标识": apiData.weUserId,
            
            // 截图 - 生成截图文件名
            "截图": this.generateScreenshotName(apiData),
            
            // 额外信息
            "设备信息": `${apiData.weDeviceName} - ${apiData.weBrowserName}`,
            "IP地址": apiData.weIp,
            "创建时间": apiData.createdAt,
            "是否新用户": apiData.weNewStatus === 1 ? "是" : "否"
        };
    }

    /**
     * 批量转换API数据
     * @param {Array} apiDataList - API数据列表
     * @returns {Array} 转换后的数据列表
     */
    convertBatch(apiDataList) {
        return apiDataList.map(data => this.convertSingleRecord(data));
    }

    /**
     * 根据页面名称查找业务规则
     * @param {string} pageName - 页面名称
     * @returns {Object|null} 业务规则对象
     */
    findBusinessRule(pageName) {
        // 精确匹配
        if (this.businessRules[pageName]) {
            return this.businessRules[pageName];
        }
        
        // 模糊匹配
        for (const [key, rule] of Object.entries(this.businessRules)) {
            if (pageName.includes(key) || key.includes(pageName)) {
                return rule;
            }
        }
        
        return null;
    }

    /**
     * 推断流程节点
     * @param {string} pageName - 页面名称
     * @returns {string} 推断的流程节点
     */
    inferProcessNode(pageName) {
        if (pageName.includes("分账")) {
            return "分账相关操作";
        } else if (pageName.includes("对账")) {
            return "对账相关操作";
        } else if (pageName.includes("商户")) {
            return "商户管理操作";
        } else if (pageName.includes("银行")) {
            return "银行账户操作";
        } else {
            return "其他操作";
        }
    }

    /**
     * 推断操作结果
     * @param {Object} apiData - API数据
     * @returns {string} 推断的结果
     */
    inferResult(apiData) {
        // 根据操作类型和内容推断结果
        if (apiData.type === "query" || apiData.type === "点击") {
            return "成功";
        } else if (apiData.pageBehavior === "关闭") {
            return "完成";
        } else {
            return "成功";
        }
    }

    /**
     * 解析自定义内容
     * @param {string} content - 原始内容
     * @returns {string} 解析后的内容
     */
    parseContent(content) {
        if (!content) return "";
        
        try {
            // 尝试解析JSON
            const parsed = JSON.parse(content);
            if (typeof parsed === 'object') {
                // 提取关键信息
                const keys = Object.keys(parsed);
                if (keys.length > 0) {
                    return `${keys[0]}: ${parsed[keys[0]]}`;
                }
            }
        } catch (e) {
            // 不是JSON，直接返回
            return content;
        }
        
        return content;
    }

    /**
     * 生成截图文件名
     * @param {Object} apiData - API数据
     * @returns {string} 截图文件名
     */
    generateScreenshotName(apiData) {
        const timestamp = new Date(apiData.createdAt).getTime();
        const userId = apiData.weUserId;
        return `screenshot_${userId}_${timestamp}.png`;
    }

    /**
     * 生成流程分析报告
     * @param {Array} convertedData - 转换后的数据
     * @returns {Object} 分析报告
     */
    generateAnalysisReport(convertedData) {
        const report = {
            totalRecords: convertedData.length,
            processStats: {},
            userStats: {},
            timeStats: {},
            errorStats: {}
        };

        // 统计流程分布
        convertedData.forEach(record => {
            const processNode = record["流程节点"];
            report.processStats[processNode] = (report.processStats[processNode] || 0) + 1;
            
            const userId = record["用户标识"];
            report.userStats[userId] = (report.userStats[userId] || 0) + 1;
            
            const stayTime = parseInt(record["耗时"]) || 0;
            if (stayTime > 0) {
                report.timeStats[processNode] = (report.timeStats[processNode] || 0) + stayTime;
            }
            
            if (record["结果"] === "失败") {
                report.errorStats[processNode] = (report.errorStats[processNode] || 0) + 1;
            }
        });

        return report;
    }

    /**
     * 导出为CSV格式
     * @param {Array} convertedData - 转换后的数据
     * @returns {string} CSV字符串
     */
    exportToCSV(convertedData) {
        if (convertedData.length === 0) return "";
        
        const headers = Object.keys(convertedData[0]);
        const csvRows = [headers.join(',')];
        
        convertedData.forEach(record => {
            const values = headers.map(header => {
                const value = record[header] || '';
                // 处理包含逗号的值
                return `"${value.toString().replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        });
        
        return csvRows.join('\n');
    }

    /**
     * 导出为JSON格式
     * @param {Array} convertedData - 转换后的数据
     * @returns {string} JSON字符串
     */
    exportToJSON(convertedData) {
        return JSON.stringify(convertedData, null, 2);
    }
}

// 使用示例
const processor = new YeepayDataProcessor();

// 示例API数据
const sampleEventData = {
    "id": 7743,
    "pageName": "易分账-分账-分账查询",
    "type": "query",
    "content": "{\"商户编号\":\"10086624159\",\"变更申请状态\":\"全部\"}",
    "weCustomerKey": "d56f0b85-32b9-452c-b445-5d07ba5970f7-20250729154128349",
    "weUserId": "10091502926",
    "wePath": "https://mp.yeepay.com/mp-galaxy/mp-separate-account/#/ledgerManage/ledger_query",
    "weDeviceName": "PC",
    "wePlatform": "Win32",
    "weSystem": "web ",
    "weOs": "web",
    "weBrowserName": "chrome",
    "weNewStatus": 2,
    "weIp": "10.201.77.173",
    "weCountry": "0",
    "weProvince": "0",
    "weCity": "内网IP",
    "createdAt": "2025-10-10T06:31:37.000Z"
};

const samplePageData = {
    "id": 11350,
    "pageName": "易分账-分账-分账复核",
    "type": "页面",
    "stayTime": "30",
    "pageBehavior": "关闭",
    "weCustomerKey": "5c571dc8-bc1c-4d7d-ab79-48d485f64850-20250910111015940",
    "weUserId": "10091461782",
    "wePath": "https://mp.yeepay.com/mp-galaxy/mp-separate-account/#/ledgerManage/ledger_review",
    "weDeviceName": "PC",
    "wePlatform": "Win32",
    "weSystem": "web ",
    "weOs": "web",
    "weBrowserName": "chrome",
    "weNewStatus": 2,
    "weIp": "10.203.12.129",
    "weCountry": "0",
    "weProvince": "0",
    "weCity": "内网IP",
    "createdAt": "2025-10-10T06:31:49.000Z"
};

// 转换示例
console.log("=== 事件数据转换示例 ===");
const convertedEvent = processor.convertSingleRecord(sampleEventData);
console.log(JSON.stringify(convertedEvent, null, 2));

console.log("\n=== 页面数据转换示例 ===");
const convertedPage = processor.convertSingleRecord(samplePageData);
console.log(JSON.stringify(convertedPage, null, 2));

// 批量转换示例
const batchData = [sampleEventData, samplePageData];
const convertedBatch = processor.convertBatch(batchData);
console.log("\n=== 批量转换示例 ===");
console.log(JSON.stringify(convertedBatch, null, 2));

// 生成分析报告
const report = processor.generateAnalysisReport(convertedBatch);
console.log("\n=== 分析报告 ===");
console.log(JSON.stringify(report, null, 2));

// 导出示例
console.log("\n=== CSV导出示例 ===");
console.log(processor.exportToCSV(convertedBatch));

// 如果在浏览器环境中，将处理器暴露到全局
if (typeof window !== 'undefined') {
    window.YeepayDataProcessor = YeepayDataProcessor;
    window.processor = processor;
}
