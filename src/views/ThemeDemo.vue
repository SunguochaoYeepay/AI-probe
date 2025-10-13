<template>
  <AppLayout 
    page-title="主题系统演示"
    current-page="theme-demo"
    @menu-click="handleMenuClick"
  >
    <template #header-actions>
      <a-button @click="showThemeInfo">
        <InfoCircleOutlined />
        主题信息
      </a-button>
    </template>
    
    <div class="theme-demo">
      <a-card title="🎨 主题系统演示" class="demo-card">
        <div class="demo-content">
          <a-row :gutter="24">
            <a-col :span="12">
              <h3>🌟 当前主题</h3>
              <a-descriptions :column="1" bordered>
                <a-descriptions-item label="主题名称">
                  <a-tag :color="isDark ? 'purple' : 'blue'">
                    {{ themeName }}
                  </a-tag>
                </a-descriptions-item>
                <a-descriptions-item label="主题类型">
                  <a-tag :color="isDark ? 'dark' : 'light'">
                    {{ isDark ? '暗黑主题' : '亮色主题' }}
                  </a-tag>
                </a-descriptions-item>
                <a-descriptions-item label="是否跟随系统">
                  <a-tag :color="isSystemTheme ? 'green' : 'default'">
                    {{ isSystemTheme ? '是' : '否' }}
                  </a-tag>
                </a-descriptions-item>
              </a-descriptions>
            </a-col>
            
            <a-col :span="12">
              <h3>🎛️ 主题控制</h3>
              <a-space direction="vertical" style="width: 100%">
                <a-button 
                  type="primary" 
                  @click="toggleTheme"
                  :icon="isDark ? h(BulbFilled) : h(BulbOutlined)"
                  block
                >
                  {{ isDark ? '切换到亮色主题' : '切换到暗黑主题' }}
                </a-button>
                
                <a-button @click="setTheme('light')" block>
                  强制亮色主题
                </a-button>
                
                <a-button @click="setTheme('dark')" block>
                  强制暗黑主题
                </a-button>
                
                <a-button @click="resetToSystemTheme" block>
                  跟随系统主题
                </a-button>
              </a-space>
            </a-col>
          </a-row>
          
          <a-divider />
          
          <div class="demo-showcase">
            <h3>🎭 主题展示</h3>
            <a-row :gutter="16">
              <a-col :span="8">
                <a-card title="卡片示例" class="showcase-card">
                  <p>这是一个普通的卡片，会跟随当前主题变化。</p>
                  <a-button type="primary">主要按钮</a-button>
                  <a-button style="margin-left: 8px;">次要按钮</a-button>
                </a-card>
              </a-col>
              
              <a-col :span="8">
                <a-card title="表单示例" class="showcase-card">
                  <a-form layout="vertical">
                    <a-form-item label="用户名">
                      <a-input placeholder="请输入用户名" />
                    </a-form-item>
                    <a-form-item label="密码">
                      <a-input-password placeholder="请输入密码" />
                    </a-form-item>
                    <a-form-item>
                      <a-button type="primary" block>登录</a-button>
                    </a-form-item>
                  </a-form>
                </a-card>
              </a-col>
              
              <a-col :span="8">
                <a-card title="数据展示" class="showcase-card">
                  <a-statistic title="总访问量" :value="112893" />
                  <a-statistic title="活跃用户" :value="9283" style="margin-top: 16px;" />
                  <a-progress :percent="75" style="margin-top: 16px;" />
                </a-card>
              </a-col>
            </a-row>
          </div>
          
          <a-divider />
          
          <div class="demo-features">
            <h3>✨ 主题特性</h3>
            <a-list :data-source="features" bordered>
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-list-item-meta>
                    <template #title>
                      <span>{{ item.title }}</span>
                    </template>
                    <template #description>
                      {{ item.description }}
                    </template>
                  </a-list-item-meta>
                </a-list-item>
              </template>
            </a-list>
          </div>
        </div>
      </a-card>
    </div>
  </AppLayout>
</template>

<script setup>
import { h } from 'vue'
import { message } from 'ant-design-vue'
import {
  InfoCircleOutlined,
  BulbOutlined,
  BulbFilled
} from '@ant-design/icons-vue'
import AppLayout from '@/components/AppLayout.vue'
import { useTheme } from '@/composables/useTheme'

// 主题管理
const { 
  currentTheme, 
  themeName, 
  isDark, 
  isSystemTheme,
  toggleTheme, 
  setTheme, 
  resetToSystemTheme 
} = useTheme()

// 功能特性列表
const features = [
  {
    title: '🌓 智能主题切换',
    description: '支持亮色和暗黑主题一键切换，图标会自动更新'
  },
  {
    title: '💾 持久化存储',
    description: '主题选择会自动保存到本地存储，下次访问时保持选择'
  },
  {
    title: '🔄 系统主题跟随',
    description: '可以选择跟随系统主题设置，自动适配系统变化'
  },
  {
    title: '🎨 CSS变量驱动',
    description: '使用CSS变量实现主题切换，性能优秀，过渡流畅'
  },
  {
    title: '📱 响应式适配',
    description: '主题系统完全响应式，在所有设备上都能完美工作'
  }
]

// 方法
const handleMenuClick = (menuKey) => {
  console.log('菜单点击处理:', menuKey)
}

const showThemeInfo = () => {
  message.info(`当前主题: ${themeName.value}`)
}
</script>

<style scoped lang="less">
.theme-demo {
  .demo-card {
    .demo-content {
      h3 {
        color: var(--text-color, #262626);
        margin-bottom: 16px;
      }
      
      .demo-showcase {
        .showcase-card {
          height: 100%;
        }
      }
      
      .demo-features {
        .ant-list-item {
          border-color: var(--border-color, #d9d9d9);
        }
      }
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .theme-demo {
    .demo-content {
      .ant-row {
        .ant-col {
          margin-bottom: 16px;
        }
      }
    }
  }
}
</style>
