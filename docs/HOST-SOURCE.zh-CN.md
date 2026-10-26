# 从 DSH 当前输入核对比较内容

源码/构建候选 `0.1.0-preview.12-dev.2` 将现有 [有限中文比较核对](SOURCE-DECISION.zh-CN.md) 接到真实 DSH 当前回合。工具从执行 Agent 的 Session 和公开投影读取输入；调用参数不能提供、替换或认证来源。本段没有发布新归档、安装到用户工作台或加载到当前 Codex 客户端。

后续 `0.1.0-preview.12-dev.3` 仅修正共用元数据叶子的 `scope` 文案，按 `decision-zh` 与缺省/arrows区分；比较返回层原已有正确覆盖。文件/宿主投影夹具的叶子结果和新编译MCP入口见 [窄检查](evidence/source-scope.json)。下文实际Native/PTC各6项仍对应dev.2及其原构建摘要，不宣称旧run测试了新字节。

## 正常入口

在锁定的 DSH `0.2.1-rc.2` 中启用本插件，用户通过普通 `session/prompt` 发送符合已公布有限语法的比较问题。调用现有唯一工具：

```json
{"action":"source-check"}
```

这会返回该条来源的声明、未知项和程序生成的有限说明。对照实际视图时，再提交 `{"action":"source-check","view":{...},"mapping":{...}}`；`view` 和 `mapping` 结构见 [比较核对合同](SOURCE-DECISION.zh-CN.md)。映射只是字段坐标，不提供真值。可选 `claims` 仍是有限陈述检查；`prose` 始终不认证。`sourceText`、`sourceFile`、`sourceKind`、消息 ID、authority 等替换参数被拒绝。

仅支持 `decision-zh` 的完整有限语法，不是通用自然语言事实验证。语法不支持、来源不可用和内容不匹配是不同结果。只读核对不创建聊天组件 checkpoint；默认 `render` 继续按原合同工作，并不因为增加这个动作就自动得到来源认证。

## 选择哪条消息

Host 注册无 client wire 的 `dshSemanticCurrentSource` 投影，通过 `exec.agent.session`、`ctx.sessionProjections.stateOf` 和现有 `turnBoundary` 对齐实际 Session、当前 turn 和起始 seq。继承事件前缀不选；上一回合、关闭回合、无 Agent/开放边界、多个 user-source 候选、未知 producer、缺 ID、非单一文本块或超过16 KiB UTF-8 的文本均拒绝，不回退历史消息或参数来源。

DSH 的 `user/message` 也会承载合成上下文。锁定公开包中以下明确 producer 被排除，计入 `excludedSyntheticContexts`，绝不选作输入：

| producer | 已核对的公开声明/实现 |
| --- | --- |
| `runtime-context` | `@deepseek-ai/dsh-agent-loop` 的 `runtime-context`，循环生成的动态环境快照 |
| `skill-catalog` | `@deepseek-ai/dsh-tool-skill`，技能目录 |
| `time-context` | `@deepseek-ai/dsh-time-context`，请求时钟上下文 |
| `skill-invocation` | `@deepseek-ai/dsh-skill`，宿主注入的技能正文 |
| `model-selection` | `@deepseek-ai/dsh-agent` 的 `model-selection`，模型切换通知 |
| `tool-registry` | `@deepseek-ai/dsh-tools`，工具可用性变更 |

这些合同来自已安装的公开 `0.2.1-rc.2` 包及锁定 [DSH commit](https://github.com/deepseek-ai/deepseek-harness/tree/687f282e8625c6b8d11ff58211a90524be2e4317)。不能把 `form: notice` 当成通用 producer 白名单。仅有合成上下文仍拒绝；其它未知 kind 即使同时出现一条 user-source，也拒绝。宿主版本更新后需重新核对合同，不自动扩名单。

投影只派生保存当前有界候选及必要标识，在 `turn/end` 和新 `turn/start` 清空文本。它是宿主投影缓存，没有新增项目聊天数据库、全量消息副本或客户端状态协议。插件 generation 关闭时不注册该投影或生成工具。

## 来源内容与身份的边界

回执包含实际 `sessionId`、turn、`turnStartSeq`、`messageId`、`messageSeq`、producer 和文本 UTF-8 SHA-256。它表示“该宿主当前回合收到的 user-source 消息内容”，不是独立人类 principal、作者签名或真实世界事实证明。`identityVerified=false`、`sourceFactsVerified=false` 保持不变；模型自由正文仍未认证。

消息快照不输出 `documentSha256` 或 `jsonPointer`，也不把序列化消息的摘要冒充原始日志文件字节摘要。MCP 显式启动文件路径仍使用原来的文件 SHA-256 和 pointer 合同；默认三个 MCP 工具不读取 DSH 当前会话。DSH 的来源适配不自动赋予 Codex 客户端同等会话访问能力。

## 实际验证

实现前固定 [最小预期](../fixtures/host-source-expectations.json)。现有隔离 DSH 测试入口通过普通 workspace/session 创建、选定本地确定性 provider、`session/prompt`、实际 Native/PTC 工具调用完成以下六项，每种模式均通过，pageerror=0：

1. 原 D1 完整问题经宿主来源读取，文本摘要和实际 Session/消息标识齐全，有限说明可用。
2. 原首次 D1 视图的错误反面值、维护关系与价格单位被检出。
3. 明确手写的来源对齐夹具匹配，仅作为确定性反例修正验证。
4. 能力反转且当前确实需要私网：`eligibleOptionIds=[]`、`unknownFeasibilityIds=["hosted"]`、`recommendedOptionIds=[]`；保留未声明维护负担的未知语义。
5. 请求替换来源被拒绝。
6. 默认 ArchitectureExplorer 正常渲染，工具过程折叠时仍可见。

源码单元/回放12项、文件来源回归4项、最终编译 MCP 的默认工具及旧 arrows 来源路径2项通过，类型/构建通过。MCP 的另外5项有意未执行；不重新跑已验收旧矩阵。本轮新自然模型请求0，原 run9 仍0通过/6失败/18请求。`session/prompt` 的 accepted 回执不含消息ID，实际消息标识来自公开宿主投影；这不构成额外身份凭证。

首轮实际宿主因未识别的合成 producer 被拒绝；随后按公开合同识别 runtime/skill/time 上下文，再跑通两种模式，没有改成忽略全部未知 producer。详见 [本段证据](evidence/host-source.json)。没有重写原始自然结果、迁移1.0–1.4历史、改变全局模型/路由或新发Release；也没有宣称已经解决原六题的自然生成及全文语义问题。
