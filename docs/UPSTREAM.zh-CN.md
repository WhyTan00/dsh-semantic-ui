# 锁定的公开上游与能力

公开接口核实日期：2026-10-23；2026-10-27 更正 Zod 直接依赖版本。安装版本以 package.json / pnpm-lock.yaml 根 importer 为准。

| 上游 | 固定版本 | 许可证 | 本项目职责 |
|---|---|---|---|
| DSH | 0.2.1-rc.2 / 687f282e8625c6b8d11ff58211a90524be2e4317 | MIT | 工具、会话日志、聊天挂载与生命周期 |
| @json-render/core、@json-render/react | 0.21.1 | Apache-2.0 | defineCatalog、schema、defineRegistry、Renderer |
| @xyflow/react | 12.12.0 | MIT | 节点、边、视口、缩放与选择 |
| @dagrejs/dagre | 3.1.1 | MIT | 初始扁平有向图布局 |
| echarts | 6.1.0 | Apache-2.0 | SVG 图表呈现；不负责本项目统计口径 |
| React / React DOM | 19.3.1 | MIT | 隔离渲染根；宿主自身仍使用 React 18 |
| zod | 4.4.3 | MIT | 白名单 schema、类型、JSON Schema 与运行时校验 |

本表列本项目锁定采用的版本；[研究清单](research/projects.json) 中固定源码 HEAD 的预发布观察不代表运行依赖升级，例如 Dagre 仍为 3.1.1。锁文件中的其它传递版本也不替代根 importer 的直接依赖选择。

本项目独立实现协议、跨字段语义校验、声明式决策规则、统计纯函数、组件交互、错误降级及 DSH 适配。上述业务保证不是 json-render 自动提供的。

| 宿主能力 | 固定版本公开依据 | 适配方式 / 边界 |
|---|---|---|
| 原生工具与参数 | [adding-a-tool](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/cookbook/adding-a-tool.md) | defineTool；简短 envelope 自动常驻，完整 payload schema 按需 describe |
| 原生聊天节点 | [conversation](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/subsystems/conversation.md) | ctx.uiConversation.events.register + conversation.chat.node |
| 折叠过程以外的行 | [group-tree.ts](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/client/ui-chat/src/client/contract/group-tree.ts) | groupTree=turn，组件不属于工具展开卡 |
| 持久化 | [output.presentationMeta 实现](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/core/tools/src/index.ts#L1853) | 在标准工具结果 meta.dshSemanticUi 保存完整校验后载荷；canonical value 仅短回执，无自定义必需事件 |
| 历史重放、补页 | [conversation window update paths](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/subsystems/conversation.md#window-update-paths) | 整值 checkpoint 可独立初始化；重复 ID 合并、版本校验、无另一套记录库 |
| 生成状态 | 同上 | 宿主工具/推理过程显示生成；插件完成 checkpoint 原子交付，不伪造增量 spec |
| Native / PTC | [PTC 持久化 meta 的实际代码](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/core/tools/src/ptc.ts#L587) | 锁定版本实际将内层结果 meta 保存到 tool/ptc-dispatch；分别实测，文档中的旧路径提示不能替代此版本运行结果 |
| client 打包 | [client modules](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/subsystems/client-modules.md) | dsh.client + exports[./client]；公开 closure-factory 格式，外部共享 React 仅用于宿主 wrapper |

0.1.1-rc.2 的安装存在不等于本插件兼容；首版不宣称旧接口兼容。实际测试状态见 VALIDATION。

## preview.6 的个人库接入

固定同一 DSH commit 的公开 [Connection 接口](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/client/connection/src/rpc.ts)、[owner-only 精确路由](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/client/connection/src/rpc-host.ts)、[storageDomain](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/storage/storage-domain/src/index.ts) 和 [profileContext](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/boot/app-boot/src/profile-context.ts)。

实测共享 `/api` interceptor 只能有一个，已由 Gateway 使用；通用 `handle` 在锁定宿主触发 webServer 注入约束。最终使用公开 `connection.fetch.register` 精确扩展点，由宿主执行认证/owner 检查，保留原生 RPC 请求/响应信封和客户端关联 ID 校验。storage 默认按 HOME 存放，因此额外按公开 profile 名称划分 domain。没有修改宿主依赖、认证、全局路由或历史格式。
