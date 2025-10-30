<template>
  <div class="theme-config-tab">
    <a-card title="主题设置" class="config-card">
      <a-form layout="vertical">
        <a-form-item label="当前主题">
          <a-radio-group v-model:value="currentTheme" @change="handleThemeChange">
            <a-radio-button value="light">
              <template #icon>
                <BulbOutlined />
              </template>
              亮色主题
            </a-radio-button>
            <a-radio-button value="dark">
              <template #icon>
                <BulbFilled />
              </template>
              暗黑主题
            </a-radio-button>
          </a-radio-group>
        </a-form-item>

        <a-form-item label="主题模式">
          <a-radio-group v-model:value="themeMode" @change="handleModeChange">
            <a-radio value="manual">手动选择</a-radio>
            <a-radio value="system">跟随系统</a-radio>
          </a-radio-group>
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            手动选择：固定使用选择的主题；跟随系统：根据系统主题自动切换
          </div>
        </a-form-item>

        <a-form-item label="主题预览">
          <div class="theme-preview">
            <div class="preview-card" :class="currentTheme">
              <div class="preview-header">
                <h4>预览卡片</h4>
                <a-button size="small">操作按钮</a-button>
              </div>
              <div class="preview-content">
                <p>这是主题预览内容，展示了不同主题下的视觉效果。</p>
                <a-input placeholder="输入框预览" style="margin-top: 8px;" />
              </div>
            </div>
          </div>
        </a-form-item>

        <a-form-item>
          <a-space>
            <a-button type="primary" @click="handleSave" :loading="saving">
              保存设置
            </a-button>
            <a-button @click="handleReset">
              重置
            </a-button>
            <a-button @click="toggleTheme">
              快速切换
            </a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <!-- 主题信息卡片 -->
    <a-card title="主题信息" class="config-card">
      <a-descriptions :column="1" bordered>
        <a-descriptions-item label="当前主题">
          {{ themeName }}
        </a-descriptions-item>
        <a-descriptions-item label="主题模式">
          {{ themeMode === 'system' ? '跟随系统' : '手动选择' }}
        </a-descriptions-item>
        <a-descriptions-item label="系统主题">
          {{ isSystemDark ? '暗黑模式' : '亮色模式' }}
        </a-descriptions-item>
        <a-descriptions-item label="存储状态">
          {{ isSystemTheme ? '跟随系统设置' : '已保存用户设置' }}
        </a-descriptions-item>
      </a-descriptions>
    </a-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { BulbOutlined, BulbFilled } from '@ant-design/icons-vue'
import { useTheme } from '@/composables/useTheme'

// 主题管理
const { 
  currentTheme: currentThemeRef, 
  themeName, 
  isDark, 
  isSystemTheme,
  isSystemDark,
  toggleTheme, 
  setTheme, 
  resetToSystemTheme 
} = useTheme()

// 表单数据
const currentTheme = ref('light')
const themeMode = ref('manual')
const saving = ref(false)

// 初始化
onMounted(() => {
  loadThemeSettings()
})

// 加载主题设置
const loadThemeSettings = () => {
  currentTheme.value = currentThemeRef.value
  themeMode.value = isSystemTheme.value ? 'system' : 'manual'
}

// 处理主题变化
const handleThemeChange = (e) => {
  const newTheme = e.target.value
  setTheme(newTheme)
  message.success(`已切换到${newTheme === 'dark' ? '暗黑' : '亮色'}主题`)
}

// 处理模式变化
const handleModeChange = (e) => {
  const newMode = e.target.value
  if (newMode === 'system') {
    resetToSystemTheme()
    message.success('已设置为跟随系统主题')
  } else {
    // 保持当前主题，但标记为手动模式
    setTheme(currentTheme.value)
    message.success('已设置为手动选择主题')
  }
}

// 保存设置
const handleSave = async () => {
  try {
    saving.value = true
    
    // 根据模式设置主题
    if (themeMode.value === 'system') {
      resetToSystemTheme()
    } else {
      setTheme(currentTheme.value)
    }
    
    message.success('主题设置已保存')
  } catch (error) {
    console.error('保存主题设置失败:', error)
    message.error('保存主题设置失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

// 重置设置
const handleReset = () => {
  loadThemeSettings()
  message.info('主题设置已重置')
}
</script>

<style scoped lang="less">
.theme-config-tab {
  .config-card {
    margin-bottom: 16px;
  }

  .theme-preview {
    .preview-card {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      background: var(--card-bg);
      color: var(--text-color);
      transition: all 0.3s ease;

      .preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--border-color);

        h4 {
          margin: 0;
          color: var(--text-color);
        }
      }

      .preview-content {
        p {
          margin: 0 0 8px 0;
          color: var(--text-color-secondary);
        }
      }

      &.dark {
        background: #1f1f1f;
        color: #ffffff;
        border-color: #303030;

        .preview-header {
          border-bottom-color: #303030;

          h4 {
            color: #ffffff;
          }
        }

        .preview-content p {
          color: #cccccc;
        }
      }

      &.light {
        background: #ffffff;
        color: #262626;
        border-color: #d9d9d9;

        .preview-header {
          border-bottom-color: #d9d9d9;

          h4 {
            color: #262626;
          }
        }

        .preview-content p {
          color: #999999;
        }
      }
    }
  }
}
</style>
