# DSH Semantic UI

[English](README.en.md) · [安装](docs/INSTALL.zh-CN.md) · [语言设置](docs/LANGUAGE.zh-CN.md) · [本版验证](https://github.com/WhyTan00/dsh-semantic-ui/blob/main/docs/evidence/scenarios.json)

**默认简体中文，支持可记忆的「简体中文 / English」切换。** 每个组件顶部都有固定双语入口「界面语言 / Language」，同页同步切换，刷新后保留选择。图表、决策面板、架构图、模板主题与状态提示共用同一语言设置；你提供的来源和数据保持原样。

[独立离线伴随包31.2](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/codex-v0.1.0-preview.31.2)新增[完整答复交付门](docs/ANSWER-DELIVERY.zh-CN.md)：结构匹配或一条正确断言都不批准全文；原文完整保留未核，只输出当前有限来源的程序说明或明确拒绝。现有[正常文件入口](docs/CODEX-LOCAL-ENTRY.zh-CN.md)支持完整候选、摘要绑定和有据输出，编译后无需MCP连接；原DSH/客户端与模型观察保持各自边界。

新增[可复用任务表单](docs/TASK-FORM.zh-CN.md)：补充布尔/数值/枚举/文字条件，预览后明确确认并另存，重开后继续成新修订；模板、主题与答案分开。[task.3 预发布](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/client-v0.1.0-preview.31-task.3)提供单文件离线HTML与文件命令入口，可独立使用，无须更改当前DSH页。当前个人页未安装/热更新，本轮未做浏览器或DSH显示验收。

**[打开个人DSH交互视图（本机3200）](http://127.0.0.1:3200/)** · [免命令操作指南](docs/INTERACTIVE-ENTRY.zh-CN.md) · [项目技能](.agents/skills/semantic-ui-view/SKILL.md)

在已有语义消息中展开“保存与携带完整结果”，选择自己的结果JSON，就能用中文修改本地条件、查看差异和unknown、保存并重开。这里打开真实个人DSH页面；Codex原生内嵌和自然技能选择仍未验。其他环境请使用自己的DSH地址。

DSH保留严格的浏览器认证。从外部链接进入若看到认证提示，已在本机登录时请选中地址栏并回车，直接打开同一个无token地址；尚未登录请沿用已有DSH认证入口。不要公开分享含token的启动地址。

preview.30修正打开历史结果意外覆盖语言偏好的问题，并新增[中文批量条件表单](docs/LOCAL-CONDITIONS.zh-CN.md)：逐项校验、预览差异后应用、本地草稿保存重开和携带。新结果使用格式2，继续读取preview.28的格式1。

preview.31新增[双方案本地假设对照](docs/WHAT-IF.zh-CN.md)：保留只读A，在B编辑条件，同一核心并排核对结果和未知项，保存后重开或携带到其他兼容环境继续。

客户端增量 [`preview.31-prose.1`](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/client-v0.1.0-preview.31-prose.1) 新增[中文说明正文核对](docs/PROSE-REVIEW.zh-CN.md)：直接输入来源与候选说明，定位有限断言的矛盾和依据不足，生成有据说明；改来源即清除旧结论，载入旧核对记录会重新计算。仍不认证任意自由正文。

[`preview.31-prose.2`](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/client-v0.1.0-preview.31-prose.2) 进一步接通[工作流条件与故障动作范围](docs/PROSE-WORKFLOW.zh-CN.md)：能区分局部重试和整流程重试、分支内不回滚和全局保证，处理跨句条件、否定与动作对象。未识别的新条件撤销旧分支；原A2正确规则与额外执行／反向传播断言分别核对，不把旧自然题改判通过。

[`preview.31-prose.3`](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/client-v0.1.0-preview.31-prose.3) 新增[容量正文的时间与确定性](docs/PROSE-CAPACITY.zh-CN.md)：当前需求、未来可能点、已拥有量／预留承诺和整体推荐分开核对，来源更新会改变当前结论并保留独立未来假设。未来可能需求不能变成未来已有容量，需求情景也不能变成已确定阶段。正常面板接受与自然模型观察分别记录。

客户端增量 [`preview.31-data.1`](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/client-v0.1.0-preview.31-data.1) 增加[本地CSV换数据与双图联动](docs/DATA-EXPLORATION.zh-CN.md)：明确列/单位并预览后应用，点选、分布区间、表格、统计与下载共用同一行选择；保存后可刷新重开，第二份数据沿用外观并清除旧选择与结论。新探索使用浏览器保存的格式4，旧结果保留原profile路径；整个流程不调用模型。

main 源码新增[正常工具的同源核对](docs/HOST-SOURCE.zh-CN.md#普通check与正文草稿)：`check` 与 `render` 共用当前来源绑定，三种核对/交付动作可复用已有正文引擎核对可选草稿。此宿主增强尚未包含在上述冻结发行中；后续已沿现有个人实例的正常单插件管理入口应用，回执为 applied，配置和既有客户端保留。新工具执行到持久视图的消费者验证仍未完成，不能把管理回执当作整条链路通过。

[六题当前状态与可保存的有据结果](docs/SIX-QUESTION-STATUS.zh-CN.md)逐题区分已实现的有限来源修复和仍未通过的模型自由正文；提供既有正常checkpoint的结果包，在现有DSH选择文件即可读来源说明、改本地条件、保存重开。原六题自然结果仍为0通过/6失败/18请求。

独立Codex伴随包新增[完整结果显式互通](docs/CODEX-RESULTS.zh-CN.md)：零新增模型地读取保存结果，核对来源与A/B假设，原合同文件可交回DSH继续使用。

本仓库也有[直接本地读取命令](docs/CODEX-LOCAL-ENTRY.zh-CN.md)，不建立MCP连接。在当前个人项目目录中可直接运行：

```sh
node --import tsx scripts/result-local.ts --result-file docs/evidence/scenarios/examples/pair.json
```

输出中文说明、原结果和结构化A/B/unknown；缺独立来源会明确标为未核。固定来源核对、只看中文说明和携带原合同的用法见上述指南。需要已有Node24+及仓库开发依赖，不全局安装。

DSH Semantic UI 是个人开源的受约束语义界面插件。它把关系、取舍和数值整理成可交互组件，并把来源、计算结果、本地假设与模型说明分开。

| 组件 | 可以做什么 |
|---|---|
| 架构关系图 | 搜索和定位节点、查看职责与约束、情景高亮、文字关系列表 |
| 决策比较 | 对齐方案维度、调整本地条件、核对硬性需求与未知值、显式探索偏好规则 |
| 数据图表 | 折线、柱状和直方图；筛选、等价表格、下载、共同分箱、缺失与实测零的对照 |

个人模板支持主题、字体、疏密、字号与布局预览，保存版本、导入导出和使用新数据复用。模板不携带旧观测值、规则或结论。

新增[完整交互结果包](docs/RESULT-PACKAGE.zh-CN.md)：将当前数据、规则/假设、来源历史状态、主题/中文与选择一起导出，在另一兼容个人环境导入、保存并重开后继续操作。它和模板分开，不自动调用模型。

## 安装新版

下载 [0.1.0-preview.31 公开预发布](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/v0.1.0-preview.31)的运行包，核对同页 `SHA256SUMS` 后安装：

```sh
dsh plugin --profile web add /绝对路径/whytan-dsh-semantic-ui-0.1.0-preview.31.tgz
```

本项目锁定 DSH `0.2.1-rc.2` 与 json-render `0.21.1`，组件协议为1.4。完整配置、兼容范围与历史版本见[安装说明](docs/INSTALL.zh-CN.md)。当前共享工作台不会因源码更新而自动升级，请按自己的运行环境安装新包。

也提供[独立Codex本地插件包27.1](docs/CODEX-PLUGIN-PACKAGE.zh-CN.md)，将技能与只读MCP一起安装；macOS/Linux包与公开下载已核对。它复用相同核对核心，图形展示仍由宿主提供，当前Codex会话没有自动安装。

## 沿用的preview.26语言验证

- 默认中文；四类视图同页同步切换，中英文刷新记忆，切换不重置本地筛选、不请求模型。
- 类型检查及245项单元检查通过。388文件最终归档正常隔离安装，未用语义插件源码覆盖。
- macOS/Linux分别验证 Native/PTC，每组四类视图，360px容器无根溢出，页面错误为0。[CI](https://github.com/WhyTan00/dsh-semantic-ui/actions/runs/40515658647)与[分层回执](docs/evidence/language.json)可查。

浏览器禁止本地存储时，本页仍可切换，但无法保证刷新记忆。语言功能不自动翻译用户来源、节点名称、单位或模型正文。窄屏容器测试不等于真机或完整读屏验收。

preview.27另修复[全缺失范围中的补零假设](docs/ZERO-FILL-CHART.zh-CN.md)：独立假设可算0，原始观测与真实完整统计仍未知。最终安装、定向宿主和发行接受见[本版回执](docs/evidence/zero-fill-chart.json)。

## 与 GenUI 及其他开源项目的关系

项目借鉴 json-render、A2UI、AG-UI、Tambo、assistant-ui、Vega-Lite、Observable Plot、ECharts、React Flow 等的受约束渲染、状态分层、统计范围和可访问性设计，并保留固定公开来源及许可证记录。研究覆盖35项目、139份固定文件；研究覆盖不等于功能采用完成率，具体实现与缺口见[采用复核](docs/research/ABSORPTION-AUDIT.zh-CN.md)。

本插件可与 GenUI 分工使用，不能完整替代通用应用生成、任意表单提交和复杂统计图。两类 GenUI 的对照与分版本证据见[兼容边界](docs/GENUI.zh-CN.md)。

## 语义边界

有界来源可以核对逐项读数、缺失mask、单位、条件或明确关系，再交付有限来源说明。字段匹配和程序计算不认证来源身份、世界事实或任意模型正文；本地试算也不补齐缺失事实。

preview.25的[I/J两个新引导观察](docs/CODEX-NUMERIC-BASELINE-OBSERVATION.zh-CN.md)各自保留模型原文、实际工具调用和宿主最终说明。它们不改写原六题0通过/6失败/18请求，也不外推为preview.26的新模型验收。本版语言改动新增模型回合为0。

## 开发与资料

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

- [中文产品介绍](docs/OVERVIEW.zh-CN.md)
- [协议](docs/PROTOCOL.md)与[语义校验](docs/SEMANTICS.zh-CN.md)
- [个人模板](docs/TEMPLATES.zh-CN.md)与[语言实现](docs/LANGUAGE.zh-CN.md)
- [Codex 只读伴随入口](docs/CODEX.zh-CN.md)
- [可选本地Codex插件包与安装](docs/CODEX-PLUGIN-PACKAGE.zh-CN.md)
- [零模型启动：在真实DSH中交互查看已保存模型结果](docs/SAVED-MODEL-HOST-REPLAY.zh-CN.md)
- [原始六题与自己的来源文件：正常DSH中的交互参考](docs/ORIGINAL-CASE-REFERENCE.zh-CN.md)
- [实际进度](docs/PROGRESS.zh-CN.md)、[成熟度](docs/MATURITY.zh-CN.md)与[验证](docs/VALIDATION.zh-CN.md)
- [第三方说明](THIRD_PARTY_NOTICES.md)与 [MIT 许可证](LICENSE)
