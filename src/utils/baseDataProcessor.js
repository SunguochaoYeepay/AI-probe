/**
 * 数据处理器基类
 */
export class BaseDataProcessor {
  constructor() {
    this.logger = console
  }

  /**
   * 统一的数据处理入口
   * @param {Array} data - 原始数据或已聚合数据
   * @param {Object} options - 处理选项
   * @returns {Object} 处理后的图表数据
   */
  process(data, options) {
    throw new Error('子类必须实现 process 方法')
  }

  /**
   * 数据标准化 - 将不同格式的数据转换为统一格式
   * @param {Array} data - 原始数据
   * @param {Object} options - 处理选项
   * @returns {Array} 标准化的聚合数据
   */
  normalize(data, options) {
    throw new Error('子类必须实现 normalize 方法')
  }

  /**
   * 数据分配 - 将聚合数据分配给各个维度
   * @param {Array} aggregatedData - 聚合数据
   * @param {Object} options - 处理选项
   * @returns {Object} 分配后的图表数据
   */
  allocate(aggregatedData, options) {
    throw new Error('子类必须实现 allocate 方法')
  }
}
