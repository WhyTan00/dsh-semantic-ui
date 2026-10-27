# 典型开源项目采用复核

后续preview.19开始落实提交/接收分层：[单未知当前事实补充](../SOURCE-UPDATE.zh-CN.md)经正常prompt产生新来源，关联持久requestId、消息和新checkpoint；unknown/取消、本地试算、重复及不明结果分开。仍无通用RequestForm或可迁移结果；原preview.11矩阵保持，不把此窄流程写成全部提交闭环已完成。

后续preview.17已把[明确两分支硬需求](../SOURCE-CONDITIONAL.zh-CN.md)接入既有来源/普通答复/原生交付，当前条件与局部假设分层；新包、模型候选及宿主接受分开留证。这个增量补有界解释，不把研究覆盖面当功能完成率，下表原preview.11基线保持。

复核日期：2026-10-27。实现基线为 `0.1.0-preview.11 / 协议1.4`，源码 commit `ec7cf58f920e5578f8b38719095d49dba6d15220`。

**研究覆盖面已经较广，实际采用仍不充分。** 三类语义表达、确定性计算、个人模板和 DSH 历史交付已有实现及分版本证据；用户输入进入下一轮、可迁移交互结果、复杂统计表达仍有明确缺口。当前不能全面替代两类 GenUI，也不能保证模型生成的来源映射和正文正确。

本轮交付是采用复核、来源快照和优先级修订，没有增加运行功能、升级依赖或重发安装包。

后续源码增量preview.12-dev.0–4已补上有界的独立来源对照：字面箭头、[双方案条件](../SOURCE-DECISION.zh-CN.md) 与 [直接访问/局部权限](../SOURCE-PERMISSIONS.zh-CN.md)，并复用 [DSH当前输入门禁](../HOST-SOURCE.zh-CN.md)。这些各有单独实现/验证范围，不改下表preview.11复核基线；任意正文、全局因果、提交闭环和结果迁移仍未完成。 dev.5进一步将权限来源核对接入 [正常render交付与恢复](../SOURCE-DELIVERY.zh-CN.md)，以新来源投影替代未核模型注释；范围仍限该合同。preview.12再补完整decision-zh的正常交付及本地假设边界，见同页；仍不改变下表基线或原自然失败。

## 证据怎么读

后续 [普通答复入口](../CODEX-GROUNDED.zh-CN.md) 已将现成来源说明用于CLI文字交付：decision-zh先前验收，arrows选段和permissions-zh完整有限来源另各一次零推理实测。它进一步落实来源、计算和解释分离；不代表任意正文认证、交互提交或当前桌面富UI已完成，各次字节与结果分别保留。

- 原 [projects.json](projects.json) 保留 2026-10-24 的 **35 个项目、139 份固定源码文件**。它记录选定文件、许可证、设计取舍，不代表逐文件审计了整个生态。
- 本轮另行取得 **9 个项目、16 份选定文件**的当前默认分支 commit 与文件摘要，定向阅读相关契约/函数。见 [复核来源快照](absorption-audit.json)。其中 6 个仓库 HEAD 改变；原清单中可比较的 14 份文件只有 1 份改变，另有 2 份新补读。不能仅凭 HEAD 改变推导协议或产品能力变化。
- 另核对 A2UI、AG-UI、Vega-Lite、ECharts、React Flow 的官方文档。其余项目继续引用原固定研究，未在本轮全部重新抓取或运行。
- 下表的“已实现”限本项目所述范围；宿主、包安装、模型内容和设备验收分别看原证据。**设计采用、运行依赖、协议兼容、自然任务通过是四种不同结论。** 不据仓库数或文件数计算“吸收完成率”。

preview.15的后续 [数值来源交付](../SOURCE-NUMERIC.zh-CN.md) 已把每位置值、null mask、单位、统计范围与DataChart字段绑定，普通`--answer`实测通过/拒绝各一项，新增模型回合0。它补上一段数值来源核对，仍不完成任意正文认证、DSH数值来源或表单提交；下表保留原preview.11基线，各版本不混算。

