# DSH Mobile Lite (移动端轻量极简复用插件)

本项目将从 `dsh-web-mobile` 提取出的核心功能以**100% 原样复用、零算法修改**的方式整合为独立、干净、零额外依赖的微型 DSH 客户端插件（编译后 `lib/client.js` 仅 102KB）。

---

## 一、 功能特性总览

1. **输入框紧凑化与留白优化**：消除原生输入框在手机端高达 29px 的无效纵向留白，确保单行输入卡片高度控制在 78px，扩大消息流可视区域。
2. **底部性能与用量单行紧凑自适应**：
   - 保持 `activity`（轮次/步数/速度）与 `usage`（Token用量/缓存命中）在第一排单行自适应，防止数字增大折成两排挤压界面；
   - 采用**绝对定位浮层重叠（Overlay）**方案，将原生上下文用量环（ContextMeter）无缝移到输入框右侧工具簇，**隐藏冗余文字、只留圆环**，同时**绝对不挪动 React DOM 节点层级**，彻底杜绝 React 重连/卸载时的白屏崩溃（规避 #104 陷阱）。
3. **对话页双向滑动手势引擎**：
   - **左边缘右滑**（屏幕左侧 45% 区域）：滑出/收起左侧抽屉式会话列表；
   - **右边缘左滑**（屏幕右侧 45% 区域）：调出/收起右侧 Files 工作区文件树；
   - **8px 轴锁定**、**轻拂速度惯性判定（Fling）**、**代码块横滑避让**与**释放后防点击穿透守卫（Click Swallowing）**。
4. **全面屏侧滑返回层级识别与分发中枢（`triggerMobileBack`）**：
   - 开放全局函数 `window.triggerMobileBack()`（兼容别名 `window.__dshTriggerMobileBack()`），专供手机系统侧滑返回手势（或 Android `onBackPressed`）调用；
   - **六层智能优先级侦测**：自动识别设置模态、左侧抽屉、右侧文件栏、插件市场（含二级详情返回）、自动化任务页以及普通对话页；
   - **带平滑退出动画**：触发抽屉与文件栏退出时，先播放 280ms 平滑滑出动画，再翻转状态；
   - **返回值规范**：消费并关闭上层界面返回 `true`；处于底层普通对话页返回 `'none'`，由宿主执行系统级退出。

---

## 二、 核心文件清单与作用位置深度剖析

本项目严格按照提取代码的原生相对引用组织目录结构，保证提取出的核心文件**一行代码都不需要改动**：

```text
dsh-mobile-lite/
├── package.json                          # DSH 插件规范清单
├── tsconfig.json                         # 宿主端 TypeScript 配置
├── tsconfig.client.json                  # 客户端 TypeScript 编译配置
├── scripts/
│   └── build-client.mjs                  # 打包组装脚本（生成 DSH ModuleLoader 格式）
├── lib/
│   ├── index.js                          # 宿主端编译产物
│   └── client.js                         # 浏览器端打包产物（102KB 最终交付件）
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
            ├── mobile-back-dispatcher.ts # 【独立新增】全面屏侧滑返回分发中枢 (triggerMobileBack)
            └── phone-chrome.ts           # 轻量桥接层（断点检测、外壳打标与清理）
```

---

### 详细文件作用解析表

