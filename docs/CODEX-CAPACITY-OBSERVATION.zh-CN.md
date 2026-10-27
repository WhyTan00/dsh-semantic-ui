# 容量来源的两个真实模型观察

两份原始答复按事前有限判据评读为met，但结构化采用程度不同：**23上的首题有7次新view比较未匹配；修复字段合同反馈后，24上的独立边界题当前view首次匹配。** 原文、全部首次拒绝、宿主说明与实际包身份分别保留，不能把正文正确、core validated或宿主canonical补记为view已通过。

这是一段恰好2个用户级回合的技能/工作流引导观察。没有第三次，也没有重跑首题。后台推理请求数未知，不称免费；不同题目和版本不构成同题因果或效率基准，更不代表全部自然题通过。

## 先固定来源、问题与判断

2026-10-27 11:40:47UTC已固定两份Agent受控合成资料、普通问题、独立算术、逐项预期和失败停止条件，原私有回执SHA-256 `c1578cc573c0432b70e6c2a81106a55caee3b2c6a441ab6531981508f00265f8`。公开[题目与判据摘录](evidence/capacity-observation/criteria-cases.json)保留安全选字段，不冒充私有交接的同字节副本。

| 对照 | 完整来源声明 | 普通问题的重点 |
| --- | --- | --- |
| current-mb | 雾汀上限240MB、部署简单；杉海上限900MB、维护复杂。现在180MB，以后可能600MB | 当前/未来可能、本地改需求会改变什么 |
| boundary-gib | 澄泉上限64GiB、维护简单；岚峰上限160GiB、部署复杂。现在64GiB，以后可能192GiB | 等号边界、假设下两项都不足，是否足以决定整体选型 |

原始完整文本都使用文档化的 `capacity-zh` 语法；[第一源](evidence/capacity-observation/current-mb-source.txt)与[第二源](evidence/capacity-observation/boundary-gib-source.txt)SHA分别为 `1fa41e00eeaa55e10d1d8ae382290861fa4507be42190c09fb0832421729645f`、`203fdcae467dc9894bc481c0aeefb11041d1b9cd09983d180fe6dd1249d3398e`。它们是合成声明，不是人类或世界事实认证。

明确的合法假设允许计算和条件化讨论，但不能冒原始当前需求或确认未来计划。未知部署/维护交叉属性、价格、迁移和偏好仍未知；不因这是一道拒绝/边界观察就禁止合法需求假设。题目与预期没有看结果后改写。

## 实际正常入口

沿未修改的 `examples/codex-readonly.py --answer --model-candidate`，官方个人CLI0.164.0 / app-server / 既有ChatGPT登录，原默认 `gpt-6.1-sol / max / openai / default` 保持。两个独立ephemeral thread/cwd，只输入普通问题与归档技能的官方typed skill item，通用developer指引相同。

归档SHA和实际MCP入口字节在加载前核对，入口位于临时解包的 `package/dist/mcp.js`；实际完整路径、typed技能路径与字节、全部RPC/MCP wire、模型事件、raw final及终态留在私有记录。没有semantic源码overlay、全局MCP注册或模型路由变更。公开证据保留安全的语义调用与身份摘要，省略重复的JSON文本副本，不公开reasoning、配置或凭据。

模型未收到评审预期、人工正确view、前题上下文或预先粘贴的宿主答案。**来源工具本身会返回现有有限canonical；24还返回可发现的字段合同。** 这是工具辅助采用，不能当作无解释帮助的独立推理或无指引自主选择。技能已发现、读取、提供并由接口接受，内部逐字注意不可直接观察。

| 层次 | current-mb：23 | boundary-gib：24 |
| --- | --- | --- |
| archive SHA | `8f4492c7242c99f1daf884be1af38b1275f8eeac0164b2fb96309023117421c8` | `ccd2b7890292eee150d8fb9c3ea800d75e0f69ddcd4c72b532eee0bdee28fb70` |
| 实际模型回合 | 1，completed | 1，completed |
| 模型语义调用 | 12 | 6 |
| 内置资源发现 | 2，单列 | 2，单列 |
| 宿主显式调用 | 3，单列 | 3，单列 |
| 当前新view首次比较 | mismatch | matched |
| 后续来源比较 | 共6次mismatch、1次ROLE_TYPE validation-failed；无matched | 192GiB假设初值mismatch，保留 |
| raw有限人工评读 | met | met |
| 宿主最终文本 | 独立source-canonical delivered | 独立source-canonical delivered |

