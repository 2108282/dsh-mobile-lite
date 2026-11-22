import { createElement as h, useEffect, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { MOBILE_QUERY } from './phone-chrome.ts'

const STORAGE_KEY = 'dsh-mobile-lite.text-width'
const FLOW = '[data-chat-flow]:not([data-chat-flow] [data-chat-flow])'
const CHAT = '[data-slot="main"] [data-conversation-content][data-conversation-region="chat"] [data-conversation-scroll]'
const COLUMN = `${CHAT} ${FLOW}`
const SCROLLER = `${CHAT} :has(> ${FLOW})`
const EDGE = 8

interface Preference { enabled: boolean; width: number }
interface Limits { min: number; max: number }
interface Slots {
  inject(name: string, register: () => (() => void)): () => void
  register(options: Record<string, unknown>, component: unknown): () => void
}

function readPreference(): Preference {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (value !== null && Number.isInteger(value.width) && value.width > 0 && value.width <= 2400) {
      return { enabled: value.enabled === true, width: value.width }
    }
  } catch { /* Unavailable or invalid browser storage uses the disabled default. */ }
  return { enabled: false, width: 680 }
}

export function installTextWidth(ctx: ClientContext): void {
  let preference = readPreference()
  let style: HTMLStyleElement | undefined

  const sync = (): void => {
    style?.remove()
    style = undefined
    if (!preference.enabled) return
    style = document.createElement('style')
    style.dataset.pluginCss = 'dsh-mobile-lite-text-width'
    // After reducing the scroller gutter to 8px, subtract the released space
    // to retain the native column as a responsive lower bound. The shared
    // Host width variable and the composer remain untouched.
    style.textContent = `@media ${MOBILE_QUERY} {
      ${SCROLLER} { padding-inline: ${EDGE}px !important; }
      ${COLUMN} {
        max-width: min(100%, max(
          min(var(--dsh-chat-content-width), calc(100% - 2 * (var(--dsh-composer-side-clearance) + 16px - ${EDGE}px))),
          ${preference.width}px
        )) !important;
      }
    }`
    document.head.appendChild(style)
  }

  const limits = (): Limits | undefined => {
    if (!window.matchMedia(MOBILE_QUERY).matches) return undefined
    // Measure the native layout with only our own stylesheet disabled.
    if (style !== undefined) style.disabled = true
    try {
      const column = document.querySelector<HTMLElement>(COLUMN)
      const scroller = column?.parentElement
      if (column === null || column === undefined || scroller === null || scroller === undefined) return undefined
      const measured = column.getBoundingClientRect().width
      if (measured <= 0) return undefined
      const min = Math.ceil(measured)
      return { min, max: Math.max(min, Math.floor(scroller.clientWidth - EDGE * 2)) }
    } finally {
      if (style !== undefined) style.disabled = false
    }
  }

  const save = (next: Preference): boolean => {
    preference = next
    sync()
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return true
    } catch { return false }
  }

  ctx.effect(() => {
    sync()
    return () => { style?.remove(); style = undefined }
  }, 'dsh-mobile-lite: optional text width stylesheet')

  function TextWidthSettings() {
    const [enabled, setEnabled] = useState(preference.enabled)
    const [draft, setDraft] = useState(String(preference.width))
    const [range, setRange] = useState<Limits | undefined>(undefined)
    const [feedback, setFeedback] = useState('')
    const [error, setError] = useState(false)
    useEffect(() => {
      const initialRange = limits()
      setRange(initialRange)
      if (initialRange) setDraft(String(Math.max(initialRange.min, Math.min(initialRange.max, preference.width))))
      const refresh = (): void => { setRange(limits()) }
      window.addEventListener('resize', refresh)
      return () => { window.removeEventListener('resize', refresh) }
    }, [])

    const apply = (): void => {
      const latest = limits()
      setRange(latest)
      const width = Number(draft)
      if (!latest || !Number.isInteger(width) || width < latest.min || width > latest.max) {
        setError(true)
        setFeedback(latest ? `请输入 ${latest.min}–${latest.max} 之间的整数。` : '请在移动端打开一个对话后设置。')
        return
      }
      const persisted = save({ enabled: true, width })
      setError(false)
      setFeedback(persisted ? `已应用：${width}px` : `已应用：${width}px；浏览器无法保存，刷新后会恢复默认。`)
    }

    const controlStyle = {
      font: 'inherit', color: 'var(--dsw-alias-label-primary)',
      background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: '8px', padding: '8px 12px', minHeight: '40px',
    }
    return h('section', {
      style: { display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '680px', paddingBottom: '24px' },
    },
    h('h2', { style: { margin: 0, fontSize: '18px' } }, '移动端正文宽度'),
    h('p', { style: { margin: 0, color: 'var(--dsw-alias-label-secondary)', lineHeight: 1.6 } },
      '默认关闭。打开开关、输入宽度，点击“应用”后生效；关闭开关立即恢复 DSH 布局。设置仅保存在当前浏览器。'),
    h('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', minHeight: '40px' } },
      h('input', {
        type: 'checkbox', role: 'switch', checked: enabled, 'aria-checked': enabled,
        onChange: (event: { currentTarget: { checked: boolean } }) => {
          const next = event.currentTarget.checked
          setEnabled(next)
          setError(false)
          if (!next) {
            const persisted = save({ ...preference, enabled: false })
            setFeedback(persisted ? '已关闭，宽度样式已移除。' : '已关闭；浏览器无法保存，刷新后可能恢复之前的设置。')
          } else setFeedback('待应用：确认宽度后点击“应用”。')
        },
      }), '启用正文宽度控制'),
    h('label', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, '正文宽度（px）',
      h('input', {
        type: 'number', step: 1, min: range?.min, max: range?.max, value: draft,
        disabled: !enabled || !range, 'aria-invalid': error,
        'aria-describedby': 'dsh-mobile-lite-width-range dsh-mobile-lite-width-feedback',
        style: { ...controlStyle, width: '160px', boxSizing: 'border-box' },
        onChange: (event: { currentTarget: { value: string } }) => {
          setDraft(event.currentTarget.value)
          setError(false)
          setFeedback('待应用')
        },
      })),
    h('p', { id: 'dsh-mobile-lite-width-range', style: { margin: 0, color: 'var(--dsw-alias-label-secondary)' } },
      range ? `DSH 当前默认：${range.min}px；可用范围：${range.min}–${range.max}px。` : '请在移动端打开一个对话后设置。'),
    h('button', {
      type: 'button', disabled: !enabled || !range, onClick: apply,
      style: { ...controlStyle, alignSelf: 'flex-start', opacity: !enabled || !range ? 0.5 : 1 },
    }, '应用'),
    h('p', {
      id: 'dsh-mobile-lite-width-feedback', role: error ? 'alert' : 'status',
      style: { margin: 0, color: error ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-label-secondary)' },
    }, feedback))
  }

  const slots = ctx.get('slots') as Slots | undefined
  if (slots !== undefined) ctx.effect(() => slots.inject('settings.section', () => slots.register({
    name: 'settings.section', id: 'mobile-text-width', order: 26, label: '正文宽度',
  }, TextWidthSettings)), 'dsh-mobile-lite: text width settings page')
}
