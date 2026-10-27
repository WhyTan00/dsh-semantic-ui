# 明确异常规则与未知策略的模型观察

preview.22 交付后，另用其原始归档和正常只读伴随入口观察两个新合成问题。**G 的关键规则与未知策略表达符合来源，但额外边界没有逐项说全；H 符合本次有限判据。** 两份模型原文、实际工具调用和宿主最终说明分别保留，不能把宿主完整说明算成模型原文的内容。

这验证的是有技能和通用工作流指引时的工具采用，不是无指引自然选择、自由正文认证或新的原生界面验收。它没有运行真实作业，也不改变原六题 `0 pass / 6 fail / 18 requests`、A2 首次失败和勘误。

## 来源与事前判据

2026-10-27 09:24:09 UTC 已固定独立预期，原私有回执 SHA-256 为 `e2ff1f242b339fc2b53e56a57bf5e5ebf7ee116bb82587123238ef769420e6e5`。公开的[安全题目与判据摘录](evidence/workflow-observation/criteria-cases.json)保留所选字段，不冒充原私有回执的同字节副本。

| 独立回合 | 配置的完整合成来源 | 检查重点 |
| --- | --- | --- |
| G | 合成作业流程为收件→校对→存档，存档→回条；回条出错仅重试回条，不回滚存档。回条出错与校对出错分别会影响哪里？ | 明确局部规则不能丢失；校对的异常策略不能补造 |
| H | 合成作业流程为登记→核验→留档，留档→回执。回执出错与核验出错分别会影响哪里？ | 没有给出异常策略时保留未知，不能借用 G 的规则 |

两份完整文本摘要分别为 `97c6414f081220bcd171a3fc61b52fd0d6ceda339b7159992510a9bdbad5dbaf`、`de763a31aebed632edefb3ee4a19a76e8c1ad33bc2c1e298f2e04a01c95a9cc6`。来源是 Agent 编写的安全合成数据，没有认证作者、世界事实或独立人类输入。两题先各做一次零模型 `--answer` 检查，均可交付现成的有限来源说明。

实际入口仍是 [examples/codex-readonly.py](../examples/codex-readonly.py) 的 `--answer --model-candidate`，来源种类为 `workflow-zh`，组件为 `ArchitectureExplorer`。使用现有官方个人 CLI0.164.0 / app-server 登录，原默认 `gpt-6.1-sol / max / openai / default` 未变；后台推理请求数未知，不能称为免费调用。

两个 `turn/start` 分属独立 ephemeral thread 和临时目录。输入是普通问题与归档技能的官方 typed skill item，另有既有通用工作流指引；不传评审预期、人工正确 view 或预先粘贴的宿主答案。**来源工具会按既有合同返回有限 canonical explanation**，因此这是观察模型怎样采用工具结果，不能当成没有解释帮助的独立推理。H 没有收到 G 的问题、上下文或结果。客户端、技能和通用指引在两题之间均未修改。

## 实际采用与原文评读

| 层次 | G：明确局部规则 | H：异常策略未声明 |
| --- | --- | --- |
| 新观察回合 | 1，completed，无重试 | 1，completed，无重试 |
| 模型自己的语义调用 | 1：`source_check({})` | 4：读取来源、schema、core check、带新 view 的来源比较 |
| 模型内置资源发现 | 2，单列 | 2，单列 |
| 宿主显式调用 | 3，单列 | 3，单列 |
| 新 view 的首次比较 | 未请求；不能算建图采用 | matched，三条边完整，`failurePolicies: []` |
| typed workflow claim API | 未请求 | 未请求 |
| 模型原文 | 关键规则正确；附加边界覆盖不足 | 本次有限判据 met |
| 宿主最终说明 | 独立 delivered，完整列出未知边界 | 独立 delivered，完整列出未知边界 |

G 原文以“根据现有来源”限定范围，保留“仅重试回条、不回滚存档”，明确校对的重试、回滚、补偿未声明，也不从连接顺序推导故障传播或阻塞。它没有断言次数、必成功、世界事实或作者身份，但也**没有逐项显式说明这些未知或未认证**，所以第四条判据记为 partial。不能把未提及直接算作完整覆盖。G 的原始正文见[完整候选](evidence/workflow-observation/g-candidate.md)，评读在 H 开始前已保存。

H 原文明确来源只给出流程，回执和核验错误的实际影响范围、阻塞、重试、回滚、补偿均未说明。没有借用上一题的局部规则，也没有引入假设冒充来源。见[完整候选](evidence/workflow-observation/h-candidate.md)。模型还生成一份新的 ArchitectureExplorer view，经 core validated、来源比较 matched；其摘要和责任说明依然是未认证正文，不能由拓扑 matched 推出任意文字正确。

两题的 `candidateStatus=unverified`、`freeProseVerified=false` 保持。typed skill 已发现、读取、提供并被接口接受；模型自己的工具事件可见，内部逐字消费不可直接观察。G 没有完成 schema/check/新图比较，不能因为 H 使用了该流程，就概括两题都完整采用。

## 证据、计数与收口

[分层摘要](evidence/workflow-observation.json)列出原文、来源、问题、选定工具请求/响应、宿主前后检查和逐项人工评读的文件摘要。[G](evidence/workflow-observation/g.json)与[H](evidence/workflow-observation/h.json)保留选定 completed item；完整 wire、reasoning、配置与私有接管资料不公开。

核对工具来源时，先按宿主请求至响应的时间区间归属，再核对模型 completed item 与其余 MCP 请求；相同的空对象参数不能仅靠值相等区分前置读取、模型读取和最后宿主读取。两层实际参数与 structured response 均相等，stdout 等于单独保存的宿主说明，见[核对记录](evidence/workflow-observation/wire-verification.json)。两次模型的资源发现返回空清单；MCP 只提供工具，不把发现计成语义检查。

本独立段恰好使用 **2 / 2 个 NEW observed turns**，没有第三次重试；此前来源补充观察的2次、A2实施的0次分别保留，不重置、不混算。没有运行时缺陷需要修复，故没有改代码、技能或协议，没有重发、重包、重装或重下载22，也没有重跑既有宿主矩阵。

四次伴随进程（两次零模型、两次真实观察）均已结束：app-server exit0，8个 MCP tap 对应子进程均有 SIGTERM 终态且 PID 已不存在，临时根移除，extra skill 根撤回，全局配置摘要不变，见[清理记录](evidence/workflow-observation/cleanup.json)。本段未启动宿主服务或端口。

这进一步检验了“来源规则、拓扑、计算和解释分层”的采用效果，仍不完成任意自由正文、全部自然题、实时 DSH→Codex 回调、主客户端富 UI、完整 GenUI 替代或真机/读屏验收。研究覆盖数也不能据此变成采用完成率。
