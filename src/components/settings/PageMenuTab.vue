<template>
  <div class="page-menu-tab">
    <div class="page-menu-header">
      <h3>页面菜单维护</h3>
      <p class="description">
        管理页面层级结构，用于用户行为路径分析的页面分类和层级展示
      </p>
    </div>

    <div class="page-menu-content">
      <!-- 操作按钮 -->
      <div class="action-buttons">
        <a-button type="primary" @click="importMenuData" :loading="importing">
          <template #icon>
            <UploadOutlined />
          </template>
          导入菜单数据
        </a-button>
        <a-button @click="exportMenuData" :disabled="!menuData">
          <template #icon>
            <DownloadOutlined />
          </template>
          导出菜单数据
        </a-button>
        <a-button @click="clearMenuData" :disabled="!menuData" danger>
          <template #icon>
            <DeleteOutlined />
          </template>
          清空数据
        </a-button>
        <a-button @click="refreshMenuData">
          <template #icon>
            <ReloadOutlined />
          </template>
          刷新
        </a-button>
      </div>

      <!-- 菜单数据展示 -->
      <div class="menu-data-section">
        <h4>当前菜单数据</h4>
        <div v-if="menuData" class="menu-data-info">
          <a-descriptions :column="2" bordered>
            <a-descriptions-item label="菜单总数">
              {{ menuData.data?.menus?.length || 0 }} 个一级菜单
            </a-descriptions-item>
            <a-descriptions-item label="最后更新时间">
              {{ formatDate(menuData.lastUpdated) }}
            </a-descriptions-item>
            <a-descriptions-item label="数据来源">
              {{ menuData.source || '手动导入' }}
            </a-descriptions-item>
            <a-descriptions-item label="状态">
              <a-tag :color="menuData.status === 'success' ? 'green' : 'red'">
                {{ menuData.status === 'success' ? '正常' : '异常' }}
              </a-tag>
            </a-descriptions-item>
          </a-descriptions>
        </div>
        <div v-else class="no-data">
          <a-empty description="暂无菜单数据">
            <template #image>
              <FileTextOutlined style="font-size: 48px; color: #d9d9d9;" />
            </template>
            <a-button type="primary" @click="importMenuData">
              导入菜单数据
            </a-button>
          </a-empty>
        </div>
      </div>

      <!-- 菜单树形结构预览 -->
      <div v-if="menuData" class="menu-tree-section">
        <h4>菜单结构预览</h4>
        <div class="menu-tree-container">
          <a-tree
            :tree-data="treeData"
            :default-expand-all="false"
            :show-line="true"
            :show-icon="true"
            :selectable="false"
          >
            <template #title="{ title, url, menuId }">
              <div class="tree-node">
                <span class="node-title">{{ title }}</span>
                <span v-if="url" class="node-url">{{ url }}</span>
                <a-tag size="small" color="blue">{{ menuId }}</a-tag>
              </div>
            </template>
            <template #icon>
              <FolderOutlined />
            </template>
          </a-tree>
        </div>
      </div>

      <!-- 使用说明 -->
      <div class="usage-section">
        <h4>使用说明</h4>
        <a-alert
          message="页面菜单数据说明"
          type="info"
          show-icon
        >
          <template #description>
            <ul>
              <li><strong>数据格式：</strong>支持JSON格式的菜单层级数据</li>
              <li><strong>字段要求：</strong>必须包含 menuId、menuName、url 等字段</li>
              <li><strong>层级结构：</strong>支持多级菜单嵌套（subMenus）</li>
              <li><strong>应用场景：</strong>用于用户行为路径分析的页面分类和层级展示</li>
              <li><strong>数据来源：</strong>可从商户后台系统获取菜单配置数据</li>
            </ul>
          </template>
        </a-alert>
      </div>
    </div>

    <!-- 导入数据对话框 -->
    <a-modal
      v-model:open="importModalVisible"
      title="导入菜单数据"
      width="800px"
      @ok="handleImport"
      @cancel="importModalVisible = false"
    >
      <div class="import-content">
        <a-alert
          message="请粘贴菜单数据的JSON格式内容"
          type="warning"
          show-icon
          style="margin-bottom: 16px;"
        />
        <a-textarea
          v-model:value="importData"
          placeholder="请粘贴完整的菜单数据JSON..."
          :rows="20"
          :maxlength="200000"
          show-count
        />
        <div class="import-tips">
          <p><strong>示例数据格式：</strong></p>
          <pre>{{ exampleData }}</pre>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { buildApiUrl } from '@/config/environment'
import { 
  UploadOutlined, 
  DownloadOutlined, 
  DeleteOutlined, 
  ReloadOutlined,
  FileTextOutlined,
  FolderOutlined
} from '@ant-design/icons-vue'
import { useStore } from 'vuex'

const store = useStore()

// 响应式数据
const menuData = ref(null)
const importing = ref(false)
const importModalVisible = ref(false)
const importData = ref('')

// 示例数据
const exampleData = `{
  "status": "success",
  "data": {
    "menus": [
      {
        "menuId": 2180,
        "menuName": "首页",
        "url": "/portal",
        "subMenus": [
          {
            "menuId": 2181,
            "menuName": "首页",
            "url": "/portal",
            "parentId": 2180
          }
        ]
      }
    ]
  }
}`

// 计算属性：树形数据
const treeData = computed(() => {
  if (!menuData.value?.data?.menus) return []
  
  return menuData.value.data.menus.map(menu => ({
    key: menu.menuId,
    title: menu.menuName,
    url: menu.url,
    menuId: menu.menuId,
    children: buildTreeChildren(menu.subMenus || [])
  }))
})

