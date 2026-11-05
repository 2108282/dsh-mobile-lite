import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { getFrame } from './phone-chrome.ts'

/**
 * 带有平滑退出动画关闭左侧抽屉
 */
export function closeLeftDrawerAnimated(ctx?: ClientContext): void {
  const frame = getFrame()
  const drawer = frame?.querySelector<HTMLElement>(':scope > [class*="sidebarCol"], [class*="sidebarCol"]')
  const mask = frame?.querySelector<HTMLElement>('[class*="drawerMask"], [data-sidebar-mask]')

  if (!drawer) {
    if (ctx) ctx.layout.toggleSidebar()
    return
  }

  // 1. 抽屉平滑滑出屏幕外
  drawer.style.transition = 'transform 0.28s var(--ds-ease-in-out, ease-in-out)'
  drawer.style.transform = 'translateX(-110%)'

  if (mask) {
    mask.style.transition = 'opacity 0.28s var(--ds-ease-in-out, ease-in-out)'
    mask.style.opacity = '0'
  }

  // 2. 动画结束（280ms）后正式提交宿主折叠状态
  setTimeout(() => {
    drawer.style.transition = ''
    drawer.style.transform = ''
    if (mask) {
      mask.style.transition = ''
      mask.style.opacity = ''
    }
    if (frame && !frame.hasAttribute('data-sidebar-collapsed')) {
      if (ctx) {
        ctx.layout.toggleSidebar()
      } else {
        const toggleBtn = document.querySelector<HTMLElement>('[data-mobile-nav="toggle"], [data-sidebar-toggle]')
        toggleBtn?.click()
      }
    }
  }, 280)
}

/**
 * 带有平滑退出动画关闭右侧 Files 面板
 */
export function closeRightSidebarAnimated(): void {
  const panel = document.querySelector<HTMLElement>('[data-sidebar-right-panel]')
  const closer = document.querySelector<HTMLElement>('[data-sidebar-right-toggle]')

  if (!panel) {
    closer?.click()
    return
  }

  // 1. 触发 CSS 向右平滑移出屏幕
  panel.style.transition = 'transform 0.28s var(--ds-ease-in-out, ease-in-out)'
  panel.style.transform = 'translateX(100%)'
  panel.style.pointerEvents = 'none'

  // 2. 动画结束后真正调用宿主卸载按钮
  setTimeout(() => {
    if (typeof closer?.click === 'function') {
      closer.click()
    }
    panel.style.transition = ''
    panel.style.transform = ''
    panel.style.pointerEvents = ''
  }, 280)
}

/**
 * 安全派发 Escape 键盘事件
 */
function dispatchEscape(): void {
  if (typeof document === 'undefined') return
  const event = typeof KeyboardEvent !== 'undefined'
    ? new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      })
    : { key: 'Escape', bubbles: true }
  document.dispatchEvent(event as any)
}

/**
 * 关闭设置模态弹窗
 */
function closeSettingsModal(): void {
  dispatchEscape()
  const closeBtn = document.querySelector<HTMLElement>(
    '[data-shortcut-modal="settings"] button:has(svg), [role="dialog"][data-shortcut-modal="settings"] button:has(svg)'
  )
  closeBtn?.click()
}

/**
 * 全面屏手势响应核心：根据当前顶层页面自动触发对应退出动作
 *
 * @param ctx 插件上下文（可选）
 * @returns 
 *  - true: 消费了返回手势（关闭了设置/抽屉/文件栏/插件页/自动化任务等）
 *  - 'none': 处于底层的【普通对话页】，不工作
 */