preview.16已把上述数值约束接入 [DSH正常render/checkpoint](../NUMERIC-DELIVERY.zh-CN.md)，最终归档本机/Linux的Native/PTC各正反例与刷新通过，保留source身份/世界/任意正文未核。该后续实现单列，不改下表原preview.11基线或旧自然题结果。

其后[两个新Codex合成样本](../CODEX-NUMERIC-OBSERVATION.zh-CN.md)实证有指引模型的来源采用及有限候选语义；合法补零假设与原来源完整未知分开。首次比较失败、同回合修正、原始正文与宿主最终范围各自保留，宿主尚未保障假设答复。它没有补齐提交闭环、结果迁移或任意正文认证，也不改下表基线。

初版[显式宿主补零模式](../CODEX-ZERO-FILL.zh-CN.md)另以C/D来源零推理核验正常假设交付与不可得边界，消费已有core而不扩图表依赖；该阶段D数学零目标尚未完成，后续修复见下段。原观察及下表基线不重写。

D失败后的有限修复已通过：独立假设副本经同一core计算0，原来源观测/完整/相对观测差未知保持；原partial不覆盖，没有新自然观察或runtime依赖。该结果单列[回执](../evidence/zero-fill-all-missing.json)，不回写下表原基线。

## 从上游优点到本项目行为

| 能力与代表项目 | 本项目实际采用 | 仍缺什么 / 验证到哪里 |
|---|---|---|
| 受约束的组件词汇与可信 renderer：json-render、A2UI | **已实现，范围受限**：[catalog](../../src/catalog.ts)、[registry/renderer](../../src/island.tsx)、[能力目录](../../src/capabilities.ts) 真实使用三组件 schema；拒绝可执行字段 | 采用目录原则；未实现 A2UI wire adapter，也没有通用组件编排器 |
| 生命周期、错误与历史：DSH；AG-UI 的状态分层 | **已实现原生整值 checkpoint**：[adapter](../../src/dsh/host.ts)、[重放](../../src/dsh/events.ts)；已区分生成中、校验失败、完成和渲染失败 | 内容恢复有分版本 Native/PTC 证据；临时筛选复位，没有可恢复草稿或 AG-UI snapshot/delta adapter |
| 本地输入、提交和模型继续：GenUI、assistant-ui、Tambo、A2UI actions | **尚未实现提交闭环**：本地条件试算有效；[能力目录](../../src/capabilities.ts) 明示 `feedbackToModel:false`，catalog 的 `actions` 为空 | 缺 RequestForm、原生接收、幂等回执及下轮继续；旧 GenUI 表单实测不属于本插件能力 |
| 统计变换与绘制分开：Observable Plot、Vega-Lite、ECharts | **已实现部分**：[math](../../src/math.ts)、[chart-view](../../src/chart-view.ts) 保留 null/0/负数、真实时间距离、共同箱界和明确分母；图/表/下载共用变换 | 仅 line、category bar、等宽 histogram；没有散点、区间带、分面、跨视图联动，也不自动发明置信区间或权重 |
| 独立的可访问阅读路径：Visa Chart Components、Unovis、ECharts、React Flow | **已实现部分**：动态描述、等价表格、稳定颜色/形状/纹理、键盘选中和非拖拽定位，见 [质量说明](../QUALITY.zh-CN.md) | 360px 浏览器证据不等于真机/屏幕阅读器验收；大量控件文案仍是英文，未有完整本地化与任务级读屏验证 |
| 图布局与业务关系分开：React Flow、Dagre；ELK/G6/Cytoscape 候选 | **已实现平面图范围**：[ArchitectureExplorer](../../src/components/ArchitectureExplorer.tsx) 保留方向、回路、平行边、自环及关系表 | 嵌套/端口、密集网络分析和大图可读性未实现或未验证；不以布局函数跑通代表图可读 |
| 模板、主题和显式版本：两类 GenUI；设计 token 原则 | **已实现受限个人模板**：[templates](../../src/templates.ts)、[owner storage](../../src/dsh/library.ts)；版本、还原、导入导出、新数据字段合同、历史外观快照 | 不是完整结果产物：模板不携带旧数据、规则或结论；没有保存筛选视图、跨设备同步、通用设计中心或 DTCG 格式兼容 |
| 带状态产物、资源清单和迁移：两类 GenUI；MCP Apps 边界 | **候选**：现在能下载表格 JSON、导出模板；DSH 保存对话内容 | 缺包含数据、版本和选择状态的可移植交互包，独立 HTML、离线依赖/动作降级和导入迁移均未实现；MCP 只读校验工具不等于 MCP Apps UI |
| 来源、假设、计算与解释分开 | **已实现内部一致性检查**：[角色/作用检查](../../src/decision-mapping.ts)、[core](../../src/core.ts)、[1.4 说明](../DECLARATION-CHECKS.zh-CN.md) 给出精确错误与完整映射 | `sourceFactsVerified=false`；同一模型能提交内部一致却错误的角色。缺独立来源对照和自由正文一致性验收，原六题仍失败 |
| 流式局部更新：json-render、OpenUI、AG-UI | **仅研究，暂保留原子交付**：当前等待完整校验后的 checkpoint，不把半成品数值当完成结果 | 不是没有生成/错误状态，而是没有增量 spec/patch 协议；需要测出等待体验问题，再引入保留最后有效版本的机制 |
| 任意生成应用、地图、3D、外部执行：应用型 GenUI、deck.gl、Three.js | **明确暂缓** | 本项目原任务只要求三类语义表达；需要真实任务、宿主与权限合同后再决定，不以补齐所有上游功能为目标 |

