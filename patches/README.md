# 同会话短暂重连：保留最后成功显示

本修复针对当前安装的 DSH 0.2.2-rc.5，配合移动端已启用的 dsh-mobile-lite；不修改首次加载和会话切换的产品流程。

## 原因与修改

- SessionManager.handleConnected 原来对每个 ProjectionValueStore 调 clear，导致统计、上下文和费用瞬间变为 undefined。
- 重连现在仍清空权威 rows 和水位；另存五个只读显示值：sessionStats、tokenUsage、contextPressure、contextBreakdown、queryBalanceCost。
- faceOf/get/values/seqOf 仍只读权威数据；仅 UI 会话适配器通过 displayFaceOf 读取旧显示。
- 新 sequenced 值替换旧显示；权威完整基线遗漏的能力、会话不存在或迁移状态清除显示缓存。缓存检查点不能覆盖此前已连线显示。
- 模型触发器按 directory 身份缓存最后确认的名称和推理级别；加载时禁用，失败后保留菜单重试。
- 权限触发器按 sessionId 缓存已确认显示。目录与会话基线无论谁先返回都保留旧按钮，期间禁用、关闭菜单与确认框，不把旧值用于授权或提交。
- 在桌面断点或未启用移动插件时，重连仍遵循原始行为。

## 文件与验证

- reconnect-display.mjs：先生成 staged 候选，--apply 校验安装版本并备份后部署，--restore 在已部署哈希仍吻合时回退。
- originals/：部署前的十个原始文件；deployment.json：精确目标与前后 SHA-256。
- staged/：与部署产物一致的候选源码及浏览器脚本。
- test-reconnect.mjs：执行源码和实际 bundle 内类的恢复、替换、隔离检查，并检查所有浏览器脚本和 TS/TSX 语法。
- verification.json：从现有 http://127.0.0.1:3080/plugins/events 取得资源图，再按实际公布的 URL 获取四个脚本的验证结果。

当前检查通过 22 项；实际服务四个资源均返回 200 且含修复。没有浏览器 DOM/控制台工具，尚未完成手机上真实短断线的视觉验证。原始 source map 对应上游发布产物，不对应本地补丁偏移。

## 应用与回退

脚本当前适配这台 Android 容器的安装布局：DSH 位于 `/usr/local/lib/node_modules/@deepseek-ai/dsh`，TypeScript 位于 `/usr/local/lib/node_modules/typescript`。其他安装路径需先调整脚本中的路径；不要直接跨版本应用。

在插件目录执行：

```bash
node patches/reconnect-display.mjs
node patches/test-reconnect.mjs
node patches/reconnect-display.mjs --apply
```

无参数只生成候选；测试通过后显式 `--apply` 才修改宿主文件。随后在 DSH 插件管理中重新加载移动插件，并刷新现有页面一次。

`originals/`、`staged/`、`inspection/`、`deployment.json` 和 `verification.json` 均是本机生成或检查文件，不提交仓库、不包含在发布包中。部署脚本会在目标机器重新生成备份与部署记录。

## 生效与维护

刷新现有页面一次，保证驻留的模型/权限组件和投影实例全部采用新实现。此后正常同会话短暂重连应保留读数，收到新值后直接替换。

本次涉及四个 DSH 宿主前端包，不是只改插件 CSS。工作区和实际安装副本的移动插件 Host 入口通过 clientModules.rebuilt 发布完成的浏览器产物，不重启 DSH 进程。

DSH 升级可能覆盖安装目录补丁；脚本明确拒绝在其他版本应用，需要重新核对源码，不应直接跨版本复用。

回退：在插件目录运行 `node patches/reconnect-display.mjs --restore`，然后重新加载移动插件以发布恢复的产物并刷新现有页面。若目标文件已有其他修改，脚本拒绝覆盖，需人工核对。
