/**
 * 易宝支付埋点API配置
 * 用于获取真实的埋点数据
 */

class YeepayAPI {
    constructor() {
        this.baseURL = 'https://probe.yeepay.com';
        this.endpoints = {
            search: '/tracker/buryPointTest/search'
        };
        
        // 默认配置
        this.defaultConfig = {
            projectId: 'event1021',
            selectedPointId: 110,
            dataType: 'list',
            order: 'descend',
            pageSize: 30,
            page: 1
        };
    }

    /**
     * 构建请求头
     * @param {string} accessToken - 访问令牌
     * @returns {Object} 请求头对象
     */
    buildHeaders(accessToken) {
        return {
            'accept': '*/*',
            'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
            'access-token': accessToken,
            'content-type': 'text/plain;charset=UTF-8',
            'origin': 'https://probe.yeepay.com',
            'referer': 'https://probe.yeepay.com/webfunny_event/eventSearch.html',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
        };
    }

    /**
     * 构建请求数据
     * @param {Object} config - 配置参数
     * @returns {Object} 请求数据对象
     */
    buildRequestData(config) {
        return {
            projectId: config.projectId || this.defaultConfig.projectId,
            selectedPointId: parseInt(config.selectedPointId) || this.defaultConfig.selectedPointId,
            calcInfo: config.calcInfo || {},
            dataType: config.dataType || this.defaultConfig.dataType,
            filterList: config.filterList || [],
            page: config.page || this.defaultConfig.page,
            pageSize: parseInt(config.pageSize) || this.defaultConfig.pageSize,
            order: config.order || this.defaultConfig.order,
            date: config.date || this.getCurrentDate()
        };
    }

    /**
     * 获取当前日期字符串
     * @returns {string} YYYY-MM-DD格式的日期
     */
    getCurrentDate() {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }

    /**
     * 搜索埋点数据
     * @param {Object} config - 配置参数
     * @param {string} accessToken - 访问令牌
     * @returns {Promise<Object>} API响应数据
     */
    async searchBuryPointData(config, accessToken) {
        if (!accessToken) {
            throw new Error('访问令牌不能为空');
        }

        const url = this.baseURL + this.endpoints.search;
        const headers = this.buildHeaders(accessToken);
        const requestData = this.buildRequestData(config);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.code !== 200) {
                throw new Error(result.msg || 'API请求失败');
            }

            return result;
        } catch (error) {
            console.error('API请求失败:', error);
            throw error;
        }
    }

    /**
     * 批量获取多页数据
     * @param {Object} config - 配置参数
     * @param {string} accessToken - 访问令牌
     * @param {number} maxPages - 最大页数
     * @returns {Promise<Array>} 合并后的数据列表
     */
    async searchBuryPointDataBatch(config, accessToken, maxPages = 5) {
        const allData = [];
        let currentPage = 1;
        let hasMoreData = true;

        while (hasMoreData && currentPage <= maxPages) {
            try {
                const pageConfig = { ...config, page: currentPage };
                const result = await this.searchBuryPointData(pageConfig, accessToken);
                
                if (result.data && result.data.dataList && result.data.dataList.length > 0) {
                    allData.push(...result.data.dataList);
                    currentPage++;
                    
                    // 如果返回的数据少于页面大小，说明没有更多数据了
                    if (result.data.dataList.length < (pageConfig.pageSize || this.defaultConfig.pageSize)) {
                        hasMoreData = false;
                    }
                } else {
                    hasMoreData = false;
                }
            } catch (error) {
                console.error(`获取第${currentPage}页数据失败:`, error);
                break;
            }
        }

        return allData;
    }

    /**
     * 获取不同日期的数据
     * @param {Object} config - 配置参数
     * @param {string} accessToken - 访问令牌
     * @param {Array} dates - 日期数组
     * @returns {Promise<Object>} 按日期分组的数据
     */
    async searchBuryPointDataByDates(config, accessToken, dates) {
        const dateData = {};
        
        for (const date of dates) {
            try {
                const dateConfig = { ...config, date: date };
                const result = await this.searchBuryPointData(dateConfig, accessToken);
                
                if (result.data && result.data.dataList) {
                    dateData[date] = result.data.dataList;
                }
            } catch (error) {
                console.error(`获取${date}数据失败:`, error);
                dateData[date] = [];
            }
        }

        return dateData;
    }

    /**
     * 验证访问令牌
     * @param {string} accessToken - 访问令牌
     * @returns {Promise<boolean>} 令牌是否有效
     */
    async validateToken(accessToken) {
        try {
            const testConfig = {
                projectId: this.defaultConfig.projectId,
                selectedPointId: this.defaultConfig.selectedPointId,
                pageSize: 1
            };
            
            await this.searchBuryPointData(testConfig, accessToken);
            return true;
        } catch (error) {
            return false;
        }
    }
}

// 如果在浏览器环境中，将API类暴露到全局
if (typeof window !== 'undefined') {
    window.YeepayAPI = YeepayAPI;
}

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = YeepayAPI;
}
