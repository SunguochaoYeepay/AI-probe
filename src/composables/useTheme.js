import { ref, computed, watch } from 'vue'

// 主题配置
const THEMES = {
  light: {
    name: '亮色主题',
    value: 'light',
    class: 'light-theme'
  },
  dark: {
    name: '暗黑主题', 
    value: 'dark',
    class: 'dark-theme'
  }
}

// 全局状态
const currentTheme = ref('light')
const isSystemDark = ref(false)

// 初始化主题
const initTheme = () => {
  // 检查本地存储
  const savedTheme = localStorage.getItem('app-theme')
  if (savedTheme && THEMES[savedTheme]) {
    currentTheme.value = savedTheme
  } else {
    // 检测系统主题
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    isSystemDark.value = mediaQuery.matches
    currentTheme.value = isSystemDark.value ? 'dark' : 'light'
    
    // 监听系统主题变化
    mediaQuery.addEventListener('change', (e) => {
      isSystemDark.value = e.matches
      if (!localStorage.getItem('app-theme')) {
        currentTheme.value = isSystemDark.value ? 'dark' : 'light'
        applyTheme(currentTheme.value)
      }
    })
  }
  
  applyTheme(currentTheme.value)
}

// 应用主题
const applyTheme = (theme) => {
  const root = document.documentElement
  
  // 移除所有主题类
  Object.values(THEMES).forEach(t => {
    root.classList.remove(t.class)
  })
  
  // 添加当前主题类
  if (THEMES[theme]) {
    root.classList.add(THEMES[theme].class)
  }
  
  // 设置CSS变量
  if (theme === 'dark') {
    root.style.setProperty('--bg-color', '#141414')
    root.style.setProperty('--bg-color-light', '#1f1f1f')
    root.style.setProperty('--text-color', '#ffffff')
    root.style.setProperty('--text-color-secondary', '#cccccc')
    root.style.setProperty('--border-color', '#303030')
    root.style.setProperty('--card-bg', '#1f1f1f')
    root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.3)')
  } else {
    root.style.setProperty('--bg-color', '#f5f5f5')
    root.style.setProperty('--bg-color-light', '#ffffff')
    root.style.setProperty('--text-color', '#262626')
    root.style.setProperty('--text-color-secondary', '#999999')
    root.style.setProperty('--border-color', '#d9d9d9')
    root.style.setProperty('--card-bg', '#ffffff')
    root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.1)')
  }
}

// 切换主题
const toggleTheme = () => {
  const newTheme = currentTheme.value === 'light' ? 'dark' : 'light'
  setTheme(newTheme)
}

// 设置主题
const setTheme = (theme) => {
  if (!THEMES[theme]) return
  
  currentTheme.value = theme
  applyTheme(theme)
  localStorage.setItem('app-theme', theme)
}

// 重置为系统主题
const resetToSystemTheme = () => {
  localStorage.removeItem('app-theme')
  currentTheme.value = isSystemDark.value ? 'dark' : 'light'
  applyTheme(currentTheme.value)
}

// 计算属性
const themeName = computed(() => THEMES[currentTheme.value]?.name || '未知主题')
const isDark = computed(() => currentTheme.value === 'dark')
const isLight = computed(() => currentTheme.value === 'light')
const isSystemTheme = computed(() => !localStorage.getItem('app-theme'))

// 监听主题变化
watch(currentTheme, (newTheme) => {
  applyTheme(newTheme)
})

export function useTheme() {
  return {
    // 状态
    currentTheme: computed(() => currentTheme.value),
    themeName,
    isDark,
    isLight,
    isSystemTheme,
    
    // 方法
    initTheme,
    toggleTheme,
    setTheme,
    resetToSystemTheme,
    
    // 主题配置
    themes: THEMES
  }
}
