/**
 * 轻量级文件触发器：直接在输入框工具行注入原生文件触发按钮
 */
export function installFileTrigger(): void {
  const inject = () => {
    // 限制注入范围：仅当处于输入状态时注入
    const card = document.querySelector('[data-mobile-nav="frame"] [data-composer-card]')
    if (!card || card.querySelector('[data-mobile-nav="file-trigger"]')) return
    
    const hostInput = card.querySelector('input[type=file]') as HTMLInputElement | null
    if (!hostInput) return

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.dataset.mobileNav = 'file-trigger'
    btn.title = '上传文件'
    // 使用纯粹的线条风格 Paperclip SVG，与官方图标库视觉权重一致
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v10.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>`
    btn.onclick = () => hostInput.click()
    
    // 找到工具栏行，插入在第一位
    const toolRow = card.querySelector('[class*="_tools"]')
    if (toolRow) {
      toolRow.insertBefore(btn, toolRow.firstChild)
    }
  }

  const observer = new MutationObserver(inject)
  observer.observe(document.body, { childList: true, subtree: true })
  inject()
}
