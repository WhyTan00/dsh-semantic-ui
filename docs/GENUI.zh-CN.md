# 与具体 GenUI 的共存边界

核实日期：2026-10-23。未读取任何已有工作台实现、配置或用户旧对话。本节是公开版本研究，不是用户目标环境的兼容验收。

| 对象 | 固定公开版本 / commit | 协议与定位 |
|---|---|---|
| [omdsh-dev/dsh-genui](https://github.com/omdsh-dev/dsh-genui/tree/7301d8a8ec6d5a164beff75e5a8afd20e45f9518) | npm manifest `@changfenhuang/dsh-genui` 0.14.0 / 7301d8a8ec6d5a164beff75e5a8afd20e45f9518 | dsh-ui 围栏白名单组件、模型动作回传、host 指引与 client renderer |
| [pengyue-polaron/deepseek-harness-genui](https://github.com/pengyue-polaron/deepseek-harness-genui/tree/f6289bc709c5b1992c851bf5e63237a5fa453e1f) | manifest `dsh-plugin-genui` 0.15.1 / f6289bc709c5b1992c851bf5e63237a5fa453e1f | 生成 React 应用、编译及应用状态进入下轮；其 manifest 支持的旧 DSH 范围未包括本项目锁定的 0.2.1-rc.2 |
| 本插件 | 0.1.0-preview.3 / protocol 1.0 | 唯一工具提交三类受约束语义载荷、原生独立聊天节点、本地确定性操作 |

在第一个对象的固定源码 [src/plugin/index.ts](https://github.com/omdsh-dev/dsh-genui/blob/7301d8a8ec6d5a164beff75e5a8afd20e45f9518/src/plugin/index.ts) 中，公开配置只有 `fenceFeedback` 与 `renderUiTool`。`renderUiTool: false` 只关闭 render_ui，**仍注册 validate_dsh_ui、系统围栏指引及 genui Skill**；`fenceFeedback: false` 只关闭同回合反馈。没有核实到允许只保留历史 renderer、同时关闭全部 host 指引/Skill 的独立配置。本项目不发明 injectPrompt 或类似开关。

因此可行的保守共存方式是：保留原插件以继续读取旧消息；在新会话中使用本插件的唯一 `dsh_semantic_ui` 通道，并明确新任务优先选择本插件。两者同时开启仍可能存在模型表达指引竞争，不能宣称已彻底隔离。仅关闭 render_ui 不能解决全部指引冲突。完全停用旧插件可能导致旧围栏只能退化为代码块；不得把卸载或重写旧消息称为历史兼容。

本插件停用生成指引与工具后，如果仍希望保留自己的历史节点，可将插件配置 `generation: false`：宿主不注册工具、Skill 或系统指引，client renderer 仍随包加载。需要重启所选宿主 profile 并刷新页面后确认；真实实测状态见 VALIDATION。

已将第一个对象的未修改公开发行包 `@changfenhuang/dsh-genui@0.14.0` 安装到任务独立的 DSH 0.2.1-rc.2 profile：先用确定性夹具产生并保存一条旧 dsh-ui 消息，再于同一会话生成本插件的架构节点。两个 renderer 同时显示，刷新和切会话可恢复。重启并设置本插件 `generation: false` 后，两类历史均恢复；模型可见的新请求中，本插件工具和常驻指引已消失，而 GenUI 的 validate_dsh_ui 与围栏指引仍在。这证明该配置无法关闭 GenUI 的全部生成引导。证据见 [genui-compatibility.json](evidence/genui-compatibility.json)。

原 GenUI 使用其自带的围栏 DOM renderer。本插件仅使用 DSH 公开 Conversation Node/slot，不复制该渲染策略，不接管或改写旧消息。上述是固定公开版本的宿主兼容测试，使用确定性夹具；没有真实模型参与，不证明新问题一定优先选本插件。第二个公开对象只做源码/manifest 研究，用户现有实例、跨插件状态同步及实际设备均未访问或验收。

从 composition 完全移除本插件后，普通会话仍可读取、旧 GenUI 仍显示；重新启用本插件后其语义节点恢复。这个操作在隔离 profile 的公开 overlay 中完成，不改写任何已存消息，不等同于用户现有实例的包管理验收。
