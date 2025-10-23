import { ref, computed } from 'vue'
import { useStore } from 'vuex'
import { useRequirementAnalysis } from '@/composables/useRequirementAnalysis'
import { useChart } from '@/composables/useChart'

/**
 * 聊天分析相关的逻辑
 */
export function useChatAnalysis() {
  const store = useStore()
  const { analyzeRequirement, analyzeButtonClickRequirement, analyzeQueryConditionRequirement } = useRequirementAnalysis()
  const { generateChart } = useChart()

  /**
   * 处理聊天分析请求
   */
  const handleChatAnalysis = async (analysisRequest) => {
    try {
      console.log('聊天分析请求:', analysisRequest)
      
      // 根据分析类型调用不同的分析方法
      switch (analysisRequest.type) {
        case 'button_click_analysis':
          return await analyzeButtonClickRequirement(analysisRequest)
        case 'query_condition_analysis':
          return await analyzeQueryConditionRequirement(analysisRequest)
        default:
          return await analyzeRequirement(analysisRequest)
      }
    } catch (error) {
      console.error('聊天分析失败:', error)
      throw error
    }
  }

  /**
   * 处理多条件选择
   */
  const handleMultipleConditionsSelection = async (selectedConditions, analysisRequest) => {
    try {
      console.log('多条件选择:', selectedConditions)
      
      // 更新分析请求的条件
      const updatedRequest = {
        ...analysisRequest,
        queryCondition: selectedConditions.map(c => c.content).join('、'),
        queryData: {
          ...analysisRequest.queryData,
          conditions: selectedConditions
        }
      }
      
      return await handleChatAnalysis(updatedRequest)
    } catch (error) {
      console.error('多条件分析失败:', error)
      throw error
    }
  }

  /**
   * 处理按钮选择
   */
  const handleButtonSelection = async (selectedButtons, analysisRequest) => {
    try {
      console.log('按钮选择:', selectedButtons)
      
      // 更新分析请求的按钮
      const updatedRequest = {
        ...analysisRequest,
        buttonName: selectedButtons.map(b => b.content).join('、'),
        buttonData: selectedButtons
      }
      
      return await handleChatAnalysis(updatedRequest)
    } catch (error) {
      console.error('按钮分析失败:', error)
      throw error
    }
  }

  return {
    handleChatAnalysis,
    handleMultipleConditionsSelection,
    handleButtonSelection
  }
}
