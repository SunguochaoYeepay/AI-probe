import { ref, computed } from 'vue'
import { useStore } from 'vuex'

/**
 * 埋点配置管理composable
 */
export function useBuryPointConfig(addMessage) {
  const store = useStore()

  // 埋点选择
  const selectedBuryPointId = ref(null)
  const selectedBuryPointIds = ref([]) // 用于行为分析的多选

  // 分析类型选择
  const selectedAnalysisType = ref('page_analysis') // 默认为页面分析

  // 获取已配置的埋点信息（支持新的分离配置，并根据分析类型过滤）
  const allBuryPoints = computed(() => {
    const projectConfig = store.state.projectConfig
    const allBuryPoints = projectConfig?.buryPoints || []
    const configuredPoints = []
    
    // 尝试从localStorage获取埋点信息作为备用方案
    const getBuryPointInfo = (pointId) => {
      // 先尝试从store获取
      const storePoint = allBuryPoints.find(p => p.id === pointId)
      if (storePoint) return storePoint
      
      // 备用方案：根据ID推断埋点信息
      if (pointId === 110) {
        return { id: 110, name: '低代码_页面浏览', type: '访问' }
      } else if (pointId === 109) {
        return { id: 109, name: '低代码_点击事件', type: '点击' }
      }
      
      return { id: pointId, name: `埋点 ${pointId}`, type: '未知' }
    }
    
    // 调试信息：查看实际的数据结构
    console.log('🔍 useBuryPointConfig - 项目配置调试信息:', {
      projectConfig: projectConfig,
      allBuryPoints: allBuryPoints,
      allBuryPointsLength: allBuryPoints.length,
      allBuryPointsContent: JSON.parse(JSON.stringify(allBuryPoints)), // 深度克隆以查看完整内容
      visitBuryPointId: projectConfig?.visitBuryPointId,
      clickBuryPointId: projectConfig?.clickBuryPointId,
      behaviorBuryPointIds: projectConfig?.behaviorBuryPointIds,
      visitPoint: projectConfig?.visitPoint,
      clickPoint: projectConfig?.clickPoint,
      fullProjectConfig: JSON.parse(JSON.stringify(projectConfig)) // 查看完整的项目配置
    })
    
    // 优先使用新的分离配置
    if (projectConfig.visitBuryPointId || projectConfig.clickBuryPointId || (projectConfig.behaviorBuryPointIds && projectConfig.behaviorBuryPointIds.length > 0)) {
      // 根据分析类型过滤埋点
      switch (selectedAnalysisType.value) {
        case 'page_analysis':
          // 页面分析只显示访问埋点
          if (projectConfig.visitBuryPointId) {
            const visitPoint = getBuryPointInfo(projectConfig.visitBuryPointId)
            configuredPoints.push({ ...visitPoint, type: '访问' })
          }
          break
          
        case 'click_analysis':
          // 点击分析只显示点击埋点
          if (projectConfig.clickBuryPointId) {
            const clickPoint = getBuryPointInfo(projectConfig.clickBuryPointId)
            configuredPoints.push({ ...clickPoint, type: '点击' })
          }
          break
          
        case 'behavior_analysis':
          // 行为分析显示访问埋点和点击埋点（支持用户行为路径分析和转化漏斗分析）
          if (projectConfig.visitBuryPointId) {
            const visitPoint = getBuryPointInfo(projectConfig.visitBuryPointId)
            configuredPoints.push({ ...visitPoint, type: '访问' })
          }
          if (projectConfig.clickBuryPointId && projectConfig.clickBuryPointId !== projectConfig.visitBuryPointId) {
            const clickPoint = getBuryPointInfo(projectConfig.clickBuryPointId)
            configuredPoints.push({ ...clickPoint, type: '点击' })
          }
          // 如果配置了行为分析埋点，也包含进来
          if (projectConfig.behaviorBuryPointIds && projectConfig.behaviorBuryPointIds.length > 0) {
            projectConfig.behaviorBuryPointIds.forEach(pointId => {
              if (pointId !== projectConfig.visitBuryPointId && pointId !== projectConfig.clickBuryPointId) {
                const behaviorPoint = getBuryPointInfo(pointId)
                configuredPoints.push({ ...behaviorPoint, type: '行为' })
              }
            })
          }
          break
          
        case 'query_analysis':
          // 查询条件分析使用点击埋点，因为查询条件数据通常通过点击事件记录
          if (projectConfig.clickBuryPointId) {
            const clickPoint = getBuryPointInfo(projectConfig.clickBuryPointId)
            configuredPoints.push({ ...clickPoint, type: '点击' })
          }
          break
          
        default:
          // 默认显示所有类型的埋点
          if (projectConfig.visitBuryPointId) {
            const visitPoint = getBuryPointInfo(projectConfig.visitBuryPointId)
            configuredPoints.push({ ...visitPoint, type: '访问' })
          }
          if (projectConfig.clickBuryPointId && projectConfig.clickBuryPointId !== projectConfig.visitBuryPointId) {
            const clickPoint = getBuryPointInfo(projectConfig.clickBuryPointId)
            configuredPoints.push({ ...clickPoint, type: '点击' })
          }
          if (projectConfig.behaviorBuryPointIds && projectConfig.behaviorBuryPointIds.length > 0) {
            projectConfig.behaviorBuryPointIds.forEach(behaviorId => {
              const behaviorPoint = getBuryPointInfo(behaviorId)
              configuredPoints.push({ ...behaviorPoint, type: '行为分析' })
            })
          }
      }
      console.log(`使用分离配置的埋点 (分析类型: ${selectedAnalysisType.value}):`, configuredPoints)
    } else {
      // 回退到旧的配置方式
      const selectedIds = projectConfig?.selectedBuryPointIds || []
      selectedIds.forEach(id => {
        const point = allBuryPoints.find(p => p.id === id)
        if (point) {
          configuredPoints.push({ ...point, type: '通用' })
        } else {
          // 如果埋点列表中没有找到，保留原始ID，不创建通用名称
          configuredPoints.push({ 
            id: id, 
            name: `埋点 ${id}`, 
            type: '通用' 
          })
        }
      })
      console.log('使用旧配置的埋点:', configuredPoints)
    }
    
    return configuredPoints
  })

  // 获取当前选择的埋点类型
  const getCurrentBuryPointType = () => {
    const projectConfig = store.state.projectConfig
    const currentPointId = selectedBuryPointId.value
    
    console.log('getCurrentBuryPointType - 当前埋点ID:', currentPointId)
    console.log('getCurrentBuryPointType - 项目配置:', {
      visitBuryPointId: projectConfig.visitBuryPointId,
      clickBuryPointId: projectConfig.clickBuryPointId,
      buryPoints: projectConfig?.buryPoints?.length || 0
    })
    
    if (!currentPointId) {
      console.log('getCurrentBuryPointType - 没有当前埋点ID，返回null')
      return null
    }
    
    // 优先使用新的分离配置
    if (projectConfig.visitBuryPointId || projectConfig.clickBuryPointId || (projectConfig.behaviorBuryPointIds && projectConfig.behaviorBuryPointIds.length > 0)) {
      if (currentPointId === projectConfig.visitBuryPointId) {
        console.log('getCurrentBuryPointType - 匹配访问埋点，返回"访问"')
        return '访问'
      } else if (currentPointId === projectConfig.clickBuryPointId) {
        console.log('getCurrentBuryPointType - 匹配点击埋点，返回"点击"')
        return '点击'
      } else if (projectConfig.behaviorBuryPointIds && projectConfig.behaviorBuryPointIds.includes(currentPointId)) {
        console.log('getCurrentBuryPointType - 匹配行为分析埋点，返回"行为分析"')
        return '行为分析'
      }
      console.log('getCurrentBuryPointId - 当前埋点ID不匹配任何分离配置')
    }
    
    // 回退到旧的配置方式 - 通过埋点名称判断
    const allBuryPoints = projectConfig?.buryPoints || []
    const currentPoint = allBuryPoints.find(p => p.id === currentPointId)
    
    if (currentPoint) {
      console.log('getCurrentBuryPointType - 找到埋点信息:', currentPoint)
      // 通过埋点名称判断类型
      const name = currentPoint.name || ''
      if (name.includes('访问') || name.includes('浏览') || name.includes('页面')) {
        console.log('getCurrentBuryPointType - 通过名称判断为访问类型')
        return '访问'
      } else if (name.includes('点击') || name.includes('按钮') || name.includes('事件')) {
        console.log('getCurrentBuryPointType - 通过名称判断为点击类型')
        return '点击'
      }
      console.log('getCurrentBuryPointType - 埋点名称无法判断类型:', name)
    } else {
      console.log('getCurrentBuryPointType - 未找到对应的埋点信息')
    }
    
    console.log('getCurrentBuryPointType - 返回null')
    return null
  }

  // 根据埋点ID获取埋点类型（不依赖selectedBuryPointId.value）
  const getBuryPointTypeById = (pointId) => {
    const projectConfig = store.state.projectConfig
    
    console.log('getBuryPointTypeById - 埋点ID:', pointId)
    console.log('getBuryPointTypeById - 项目配置:', {
      visitBuryPointId: projectConfig.visitBuryPointId,
      clickBuryPointId: projectConfig.clickBuryPointId,
      buryPoints: projectConfig?.buryPoints?.length || 0
    })
    
    if (!pointId) {
      console.log('getBuryPointTypeById - 没有埋点ID，返回null')
      return null
    }
    
    // 优先使用新的分离配置
    if (projectConfig.visitBuryPointId || projectConfig.clickBuryPointId) {
      if (pointId === projectConfig.visitBuryPointId) {
        console.log('getBuryPointTypeById - 匹配访问埋点，返回"访问"')
        return '访问'
      } else if (pointId === projectConfig.clickBuryPointId) {
        console.log('getBuryPointTypeById - 匹配点击埋点，返回"点击"')
        return '点击'
      }
      console.log('getBuryPointTypeById - 埋点ID不匹配任何分离配置')
    }
    
    // 回退到旧的配置方式 - 通过埋点名称判断
    const allBuryPoints = projectConfig?.buryPoints || []
    const currentPoint = allBuryPoints.find(p => p.id === pointId)
    
    if (currentPoint) {
      console.log('getBuryPointTypeById - 找到埋点信息:', currentPoint)
      // 通过埋点名称判断类型
      const name = currentPoint.name || ''
      if (name.includes('访问') || name.includes('浏览') || name.includes('页面')) {
        console.log('getBuryPointTypeById - 通过名称判断为访问类型')
        return '访问'
      } else if (name.includes('点击') || name.includes('按钮') || name.includes('事件')) {
        console.log('getBuryPointTypeById - 通过名称判断为点击类型')
        return '点击'
      }
      console.log('getBuryPointTypeById - 埋点名称无法判断类型:', name)
    } else {
      console.log('getBuryPointTypeById - 未找到对应的埋点信息')
    }
    
    console.log('getBuryPointTypeById - 返回null')
    return null
  }

  // 埋点选择变化处理
  const onBuryPointChange = (value) => {
    console.log('埋点选择变化:', value)
    
    // 根据分析类型处理不同的选择逻辑
    if (selectedAnalysisType.value === 'behavior_analysis') {
      // 行为分析支持多选
      selectedBuryPointIds.value = value || []
      console.log(`✅ 行为分析埋点已更新: ${selectedBuryPointIds.value.join(', ')}`)
      
      // 更新store中的多选埋点
      store.dispatch('updateApiConfig', {
        selectedPointIds: selectedBuryPointIds.value,
        selectedPointId: selectedBuryPointIds.value.length > 0 ? selectedBuryPointIds.value[0] : null // 主埋点设为第一个
      })
    } else {
      // 其他分析类型单选
      const oldBuryPointType = getBuryPointTypeById(selectedBuryPointId.value)
      console.log('旧的埋点ID:', selectedBuryPointId.value)
      console.log('旧的埋点类型:', oldBuryPointType)
      
      // 更新埋点选择
      selectedBuryPointId.value = value
      
      // 只更新 apiConfig.selectedPointId，不修改 projectConfig
      // 因为这里只是在已配置的埋点之间切换，不改变配置本身
      store.dispatch('updateApiConfig', {
        selectedPointId: value
      })
      
      console.log(`✅ 当前分析埋点已切换到: ${value}`)
      console.log('🔍 更新后的store.state.apiConfig.selectedPointId:', store.state.apiConfig.selectedPointId)
      
      // 获取新的埋点类型（基于新的埋点ID）
      const newBuryPointType = getBuryPointTypeById(value)
      console.log('新的埋点类型:', newBuryPointType)
      console.log(`埋点类型变化: ${oldBuryPointType} -> ${newBuryPointType}`)
      
      // 如果埋点类型发生变化，自动更新提示词
      if (oldBuryPointType !== newBuryPointType) {
        console.log('埋点类型发生变化，自动更新提示词')
        updateWelcomeMessageForBuryPointType()
        
        // 保存用户的埋点类型偏好到localStorage
        if (newBuryPointType === '访问') {
          localStorage.setItem('defaultBuryPointType', 'visit')
          console.log('已保存用户偏好：访问埋点')
        } else if (newBuryPointType === '点击') {
          localStorage.setItem('defaultBuryPointType', 'click')
          console.log('已保存用户偏好：点击埋点')
        } else if (newBuryPointType === '行为分析') {
          localStorage.setItem('defaultBuryPointType', 'behavior')
          console.log('已保存用户偏好：行为分析埋点')
        }
      } else {
        console.log('埋点类型未发生变化，无需更新提示词')
        console.log('🔍 当前聊天记录数量:', messages.value.length)
        console.log('🔍 聊天记录内容:', messages.value)
        // 每次埋点切换都显示对应的提示词
        console.log('埋点切换完成，显示当前埋点的提示词')
        showWelcomeMessage()
      }
    }
  }

  // 分析类型变化处理
  const onAnalysisTypeChange = (value) => {
    console.log('分析类型变化:', value)
    selectedAnalysisType.value = value
    
    // 检查当前选择的埋点是否在新的过滤列表中
    const filteredPoints = allBuryPoints.value
    
    if (value === 'behavior_analysis') {
      // 切换到行为分析模式，清空单选埋点，初始化多选埋点
      selectedBuryPointId.value = null
      if (filteredPoints.length > 0 && selectedBuryPointIds.value.length === 0) {
        // 默认优先选择点击埋点，然后选择访问埋点
        const defaultSelectedIds = []
        const projectConfig = store.state.projectConfig
        
        // 优先添加点击埋点
        if (projectConfig.clickBuryPointId) {
          defaultSelectedIds.push(projectConfig.clickBuryPointId)
        }
        
        // 添加页面访问埋点
        if (projectConfig.visitBuryPointId) {
          defaultSelectedIds.push(projectConfig.visitBuryPointId)
        }
        
        selectedBuryPointIds.value = defaultSelectedIds
        console.log(`行为分析模式默认选择埋点（优先点击埋点）: ${defaultSelectedIds.join(', ')}`)
        
        // 同时设置单选埋点为点击埋点（用于显示）
        if (projectConfig.clickBuryPointId) {
          selectedBuryPointId.value = projectConfig.clickBuryPointId
          console.log('✅ 行为分析模式：设置单选埋点为点击埋点:', projectConfig.clickBuryPointId)
        }
      }
      
      // 更新store中的多选埋点和分析类型
      store.dispatch('updateApiConfig', {
        selectedPointIds: selectedBuryPointIds.value,
        selectedPointId: selectedBuryPointIds.value.length > 0 ? selectedBuryPointIds.value[0] : null,
        selectedAnalysisType: selectedAnalysisType.value
      })
    } else {
      // 切换到其他分析类型，清空多选埋点，处理单选埋点
      selectedBuryPointIds.value = []
      
      // 尝试从store中恢复之前的选择
      const storeSelectedPointId = store.state.apiConfig.selectedPointId
      console.log('尝试从store恢复埋点选择:', storeSelectedPointId)
      
      // 检查store中的埋点是否在新的过滤列表中
      if (storeSelectedPointId && filteredPoints.find(p => p.id === storeSelectedPointId)) {
        // store中的埋点仍然有效，使用它
        selectedBuryPointId.value = storeSelectedPointId
        console.log(`从store恢复埋点选择: ${storeSelectedPointId}`)
      } else {
        // store中的埋点无效或不存在，自动选择第一个可用的埋点
        if (filteredPoints.length > 0) {
          const firstPoint = filteredPoints[0]
          selectedBuryPointId.value = firstPoint.id
          console.log(`自动切换到第一个可用埋点: ${firstPoint.id} (${firstPoint.name})`)
        } else {
          // 如果没有可用的埋点，清空选择
          selectedBuryPointId.value = null
          console.log('没有可用的埋点，清空选择')
        }
      }
      
      // 更新store中的单选埋点和分析类型
      store.dispatch('updateApiConfig', {
        selectedPointId: selectedBuryPointId.value,
        selectedAnalysisType: selectedAnalysisType.value
      })
    }
    
    // 根据分析类型更新提示消息
    let typeChangeMessage = ''
    let newActions = []
    
    switch (value) {
      case 'page_analysis':
        typeChangeMessage = `📊 页面访问分析

请选择您要分析的页面范围：`
        
        newActions = [
          { 
            text: '选择页面分析', 
            type: 'show_page_list', 
            params: { type: 'page_visits', scope: 'specific', description: '分析特定页面的访问趋势' } 
          }
        ]
        break
        
      case 'click_analysis':
        // 点击分析直接跳转到页面选择，不需要中间选项
        typeChangeMessage = `🖱️ 点击分析模式

请选择您要分析点击行为的页面：`
        
        newActions = [
          { 
            text: '选择分析页面', 
            type: 'show_page_list', 
            params: { type: 'user_click', scope: 'page' } 
          }
        ]
        break
        
      case 'query_analysis':
        // 查询条件分析直接跳转到页面选择，不需要中间选项
        typeChangeMessage = `🔍 查询条件分析模式

请选择您要分析查询条件的页面：`
        
        newActions = [
          { 
            text: '选择分析页面', 
            type: 'show_page_list', 
            params: { type: 'query_condition', scope: 'page' } 
          }
        ]
        break
        
        case 'behavior_analysis':
          typeChangeMessage = `🔄 检测到您已切换到行为分析模式

现在为您提供用户行为分析相关的选项：`
          
          newActions = [
            { 
              text: '🛤️ 用户行为路径', 
              type: 'analyze', 
              params: { type: 'behavior_path', scope: 'path' } 
            },
            { 
              text: '🎯 行为转化漏斗', 
              type: 'analyze', 
              params: { type: 'behavior_funnel', scope: 'funnel' } 
            }
          ]
        break
        
      default:
        typeChangeMessage = `🔄 分析类型已更新

请选择您想要进行的分析类型：`
        
        newActions = [
          { 
            text: '📊 页面访问分析', 
            type: 'select_analysis', 
            params: { type: 'page_visits', description: '分析页面的访问量、UV/PV趋势等' } 
          },
          { 
            text: '🖱️ 用户点击分析', 
            type: 'select_analysis', 
            params: { type: 'user_click', description: '分析用户点击行为、按钮热度等' } 
          },
          { 
            text: '🔄 行为转化分析', 
            type: 'select_analysis', 
            params: { type: 'conversion', description: '分析用户行为路径和转化漏斗' } 
          }
        ]
    }
    
    // 添加新的提示消息
    addMessage(typeChangeMessage, 'ai', newActions)
  }

  // 根据埋点类型更新欢迎消息
  const updateWelcomeMessageForBuryPointType = () => {
    // 如果聊天记录为空，直接显示欢迎消息
    if (messages.value.length === 0) {
      showWelcomeMessage()
      return
    }
    
    // 如果已有聊天记录，添加一个提示消息告知用户埋点类型已切换
    const currentBuryPointType = getCurrentBuryPointType()
    let typeChangeMessage = ''
    let newActions = []
    
    if (currentBuryPointType === '访问') {
      typeChangeMessage = `🔄 检测到您已切换到访问埋点分析模式

现在为您提供页面访问分析相关的选项：`
      
      newActions = [
        { 
          text: '📊 页面访问量分析', 
          type: 'select_analysis', 
          params: { type: 'page_visit', description: '分析页面的访问量、UV/PV趋势等' } 
        },
        { 
          text: '📈 访问趋势分析', 
          type: 'select_analysis', 
          params: { type: 'page_visit', description: '分析页面访问的时间趋势和变化' } 
        },
        { 
          text: '📋 页面类型分布', 
          type: 'select_analysis', 
          params: { type: 'page_visit', description: '按页面类型分析访问分布情况' } 
        }
      ]
    } else if (currentBuryPointType === '点击') {
      typeChangeMessage = `🔄 检测到您已切换到点击埋点分析模式

现在为您提供按钮点击分析相关的选项：`
      
      newActions = [
        { 
          text: '🖱️ 按钮点击分析', 
          type: 'select_analysis', 
          params: { type: 'user_click', description: '分析按钮点击行为、点击次数等' } 
        },
        { 
          text: '🔥 按钮点击热度', 
          type: 'select_analysis', 
          params: { type: 'user_click', description: '分析按钮点击热度和用户偏好' } 
        },
        { 
          text: '📊 点击转化分析', 
          type: 'select_analysis', 
          params: { type: 'user_click', description: '分析点击到转化的路径和效果' } 
        }
      ]
    } else if (currentBuryPointType === '行为分析') {
      typeChangeMessage = `🔄 检测到您已切换到行为分析模式

现在为您提供用户行为分析相关的选项：`
      
      newActions = [
        { 
          text: '🛤️ 用户行为路径', 
          type: 'analyze', 
          params: { type: 'behavior_path', scope: 'path' } 
        },
        { 
          text: '🎯 行为转化漏斗', 
          type: 'analyze', 
          params: { type: 'behavior_funnel', scope: 'funnel' } 
        }
      ]
    } else {
      // 默认情况
      typeChangeMessage = `🔄 埋点配置已更新

请选择您想要进行的分析类型：`
      
      newActions = [
        { 
          text: '📊 页面访问分析', 
          type: 'select_analysis', 
          params: { type: 'page_visit', description: '分析页面的访问量、UV/PV趋势等' } 
        },
        { 
          text: '🖱️ 用户点击分析', 
          type: 'select_analysis', 
          params: { type: 'user_click', description: '分析用户点击行为、按钮热度等' } 
        },
        { 
          text: '🔄 行为转化分析', 
          type: 'select_analysis', 
          params: { type: 'conversion', description: '分析用户行为路径和转化漏斗' } 
        }
      ]
    }
    
    // 添加新的提示消息
    addMessage(typeChangeMessage, 'ai', newActions)
  }

  return {
    // 响应式数据
    selectedBuryPointId,
    selectedBuryPointIds,
    selectedAnalysisType,
    allBuryPoints,
    
    // 方法
    getCurrentBuryPointType,
    getBuryPointTypeById,
    onBuryPointChange,
    onAnalysisTypeChange,
    updateWelcomeMessageForBuryPointType
  }
}
