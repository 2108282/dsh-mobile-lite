# DSH Mobile Lite (移动端轻量极简复用插件)

## 1.0.8 更新

移动端底部采用固定统计行：Activity（轮次/步数/速度）、Usage（Token/命中）和上下文圆环固定在首行；交接按钮及其他扩展按原顺序独占后续行。Activity 和圆环保留内容宽度，Usage 空间不足时省略，仍可通过原生提示和弹窗查看完整读数。仅调整当前 Composer Dock 布局根的网格位置和外边距，不移动 React 节点，不改变扩展内部布局或桌面排版。

适配 `(max-width: 1023px) and (pointer: coarse)`。会话切换、重连替换节点时重新标记当前 Dock，离开移动断点或卸载时移除标记和监听器。本次不需要运行宿主补丁脚本。

## 1.0.7 更新

新增「设置 → 正文宽度」独立页面。移动端正文宽度控制默认关闭，打开开关、输入宽度并点击「应用」后生效；最窄保持当前 DSH 原生正文宽度，关闭时移除独立样式。仅调整主聊天区宽度，不修改输入框、侧栏、手势或原有的左对齐方式；偏好保存在当前浏览器。

## 1.0.6 更新

同一会话短暂重连时，保留最后成功显示的模型、权限按钮、统计、上下文和费用，新数据到达后原位替换，减少输入区下方先清空再恢复的跳动。权限恢复前保留显示但禁止操作；首次加载和不同会话之间不复用旧显示。

这项修复包含针对 **DSH 0.2.2-rc.5** 的宿主前端补丁。仅安装或升级移动插件不会自动修改宿主文件：需要按 [补丁说明](patches/README.md) 显式应用、重新加载插件并刷新页面。补丁脚本、测试随包提供，本机备份和部署记录不发布。宿主升级后需重新核对兼容性。

本项目基于 `dsh-web-mobile` 的输入区适配与手势功能，维护独立的轻量 DSH 客户端插件。

---

## 一、 功能特性总览

1. **输入框紧凑化与留白优化**：消除原生输入框在手机端高达 29px 的无效纵向留白，确保单行输入卡片高度控制在 78px，扩大消息流可视区域。
2. **移动端对话正文宽度控制**：设置页中默认关闭；开启后可输入正文宽度并点击应用，最小值保持当前 DSH 默认正文宽度，上限保留 8px 屏幕边距。关闭时移除本功能的独立样式，不改动 DSH 官方宽度设置；输入框、侧栏和手势保持原有行为。偏好保存在当前浏览器。
3. **底部性能与用量固定统计行**：
   - `activity`、`usage`、ContextMeter 同处第一行；仅 Usage 可收缩省略，圆环保留百分比；
   - 交接及其他扩展全宽排在后续行，保持内部布局与点击行为；
   - 用 CSS Grid 和局部属性标记排列现有节点，**不移动 React DOM 节点层级**，规避重连/卸载时的 #104 陷阱。旧版独立 TPS 读数仍沿用原有占位叠放兼容逻辑。
4. **对话页双向滑动手势引擎**：
   - **左边缘右滑**（屏幕左侧 45% 区域）：滑出/收起左侧抽屉式会话列表；
   - **右边缘左滑**（屏幕右侧 45% 区域）：调出/收起右侧 Files 工作区文件树；
   - **8px 轴锁定**、**轻拂速度惯性判定（Fling）**、**代码块横滑避让**与**释放后防点击穿透守卫（Click Swallowing）**。

---

## 二、 核心文件清单与作用位置深度剖析

核心功能按样式、任务和手势拆分维护：

```text
dsh-mobile-lite/
├── package.json                          # DSH 插件规范清单
├── cordis.patch.yml                      # DSH 插件注册元信息
├── tsconfig.json                         # 宿主端 TypeScript 配置
├── tsconfig.client.json                  # 客户端 TypeScript 编译配置
├── scripts/
│   └── build-client.mjs                  # 打包打包脚本（生成 DSH ModuleLoader 格式）
├── lib/
│   ├── index.js                          # 宿主端编译产物
│   └── client.js                         # 浏览器端打包产物（90KB 最终交付件）
└── src/
    ├── index.ts                          # 宿主端入口（最小空插件）
    └── client/
        ├── index.ts                      # 客户端总装入口（挂载样式、手势与任务）
        ├── runtime.d.ts                  # 本地 ClientContext 类型垫片
        ├── core/
        │   └── reconciler-core.ts        # 极简任务契约接口声明（ReconcilerTask）
        ├── styles/
        │   ├── composer-and-stats.css    # 【提取件】纯 CSS 样式定义
        │   └── styles.ts                 # 将 CSS 包装为 TS 字符串导出
        ├── components/
        │   └── open-files-panel.ts       # 【提取件】右侧 Files 触发器
        └── effects/
            ├── stats-line.ts             # 【提取件】性能用量定位与 DOM 观察器
            ├── sidebar-swipe.ts          # 【提取件】双向滑动手势引擎
            ├── gesture-guard.ts          # 【提取件】手势冲突避让与点击吞噬守卫
            └── phone-chrome.ts           # 轻量桥接层（断点检测、外壳打标与清理）
```

---

### 详细文件作用解析表

