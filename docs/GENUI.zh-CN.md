# 与具体 GenUI 的共存边界

核实日期：2026-10-23。未读取任何已有工作台实现、配置或用户旧对话。本节区分公开版本研究、隔离宿主夹具和真实模型共存测试；不代表用户既有实例或全部设备验收。

这里核对的是具体插件互通，**不把 GenUI 指定为目录外任务的通用优先项**。选型应看实际可用能力、宿主兼容和状态/回传合同。更广的开源协议、组件、图表与布局研究，以及明确的采用/未采用决定，见 [交互 UI 研究](research/README.md)。本节冻结 npm 版本的实测不等同于新 main 源码或其它项目已接入。

| 对象 | 固定公开版本 / commit | 协议与定位 |
|---|---|---|
| [omdsh-dev/dsh-genui](https://github.com/omdsh-dev/dsh-genui/tree/7301d8a8ec6d5a164beff75e5a8afd20e45f9518) | npm manifest `@changfenhuang/dsh-genui` 0.14.0 / 7301d8a8ec6d5a164beff75e5a8afd20e45f9518 | dsh-ui 围栏白名单组件、模型动作回传、host 指引与 client renderer |
| [pengyue-polaron/deepseek-harness-genui](https://github.com/pengyue-polaron/deepseek-harness-genui/tree/f6289bc709c5b1992c851bf5e63237a5fa453e1f) | manifest `dsh-plugin-genui` 0.15.1 / f6289bc709c5b1992c851bf5e63237a5fa453e1f | 生成 React 应用、编译及应用状态进入下轮；其 manifest 支持的旧 DSH 范围未包括本项目锁定的 0.2.1-rc.2 |
| 本插件 | 0.1.0-preview.5 / protocol 1.0 | 唯一工具提交三类受约束语义载荷、原生独立聊天节点、本地确定性操作 |

在第一个对象的固定源码 [src/plugin/index.ts](https://github.com/omdsh-dev/dsh-genui/blob/7301d8a8ec6d5a164beff75e5a8afd20e45f9518/src/plugin/index.ts) 中，公开配置只有 `fenceFeedback` 与 `renderUiTool`。`renderUiTool: false` 只关闭 render_ui，**仍注册 validate_dsh_ui、系统围栏指引及 genui Skill**；`fenceFeedback: false` 只关闭同回合反馈。没有核实到允许只保留历史 renderer、同时关闭全部 host 指引/Skill 的独立配置。本项目不发明 injectPrompt 或类似开关。

因此可行的保守共存方式是：保留原插件以继续读取旧消息；在三类支持任务中优先使用本插件的唯一 `dsh_semantic_ui` 通道，其他能力保留合适插件的原协议。同一视图不重复生成。本插件 preview.4 将“禁止输出 spec/围栏”限定为自己的载荷，避免与 GenUI 围栏直接冲突。两者同时开启仍可能存在模型表达指引竞争，不能宣称已彻底隔离。仅关闭 render_ui 不能解决全部指引冲突。完全停用旧插件可能导致旧围栏只能退化为代码块；不得把卸载或重写旧消息称为历史兼容。

本插件停用生成指引与工具后，如果仍希望保留自己的历史节点，可将插件配置 `generation: false`：宿主不注册工具、Skill 或系统指引，client renderer 仍随包加载。需要重启所选宿主 profile 并刷新页面后确认；真实实测状态见 VALIDATION。

已将第一个对象的未修改公开发行包 `@changfenhuang/dsh-genui@0.14.0` 安装到任务独立的 DSH 0.2.1-rc.2 profile：先用确定性夹具产生并保存一条旧 dsh-ui 消息，再于同一会话生成本插件的架构节点。两个 renderer 同时显示，刷新和切会话可恢复。重启并设置本插件 `generation: false` 后，两类历史均恢复；模型可见的新请求中，本插件工具和常驻指引已消失，而 GenUI 的 validate_dsh_ui 与围栏指引仍在。这证明该配置无法关闭 GenUI 的全部生成引导。证据见 [genui-compatibility.json](evidence/genui-compatibility.json)。

原 GenUI 使用其自带的围栏 DOM renderer。本插件仅使用 DSH 公开 Conversation Node/slot，不复制该渲染策略，不接管或改写旧消息。上述历史兼容矩阵使用确定性夹具；不证明新问题一定优先选本插件。第二个公开对象只做源码/manifest 研究，用户现有实例、跨插件状态同步及实际设备均未访问或验收。

从 composition 完全移除本插件后，普通会话仍可读取、旧 GenUI 仍显示；重新启用本插件后其语义节点恢复。这个操作在隔离 profile 的公开 overlay 中完成，不改写任何已存消息，不等同于用户现有实例的包管理验收。

## preview.5 的状态边界复核

新的目录外表单实例在输入后等待 1000ms，刷新后主题/备注保留；同一回答却错误承诺不选主题也能提交。先前 C4 的立即刷新复位不能外推为所有表单，更不能把某段源码中的存储能力当所有实例的成功承诺。实例和时序两个因素没有被单独控制，不声明因果。见 [四题定向记录](evidence/ecosystem-adoption.json)。本插件自己的控件仍明确是本地试算、刷新复位、无模型回传。

## 真实模型共存与能力差异

preview.4 在完整启用两个插件的独立 profile 中，通过个人 WorkBuddy / deepseek-v4.1-flash / high 跑四个新会话：架构、比较、趋势选择本插件，目录外的报名表选择 GenUI；没有双重出图，pageerror 为 0。实际点击表单提交后，主题、昵称和备注进入第二轮模型。未提交表单刷新后复位，与模型先前的保存承诺相矛盾。趋势首次正文也有 3 大于 4 的错误，增加计算回执后另行复测正确，两个结果都保留。见 [完整索引](evidence/genui-model-coexistence.json)。

白名单 GenUI 除卡片、表格和图表外，还包含表单、测验、Mermaid、3D 与动作回传；另一类 GenUI 生成 React/TypeScript 应用，并有应用状态进入后续对话的机制。两者范围都超过本插件的三组件目录，但协议、宿主版本和行为各不相同。本插件不具备等价表单回传、任意应用生成或状态持久化，不能无损全面替代它们。能力矩阵、优先改进项和证据限制见 [成熟度评估](MATURITY.zh-CN.md)。
