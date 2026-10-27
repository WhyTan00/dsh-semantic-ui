# 当前来源撤回两项声明后的模型观察

**一个新的有指引模型回合正确保留了两项未知，并将公共缓存从“已排除”改为“待核实候选”。** 模型实际读取当前来源，生成的新视图首次来源比较为matched，原始回答按事前有限判据评读为met。宿主最终说明另行交付，未用宿主文本替换模型原文。

本次复用原preview.26归档及普通伴随入口，没有发现需要修改的通用运行缺陷，因此只补公开证据和文档，没有改运行代码、技能、协议或版本，没有重打包、重装、重发Release或重跑旧矩阵。[分层回执](evidence/source-revision-observation.json)记录实际范围。

## 当前来源与合成的旧判断

事前独立判据于 **2026-10-27 14:45:00 UTC** 冻结，原私有原件SHA-256为 `9548ebf19ab3d9be5327d6bdaab354dd268844d29c15a11e566e313c1ae8b74e`。执行指纹于15:03:48 UTC另行冻结。[公开安全摘录](evidence/source-revision-observation/criteria-cases.json)在模型完成后生成，不声称与整个私有原件同字节。

完整合成来源说明：公共缓存由平台更新、内网支持未知；隔离缓存支持内网、需要小组维护；价格均未知；小组有维护余力。条件规则是“若资料含限制字段则需要内网，否则不需要”，当前是否含限制字段未知。

独立审查另保留一份旧控制文本，其公共缓存内网支持为false、当前条件为true。**旧控制文本和评审预期都未提供给模型。** 普通问题只说“上次有人按旧资料排除了公共缓存”，询问按当前资料如何更新。这里没有实际的旧模型答复、真实用户选择或已观察的旧聊天历史，不能把合成控制文本描述成这些事实。

| 输入 | 原字节SHA-256 |
|---|---|
| [当前完整来源](evidence/source-revision-observation/current-source.txt) | `d086ba87551a3529dc6f2a962f7bca119121278ea6fca00a3aa2486d42518102` |
| [普通问题](evidence/source-revision-observation/question.txt) | `b26187033f5260f6cae5fddc3723b8311a3e7d398909c310d3b9c917abb0b259` |
| [模型原始回答](evidence/source-revision-observation/candidate.md) | `75be3d54d703feed13ee727c699a915b0904863058a33349ba22f3be4367c84e` |

模型仅收到当前来源的工具快照、普通问题、原归档typed skill和未改动的通用workflow；没有人工正确view、评审答案或私有期望路径。技能和[通用指引](evidence/source-revision-observation/generic-guide.txt)的完整字节及摘要分别保存。**source_check本身会按既有合同返回有限canonical explanation**，所以这是观察模型采用工具说明，不能称为无帮助的独立推理。

## 实际工具与原文分开核对

先用正常 `--answer` 完成一次零模型前置核对，当前完整来源可处理、有限说明delivered。随后恰好启动一次 `--answer --model-candidate`，终态completed，没有重试或第二次观察。

| 层次 | 实际结果 |
|---|---|
| 官方个人CLI / app-server | 0.164.0；既有登录，默认 `gpt-6.1-sol / max / openai / default` 未改 |
| typed skill | 原归档技能已发现、读取、提供并由接口接受；内部逐字消费不可直接观察 |
| 模型自己的语义调用 | 4次，依次为读取来源、schema、新view来源比较、core check |
| 新view首次来源比较 | matched；公共缓存支持=null、当前内网需求initial=null，派生状态derived-unknown |
| core check | validated；调用发生在新view来源比较之后，原顺序保留 |
| 模型内置资源发现 | 2次，空清单，单列而不计语义检查 |
| 宿主显式调用 | 零模型前置2次；模型观察前后合计3次，与模型调用分开 |
| 原始回答人工评读 | 本次有限语义判据met；运行时candidateStatus仍为unverified |
| [宿主最终说明](evidence/source-revision-observation/host-answer.md) | 独立delivered，modelCandidateUsed=false |

模型原文明确：公共缓存的内网支持未知，并非明确不支持；当前是否含限制字段未知，不能直接按需要或不需要处理。旧排除理由不足以确定当前排除，但也没有确认公共缓存适用。隔离缓存的内网支持、维护需求及小组余力只能说明相应条件，不能推出唯一选择。两种条件分支、未知价格和未给出的反面维护责任也分别保留。

[逐项评读](evidence/source-revision-observation/review.json)读取完整raw final，对照事前语义判据，没有关键词白名单，也没有用无关工程免责声明作为通过条件。工具采用与正文正确分别记；本例两项均met，不推广成普遍准确率或任意正文认证。没有额外请求typed claims接口，不能把新view比较当成所有claim API均已采用。

## 字节、计数与边界

[选定实际工具记录](evidence/source-revision-observation/observation.json)保留完整语义参数、content与structuredContent，以及独立的宿主调用和最终交付。[双层核对](evidence/source-revision-observation/wire-verification.json)先按宿主请求至响应的时间区间归属，再匹配模型completed item与其余MCP记录；相同空参数不能单独用来区分前置、模型和最后读取。stdout等于保存的宿主说明加Python print产生的一个换行，未泛化为空白归一化。

本次最多1次，实际 **1/1**；所属较大独立段计数为 **1/2**，剩余名额没有自动授权使用。失败启动、中断和重试也应计数，本次没有这些情况。后台推理请求总数unknown，未探测额度或密钥，不称免费调用。此前I/J、G/H、容量、0520等各自2/2与原六题0 pass / 6 fail / 18 requests保持不变，见[计数](evidence/source-revision-observation/budget.json)。

两个伴随进程均app-server exit0；4个MCP tap的对应子进程均有SIGTERM终态，已无存活PID。临时根已删除、extra skill根撤回，全局配置摘要未变。本段没有启动DSH宿主或监听端口，没有改动共享服务，见[清理记录](evidence/source-revision-observation/cleanup.json)。完整wire、reasoning、配置与私有路径不公开。

使用的仍是26运行归档，SHA-256 `a8cfc1d4fb36847a2b9e137346ea078d25c3877e14457be3e56aa0f96951c51d`，运行源码commit `2b7cfa14baab942472dc45234b7d1ff912124657`。[全部执行指纹](evidence/source-revision-observation/fingerprints.json)关联客户端、技能、通用指引、manifest及运行入口；本次前后均未改变。

这是**当前文件快照正常隔离导入后的模型任务观察**。它与[Native/PTC同会话完整来源修订](NORMAL-SOURCE-REVISION.zh-CN.md)相互补充，仍不是同一Codex会话的实时DSH回传、真实多轮历史理解、主客户端富UI、手机验收或完整GenUI替代。`sourceFactsVerified=false`、身份未认证和自由正文运行时未认证继续保持。
