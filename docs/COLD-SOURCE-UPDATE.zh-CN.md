# 重启后的来源补充与原请求核对

preview.20的冷宿主/安装/CI/四匿名资产已[单独接受](evidence/cold-source-update20.json)，冻结资产不改。最后代码复查另发现界面在status结果省略requestId时可能丢失原ID提示；21已修复此边界，不能用20原矩阵冒充本修复通过。

preview.21 / DSH `0.2.1-rc.2`，沿用[单未知当前事实补充](SOURCE-UPDATE.zh-CN.md)。本次完善的是会话生命周期，不扩大来源语法、图种或事实认证范围。[preview.21已公开](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/v0.1.0-preview.21)：冻结源码`2f2cb1908655d4cf2d554b74b9356472339fb44b`，最终365文件归档在macOS/Linux的Native/PTC均通过，四份资产匿名HTTPS200且同字节。39项定向检查通过；完整[最终分层接受](evidence/cold-source-update.json)是冻结后的独立文档提交，不重打包。

## 行为与边界

- Agent 尚未恢复时，`offer` 和 `status` 经原生 `session/projections` 读取真实持久前缀。返回可补充条件或原请求收据；没有 Agent、新回合、新消息和模型请求。未知请求只返回 `UPDATE_REQUEST_UNKNOWN`。界面的保留未知和取消没有提交调用。
- 只有新的、明确的 owner `submit` 才调用注入的公共 `sessionController.resolveAgent(sessionId)`。它复用宿主的普通会话、writer、preset 和模型选择策略，恢复同一个 session；不创建另一会话，不发送空消息或旧消息，不用 rename/selectModel 充当恢复入口。
- 恢复前检查最新来源基准、原生 inbox、未关闭回合、workspace activity、归档与普通会话标记。activity 查询会让出执行，因此随后重读最新原生前缀。恢复后、记录意图时、意图 flush 后再检查当前 Agent、Session、基准与排队工作；再经保留原 Peer 的正常 `session/prompt` 提交一个新全文来源。
- 此窄入口保守拒绝本会话自身有 `goal/change`、`schedule/change` 历史或当前 goal 的会话，包括已暂停/结束的任务。它不会恢复这些任务；仍从其原生任务入口继续。缺失、缓存提示而非确定前缀、损坏或未提供 inbox 的状态同样拒绝。
- 界面始终保留已经知道的原请求 ID。合法 unknown/withheld 状态结果即使省略可选 ID，也不能清掉它、重新offer、生成新提交 ID 或发送第二次；服务端明确返回的原 ID 优先于本地ID，旧receipt字段不会回填到失败结果。每个 session 的提交在本进程内串行。并发的同请求 ID 返回原 ID 的不明状态；不同 ID 返回原 ID 并暂缓。意图已落盘后，不明结果、刷新、重启和重复点击只核原请求，绝不自动换 ID 重发。`command/done`、prompt accepted、持久消息及新 checkpoint 四者继续分开。
- 原生准入没有本插件专用的“基准比较与 prompt 原子事务”。上述是公开服务边界上的复查；最终仍由原生准入与后续精确消息/来源匹配决定结果，不宣称跨进程全局事务。新工作插入或内容不匹配不能被记成来源采用。

**DSH 的会话导航是另一个行为。** 锁定版本实测，点击会话树会自行恢复 Agent。因此本次冷状态验证先在已认证的真实 DSH 页面直接调用本插件入口，明确区分只读查询和新 owner 提交，再打开原生会话检验旧/新 UI 恢复。没有拦截原生导航或伪装其不恢复，也不宣称实际冷提交经过会话内控件点击。已有会话的保留未知/取消和只读查询另经真实控件验证。此边界保留在证据中。

## 公开接口与持久化

固定 [DSH commit](https://github.com/deepseek-ai/deepseek-harness/tree/687f282e8625c6b8d11ff58211a90524be2e4317) 的实际已安装声明与实现：`@deepseek-ai/dsh-api-session-controller` 公开 `Context.sessionController.resolveAgent/inspect`；`@deepseek-ai/dsh-workspace` 公开 `archivedSessionIds` 和 `workspace/session-activity`；原生 `inbox` 提供 `next-turn/next-step`。只使用注入实例，不构造第二个 controller、绕过 writer 或导入私有模块。新增两个锁定版本的 SDK peer 声明，许可证闭包重新生成，217 项都有许可证原件。

来源补充投影从 stateVersion3 升为4，增加只读 offer、普通会话、自动任务历史与 open 标记。它从原日志重放，不修改旧日志或写第二份完整聊天记录。preview.19 的一段实际合成用户/意图/checkpoint事件已筛去系统和私人运行上下文，作为[旧收据重放夹具](https://github.com/WhyTan00/dsh-semantic-ui/blob/v0.1.0-preview.20/fixtures/source-update-preview19.json)；新 reader 复建相同消息与收据。它不是19完整矩阵重跑，也不承诺旧 reader 读取新缓存。

## 这次检验的含义

实现前固定的新合成来源：杉原支持缓存、松港不支持；若离线值守则需要缓存，否则不需要；原当前条件 unknown，调用者只补为 false。来源 SHA-256 `00f2fb7b07cd95e5da06e0ec1c725401d401282adb92288855e69d59fa7613af`；新来源 `b0654a83de8e3c9e177e59131ce1c047187ebcf0b0a56916a6deb856248f2099`。只替换 UTF-8 `[156,180)` 的声明，当前缓存需求为 false，两方案均不因本项排除；价格、整体与赢家仍未知。

开发构建的正常SourceUpdatePanel已注入两种合法但省略ID的status回执（unknown/withheld）：原ID持续可见，随后三次真实界面请求全部仍是同ID status，没有offer/submit或新提交ID；失败状态不显示旧采用信息，恢复正常回执后才重新显示真实采用。该故障注入另有标记，不冒真实服务器故障或旧receipt的新采用。最终365文件归档在macOS/Linux的Native/PTC另行完成了同一个实际组件路径，四组原件见分层接受。

源码阶段39项定向测试通过，包含暂停 resolve/flush 时插入来源、排队工作和归档的拒绝；旧收据重放和既有 flush 前缀保护仍通过。开发构建的真实 Native/PTC 各经过原始正常一轮、完全停宿主、冷查询/明确补充、再完全停宿主、原 ID 收据恢复；模型推理0。活动拒绝由单独的 test-only activity provider 注入，仅证明该准入分支，不等于运行了真实作业/排程；排队、非普通和自动任务分支有服务/投影测试，未另制造真实任务。开发构建与最终包证据严格分开。

可运行入口：冻结干净源码后 `pnpm release:pack`，再 `pnpm test:installed-cold-source`。包装器核对 manifest sourceCommit=HEAD 与归档 SHA，实际 `dsh plugin --profile web add` 到全新隔离 profile，并在启动前逐字节核所有打包文件。夹具 observer 只读会话，归档与合成 activity 只作用于该新 profile；没有 semantic 源码覆盖、真实推理、共享服务或全局配置修改。

依然不完成通用 RequestForm、任意正文/世界事实认证、跨设备状态、通用 GenUI 替代或当前 Codex 桌面富 UI 接入。旧版本、原六题首次失败和已用模型观察均保留，未用本次确定性运输夹具改写它们。
