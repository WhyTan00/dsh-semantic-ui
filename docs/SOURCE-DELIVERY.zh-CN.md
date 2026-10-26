# 来源核对接入正常聊天交付

`0.1.0-preview.12` 将 [permissions-zh核对](SOURCE-PERMISSIONS.zh-CN.md) 和完整的 [decision-zh条件核对](SOURCE-DECISION.zh-CN.md) 接入原有唯一 `dsh_semantic_ui` 的普通 `action=render`。不需要先调用source-check或传一个“检查通过”标记。组件协议仍1.4，没有新工具、模型层或聊天数据库。发行与安装须分别看版本回执；当前Codex客户端尚未加载本插件。

## 用户实际看到什么

对当前完整permissions-zh来源，render重新读取执行Agent当前own-turn消息并核对本次view：

1. 精确节点对应、正向访问/方向/权限模式不匹配，或完整来源不支持时，返回具体可修正差异；普通聊天位置显示拒绝，不作为有据组件交付。原Client翻译仍未核，不自动改成“客户端”。
2. 匹配后，从独立来源声明生成全新的展示标题、摘要、节点详情、限制、边模式和拓扑路径说明；原模型标题、摘要、注释、evidence及路径说法不进入有据展示。保留稳定ID、revision、已核关系和纯外观；不是关键词删除。
3. 重新校验最终展示和其正向投影，再交付正常图组件及“来源文字内的有限核对”说明。节点未知业务职责保持未知；只有禁止条件的主体也不会被误称为“仅被访问目标”。路径仅说明已声明拓扑，不证明执行或故障影响。

说明与组件均位于聊天正文节点，工具过程折叠时仍可见。修改控件、邻域聚焦及主题仍是原有本地行为，不成为模型重分析或新的世界事实。

实际完整组件截图：[Native 360px](evidence/source-delivery-native.png)、[PTC 360px](evidence/source-delivery-ptc.png)。均来自最终构建的新进程历史恢复，不是真机或自然模型验收。

未被当前有限语法覆盖的通用输入仍走结构交付，并明确显示“来源未核”；来源不可用也不伪装为已核。有限场景开头已选择permissions-zh但完整内容不支持时拒绝，不跳过难句后给局部批准。通用数据的模型解释继续标为未独立验证。本段不宣称任意来源或全文语义认证。

## 双方案条件进入同一交付路径

Decision render 的 `mapping` 仅提供维度/输入对应的源坐标，不提供真值。当前来源命中有限双方案语法时，必须完整映射并重新核对每个单元格、初始条件、角色、预期作用与要求方向；未映射、错误维护方向、未知反面被填false、虚构价格单位或额外策略均拒绝。识别到有限语法开头但全文不支持也拒绝，不跳过困难句批准一部分。

通过后重建标题、摘要、方案说明和原始条件解释；模型的优缺点、推荐、证据与迁移解释不会进入有据展示。来源检查过的标签、单元格、控件及要求链接保留；价格和未声明反面保持unknown。复用同一最终快照通道和恢复合同，不缓存前一份source-check批准。

聊天正文明确区分固定的原始来源解释与下方本地假设。改变团队余力、私网需求会重算当前候选状态，但不重写来源、填补未知单元格或发出模型请求；刷新恢复原始条件。它不证明价格、真实维护能力、模型正文或新的世界事实。完整输入与事前预期见 `fixtures/decision-delivery-expectations.json`，反例及正常工具路径见 `tests/decision-delivery.test.ts`、`tests/decision-delivery-browser.mjs`。

## 来源、检查与保存必须是同一份内容

render不接受source文本/kind、authority、旧检查结果或delivery handle作为授权参数。来源仍由 [当前输入门禁](HOST-SOURCE.zh-CN.md) 选取，原投影的继承/关闭/歧义/未知producer等规则不变。每次render、每个新revision/turn重新核当前输入，source-check结果没有批准缓存。

宿主在返回短回执之前，将**最终已校验展示及来源说明**序列化为checkpoint快照。正常 `presentationMeta` 只通过宿主私有、一次性handle消费这份快照，不再读取args.view来重建展示。handle可以经过DSH的规范JSON克隆；回合、展示ID、revision和结果状态不对应，伪造或已消费handle均不产生展示。未消费表有界，容量满时拒绝，不静默丢掉已批准的快照。完整spec不返回给模型。

handle只是这次工具调用内的传递引用，不是来源签名、独立人类身份或业务授权。临时表不承担恢复；恢复只读DSH已保存的整值checkpoint。

checkpoint沿原meta扩展版本化的来源说明、文本摘要、实际host消息引用与展示identity；不修改组件Envelope或旧协议。恢复检查来源合同及turn/displayId/revision/component对应，失配时显示错误，不回退成原未核view。同revision但数据或来源引用变化仍是冲突。一次失败的新revision不会继续展示上一个已核组件来冒充本次成功。

没有该字段的旧1.0–1.4历史继续按原语义读取，旧外观/模板合同保留。来源记录并非对任意外部修改过的DSH日志的数字签名；这里只保证正常工具与恢复路径消费实际保存的最终快照，不把宿主引用当人类principal。

## 验证与界限

实现前固定 [独立最小预期](../fixtures/source-delivery-expectations.json)。[本段证据](evidence/source-delivery.json) 逐项区分最终构建与修正前记录：

- 纯函数/实际工具body、一次性快照和重放测试：原注释不污染展示；旧检查/伪造证明/旧输入/不同revision不能批准新render；source元数据失配、失败更新及旧历史读取有对应反例。
- 模板外观及显式谓词持久化的必要窄兼容，独立MCP默认入口/permissions检查，类型与构建。
- 现有隔离真实DSH、普通session/prompt和render，本地确定性transport。修正前Native/PTC各5项涵盖两revision、错误权限/禁止、旧别名、不支持全文和通用unverified。通用反例随后纠正了“无正向出边就仅为目标”的不当职责文案；最终新字节仅复验Native/PTC各2项有据交付/真实拒绝，不把之前10项冒称测试了新字节。
- 最终候选刷新/历史切回及独立进程恢复；完整360px容器截图、宽度无溢出、pageerror=0。首次截图被宿主滚动层裁切，首次恢复脚本因工作区未展开超时；修正的是取证步骤，失败记录保留，最终完整图另存。

新模型/自然题请求为0，原六题仍0通过/6失败/18请求，所有raw与A2勘误保持。明确另写的投影和恶意注释夹具不是自然模型通过。`identityVerified=false`、`sourceFactsVerified=false`；仅来源文字内的有限内容一致性得到检查，独立人类身份、真实世界权限和组件外自由正文仍未认证。dev.5仅验证权限来源；preview.12新增上述Decision交付及独立版本验证。图表原始数据与全文一致性、自然生成采用、真实手机/读屏和当前Codex客户端效果仍需分别推进。
