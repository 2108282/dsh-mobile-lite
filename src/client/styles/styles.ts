/**
 * 提取自 dsh-web-mobile 的紧凑化输入框与统计胶囊排版规则
 */
export const COMPOSER_AND_STATS_CSS = `/* ==========================================================================
   dsh-web-mobile: 移动端紧凑化样式（遵循原生 @media 契约）
   ========================================================================== */

@media (max-width: 1023px) and (pointer: coarse) {
  /* 1. 活跃会话下的输入框紧凑化 */
  [data-phase="active"] [data-composer-card] {
    padding-top: 2px !important;
    gap: 4px !important;
  }
  [data-phase="active"] [data-composer-card] [class*="_row"] {
    padding: 0 8px !important;
  }
  [data-phase="active"] [data-composer-card] [data-composer-input],
  [data-phase="active"] [data-composer-card] [class*="_scroll"] {
    min-height: 28px !important;
    padding-top: 2px !important;
  }

  /* 2. 底部 Dock 容器单排紧凑化排布 */
  [data-composer-dock],
  [class*="_dock"] {
    gap: 4px !important;
    justify-content: center !important;
    align-items: center !important;
  }
  [data-slot="conversation.composer.dock"] {
    display: contents !important;
  }

  /* 3. 统计胶囊排版：Activity 与 Usage */
  [data-composer-stat="activity"],
  [data-composer-stat="usage"],
  [data-mobile-nav="stats-ring"] {
    height: 22px !important;
    display: inline-flex !important;
    align-items: center !important;
    vertical-align: middle !important;
  }

  [data-composer-stat="activity"] {
    flex: 0 0 auto !important;
    width: max-content !important;
    min-width: max-content !important;
    max-width: 50% !important;
    margin-right: 4px !important;
    white-space: nowrap !important;
  }

  [data-composer-stat="usage"] {
    flex: 0 1 auto !important;
    min-width: 0 !important;
    max-width: 45% !important;
    margin-right: 4px !important;
    overflow: hidden !important;
    white-space: nowrap !important;
  }

  /* 统一胶囊内部按钮 */
  [data-composer-stat] button,
  [data-mobile-nav="stats-ring"] button {
    box-sizing: border-box !important;
    height: 22px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 5px !important;
    gap: 4px !important;
    font-size: 11px !important;
    line-height: 1 !important;
    vertical-align: middle !important;
  }

  /* 统一胶囊内部 SVG */
  [data-composer-stat] svg,
  [data-mobile-nav="stats-ring"] svg {
    flex: 0 0 auto !important;
    width: 14px !important;
    height: 14px !important;
    display: block !important;
    margin: 0 !important;
    vertical-align: middle !important;
  }

  /* 统一胶囊内部文本 */
  [data-composer-stat] [class*="_label"],
  [data-composer-stat] button > span,
  [data-mobile-nav="stats-ring"] span {
    display: inline-flex !important;
    align-items: center !important;
    font-size: 11px !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  [data-composer-stat] [class*="_sep"] {
    display: none !important;
  }

  [data-mobile-nav="stats-ring"] {
    position: static !important;
    flex: 0 0 auto !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    border: 0 !important;
  }

  /* 4. 文件上传触发按钮 */
  [data-composer-card] [data-mobile-nav="file-upload"] {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 28px !important;
    height: 28px !important;
    min-width: 28px !important;
    min-height: 28px !important;
    padding: 0 !important;
    margin: 0 !important;
    border: 0 !important;
    border-radius: var(--dsw-radius-sm, 6px) !important;
    background: transparent !important;
    color: var(--dsw-alias-label-secondary, currentColor) !important;
    cursor: pointer !important;
    flex: none !important;
    -webkit-tap-highlight-color: transparent !important;
  }

  [data-composer-card] [data-mobile-nav="file-upload"]:hover {
    background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .06)) !important;
  }

  [data-composer-card] [data-mobile-nav="file-upload"]:active {
    background: var(--dsw-alias-interactive-bg-active, rgba(0, 0, 0, .12)) !important;
  }

  [data-composer-card] [data-mobile-nav="file-upload"] svg {
    width: 14px !important;
    height: 14px !important;
    display: block !important;
    flex: none !important;
    stroke: currentColor !important;
  }

  [data-composer-card] [data-mobile-nav="file-upload"]:disabled {
    opacity: 0.38;
    cursor: default;
  }

  [data-composer-card]:not(:has(input[type=file])) [data-mobile-nav="file-upload"] {
    display: none !important;
  }
}
`