实现和测试入口在仓库可查。最新发布身份、实际归档安装与Linux证据见 [preview.12](../evidence/preview12.json)；本表原preview.11基线保留；更早的完整图表/模板/GenUI 共存矩阵保留原版本，不能外推成全部在 preview.11 重跑通过。

## 本轮进一步吸收的设计判断

**1. 表单采集实际控件值，将本地变化与正式提交分开。** [A2UI actions](https://github.com/a2ui-project/a2ui/blob/409ded29ccac3eebc541979ae5320771703248e8/docs/public/concepts/actions.md) 区分 renderer 本地函数和发给 agent 的事件，也区分界面校验与服务端完整性检查。这些原则不等于协议兼容。官方入口仍把 1.0 标为 candidate，不能把它的 `actionResponse` 当本项目既有稳定接口。[A2UI 版本状态](https://a2ui.org/)。

[assistant-ui 值采集](https://github.com/assistant-ui/assistant-ui/blob/7beac6fc271435b8c60e842a8e5ba327725d25e2/packages/generative-ui/src/vocabulary/collectFormValues.ts) 分别处理复选布尔、单选未选择、分组数组和禁用字段；[action registry](https://github.com/assistant-ui/assistant-ui/blob/7beac6fc271435b8c60e842a8e5ba327725d25e2/packages/generative-ui/src/actionRegistry.ts) 的交互日志是 best effort，未注册动作可能无操作，handler 返回也不必然让 agent 继续。因此未来必须另定义 accepted/rejected 持久化回执，不能把 dispatch 或 Promise 完成直接显示为“已保存/已提交给模型”。这是本项目的采用决定，不是上游完整运行认证。

**2. 状态区分草稿、发送中、已接受和失败。** [Tambo hook](https://github.com/tambo-ai/tambo/blob/6e2c1bff3b68a00c094b6d876788cc8f33f7bb02/react-sdk/src/v1/hooks/use-tambo-v1-component-state.ts) 分开本地值、服务端值、pending/error 及请求序号；[AG-UI](https://docs.ag-ui.com/concepts/state) 分开全量快照与增量。吸收状态所有权和可观察失败，继续使用 DSH 自有会话记录；不会为一个 hook 引入整套 agent 后端，也不在每次敲字时自动向模型发消息。提交合同沿 [ADOPTION](ADOPTION.zh-CN.md)。

**3. “能导出”必须说明带走了什么。** 白名单 GenUI 的 [portability scanner](https://github.com/omdsh-dev/dsh-genui/blob/bcde2e31131836dbee264ea533ef18de8a311bb5/src/client/artifact/portability.ts) 枚举资源、自定义组件、外部媒体及模型动作；应用型 GenUI 的 [artifact types](https://github.com/pengyue-polaron/deepseek-harness-genui/blob/d24d91e3b6462aae498fa8452abcb44e3c53e9d5/src/artifacts/types.ts) 分开候选、可用、失败版本和构建/浏览器证据；[权限函数](https://github.com/pengyue-polaron/deepseek-harness-genui/blob/d24d91e3b6462aae498fa8452abcb44e3c53e9d5/src/runtime/permissions.ts) 另处理能力指纹与到期。我们的模板导出没有这些完整结果能力。未来离线查看要列出资源闭包，模型动作不可用时明确降级。本轮没有运行两类 GenUI 的新源码快照，也没有升级冻结的共存验收结论。

**4. 可访问性包含任务解释和语言。** [Visa 的描述实现](https://github.com/visa/visa-chart-components/blob/8b657d1ccc3f0799eccdba31c5f669e402d4133c/packages/utils/src/utils/accessibilityDescriptions.ts) 分开用途、上下文、统计、轴、结构和注释，并传入语言；我们的表格和动态说明是起点。下一步检查真实阅读任务的焦点顺序、状态播报和中英文控件。[ECharts](https://echarts.apache.org/handbook/en/best-practices/aria/) 要求显式注册模块；[React Flow](https://reactflow.dev/learn/advanced-use/accessibility) 的键盘与标签 API 不能替代人工读屏验收。

**5. 新图种先补分析合同。** [Plot bin](https://observablehq.github.io/plot/transforms/bin) 区分连续量分箱和类别分组；[Vega-Lite parameters](https://vega.github.io/vega-lite/docs/parameter.html) 把选择作为查询、过滤或编码输入。未来散点、区间和分面应先定义来源、单位、缺失/配对样本、统计方法与选择范围，再接 renderer。是否增加引擎要看实际缺口与维护成本。直接接收完整 Vega/JS/ECharts 配置会越过当前白名单合同，不采用。

以上采用设计原则和独立的实施要求，没有复制上游实现或新增运行依赖。原许可证记录仍以各自固定快照为准；本轮定向刷新不是新的完整许可或安全审计。

## 下一轮的顺序与验收

| 优先级 | 可交付结果 | 完成条件 |
|---|---|---|
| P0 来源与正文一致性 | 输入证据、结构化声明和输出逐项可对照；限制无依据结论 | 保留首次失败；来源反向、缺条件、额外因果或统计说法可被发现；内部一致不能当来源正确；后续自然题另留真实结果 |
| P1 缺失条件闭环 | 收集少量有界输入，经宿主接受后继续 | 用 `(session, turn, displayId, revision, actionId, submissionId)` 校验和去重；验证重复点击、旧版本、取消、失败、刷新、重启、只读历史及 Native/PTC；草稿和已接受记录分别可辨 |
| P2 结果复用与可迁移 | 在模板之外保存一个可继续查看的结果版本 | 明确数据/规则/外观/选择快照与导出范围；资源可检查、离线可读，版本不支持明确报错；不自动公开私人内容 |
| P2 无障碍与语言 | 中英文操作路径和真实读屏/设备验收 | 键盘、等价表格、焦点和播报可完成同一任务；仍区分窄屏浏览器与真机证据 |
| P3 有需求的统计和布局扩展 | 一次补一种能完成真实任务的表达 | 定义数据/统计合同和反例，证明现有表达不足，再决定沿现有引擎扩展或增加依赖 |

P0 与 P1 都有价值；先避免把错误结论固化进新的交互流程。这些是后续工作，不是本轮已实现功能。原 run9 仍为 **0 通过 / 6 失败 / 18 请求**；本轮新增模型请求为 0。详见 [自然问题边界](../DECLARATION-CHECKS.zh-CN.md)、[原记录索引](../natural-question-results.json)。

## 如何判定一项优点已经吸收

每项应指向：上游具体设计 → 本项目选择与边界 → 实际代码 → 针对反例的验证 → 可完成的用户任务。只有研究或路线建议的项继续标为候选；明确不需要的能力保留取舍理由。是否继续扩大，以可核对的任务收益与复用为准，沿 [产品价值判断](MODEL-PROGRESS.zh-CN.md) 检验。