| 文件路径 | 对应提取文件 | 作用的具体 DOM 位置 / 区域 | 解决的核心问题与技术实现机制 |
| :--- | :--- | :--- | :--- |
| **`src/client/effects/stats-line.ts`** | `feature1-stats-line.ts` | 当前 Composer Dock、真实统计项与 ContextMeter 根 | 只为实际网格项打标，圆环仅从插槽之外的直属宿主节点识别。局部 MutationObserver 与既有低频重锚覆盖异步挂载、重连和会话切换；退出时清理标记、监听器与定时器。React 节点不搬移；旧版 TPS 保留占位叠放兼容逻辑。 |
| **`src/client/styles/styles.ts`**<br>（`composer-and-stats.css` 同步保留提取规则） | `feature1-composer-and-stats.css` | 输入框及带标记的 `[data-composer-dock]` | 运行时只注入 `styles.ts`。移动端固定三项统计首行，Usage 可省略；扩展项跨整行并清除布局根的自动外边距，保持内部控件和弹窗原样。输入框工具栏规则独立保留。 |
| **`src/client/effects/sidebar-swipe.ts`** | `feature2-sidebar-swipe.ts` | **全页面全局手势捕捉**：<br>`document` 上的 `pointerdown`、`pointermove`、`pointerup`、`touchmove`（捕获阶段 `capture: true`） | **1. 双族手势路由（Dual Family）**：按触摸起点 `clientX` 划分，屏幕左侧 45% 归为抽屉手势，右侧 45% 归为 Files 手势；抽屉打开时内部向左拖动判定为关闭。<br>**2. 8px 轴锁定（`tryLock`）**：移动满 8px 时裁决主轴，水平占优则锁定横滑并调用 `event.preventDefault()` 阻止纵向滚动；垂直占优则释放让位给页面原生滚动。<br>**3. 双重裁决标准**：滑动距离超过屏幕宽度的 16% 或瞬时速度达到 `0.45 px/ms`（轻拂 Fling）即判定触发。<br>**4. 动作执行**：左侧调用 `ctx.layout.toggleSidebar()`，右侧调用 `filesToggleFn()`。 |
| **`src/client/components/open-files-panel.ts`** | `feature2-open-files-panel.ts` | **顶栏及右侧边栏控件**：<br>`[data-sidebar-right-expand]`<br>`[data-sidebar-right-toggle]` | **右侧文件树触发器**：<br>通过 `click()` 触发宿主原生的右侧栏展开与收起按钮；在无按钮的旧版上自动回退至修改外壳属性 `data-aionui-explorer-open`。 |
| **`src/client/effects/gesture-guard.ts`** | `feature2-gesture-guard.ts` | **全局手势冲突拦截器** | **1. 冲突避让**：在弹窗模态（`[aria-modal="true"]`）、全屏遮罩、代码块内部横滑、划词选择文本或悬浮拖拽时主动让出手势。<br>**2. 吞噬点击穿透（`markGestureConsumed`）**：手势释放后，在 300ms 窗口期内拦截接下来的合成 `click` 事件，防止手指松开时误触底下的会话行或操作按钮。 |
| **`src/client/effects/phone-chrome.ts`** | 轻量胶水层 | **`AppFrame` 外壳根节点**：<br>`[class*="frame"]:has(> [class*="sidebarCol"])` | **1. 响应式监听**：监听 `(max-width: 1023px) and (pointer: coarse)`。<br>**2. 外壳打标与清理**：匹配移动端时自动在 frame 上设置 `data-mobile-nav="frame"`，使 CSS 选择器精准生效；退出或卸载时自动移除属性。<br>**3. 节点定位**：导出 `getFrame()` 供各组件安全寻址。 |
| **`src/client/core/reconciler-core.ts`** | 极简类型文件 | 编译期类型 | 导出 `ReconcilerTask` 接口，使 `stats-line.ts` 保持原样而无需引入原工程的调度核心。 |
| **`src/client/index.ts`** | 客户端总装入口 | DSH Client 运行时 | 声明依赖 `inject: ['layout']`，通过 `ctx.effect` 挂载样式、启动 `statsTask.ensure()` 并调用 `installSidebarSwipe()`。 |
| **`src/index.ts`** | 宿主端入口 | DSH 服务端 Loader | 纯客户端 UI 插件的标准空入口，保证 DSH 加载器安全注册。 |

---

## 三、 构建与安装使用说明

### 1. 本地重新编译构建
在项目根目录下直接运行（已配置好免依赖的打包链路）：
```bash
npm run build
```
执行过程会自动完成两步：
1. `tsc` 编译 TypeScript；
2. `scripts/build-client.mjs` 将所有子模块组装成单文件 `lib/client.js`，包含标准的 `window.__ModuleLoader__.load({ id: "dsh-mobile-lite", factory: ... })` 包裹层。

### 2. 在 DSH 中加载运行
通过 DSH「插件 → 添加插件」安装本地 `dsh-mobile-lite` 目录，已有安装则重新安装/加载该目录。构建后需通过插件管理器发布新产物并刷新当前页面；仅改写 `lib/client.js` 不保证浏览器缓存自动更新。

### 3. 真机验证方法
1. 在手机浏览器或 DSHA 内打开 Web 页面；
2. **手势测试**：
   - 从屏幕**左侧边缘 45% 内向右滑动**，左侧会话抽屉平滑滑出；
   - 在抽屉上向左滑，抽屉平滑收起；
   - 从屏幕**右侧边缘 45% 内向左滑动**，右侧 Files 文件树面板展开；
3. **输入框与统计测试**：
   - 打开任意会话，输入框卡片紧贴底部且上下留白明显变窄；
   - 首行依次显示 `activity`、`usage` 和带百分比的上下文环；窄屏或数字增长时 Usage 省略，其余两项不换行；
   - 交接按钮和其他扩展位于后续整行，按钮及弹窗仍可操作；
   - 切换会话、短暂重连及进出移动断点后无重复标记、残留定位或输入区白屏。