| 文件路径 | 对应提取文件 | 作用的具体 DOM 位置 / 区域 | 解决的核心问题与技术实现机制 |
| :--- | :--- | :--- | :--- |
| **`src/client/effects/mobile-back-dispatcher.ts`** | 独立新增核心 | **全局 window 与顶层视图判定**：<br>`window.triggerMobileBack`<br>`window.__dshTriggerMobileBack` | **1. 全面屏返回分发中枢**：供手机系统侧滑手势直接调用。<br>**2. 无门控直绑全局**：严禁套在 `MOBILE_QUERY` 媒体查询内，无论在何种 WebView 视口下，插件加载第一毫秒立即挂上 `window`。<br>**3. 六层优先级判定**：<br>① 设置模态 (`[data-shortcut-modal="settings"]`) ➔ 关闭弹窗，返回 `true`；<br>② 左侧抽屉 (`!frame.hasAttribute('data-sidebar-collapsed')`) ➔ 带动画滑出退出，返回 `true`；<br>③ 右侧文件栏 (`[data-sidebar-right-panel]` 可见) ➔ 带动画向右滑出退出，返回 `true`；<br>④ 插件市场 (`[data-dsh-market-root]`) ➔ 若在二级详情页点返回键退回主页，若在主页关闭市场，返回 `true`；<br>⑤ 自动化任务 (`html[data-dsh-taskboard-active]`) ➔ 退出任务看板，返回 `true`；<br>⑥ 普通对话页 ➔ 无界面可退，返回 `'none'`。 |
| **`src/client/effects/stats-line.ts`** | `feature1-stats-line.ts` | **输入框卡片堆叠区**：<br>1. 监听 `[class*="_composerStack"]`<br>2. 占位注入：`[data-composer-card] [class*="_row"] [class*="_trailing"]`<br>3. 宿主圆环打标：`[data-mobile-nav="stats-ring"]` | **1. 规避 #104 崩溃陷阱**：React 渲染的 DOM 节点绝不能通过 `appendChild` 移出原有父级。该文件在输入框右侧只注入 16px 的隐藏占位（`stats-ring-reserve`），原生圆环保留在原位置。<br>**2. 绝对定位叠放（`placeOverlay`）**：实时计算占位符与父容器的相对坐标，动态写入 `style.left` 和 `style.top`，让原生圆环精准浮在输入框右侧工具栏空位上。<br>**3. 窄范围局部调度（`attachScope`）**：专属 `MutationObserver` 避开消息流高频刷新的开销；并在 `visualViewport.resize` 时自动重算坐标。 |
| **`src/client/styles/composer-and-stats.css`**<br>（及 `styles.ts`） | `feature1-composer-and-stats.css` | **输入框与底部 Dock**：<br>1. `[data-composer-card]`<br>2. `[data-composer-stat="activity"]`<br>3. `[data-composer-stat="usage"]`<br>4. `[data-mobile-nav="stats-ring"]` | **1. 输入框紧凑化**：在 `[data-phase="active"]` 活跃会话下，强制 `padding-top: 2px !important; gap: 4px !important; min-height: 28px !important;`，横向内边距和按钮（28/34px）热区保持不变。<br>**2. 胶囊单行自适应**：`activity`（步数/速度）设为 `max-width: 60%` 自适应；`usage`（Token/缓存）设为 `max-width: 50%`，超出自动出省略号，绝不折入第二排。<br>**3. 上下文环隐藏文字**：对 `[data-mobile-nav="stats-ring"]` 全树设置 `font-size: 0 !important;`（塌掉所有百分比文字，只留 16px SVG 圆环本身），并清除宿主画的厚重灰底，只留简洁环形进度。 |
| **`src/client/effects/sidebar-swipe.ts`** | `feature2-sidebar-swipe.ts` | **全页面全局手势捕捉**：<br>`document` 上的 `pointerdown`、`pointermove`、`pointerup`、`touchmove`（捕获阶段 `capture: true`） | **1. 双族手势路由（Dual Family）**：按触摸起点 `clientX` 划分，屏幕左侧 45% 归为抽屉手势，右侧 45% 归为 Files 手势；抽屉打开时内部向左拖动判定为关闭。<br>**2. 8px 轴锁定（`tryLock`）**：移动满 8px 时裁决主轴，水平占优则锁定横滑并调用 `event.preventDefault()` 阻止纵向滚动；垂直占优则释放让位给页面原生滚动。<br>**3. 双重裁决标准**：滑动距离超过屏幕宽度的 16% 或瞬时速度达到 `0.45 px/ms`（轻拂 Fling）即判定触发。<br>**4. 动作执行**：左侧调用 `ctx.layout.toggleSidebar()`，右侧调用 `filesToggleFn()`。 |
| **`src/client/components/open-files-panel.ts`** | `feature2-open-files-panel.ts` | **顶栏及右侧边栏控件**：<br>`[data-sidebar-right-expand]`<br>`[data-sidebar-right-toggle]` | **右侧文件树触发器**：<br>通过 `click()` 触发宿主原生的右侧栏展开与收起按钮；在无按钮的旧版上自动回退至修改外壳属性 `data-aionui-explorer-open`。 |
| **`src/client/effects/gesture-guard.ts`** | `feature2-gesture-guard.ts` | **全局手势冲突拦截器** | **1. 冲突避让**：在弹窗模态（`[aria-modal="true"]`）、全屏遮罩、代码块内部横滑、划词选择文本或悬浮拖拽时主动让出手势。<br>**2. 吞噬点击穿透（`markGestureConsumed`）**：手势释放后，在 300ms 窗口期内拦截接下来的合成 `click` 事件，防止手指松开时误触底下的会话行或操作按钮。 |
| **`src/client/effects/phone-chrome.ts`** | 轻量胶水层 | **`AppFrame` 外壳根节点**：<br>`[class*="frame"]:has(> [class*="sidebarCol"])` | **1. 响应式监听**：监听 `(max-width: 1023px) and (pointer: coarse)`。<br>**2. 外壳打标与清理**：匹配移动端时自动在 frame 上设置 `data-mobile-nav="frame"`，使 CSS 选择器精准生效；退出或卸载时自动移除属性。<br>**3. 节点定位**：导出 `getFrame()` 供各组件安全寻址。 |
| **`src/client/core/reconciler-core.ts`** | 极简类型文件 | 编译期类型 | 导出 `ReconcilerTask` 接口，使 `stats-line.ts` 保持原样而无需引入原工程的调度核心。 |
| **`src/client/index.ts`** | 客户端总装入口 | DSH Client 运行时 | 声明依赖 `inject: ['layout']`，挂载样式、启动 `statsTask`、安装 `sidebarSwipe` 并武装 `mobileBackDispatcher`。 |
| **`src/index.ts`** | 宿主端入口 | DSH 服务端 Loader | 纯客户端 UI 插件的标准空入口，保证 DSH 加载器安全注册。 |

