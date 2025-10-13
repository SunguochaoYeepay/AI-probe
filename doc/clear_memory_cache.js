/**
 * 清理内存缓存的快速脚本
 * 
 * 使用场景：
 * - 当发现数据量不对时
 * - 当怀疑内存缓存有问题时
 * - 当需要强制重新从IndexedDB加载数据时
 * 
 * 使用方法：
 * 1. 在浏览器控制台中运行此脚本
 * 2. 刷新页面或重新查询
 */

(async function clearMemoryCache() {
  console.log('%c====================================', 'color: #1890ff; font-weight: bold')
  console.log('%c🧹 清理内存缓存', 'color: #1890ff; font-weight: bold; font-size: 14px')
  console.log('%c====================================', 'color: #1890ff; font-weight: bold')
  
  try {
    // 方法1: 通过Vue实例清理
    const app = document.querySelector('#app').__vueParentComponent
    if (app) {
      // 找到useDataFetch的dataCache
      console.log('🔍 查找内存缓存...')
      
      // 直接清理localStorage中的相关缓存
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('multi-') || key.includes('cache'))) {
          keysToRemove.push(key)
        }
      }
      
      if (keysToRemove.length > 0) {
        keysToRemove.forEach(key => {
          localStorage.removeItem(key)
          console.log(`  ✅ 清理: ${key}`)
        })
        console.log(`\n✅ 已清理 ${keysToRemove.length} 个localStorage缓存`)
      } else {
        console.log('  ℹ️ localStorage中没有找到相关缓存')
      }
    }
    
    // 方法2: 清理sessionStorage
    console.log('\n🔍 检查sessionStorage...')
    const sessionKeysToRemove = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && (key.includes('multi-') || key.includes('cache'))) {
        sessionKeysToRemove.push(key)
      }
    }
    
    if (sessionKeysToRemove.length > 0) {
      sessionKeysToRemove.forEach(key => {
        sessionStorage.removeItem(key)
        console.log(`  ✅ 清理: ${key}`)
      })
      console.log(`\n✅ 已清理 ${sessionKeysToRemove.length} 个sessionStorage缓存`)
    } else {
      console.log('  ℹ️ sessionStorage中没有找到相关缓存')
    }
    
    // 方法3: 清理可能的内存引用
    console.log('\n🔍 清理内存引用...')
    if (window.__DATA_CACHE__) {
      window.__DATA_CACHE__ = null
      console.log('  ✅ 已清理 window.__DATA_CACHE__')
    }
    
    console.log('\n%c====================================', 'color: #52c41a; font-weight: bold')
    console.log('%c✅ 内存缓存清理完成！', 'color: #52c41a; font-weight: bold; font-size: 14px')
    console.log('%c====================================', 'color: #52c41a; font-weight: bold')
    
    console.log(`
💡 下一步操作：
━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 刷新页面 (推荐)
   或
2. 重新执行查询

现在系统会从IndexedDB重新加载完整数据
    `)
    
    return { success: true }
    
  } catch (error) {
    console.error('%c❌ 清理过程出错:', 'color: #f5222d; font-weight: bold', error)
    return { success: false, error: error.message }
  }
})()