客户端SHA `671d86e786de910af285916e67cccccdeea56fd33ffdcf0204fc25f777d50cfe`与通用指引不变；归档/技能版本因实际修复改变，技能SHA由23的 `a6b35e2a99076e7c6462a04f894dcad2efe8a2584c83ae8fb091f33d9d442e2d`变为24的 `38e2a82e1659d8d503cc5e156b17401f1339035cd560b04006677286b658be45`。这个差异不隐去。

## 首题正确的原文与失败的view

[完整首题原文](evidence/capacity-observation/current-mb-candidate.md)保留当前180MB两项容量满足、明确600MB假设仅杉海容量满足；雾汀维护/杉海部署未知，成本、迁移和偏好未知，没有整体赢家。它没有声称当前CLI已渲染或点击UI；刷新语句是正常组件合同的转述，不是本回合UI实测。

实际view请求曾添加合同外定性列，随后多次在量值180MB、单位MB、hard与at-least正确的情况下猜输入标签。23将标签不符也报为 `SOURCE_CURRENT_DEMAND`，没有定位标签或列出其允许值；一次错误添加布尔semanticRole又被 `ROLE_TYPE` 拒绝。全部首次请求/响应保留在[首题记录](evidence/capacity-observation/current-mb.json)。没有把后来的手写修正或宿主文本替换这些失败。

确认这一通用反馈缺陷后，才进行[24字段合同修复](CAPACITY-CONTRACT.zh-CN.md)及窄0模型回归/归档验收。已有允许标签、量值、单位、方向、域和策略限制没有放松；调用者必须明确修正字段。首题没有再次调用模型。

## 独立边界题保留合法假设

[完整第二题原文](evidence/capacity-observation/boundary-gib-candidate.md)明确按“上限≥需求”判断，64GiB等号也满足，当前两者满足；明确192GiB本地假设下两者都不足。它不把可能点当当前/确认计划，不强选一个赢家，分别保留澄泉部署、岚峰维护及价格/迁移/偏好未知。

模型分别通过core计算当前与假设，并让当前64GiB的新view首次来源比较matched。之后把192GiB写为view初值再作来源比较，返回 `SOURCE_CURRENT_DEMAND`：这个view不是原始64GiB来源。**拒绝来源认证不等于禁止192GiB的条件化计算。** 模型原文保留了这一层次，未声称已更新来源；[完整记录](evidence/capacity-observation/boundary-gib.json)保留匹配、假设计算与后续拒绝。

## 范围与资源

[分层摘要](evidence/capacity-observation.json)列出原件和摘要；[正常调用与清理核对](evidence/capacity-observation/wire-and-cli-cleanup.json)先按真实宿主请求时间区间归属，再核余下模型MCP参数/响应多重集，避免把相同空对象调用混算为模型采用。stdout等于单独保存的宿主说明，raw从未被canonical替换。

本段2/2新attempts、实际2次turn/start均completed，无重试、无第三次；此前0520与G/H各2次不改。7个CLI进程均exit0、临时根移除、extraRoots撤回、全局配置SHA不变，所有自有PID实测不存在。3个非模型检查tap缺少exit事件，退出原因未知，不编造为SIGTERM；其tap/child PID均已另行核实不存在。两次实际模型运行的tap退出记录完整。

CLI只读工具不提供富UI，没有本轮实时DSH回调、主客户端安装或设备验收。24的确定性Native/PTC安装/修正/刷新是单独的0模型层，不能补作模型UI采用。`candidateStatus=unverified`，sourceFacts/identity/freeProse认证仍false；原六题0pass6fail18requests、A2勘误、旧D2/raw/preference-only与全部旧资产不改，长期原语义Goal未完成。
