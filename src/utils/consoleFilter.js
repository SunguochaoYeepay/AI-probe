// 控制台警告过滤器
// 用于过滤 Ant Design Vue 的已知警告

// 过滤 useFrameWheel.js 的 passive event listener 警告
const originalWarn = console.warn
console.warn = function(...args) {
  // 安全处理参数，避免循环引用错误
  const message = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg)
      } catch (error) {
        return `[${arg.constructor?.name || 'Object'}]`
      }
    }
    return String(arg)
  }).join(' ')
  
  if (message.includes('Unable to preventDefault inside passive event listener') ||
      message.includes('useFrameWheel')) {
    return // 忽略这个警告
  }
  originalWarn.apply(console, args)
}

// 过滤其他 Ant Design Vue 的已知警告
const originalError = console.error
console.error = function(...args) {
  // 安全处理参数，避免循环引用错误
  const message = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg)
      } catch (error) {
        return `[${arg.constructor?.name || 'Object'}]`
      }
    }
    return String(arg)
  }).join(' ')
  
  if (message.includes('useFrameWheel.js')) {
    return // 忽略 useFrameWheel.js 相关的错误
  }
  originalError.apply(console, args)
}

export default {
  // 导出空对象，这个文件主要用于副作用
}
