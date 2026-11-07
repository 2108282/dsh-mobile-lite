/**
 * 轻量级文件触发器：在权限按钮右侧就地注入官方风格的文件上传按钮
 */
export function installFileTrigger(): void {
  // 官方 DSH 规范的 paperclip 细线条 SVG 图标（14×14，stroke-width 1.2）
  const PAPERCLIP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M12.75 4.5V9.5C12.75 10.7598 12.2496 11.968 11.3588 12.8588C10.468 13.7496 9.25978 14.25 8 14.25C6.74022 14.25 5.53204 13.7496 4.64124 12.8588C3.75045 11.968 3.25 10.7598 3.25 9.5V5C3.25 4.13805 3.59241 3.3114 4.2019 2.7019C4.8114 2.09241 5.63805 1.75 6.5 1.75C7.36195 1.75 8.1886 2.09241 8.7981 2.7019C9.40759 3.3114 9.75 4.13805 9.75 5V9.5C9.75 9.96413 9.56563 10.4092 9.23744 10.7374C8.90925 11.0656 8.46413 11.25 8 11.25C7.53587 11.25 7.09075 11.0656 6.76256 10.7374C6.43437 10.4092 6.25 9.96413 6.25 9.5V5.5" stroke="currentColor"></path></svg>`

  const applyBtnStyle = (btn: HTMLElement): void => {
    btn.style.setProperty('border', 'none', 'important')
    btn.style.setProperty('outline', 'none', 'important')
    btn.style.setProperty('background', 'transparent', 'important')
    btn.style.setProperty('box-shadow', 'none', 'important')
    btn.style.setProperty('width', '28px', 'important')
    btn.style.setProperty('height', '28px', 'important')
    btn.style.setProperty('min-width', '28px', 'important')
    btn.style.setProperty('min-height', '28px', 'important')
    btn.style.setProperty('border-radius', 'var(--dsw-radius-sm, 6px)', 'important')
    btn.style.setProperty('display', 'inline-flex', 'important')
    btn.style.setProperty('align-items', 'center', 'important')
    btn.style.setProperty('justify-content', 'center', 'important')
    btn.style.setProperty('padding', '0', 'important')
    btn.style.setProperty('margin', '0', 'important')
    btn.style.setProperty('color', 'var(--dsw-alias-label-secondary, currentColor)', 'important')
    btn.style.setProperty('cursor', 'pointer', 'important')
    btn.style.setProperty('-webkit-tap-highlight-color', 'transparent', 'important')
    btn.style.setProperty('flex', 'none', 'important')
  }

  const inject = (): void => {
    const card = document.querySelector('[data-composer-card]')
    if (!card) return
    
    const hostInput = card.querySelector('input[type=file]') as HTMLInputElement | null
    if (!hostInput) return

    // 锚定权限按钮所在的 modes 区域（加号按钮之后、权限按钮所在容器）
    const modes = card.querySelector('[class*="_modes"]')
    const tools = card.querySelector('[class*="_tools"]')
    if (!modes && !tools) return

    let btn = card.querySelector<HTMLButtonElement>('[data-mobile-nav="file-trigger"]')
    if (!btn) {
      btn = document.createElement('button')
      btn.type = 'button'
      btn.dataset.mobileNav = 'file-trigger'
      btn.title = '上传文件'
      btn.setAttribute('aria-label', '上传文件')
      btn.innerHTML = PAPERCLIP_SVG
      applyBtnStyle(btn)
      btn.onclick = (e) => {
        e.preventDefault()
        e.stopPropagation()
        hostInput.click()
      }
    } else {
      applyBtnStyle(btn)
    }

    // 精准插入位置：紧随权限按钮容器（modes）的右侧
    const targetParent = modes ? modes.parentElement : tools
    const insertBeforeNode = modes ? modes.nextSibling : null
    if (targetParent && btn.parentElement !== targetParent) {
      targetParent.insertBefore(btn, insertBeforeNode)
    } else if (targetParent && insertBeforeNode && btn.nextSibling !== insertBeforeNode) {
      targetParent.insertBefore(btn, insertBeforeNode)
    }
  }

  const observer = new MutationObserver(() => inject())
  observer.observe(document.body, { childList: true, subtree: true })
  inject()
}