export function triggerMobileBack(ctx?: ClientContext): true | 'none' {
  console.log('[DSH-Back] triggerMobileBack called')

  // =========================================================================
  // 1. 检测【设置页 / 模态框】是否处于最上层
  // =========================================================================
  const settingsModal = document.querySelector(
    '[data-shortcut-modal="settings"], [role="dialog"][data-shortcut-modal="settings"], [data-shortcut-modal="shortcuts"]'
  )
  if (settingsModal && getComputedStyle(settingsModal).display !== 'none') {
    console.log('[DSH-Back] matched: settings modal -> closing')
    closeSettingsModal()
    return true
  }

  const genericModal = document.querySelector('[role="dialog"][aria-modal="true"]')
  if (genericModal && getComputedStyle(genericModal).display !== 'none' && !genericModal.querySelector('[data-dsh-market-root]')) {
    console.log('[DSH-Back] matched: generic modal -> closing')
    dispatchEscape()
    return true
  }

  // =========================================================================
  // 2. 检测【左侧会话抽屉】是否处于最上层
  // （同时兼顾 frame 属性与原生 sidebarCol 可见性）
  // =========================================================================
  const frame = getFrame()
  const hasCollapsedAttr = frame ? frame.hasAttribute('data-sidebar-collapsed') : true
  const drawerEl = document.querySelector<HTMLElement>('[class*="sidebarCol"]')
  let drawerVisible = false
  if (drawerEl) {
    const cs = getComputedStyle(drawerEl)
    drawerVisible = cs.display !== 'none' && cs.visibility !== 'hidden' && cs.transform === 'none'
  }

  if ((frame && !hasCollapsedAttr) || drawerVisible) {
    console.log('[DSH-Back] matched: left drawer -> closing animated')
    closeLeftDrawerAnimated(ctx)
    return true
  }

  // =========================================================================
  // 3. 检测【右侧文件栏】是否处于最上层
  // =========================================================================
  const rightPanel = document.querySelector('[data-sidebar-right-panel]')
  if (rightPanel) {
    const cs = getComputedStyle(rightPanel)
    const inViewport = rightPanel.getBoundingClientRect().left < window.innerWidth
    const isVisible = cs.display !== 'none' && cs.visibility !== 'hidden'
    if (isVisible && inViewport) {
      console.log('[DSH-Back] matched: right sidebar panel -> closing animated')
      closeRightSidebarAnimated()
      return true
    }
  }
  if (frame?.hasAttribute('data-aionui-explorer-open')) {
    console.log('[DSH-Back] matched: aionui explorer -> closing')
    frame.removeAttribute('data-aionui-explorer-open')
    return true
  }

  // =========================================================================
  // 4. 检测【插件市场】是否处于最上层
  // =========================================================================
  const marketRoot = document.querySelector<HTMLElement>('[data-dsh-market-root]')
  if (marketRoot && getComputedStyle(marketRoot).display !== 'none') {
    const detailBackBtn = marketRoot.querySelector<HTMLElement>(
      'button[class*="back"], button[aria-label*="返回"], button[title*="返回"], [class*="detail"] button:has(svg)'
    )
    if (detailBackBtn && getComputedStyle(detailBackBtn).display !== 'none') {
      console.log('[DSH-Back] matched: plugin market detail back')
      detailBackBtn.click()
      return true
    }

    console.log('[DSH-Back] matched: plugin market home -> closing')
    const marketCloseBtn = marketRoot.querySelector<HTMLElement>('button:has(svg)')
    if (marketCloseBtn) {
      marketCloseBtn.click()
    } else {
      dispatchEscape()
    }
    return true
  }

  const activePanelRow = document.querySelector<HTMLElement>('[class*="panelRow"][aria-current="page"]')
  if (activePanelRow) {
    console.log('[DSH-Back] matched: active panel row -> exiting panel')
    if (ctx && typeof (ctx.layout as any)?.selectPanel === 'function') {
      ;(ctx.layout as any).selectPanel(null)
    } else {
      activePanelRow.click()
    }
    return true
  }

  // =========================================================================
  // 5. 检测【自动化任务页 / Taskboard】是否处于最上层
  // =========================================================================
  const isTaskboardActive = document.documentElement.hasAttribute('data-dsh-taskboard-active')
    || document.querySelector('[data-dsh-taskboard-board]') !== null

  if (isTaskboardActive) {
    console.log('[DSH-Back] matched: taskboard active -> exiting')
    const taskboardExitBtn = document.querySelector<HTMLElement>(
      '[data-dsh-taskboard-board] button[class*="close"], [data-dsh-taskboard-board] button[class*="exit"], [data-mobile-nav="fab"]'
    )
    if (taskboardExitBtn) {
      taskboardExitBtn.click()
    } else {
      window.history.back()
    }
    return true
  }

  // =========================================================================
  // 6. 处于底层的【普通对话页】
  // =========================================================================
  console.log('[DSH-Back] conversation bottom view -> return none')
  return 'none'
}

/**
 * 安装全面屏手势分发器
 * 注意：必须无条件直绑 window，严禁套在 MOBILE_QUERY 媒体查询门控中！
 */
export function installMobileBackDispatcher(ctx: ClientContext): void {
  const boundTrigger = (): true | 'none' => triggerMobileBack(ctx)

  // 1. 无条件立即挂载在 window 上，保证 WebView 随时可调
  if (typeof window !== 'undefined') {
    ;(window as any).triggerMobileBack = boundTrigger
    ;(window as any).__dshTriggerMobileBack = boundTrigger
    console.log('[DSH-Back] window.triggerMobileBack bound successfully')
  }

  // 2. 挂载到 ctx.effect 生命周期中进行卸载管理
  ctx.effect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        if ((window as any).triggerMobileBack === boundTrigger) {
          delete (window as any).triggerMobileBack
        }
        if ((window as any).__dshTriggerMobileBack === boundTrigger) {
          delete (window as any).__dshTriggerMobileBack
        }
      }
    }
  }, 'dsh-web-mobile: mobile back dispatcher')
}
