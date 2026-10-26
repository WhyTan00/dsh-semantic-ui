# 独立来源片段与图关系核对（本地开发候选）

新增于 `0.1.0-preview.12-dev.0`，来源核对合同 `1.0`；Envelope 继续使用协议1.4并读取1.0–1.4历史。它是可选的只读 MCP 路径，尚不是已发布稳定版，也没有接入 DSH 的当前用户消息或当前 Codex 客户端。preview.11 的归档、安装与自然题结果保持原身份。

## 实际新增了什么

调用者在进程启动时选定一个本地来源文件，服务读取并固定一次快照。工具请求只能提交待核对的图和受限说法，不能选择文件、替换原文或声明已认证。程序解析选定片段中的明确箭头，检查 ArchitectureExplorer 的方向、遗漏与新增关系，并给出来源摘要和出处范围。可同时核对直接边、连续路径与可达性，提供只根据来源语法组成的说明。

这比仅检查模型自己提交的字段是否自洽多了一条实际的跨输入对照，但**文件配置不认证作者、原用户或其事实真实性**。调用者和模型也可能拥有相同的文件写权限；这里不证明独立作者或签名。来源在处理工具请求之前捕获、请求参数不能替换它，与来源身份认证是不同结论。

`sourceFactsVerified` 始终为 false；返回结果分别列明：

- `source`：文档字节 SHA-256、所选文本及片段 SHA-256、JSON pointer、解码文本内的 UTF-8 字节范围；不返回本机文件路径。
- `sourceRelations`：直接箭头及片段内的出处范围。
- `comparison`：所选关系集合的完整覆盖、方向和未给关系对照。未给关系表示“本片段没有断言”，不等于禁止或不可能。
- `claimChecks`：只支持直接边、连续路径和拓扑可达性；因果、重试、回滚等仍为 not-assessed，不据此判为 false。
- `freeProse` 与 `unverified`：摘要、节点职责/约束、边的类型/标签、场景解释和任意正文没有通过自然语言真值认证。
- `canonicalExplanation`：只使用所选箭头组成的程序说明；关系不匹配或有不支持说法时 withheld。它不替模型检查最终回答。

## 正常入口

默认启动仍只有原来的三个无文件工具。显式配置来源后才增加第四个 `semantic_ui_source_check`：

```sh
# 已构建仓库或解压的候选包；只读取调用者明确指定的文件
node dist/mcp.js --source-file /absolute/path/to/relations.txt

# JSON 原件：只选一个字符串字段，并显式指定其中唯一出现的原文片段
node dist/mcp.js \
  --source-file /absolute/path/to/source.json \
  --source-json-pointer /question \
  --source-excerpt '入口→鉴权→库存→支付，支付→通知'
```

这些选项属于 MCP 进程启动配置，不是工具参数，也不会自动修改任何宿主/全局配置。文件以只读方式打开；拒绝最终路径为符号链接、非普通文件、过大文件、无效 UTF-8 和读取期间变化的文件。读取失败就退出，不扫描目录或寻找替代来源。启动后文件修改不会改变本进程已固定的快照；要采用另一个来源需由调用者明确启动另一进程。

可直接运行的工具参数示例（只核对来源中的受限说法）：

```json
{
  "claims": [
    {"kind":"edge","from":"支付","to":"通知"},
    {"kind":"path","nodes":["库存","支付","通知"]},
    {"kind":"reachability","from":"入口","to":"通知"}
  ]
}
```

省略 `view` 可先检查所选来源；要比较已生成的图，另外传入真实的 ArchitectureExplorer envelope 作为 `view`，否则不报告图已匹配。`edge`/`reachability` 只接受 from/to，`path` 只接受 nodes，不能夹带被误认证的解释 text。其它说法使用 `{"kind":"causal-impact","text":"待说明的因果说法"}` 等形式，结果明确为未核对。可选 `prose` 只报告未认证和长度，不删除关键词，也不把图匹配升级为正文正确。

## 有限语法与边界

片段中每个非空分句都必须是 `节点→节点→节点` 或 `节点 -> 节点`；用中英文逗号、分号或换行分开。节点是最多80字符的字面标签，支持字母、数字、中文以及有限空格/标点。相邻节点形成有向边，重复断言保留出处；回路、自环可表示。选定片段含任何不支持的分句时整体返回 source-unsupported，不跳过难句后冒充完整核对。

来源不会自动裁掉前言、问题、否定、条件或其它自然语言。调用者选取 excerpt 必须承认范围缩小；检查不解释片段外的上下文，不能以截取箭头证明整句含义。图节点按精确、唯一标签对应；IDs 可以改变，别名/翻译不会自动匹配。边类型与自由说明仍未认证。上限为1MiB来源文件、32KiB所选字符串、16KiB片段、80条关系断言、32条受限说法；完整回执超预算时显式拒绝，不截断后报成功。

## 真实首次原件的离线核对

来源为保留的 [r9-A2](evidence/natural/r9-A2.json) 的 `/question`；原文片段为上例四条关系。原文档 SHA-256 为 `17a3d65a7367f5b4686b9cc57867e7bbc265e11ff5f91fb9d1d00a2f59f2104e`，问题文本 SHA-256 为 `aee8484a0dc18764e15eaa2713e5ceffbae6399e12412e100eb32e85875839b0`。

原首次图应匹配这四条边；这不修复首次正文附加的方向/回传/因果解释。原 A2 共享边归因勘误保持。完整 A2 问题及 [A3](evidence/natural/r9-A3.json) 的自然语言访问/禁止/只读描述不属于该箭头语法，返回不支持。所有检查都是对保留输入/输出的离线重放，没有新模型调用，也没有将手写正确图计为自然通过。原 run9 仍0通过/6失败/18请求。

开发验证入口：

```sh
pnpm exec vitest run tests/source-graph.test.ts tests/source-input.test.ts tests/source-mcp.test.ts tests/mcp.test.ts tests/protocol.test.ts tests/replay.test.ts tests/grounding.test.ts tests/decision-consistency.test.ts
pnpm typecheck
pnpm build
```

独立 MCP stdio、候选包入口、保留反例和最终命令状态见 [本轮证据](evidence/source-check.json)。本段不宣称 DSH Native/PTC 已取得独立来源、当前 Codex 已加载新工具、自由因果正文已通过或全部原六题已修复。下一步仍需扩展有据说法的适用范围，并把真正的宿主原输入身份与内容对照分别验证。
