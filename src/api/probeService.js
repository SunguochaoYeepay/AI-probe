import axios from 'axios'
import { message } from 'ant-design-vue'

/**
 * Probe 系统 API 服务
 * 用于获取项目列表和埋点配置
 */
class ProbeService {
  constructor() {
    this.baseURL = 'https://probe.yeepay.com'
    this.token = null
  }

  /**
   * 设置访问令牌
   * @param {string} token - 访问令牌
   */
  setToken(token) {
    this.token = token
  }

  /**
   * 获取请求头
   * @returns {Object} 请求头配置
   */
  getHeaders() {
    if (!this.token) {
      throw new Error('访问令牌未设置，请先在配置中设置 access-token')
    }
    
    return {
      'accept': '*/*',
      'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
      'access-token': this.token,
      'content-type': 'text/plain;charset=UTF-8'
      // 注意：以下请求头是浏览器安全限制，不能手动设置：
      // 'origin', 'referer', 'user-agent' 等
    }
  }

  /**
   * 获取所有项目列表
   * @returns {Promise<Array>} 项目列表
   */
  async getProjectList() {
    try {
      const response = await axios.post(
        `${this.baseURL}/wfManage/getSimpleTeamList`,
        {},
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      )

      if (response.data.code !== 200) {
        throw new Error(`获取项目列表失败: ${response.data.msg}`)
      }

      // 解析项目列表
      const projectsMap = new Map() // 使用 Map 来去重
      const data = response.data.data
      
      // 检查 data 是否为数组
      if (Array.isArray(data)) {
        data.forEach(team => {
          if (team.webMonitorIds) {
            const projectIds = team.webMonitorIds.split(',').filter(id => id.trim())
            projectIds.forEach(projectId => {
              const trimmedId = projectId.trim()
              if (!projectsMap.has(trimmedId)) {
                projectsMap.set(trimmedId, {
                  id: trimmedId,
                  name: `${team.teamName} - ${trimmedId}`,
                  teamName: team.teamName,
                  teamId: team.id
                })
              } else {
                // 如果项目ID已存在，更新为更详细的名称（包含多个团队）
                const existingProject = projectsMap.get(trimmedId)
                if (!existingProject.name.includes(team.teamName)) {
                  existingProject.name = `${existingProject.name}, ${team.teamName}`
                }
              }
            })
          }
        })
      } else {
        // 如果 data 不是数组，可能是空对象或其他结构
        console.warn('API 返回的数据格式不符合预期:', data)
        // 返回一个默认项目
        projectsMap.set('event1021', {
          id: 'event1021',
          name: '默认项目 - event1021',
          teamName: '默认团队',
          teamId: 'default'
        })
      }

      // 转换为数组并排序
      const projects = Array.from(projectsMap.values()).sort((a, b) => {
        // 先按团队名称排序，再按项目ID排序
        if (a.teamName !== b.teamName) {
          return a.teamName.localeCompare(b.teamName)
        }
        return a.id.localeCompare(b.id)
      })

      console.log('获取到项目列表:', projects.length, '个项目（已去重）')
      return projects

    } catch (error) {
      console.error('获取项目列表失败:', error)
      message.error(`获取项目列表失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 获取项目的埋点配置
   * @param {string} projectId - 项目ID
   * @returns {Promise<Array>} 埋点配置列表
   */
  async getProjectBuryPoints(projectId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/tracker/buryPointWarehouse/getProjectAndWeList`,
        { projectId },
        {
          headers: this.getHeaders(),
          timeout: 10000
        }
      )

      if (response.data.code !== 200) {
        throw new Error(`获取埋点配置失败: ${response.data.msg}`)
      }

      // 处理埋点配置
      const data = response.data.data
      let buryPoints = []
      
      // 检查 data 结构
      if (data && Array.isArray(data)) {
        buryPoints = data.map(point => ({
          id: point.pointId,
          name: point.pointName,
          description: point.pointDesc,
          fields: point.fields ? point.fields.split(',') : [],
          fieldNames: point.fieldNames ? point.fieldNames.split(',') : [],
          createBy: point.createBy,
          createdAt: point.createdAt,
          updatedAt: point.updatedAt,
          projectId: point.projectId
        }))
      } else if (data && data.weList && Array.isArray(data.weList)) {
        // 如果数据结构是 { weList: [...] }
        buryPoints = data.weList.map(point => ({
          id: point.pointId || point.id,
          name: point.pointName || point.name,
          description: point.pointDesc || point.description,
          fields: point.fields ? point.fields.split(',') : [],
          fieldNames: point.fieldNames ? point.fieldNames.split(',') : [],
          createBy: point.createBy,
          createdAt: point.createdAt,
          updatedAt: point.updatedAt,
          projectId: point.projectId || projectId
        }))
      } else {
        console.warn('API 返回的埋点数据格式不符合预期:', data)
        // 返回默认埋点配置
        buryPoints = [
          {
            id: 110,
            name: '页面访问埋点',
            description: '记录页面访问行为',
            fields: [],
            fieldNames: [],
            createBy: 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            projectId: projectId
          },
          {
            id: 109,
            name: '按钮点击埋点',
            description: '记录按钮点击行为',
            fields: [],
            fieldNames: [],
            createBy: 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            projectId: projectId
          }
        ]
      }

      console.log(`项目 ${projectId} 获取到埋点配置:`, buryPoints.length, '个埋点')
      return buryPoints

    } catch (error) {
      console.error(`获取项目 ${projectId} 埋点配置失败:`, error)
      message.error(`获取埋点配置失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 智能识别访问和点击埋点
   * @param {Array} buryPoints - 埋点配置列表
   * @returns {Object} 识别结果
   */
  identifyVisitAndClickPoints(buryPoints) {
    let visitPoint = null
    let clickPoint = null

    // 按优先级匹配访问埋点
    const visitKeywords = [
      '页面访问', '页面浏览', '访问量', '浏览量', '页面访问量',
      '低代码_页面浏览', '页面访问信息'
    ]

    // 按优先级匹配点击埋点
    const clickKeywords = [
      '页面点击', '点击事件', '点击量', '页面点击量', '页面点击次数',
      '低代码_点击事件', '页面点击（'
    ]

    // 查找访问埋点
    for (const keyword of visitKeywords) {
      visitPoint = buryPoints.find(point => 
        point.name.includes(keyword) || point.description?.includes(keyword)
      )
      if (visitPoint) break
    }

    // 查找点击埋点
    for (const keyword of clickKeywords) {
      clickPoint = buryPoints.find(point => 
        point.name.includes(keyword) || point.description?.includes(keyword)
      )
      if (clickPoint) break
    }

    const result = {
      visit: visitPoint,
      click: clickPoint,
      all: buryPoints
    }

    console.log('埋点识别结果:', {
      visit: visitPoint ? `${visitPoint.name} (ID: ${visitPoint.id})` : '未找到',
      click: clickPoint ? `${clickPoint.name} (ID: ${clickPoint.id})` : '未找到',
      total: buryPoints.length
    })

    return result
  }

  /**
   * 获取项目的完整配置（项目信息 + 埋点配置）
   * @param {string} projectId - 项目ID
   * @returns {Promise<Object>} 完整配置
   */
  async getProjectFullConfig(projectId) {
    try {
      const buryPoints = await this.getProjectBuryPoints(projectId)
      const identified = this.identifyVisitAndClickPoints(buryPoints)

      return {
        projectId,
        buryPoints: identified.all,
        visitPoint: identified.visit,
        clickPoint: identified.click,
        hasVisitPoint: !!identified.visit,
        hasClickPoint: !!identified.click,
        supportDualBuryPoint: !!identified.visit && !!identified.click
      }

    } catch (error) {
      console.error(`获取项目 ${projectId} 完整配置失败:`, error)
      throw error
    }
  }

  /**
   * 验证访问令牌是否有效
   * @returns {Promise<boolean>} 是否有效
   */
  async validateToken() {
    try {
      await this.getProjectList()
      return true
    } catch (error) {
      console.error('令牌验证失败:', error)
      return false
    }
  }
}

// 创建单例实例
const probeService = new ProbeService()

export { probeService }
export default probeService