// 构建树形子节点
const buildTreeChildren = (subMenus) => {
  return subMenus.map(subMenu => ({
    key: subMenu.menuId,
    title: subMenu.menuName,
    url: subMenu.url,
    menuId: subMenu.menuId,
    children: buildTreeChildren(subMenu.subMenus || [])
  }))
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '未知'
  return new Date(dateString).toLocaleString('zh-CN')
}

// 导入菜单数据
const importMenuData = () => {
  importModalVisible.value = true
  importData.value = ''
}

// 处理导入
const handleImport = async () => {
  if (!importData.value.trim()) {
    message.error('请输入菜单数据')
    return
  }

  importing.value = true
  
  try {
    console.log('🔄 开始解析JSON数据...')
    const data = JSON.parse(importData.value)
    console.log('✅ JSON解析成功:', data)
    
    // 验证数据格式
    if (!data.data || !data.data.menus || !Array.isArray(data.data.menus)) {
      throw new Error('数据格式不正确，请检查JSON结构。需要包含 data.menus 数组')
    }
    
    console.log('📊 菜单数量:', data.data.menus.length)
    
    // 添加时间戳和来源
    data.lastUpdated = new Date().toISOString()
    data.source = '手动导入'
    
    // 🚀 配置统一化：保存到store（纯缓存）
    console.log('💾 保存数据到Store...')
    store.dispatch('updateProjectConfig', {
      pageMenuData: data
    })
    
    menuData.value = data
    
    // 保存到数据库
    try {
      const response = await fetch(buildApiUrl('/api/config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pageMenuData: data
        })
      })
      
      if (response.ok) {
        console.log('✅ 页面菜单配置已保存到数据库')
      } else {
        console.warn('⚠️ 页面菜单配置保存到数据库失败，但已保存到本地存储')
      }
    } catch (dbError) {
      console.warn('⚠️ 数据库连接失败，页面菜单配置仅保存到本地存储:', dbError.message)
    }
    
    console.log('✅ 菜单数据导入成功')
    message.success(`菜单数据导入成功！共导入 ${data.data.menus.length} 个一级菜单`)
    importModalVisible.value = false
    importData.value = ''
    
  } catch (error) {
    console.error('❌ 导入菜单数据失败:', error)
    
    // 提供更详细的错误信息
    let errorMessage = error.message
    if (error.message.includes('Bad control character')) {
      errorMessage = 'JSON格式错误：包含不可见字符，请检查数据完整性'
    } else if (error.message.includes('Unexpected token')) {
      errorMessage = 'JSON格式错误：语法不正确，请检查括号和引号'
    }
    
    message.error(`导入失败: ${errorMessage}`)
  } finally {
    importing.value = false
  }
}

// 导出菜单数据
const exportMenuData = () => {
  if (!menuData.value) {
    message.warning('暂无数据可导出')
    return
  }
  
  const dataStr = JSON.stringify(menuData.value, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `page-menu-data-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  
  message.success('菜单数据导出成功')
}

// 清空菜单数据
const clearMenuData = () => {
  menuData.value = null
  store.dispatch('updateProjectConfig', {
    pageMenuData: null
  })
  localStorage.removeItem('pageMenuData')
  message.success('菜单数据已清空')
}

// 刷新菜单数据
const refreshMenuData = () => {
  loadMenuData()
  message.success('数据已刷新')
}

// 加载菜单数据
const loadMenuData = () => {
  console.log('🔄 开始加载菜单数据...')
  
  // 从store获取
  const storeData = store.state.projectConfig?.pageMenuData
  console.log('📦 Store中的数据:', storeData)
  if (storeData) {
    menuData.value = storeData
    console.log('✅ 从Store加载菜单数据成功')
    return
  }
  
  // 🚀 配置统一化：不再从localStorage获取，完全依赖SQLite数据库
  console.log('🚀 配置统一化：不再从localStorage获取，完全依赖SQLite数据库')
}

// 组件挂载时加载数据
onMounted(() => {
  loadMenuData()
})
</script>

<style scoped lang="less">
.page-menu-tab {
  .page-menu-header {
    margin-bottom: 24px;
    
    h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 600;
    }
    
    .description {
      margin: 0;
      color: #666;
      font-size: 14px;
    }
  }
  
  .page-menu-content {
    .action-buttons {
      margin-bottom: 24px;
      
      .ant-btn {
        margin-right: 8px;
        margin-bottom: 8px;
      }
    }
    
    .menu-data-section {
      margin-bottom: 24px;
      
      h4 {
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 600;
      }
      
      .menu-data-info {
        background: #fafafa;
        padding: 16px;
        border-radius: 6px;
      }
      
      .no-data {
        text-align: center;
        padding: 40px 0;
      }
    }
    
    .menu-tree-section {
      margin-bottom: 24px;
      
      h4 {
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 600;
      }
      
      .menu-tree-container {
        max-height: 400px;
        overflow-y: auto;
        border: 1px solid #d9d9d9;
        border-radius: 6px;
        padding: 16px;
        background: #fff;
        
        .tree-node {
          display: flex;
          align-items: center;
          gap: 8px;
          
          .node-title {
            font-weight: 500;
          }
          
          .node-url {
            color: #666;
            font-size: 12px;
            font-family: monospace;
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
          }
        }
      }
    }
    
    .usage-section {
      h4 {
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 600;
      }
      
      ul {
        margin: 8px 0 0 0;
        padding-left: 20px;
        
        li {
          margin-bottom: 4px;
        }
      }
    }
  }
  
  .import-content {
    .import-tips {
      margin-top: 16px;
      
      p {
        margin: 0 0 8px 0;
        font-weight: 500;
      }
      
      pre {
        background: #f5f5f5;
        padding: 12px;
        border-radius: 4px;
        font-size: 12px;
        overflow-x: auto;
        margin: 0;
      }
    }
  }
}
</style>
