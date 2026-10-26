# 普通来源中的访问与权限边界

源码/构建候选 `0.1.0-preview.12-dev.4` 增加 `permissions-zh`，来源核对合同1.0、组件协议仍1.4。它解析完整的有限中文访问声明，区分正向关系、方向性禁止、主体—目标对的只读/读写，以及特定主体的“只能访问”目标集合；提供逐项出处和程序生成的有限说明。没有新增模型层、组件协议字段、任意代码或聊天数据库。

实现前固定 [公开最小预期](../fixtures/source-permissions-expectations.json)。实际来源为 [原 r9-A3](evidence/natural/r9-A3.json) 的完整 `/question`，原件 SHA-256 `2fb654eabcbe810aee4581f124f773610dc1cd9867925931f2d5513dcceb8481`，问题文本 SHA-256 `05ee44b266d6bbbd75607f04de92a39928732f50e3f8981c14b1cd50d7a56db8`：

> 虚构服务中，客户端只能访问 Gateway，Gateway 访问 Search 与 Account，Search 只读 Index，Account 读写 Store；禁止 Search 访问 Store。请帮我理解边界与耦合。

## 能核对什么

| 来源声明 | 有据范围 | 不据此推出 |
| --- | --- | --- |
| 客户端只能访问 Gateway | 该主体的直接访问目标集合 | 所有外部调用者都只有这个入口 |
| Gateway访问Search与Account | 两项明确的直接访问 | 未列出的所有访问均被禁止 |
| Search只读Index | 该主体对该目标可读、不可写 | 该主体对所有存储无写权限、读取不会影响写入或故障独立 |
| Account读写Store | 该主体对该目标可读写 | Store只有一个访问者/写入者或全局唯一写路径 |
| 禁止Search访问Store | 这一个方向的直接访问禁止 | 反方向也禁止、其它主体也被禁止，或存在一条正向“禁止边” |

源解析结果分别返回 `accesses`、`prohibitions`、`onlyTargets` 与原文 UTF-8 字节范围。未声明的权限为unknown；只有显式禁止或该主体的only-target限制才能支持否定。第二个明确合法访问者/写入者可以共存；同一主体对另一个目标的写权限也不被只读关系自动排除。冲突或不支持的句子整段拒绝，不跳过难句后报告完整成功。

## 两个正常入口

MCP继续使用同一个可选只读工具，仅由调用者启动时固定来源及模式：

```sh
node dist/mcp.js \
  --source-file /absolute/path/to/source.json \
  --source-json-pointer /question \
  --source-kind permissions-zh
```

先以 `{}` 调用 `semantic_ui_source_check` 读取声明和未知，再提交实际 `view` 或有限 `claims`。来源按原 [文件快照合同](SOURCE-CHECKS.zh-CN.md) 一次捕获；请求不能替换文件、文本、kind或认证身份。默认三工具与旧arrows/decision-zh入口保持。

DSH继续通过唯一 `dsh_semantic_ui` 的 `{"action":"source-check"}`。既有 [当前输入门禁](HOST-SOURCE.zh-CN.md) 先选出单一当前own-turn user-source文本，再由实际文本的有限开头选择语法：以字面场景标签加 `中，` 开头进入permissions-zh，其它仍进入既有decision-zh；前缀只选择解析器，不认证任何事实。不支持的完整来源返回source-unsupported，未知producer/歧义/继承/历史/非文本等门禁不放宽，工具参数仍不能选kind或供来源。此路径未加载到当前Codex客户端。

## 视图与有限陈述

`view` 只接受原 ArchitectureExplorer。节点按精确且唯一的字面label对应，ID与行序可变；不从模型自报mapping、evidence、responsibility或角色生成别名依据。原view的 `Client` 与来源“客户端”的翻译目前未核，返回 `SOURCE_BINDING_UNVERIFIED` / not-assessed。这是新路径的有限绑定规则，**不是追溯解释旧自然题失败的理由**。

正向边须有方向且完整覆盖已声明的正向访问；显式禁止不能画成正向边。有限边模式为：`call/access/访问/调用` 表示访问；`read-only/只读` 表示只读；`read-write/读写` 表示读写；`read/读取` 配合精确label `只读` 也支持。单独read不证明无写权限，冲突的type/模式label拒绝。其它边文案仍未认证。

`comparison.status=matched` **只表示完整正向投影及有限边模式匹配**，不认证节点注释、摘要、情景解释或其中的禁止/唯一等说法。负向与局部限制由来源结果和以下typed claims单独检查，没有把任意constraints字符串变成事实：

```json
{
  "claims": [
    {"kind":"access","from":"Search","to":"Store","value":false},
    {"kind":"read","from":"Search","to":"Index","value":true},
    {"kind":"write","from":"Search","to":"Index","value":false},
    {"kind":"only-targets","from":"客户端","targets":["Gateway"]}
  ]
}
```

这些坐标和值是待核陈述，真值来自固定原文。逐项返回supported/mismatch/not-assessed、来源预期和出处；未给的反面不自动为false。`only-targets`要求同一主体的完整目标集合，不接受重复目标。其它说法用 `{"kind":"fault-independence","text":"..."}` 明确得到未核；受支持布尔陈述不能夹带解释text。`prose`始终not-verified，不通过关键词删除或改写自由正文。`canonicalExplanation`仅由有据声明生成，存在未核绑定、模式、陈述或不匹配时withheld。

## 公布的有限语法

- 开头必须为字面场景标签加 `中，`；场景仅作标签，不认证用户或隐含业务条件。
- 每个声明明确写出主体：`主体访问目标`、`主体只能访问目标`、`主体只读目标`、`主体读写目标`、`禁止主体访问目标`。目标列表可用与、和、顿号；逗号/分号/句号/换行后重新写主体。
- 最末可附精确问法 `请帮我理解边界与耦合`、`请解释访问边界` 或 `请说明访问边界`，以句号结束或不带末尾标点。其它问法/条件/同义词不猜测。
- 名称最多80字符，仅字母、数字、中文、空格、`_ . / : -`；排除操作、否定、条件、指代和连接保留词（完整列表在 `src/source-permissions.ts`）。含保留词的名称、代词/翻译/隐含主语均不推断。
- 最多64个非空分句、80个访问断言/实体，文本上限16 KiB UTF-8，typed claims最多32项。完整回执超限明确拒绝，不截断为部分批准。

## 验证与未完成范围

见 [本段证据](evidence/source-permissions.json)：完整原件、改实体/ID/行序、反向访问与禁止、许可/禁止交换、只读/读写交换、第二合法访问者、同一主体对另一目标写入、缺条件/矛盾/指代/条件、旧别名未核和请求换源等反例。新功能在现有隔离真实DSH的Native/PTC各4项通过，采用普通session/prompt与本地确定性transport；没有新业务模型调用或自然问题通过。

原A3图的大部分正向关系正确；其注释与全文里的全局唯一、读写不会互相影响、替代路径或故障范围等问题没有被手写夹具“修复通过”。原六题仍0通过/6失败/18请求，raw不改。`sourceFactsVerified=false`、`identityVerified=false`、自由正文未认证；消息内容标识与独立人类身份继续分开。旧1.0–1.4历史不迁移，原arrows/decision合同与分版本宿主证据保留。本段未新发归档/Release、安装或全局注册。
