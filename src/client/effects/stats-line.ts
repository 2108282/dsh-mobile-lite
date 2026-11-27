import type { ReconcilerTask } from '../core/reconciler-core.ts'
import { ensureFrameMarker, isMobileViewport } from './phone-chrome.ts'

// The official conversation status row (turns / steps / LLM time / TTFT /
// cache) has a hashed class, so the stylesheet cannot target it directly.
// Mark the exact row on narrow screens by text: a [class*=_root] that
// carries the metrics text and no composer input (textarea or the
// data-composer-input Lexical node; the composer card also ends in
// _root and can mention turns in its model line). The CSS then lays the
// marked row out as ONE horizontally scrolling line with every metric
// reachable.
// Fast-path predicate: is the previously marked strip still alive in place?
// Re-verifying one anchor per flush is O(1); the full-tree hunt in mark()
// grows with the conversation and runs on every streaming token.
export function statsAnchorAlive(el: Element | null): boolean {
  if (el === null || !el.isConnected) return false
  if (el.closest('[data-phase]') === null) return false
  // The strip must stay inside the composer stack, but it need not be a
  // DIRECT child of it: 0.1.5 nests the status row (bOPqQW_root) under the
  // composer card wrapper (uV2eYG_root), so the marked element sits one level
  // deeper than on rc.2 hosts. Ancestry is still the right test — only the
  // marker's own subtree position changed, not its container relationship.
  return el.closest('[class*="_composerStack"]') !== null
}

