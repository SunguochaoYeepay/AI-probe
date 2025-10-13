<template>
  <div class="project-config-panel">
    <a-card title="项目配置管理" :loading="loading">
      <a-space direction="vertical" style="width: 100%" :size="16">
        
        <!-- 操作按钮 -->
        <a-space>
          <a-button type="primary" @click="handleFetchTeams" :loading="loading">
            <template #icon><TeamOutlined /></template>
            获取团队列表
          </a-button>
          <a-button type="primary" @click="handleFetchPoints" :loading="loading">
            <template #icon><ApartmentOutlined /></template>
            获取项目点位
          </a-button>
          <a-button @click="handleRefreshAll" :loading="loading">
            <template #icon><ReloadOutlined /></template>
            刷新所有
          </a-button>
        </a-space>

        <!-- 错误提示 -->
        <a-alert
          v-if="error"
          type="error"
          :message="error"
          closable
          @close="error = null"
        />

        <!-- 团队列表 -->
        <a-card v-if="teamList.length > 0" size="small" title="团队列表">
          <a-list
            size="small"
            :data-source="teamList"
            :pagination="{ pageSize: 5 }"
          >
            <template #renderItem="{ item }">
              <a-list-item>
                <a-list-item-meta>
                  <template #title>
                    <TeamOutlined /> {{ item.name || item.teamName }}
                  </template>
                  <template #description>
                    ID: {{ item.id || item.teamId }}
                  </template>
                </a-list-item-meta>
              </a-list-item>
            </template>
          </a-list>
        </a-card>

        <!-- 项目信息 -->
        <a-card v-if="projectList.length > 0" size="small" title="项目信息">
          <a-descriptions :column="2" size="small">
            <a-descriptions-item label="项目名称">
              {{ projectList[0].name || projectList[0].projectName }}
            </a-descriptions-item>
            <a-descriptions-item label="项目ID">
              {{ projectList[0].id || projectList[0].projectId }}
            </a-descriptions-item>
          </a-descriptions>
        </a-card>

        <!-- 点位列表 -->
        <a-card v-if="pointList.length > 0" size="small">
          <template #title>
            <span>点位列表 ({{ pointList.length }}个)</span>
          </template>
          <template #extra>
            <a-input-search
              v-model:value="searchText"
              placeholder="搜索点位名称"
              style="width: 200px"
              allowClear
            />
          </template>
          
          <a-list
            size="small"
            :data-source="filteredPointList"
            :pagination="{ pageSize: 10 }"
          >
            <template #renderItem="{ item, index }">
              <a-list-item>
                <a-list-item-meta>
                  <template #title>
                    <a-space>
                      <a-tag color="blue">#{{ index + 1 }}</a-tag>
                      {{ item.name || item.pointName || item.weName }}
                    </a-space>
                  </template>
                  <template #description>
                    <a-space>
                      <span>ID: {{ item.id || item.pointId || item.weId }}</span>
                      <a-divider type="vertical" />
                      <span v-if="item.type">类型: {{ item.type }}</span>
                      <span v-if="item.description">{{ item.description }}</span>
                    </a-space>
                  </template>
                </a-list-item-meta>
                <template #actions>
                  <a-button size="small" type="link" @click="handleSelectPoint(item)">
                    选择
                  </a-button>
                </template>
              </a-list-item>
            </template>
          </a-list>
        </a-card>

        <!-- 统计信息 -->
        <a-card v-if="hasData" size="small" title="统计信息">
          <a-row :gutter="16">
            <a-col :span="8">
              <a-statistic
                title="团队数量"
                :value="teamList.length"
                :prefix="() => h(TeamOutlined)"
              />
            </a-col>
            <a-col :span="8">
              <a-statistic
                title="项目数量"
                :value="projectList.length"
                :prefix="() => h(ProjectOutlined)"
              />
            </a-col>
            <a-col :span="8">
              <a-statistic
                title="点位数量"
                :value="pointList.length"
                :prefix="() => h(ApartmentOutlined)"
              />
            </a-col>
          </a-row>
        </a-card>

      </a-space>
    </a-card>
  </div>
</template>

<script setup>
import { ref, computed, h } from 'vue'
import { message } from 'ant-design-vue'
import { 
  TeamOutlined, 
  ApartmentOutlined, 
  ReloadOutlined,
  ProjectOutlined 
} from '@ant-design/icons-vue'
import { useProjectConfig } from '@/composables/useProjectConfig'

const {
  teamList,
  projectList,
  pointList,
  loading,
  error,
  fetchTeamList,
  fetchProjectAndPoints
} = useProjectConfig()

const searchText = ref('')

// 计算属性
const hasData = computed(() => {
  return teamList.value.length > 0 || 
         projectList.value.length > 0 || 
         pointList.value.length > 0
})

const filteredPointList = computed(() => {
  if (!searchText.value) {
    return pointList.value
  }
  const search = searchText.value.toLowerCase()
  return pointList.value.filter(point => {
    const name = (point.name || point.pointName || point.weName || '').toLowerCase()
    const id = String(point.id || point.pointId || point.weId || '')
    return name.includes(search) || id.includes(search)
  })
})

// 方法
const handleFetchTeams = async () => {
  try {
    await fetchTeamList()
    message.success(`成功获取 ${teamList.value.length} 个团队`)
  } catch (err) {
    message.error('获取团队列表失败: ' + err.message)
  }
}

const handleFetchPoints = async () => {
  try {
    const result = await fetchProjectAndPoints()
    message.success(`成功获取项目信息和 ${result.points.length} 个点位`)
  } catch (err) {
    message.error('获取项目点位失败: ' + err.message)
  }
}

const handleRefreshAll = async () => {
  try {
    await Promise.all([
      fetchTeamList(),
      fetchProjectAndPoints()
    ])
    message.success('刷新成功')
  } catch (err) {
    message.error('刷新失败: ' + err.message)
  }
}

const handleSelectPoint = (point) => {
  const pointName = point.name || point.pointName || point.weName
  const pointId = point.id || point.pointId || point.weId
  message.info(`已选择点位: ${pointName} (ID: ${pointId})`)
  console.log('选中的点位:', point)
}
</script>

<style scoped>
.project-config-panel {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

:deep(.ant-statistic-content) {
  font-size: 20px;
}
</style>