---

## 三、 全面屏侧滑返回手势（`triggerMobileBack`）对接与层级状态机制

### 1. 返回值与层级判定规则

| 优先级 | 判定目标 | 页面关闭后的真实 DOM 状态（防误判关键） | 执行的关闭操作 | 函数返回值 |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **设置页 / 模态框** | **真正卸载（Unmounted）**：关闭后 React 直接 `removeChild` 移除节点 | 若设置内部有二级配置子页面（带面包屑返回键）优先退回设置主项；否则派发 Escape 退出设置弹窗 | `true` |
| **2** | **左侧会话抽屉** | **依然常驻 DOM**：关闭后节点仍在，但外壳挂有 `data-sidebar-collapsed`，以属性为准 | 播放平滑滑出动画（`translateX(-110%)`），280ms 后切换折叠 | `true` |
| **3** | **右侧文件栏** | **依然常驻 DOM**：关闭后节点仍在，但推到 `100vw` 外或隐藏，以屏幕坐标为准 | 播放平滑滑出动画（`translateX(100%)`），280ms 后触发收起 | `true` |
| **4** | **插件管理器 / 插件市场** | **二级详情 ➔ 主列表 ➔ 对话页**：分层逐级退回 | ① **处于二级/下级页面**（如插件详情页 `[data-plugin-detail]`、配置子页、更多列表 `moreHead`、或带 `button[class*="crumb"]` 面包屑）：**精准点击返回键退回插件主列表**；<br>② **处于插件主列表页**（无二级返回键）：**退出整个插件页面退回对话区**；<br>③ **处于第三方插件市场**（`dshmarket`）：内部有子弹窗先关子弹窗，有返回键先点返回键，主页关闭市场 | `true` |
| **5** | **自动化任务页** | **属性卸载**：激活时根元素挂有 `html[data-dsh-taskboard-active]`，退出即移除 | 点击看板退出按钮或调用 `history.back()` | `true` |
| **6** | **普通对话页** | **最底层的常驻容器**：以上所有浮层均未打开 | **不进行任何操作** | `'none'` |

### 2. Android 原生宿主调用代码范例

在 Android 的 `onBackPressed` 或全面屏侧滑手势回调中直接调用 WebView 注入执行：

```java
// Android 端全面屏手势接入代码
private static final String SCRIPT_TRIGGER_MOBILE_BACK =
        "(function() {\n" +
        "    try {\n" +
        "        if (typeof window.triggerMobileBack === 'function') {\n" +
        "            return String(window.triggerMobileBack());\n" +
        "        }\n" +
        "        if (typeof window.__dshTriggerMobileBack === 'function') {\n" +
        "            return String(window.__dshTriggerMobileBack());\n" +
        "        }\n" +
        "    } catch (e) {\n" +
        "        console.error('triggerMobileBack error:', e);\n" +
        "    }\n" +
        "    return 'none';\n" +
        "})()";

webView.evaluateJavascript(SCRIPT_TRIGGER_MOBILE_BACK, value -> {
    // 字符串会带有引号返回，即 "\"true\"" 或 "\"none\""
    String clean = value != null ? value.replace("\"", "").trim() : "none";
    if ("true".equalsIgnoreCase(clean)) {
        // 1) 值为 true：已被前端插件正确消费（关了弹窗/抽屉/文件栏/二级页），系统侧滑不做额外动作
        return;
    }
    // 2) 值为 none：表示当前处于最底层普通对话页，手机系统执行返回桌面或关闭抽屉
    moveTaskToBack(true); // 或 super.onBackPressed();
});
```

---

## 四、 构建与部署说明

### 1. 本地重新编译构建
在项目根目录下直接运行（已配置好免依赖的打包链路）：
```bash
npm run build
```
执行过程会自动完成两步：
1. `tsc` 编译 TypeScript；
2. `scripts/build-client.mjs` 将所有子模块组装成单文件 `lib/client.js`，包含标准的 `window.__ModuleLoader__.load({ id: "dsh-mobile-lite", factory: ... })` 包裹层。

### 2. 在 DSH 中加载运行
将 `dsh-mobile-lite` 作为一个本地插件或者安装到 DSH 的插件目录中。DSH 启动时会自动扫描并在前端加载 `lib/client.js`。