export function createStatsLineTask(): ReconcilerTask {
  // React-owned nodes must never be relocated (issue #104): on unmount React
  // calls parent.removeChild(child) against the parent it rendered the node
  // into, so a node this task moved makes that throw NotFoundError and the
  // SlotErrorBoundary blanks the whole composer slot until a reload. The
  // offline-reconnect rebuild hits exactly this path. Modern dock items
  // therefore stay in place and only receive grid markers. The legacy TPS
  // readout still overlays a plugin-owned placeholder without moving nodes;
  // its coordinates refresh on viewport resize (including the keyboard).

  // The overlay must resolve against a positioned ancestor. The host rarely
  // positions these containers, so mark the expected one (CSS sets
  // position: relative for the marker, without !important so host styles stay
  // in charge) and let placeOverlay walk to whichever ancestor actually ends
  // up positioned — the math is self-consistent with any container.
  const ensurePositioned = (el: Element, marker: string): void => {
    if (getComputedStyle(el).position === 'static') el.setAttribute('data-mobile-nav', marker)
  }
  const positionedAncestor = (el: Element): Element | null => {
    for (let node = el.parentElement; node !== null; node = node.parentElement) {
      if (getComputedStyle(node).position !== 'static') return node
    }
    return null
  }
  const placeOverlay = (host: Element, reserve: Element): void => {
    const container = positionedAncestor(host)
    if (container === null) return
    const box = reserve.getBoundingClientRect()
    const base = container.getBoundingClientRect()
    const left = box.left - base.left - container.clientLeft
    // Center the host on its slot vertically, not top-align it. Measured
    // 2026-09-29 (issue #140 acceptance): the 20px ring top-aligned on its
    // 16px reserve hung its center at y=793 while the neighbouring keys sit
    // at 789-791 — reported as「不与其他小UI对齐」. Centering is a no-op for
    // same-height overlays (the 0.1.5/0.1.6 TPS text) and aligns the ring
    // with the cluster. hostRect is read BEFORE the style write below; its
    // height does not depend on top/left, so the math is stable across flushes.
    const hostRect = host.getBoundingClientRect()
    const top = box.top - base.top - container.clientTop - (hostRect.height - box.height) / 2
    const styled = host as HTMLElement
    if (styled.style.left !== `${left}px`) styled.style.left = `${left}px`
    if (styled.style.top !== `${top}px`) styled.style.top = `${top}px`
  }

  // The composer root renders the TPS readout ("TPS 89.4 tok/s") as its own
  // row BELOW the status strip; fold it into the strip so every metric sits
  // on one line. Idempotent: the placeholder's text mirrors the readout and
  // the readout itself is overlaid on the placeholder's box.
  const moveTps = (stats: Element): void => {
    const stack = stats.closest('[class*="_composerStack"]')
    if (stack === null) return
    let reserve = stats.querySelector(':scope > [data-mobile-nav="stats-tps-reserve"]')
    for (const el of stack.querySelectorAll('div')) {
      const text = (el.textContent ?? '').trim()
      if (!/^TPS\s+\d/.test(text)) continue
      if (el.children.length > 0) continue
      if (el.getAttribute('data-mobile-nav') === 'stats-tps') continue
      if (reserve === null) {
        reserve = document.createElement('span')
        reserve.setAttribute('data-mobile-nav', 'stats-tps-reserve')
        reserve.setAttribute('aria-hidden', 'true')
        stats.appendChild(reserve)
      }
      const live = el.textContent ?? ''
      if (reserve.textContent !== live) reserve.textContent = live
      el.setAttribute('data-mobile-nav', 'stats-tps')
      const tpsRow = el.parentElement
      if (tpsRow === null) continue
      ensurePositioned(tpsRow, 'stats-tps-row')
      placeOverlay(el, reserve)
      // The strip's last child is the flex shrink group: mirror whatever
      // width the placeholder settled on so the overlay clips with the same
      // ellipsis instead of overlapping the neighbouring group.
      const width = reserve.getBoundingClientRect().width
      const styled = el as HTMLElement
      if (styled.style.maxWidth !== `${width}px`) styled.style.maxWidth = `${width}px`
      return
    }
  }
  // Only annotate grid items; keep React's parent/child relationships intact.
  // The host's list slot holds activity / usage / extensions. ContextMeter is
  // a separate direct child AFTER that slot, never a descendant of an extension.
  const dockMarkers = new Map<Element, string>()
  const itemMarkers = new Map<Element, string>()
  const ringMarkers = new Map<Element, string>()
  const syncMarkers = (attribute: string, current: Map<Element, string>, next: Map<Element, string>): void => {
    for (const [el, value] of current) {
      if (!next.has(el) && el.getAttribute(attribute) === value) el.removeAttribute(attribute)
    }
    current.clear()
    for (const [el, value] of next) {
      if (el.getAttribute(attribute) !== value) el.setAttribute(attribute, value)
      current.set(el, value)
    }
  }
  const markDockLayout = (): boolean => {
    const docks = new Map<Element, string>()
    const items = new Map<Element, string>()
    const rings = new Map<Element, string>()
    const stack = document.querySelector('[class*="_composerStack"]')
    if (isMobileViewport() && stack !== null) {
      for (const dock of stack.querySelectorAll('[data-composer-dock]')) {
        const slot = dock.querySelector(':scope > [data-slot="conversation.composer.dock"]')
        if (slot === null) continue
        docks.set(dock, '')
        const markItem = (el: Element): void => {
          // Transparent slot-entry wrappers generate no grid box. Do not
          // descend into a contribution's own flex/grid layout or popover.
          if (getComputedStyle(el).display === 'contents') {
            for (const child of el.children) markItem(child)
            return
          }
          const stat = el.getAttribute('data-composer-stat')
          items.set(el, stat === 'activity' || stat === 'usage' ? stat : 'extension')
        }
        for (const child of slot.children) markItem(child)
        for (const child of dock.children) {
          if (child === slot) continue
          // Match the host ContextMeter's exact structural seat and reading,
          // not arbitrary circle/percent widgets anywhere under the composer.
          const button = child.matches('span')
            ? child.querySelector('button[aria-haspopup="dialog"]')
            : null
          const svg = button?.querySelector(':scope > svg[viewBox="0 0 14 14"]')
          const isRing = svg?.querySelectorAll(':scope > circle').length === 2 &&
            /^\d+(?:\.\d+)?%$/.test((button?.textContent ?? '').trim())
          items.set(child, isRing ? 'ring' : 'extension')
          if (isRing) rings.set(child, 'stats-ring')
        }
      }
    }
    syncMarkers('data-mobile-stats-grid', dockMarkers, docks)
    syncMarkers('data-mobile-dock-item', itemMarkers, items)
    syncMarkers('data-mobile-nav', ringMarkers, rings)
    return docks.size > 0
  }

  // 精简与规整统计胶囊文本：隐藏 · 分隔符后确保段落之间有正常空格，并将 "缓存命中" 精简为 "命中"
  const compactStatsText = (): void => {
    if (!isMobileViewport()) return
    const stack = document.querySelector('[class*="_composerStack"]')
    if (stack === null) return
    for (const statKey of ['activity', 'usage']) {
      const pill = stack.querySelector(`[data-composer-stat="${statKey}"]`)
      if (pill === null) continue
      const label = pill.querySelector('[class*="_label"]') ?? pill.querySelector('button')
      if (label === null) continue
      const children = [...label.childNodes]
      // 如果存在 _sep 分隔符且后方有第二段文字，确保前半段文字末尾有一个正常空格
      if (children.length >= 3) {
        const first = children[0]
        if (first.nodeType === Node.TEXT_NODE && first.nodeValue && !first.nodeValue.endsWith(' ')) {
          first.nodeValue = `${first.nodeValue.trimEnd()} `
        }
      }
      if (statKey === 'usage') {
        const walker = document.createTreeWalker(pill, NodeFilter.SHOW_TEXT)
        let node: Text | null
        while ((node = walker.nextNode() as Text | null)) {
          if (node.nodeValue && node.nodeValue.includes('缓存命中')) {
            node.nodeValue = node.nodeValue.replace(/缓存命中/g, '命中')
          }
        }
      }
    }
  }

  let viewportHandler: (() => void) | null = null
  const relayout = (): void => mark()
  // Observe only the composer stack, never the streaming message tree.
  // Rebind when the stack changes, even when the modern dock has no legacy
  // stats anchor (session switch, initial async mount, offline reconnect).
  let scopeObserver: MutationObserver | null = null
  let observedStack: Element | null = null
  let rafId: number | null = null
  const SELF_SELECTOR =
    '[data-mobile-nav="stats-ring"], [data-mobile-nav="stats-tps"], [data-mobile-nav="stats-ring-reserve"], [data-mobile-nav="stats-tps-reserve"]'
  const scheduleMark = (): void => {
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      mark()
    })
  }
  const attachScope = (): void => {
    const stack = document.querySelector('[class*="_composerStack"]')
    if (stack === observedStack) return
    scopeObserver?.disconnect()
    observedStack = stack
    if (stack === null) return
    if (scopeObserver === null) {
      scopeObserver = new MutationObserver((records) => {
        // Overlay/reserve writes must not echo back into mark(). Marker
        // attributes are not observed, so the grid never wakes itself up.
        for (const record of records) {
          const el = record.target instanceof Element ? record.target : record.target.parentElement
          if (el !== null && el.closest(SELF_SELECTOR) !== null) continue
          scheduleMark()
          return
        }
      })
    }
    scopeObserver.observe(stack, { childList: true, subtree: true, characterData: true })
  }
  let reanchorId: number | null = null
  // Keep the existing idle re-anchor for stack replacement; modern docks only
  // visit their few layout items, without a legacy composer-wide root scan.
  const reanchor = (): void => mark()
  const mark = (): void => {
    if (!isMobileViewport()) return
    ensureFrameMarker()
    // Keyboard open/close and viewport rotations relayout the composer without
    // any DOM mutation, so legacy TPS overlays need a resize channel.
    if (viewportHandler === null) {
      viewportHandler = relayout
      window.addEventListener('resize', relayout)
      window.visualViewport?.addEventListener('resize', relayout)
    }
    attachScope()
    const hasDock = markDockLayout()
    compactStatsText()
    if (hasDock) return

    // Fast path for the legacy status strip. Modern dock pills must never be
    // mistaken for that strip (nor should an extension mentioning steps).
    const anchor = document.querySelector('[data-mobile-nav="stats"]')
    if (anchor !== null && statsAnchorAlive(anchor)) {
      moveTps(anchor)
      return
    }
    anchor?.removeAttribute('data-mobile-nav')
    // Scope decision: the status row is a DESCENDANT of the composer stack,
    // not necessarily its child. On rc.2 hosts it is a direct child (its own
    // `_root`); on 0.1.5 the composer card wrapper (uV2eYG_root) sits between
    // the stack and the row (bOPqQW_root), so requiring a direct child made
    // the hunt permanently miss and the strip was never marked (measured: row
    // present at 16,814 carrying "8 turns 582 steps · 103 tok/s" while
    // [data-mobile-nav="stats"] was absent). Body blocks outside the stack are
    // still skipped by the containment test below.
    const stack = document.querySelector('[class*="_composerStack"]')
    if (stack === null) return
    for (const root of stack.querySelectorAll('[data-composer-stats], [class*="_root"]')) {
      // The status row lives inside the composer stack. The query is already
      // scoped to the stack, so every candidate is inside it by construction —
      // message-area blocks that mention turns/steps never enter this loop. (A
      // `stack.contains(root)` guard stood here and its comment claimed to skip
      // those blocks; it was unreachable.)
      // The todo plan strip also lives in the composer stack and its root
      // ends in _root. Its items may legitimately contain "步"/"steps" in
      // their text, so never mistake it (or any interactive dock panel)
      // for the stats strip.
      if (root.matches('[data-testid="todo-panel"]')) continue
      // Dock panels are skipped by never marking a candidate whose buttons are
      // actionable controls. 0.1.5 renders the status row ITSELF as two
      // popover buttons (bOPqQW_pill, aria-haspopup="dialog"), so an
      // "any button" guard excluded the one row this task exists to mark
      // (measured: bOPqQW_root rejected solely by hasButton, marker count 0).
      // Every popover button counts as a status widget: the composer's real
      // controls (model bar, context meter) carry no metrics text and are
      // filtered by the text test above, and a panel with an actionable button
      // still fails here.
      const buttons = root.querySelectorAll('button')
      if (buttons.length > 0 && ![...buttons].every((button) => button.getAttribute('aria-haspopup') !== null)) continue
      const text = root.textContent ?? ''
      if (!/(turns|steps|\bLLM\b|轮|步)/.test(text)) continue
      // Composer card must never be mistaken for the status strip; exclude
      // its input region across both composer DOMs (textarea / Lexical
      // contentEditable marked data-composer-input).
      if (root.querySelector('textarea, [data-composer-input]') !== null) continue
      root.setAttribute('data-mobile-nav', 'stats')
      moveTps(root)
      return
    }
  }
  // Scope decision: the TPS readout updates are childList/characterData text
  // mutations inside the composer stack, so this task can only wake on the
  // tree key. This fork's reconciler never notes '*' (see attachScope above),
  // so the task carries its own scoped observer plus an idle re-anchor; the
  // expensive composer-stack scan still only runs when the anchor is stale.
  let started = false
  return {
    name: 'stats-line',
    scopes: ['*'],
    ensure: () => {
      attachScope()
      if (!started) {
        started = true
        reanchorId = setInterval(reanchor, 350)
      }
      mark()
    },
    dispose: () => {
      // Hand the official layout back: drop every marker (the strip loses its
      // one-line layout, the TPS overlay returns to static flow) and remove
      // the plugin-owned placeholders.
      if (viewportHandler !== null) {
        window.removeEventListener('resize', viewportHandler)
        window.visualViewport?.removeEventListener('resize', viewportHandler)
        viewportHandler = null
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      if (reanchorId !== null) {
        clearInterval(reanchorId)
        reanchorId = null
      }
      scopeObserver?.disconnect()
      scopeObserver = null
      observedStack = null
      started = false
      syncMarkers('data-mobile-stats-grid', dockMarkers, new Map())
      syncMarkers('data-mobile-dock-item', itemMarkers, new Map())
      syncMarkers('data-mobile-nav', ringMarkers, new Map())
      for (const el of document.querySelectorAll('[data-mobile-nav="stats-tps"]')) {
        const styled = el as HTMLElement
        styled.style.left = ''
        styled.style.top = ''
        styled.style.maxWidth = ''
        styled.style.position = ''
      }
      for (const key of ['stats', 'stats-ring', 'stats-ring-dock', 'stats-tps', 'stats-tps-row']) {
        for (const el of document.querySelectorAll(`[data-mobile-nav="${key}"]`)) {
          el.removeAttribute('data-mobile-nav')
        }
      }
      for (const el of document.querySelectorAll('[data-mobile-nav="stats-ring-reserve"], [data-mobile-nav="stats-tps-reserve"]')) {
        el.remove()
      }
    },
  }
}
