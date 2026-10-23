# 开源项目选型表

本文件由 projects.json 派生；执行 `pnpm research:generate` 更新、`pnpm research:check` 核对。人工结论见 [研究说明](README.md) 与 [采用记录](ADOPTION.zh-CN.md)。

核实日期：2026-10-24。35 个公开仓库，139 份固定源码文件。版本列来自 pinned HEAD 的 manifest，含 canary/private 根包，**不是最新稳定发行查询**。文档/源码研究不等于运行、性能或设备验收。

## ui-runtime

| 项目 / 固定源码 | 观察版本 | 许可证 | 取其所长 | 采用决定与边界 |
|---|---|---|---|---|---|
| [vercel-labs/json-render](https://github.com/vercel-labs/json-render/tree/f78cc14f34c138d39a350b5e0991b8adf8b167ab) | @json-render/core 0.21.1 | [Apache-2.0](https://github.com/vercel-labs/json-render/blob/f78cc14f34c138d39a350b5e0991b8adf8b167ab/LICENSE) | catalog/schema/renderer 同源，允许组件目录与动作白名单。 | **保留已有引擎**：保留 0.21.1；默认 JSONL 生成提示不适合本项目的唯一工具交付。 |
| [assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui/tree/c015c32a08c0cd01b9f436b2759e3d4ada69a9e5) | diagrammatic 0.0.4 (private)<br>generative-frame 0.0.8<br>@assistant-ui/generative-ui 0.0.7 | [MIT](https://github.com/assistant-ui/assistant-ui/blob/c015c32a08c0cd01b9f436b2759e3d4ada69a9e5/LICENSE) | 当前 toolkit/present 将工具执行、组件词汇与动作处理分开；表单收集读取真实命名控件值。 | **采用设计**：仅吸收分层/动作契约。chartData 的缺失点补零与本项目语义冲突，拒绝照搬；0.0.x 新包不直接当稳定底座。 |
| [thesysdev/openui](https://github.com/thesysdev/openui/tree/c9f93b6e57d05b19b9781846769da530c6741dc4) | @openuidev/lang-core 1.0.1<br>@openuidev/react-ui 0.18.1 | [MIT](https://github.com/thesysdev/openui/blob/c9f93b6e57d05b19b9781846769da530c6741dc4/LICENSE) | 紧凑 DSL、流式解析、状态绑定和组件子路径拆分；当前图表实现使用 D3 模块。 | **采用设计**：吸收按能力拆分，保留整值 checkpoint；厂商 token/延迟对比未在本项目复现，不因营销数字换协议。 |
| [tambo-ai/tambo](https://github.com/tambo-ai/tambo/tree/6e2c1bff3b68a00c094b6d876788cc8f33f7bb02) | @tambo-ai/react 1.4.0 | [MIT](https://github.com/tambo-ai/tambo/blob/6e2c1bff3b68a00c094b6d876788cc8f33f7bb02/LICENSE) | 区分生成组件与可持续编辑组件；状态同步有 pending/error/debounce。 | **参考**：完整方案包含自己的会话/agent 后端。只借鉴状态所有权和错误契约，不替换 DSH 模型/会话库。 |
| [CopilotKit/CopilotKit](https://github.com/CopilotKit/CopilotKit/tree/6d9264274b9952e1a89ed01d1ef3507c72f67aab) | 以固定源码为准 | [MIT](https://github.com/CopilotKit/CopilotKit/blob/6d9264274b9952e1a89ed01d1ef3507c72f67aab/LICENSE) | 生成 UI、共享状态和人参与流程有完整应用层组合。 | **参考**：开源 SDK 与托管 Intelligence 功能分别核对；本项目已有 DSH host，不整套换聊天/状态层。 |

## ui-protocol

| 项目 / 固定源码 | 观察版本 | 许可证 | 取其所长 | 采用决定与边界 |
|---|---|---|---|---|---|
| [a2ui-project/a2ui](https://github.com/a2ui-project/a2ui/tree/020a9d6f694761ad16b35bc38945e4ccd0ac14e8) | @a2ui/catalog-vegachart 0.1.0 | [Apache-2.0](https://github.com/a2ui-project/a2ui/blob/020a9d6f694761ad16b35bc38945e4ccd0ac14e8/LICENSE) | 客户端先声明 catalog；模型只能使用当前客户端认可的组件。 | **采用设计**：吸收能力声明，暂不实现其 surface/data-binding 消息转换；当前 0.9.1 与 1.0 candidate 不能混用。 |

## interaction-protocol

| 项目 / 固定源码 | 观察版本 | 许可证 | 取其所长 | 采用决定与边界 |
|---|---|---|---|---|---|
| [ag-ui-protocol/ag-ui](https://github.com/ag-ui-protocol/ag-ui/tree/ec24165f725a5b01ecddb1f62df305855a7917c8) | 以固定源码为准 | [MIT](https://github.com/ag-ui-protocol/ag-ui/blob/ec24165f725a5b01ecddb1f62df305855a7917c8/LICENSE) | 能力发现、状态 snapshot/delta 与工具生命周期分层。 | **采用设计**：吸收显式能力和有界结果；保留 DSH 自有事件，不平行引入第二套会话状态流。 |

## component-kit

| 项目 / 固定源码 | 观察版本 | 许可证 | 取其所长 | 采用决定与边界 |
|---|---|---|---|---|---|
| [assistant-ui/tool-ui](https://github.com/assistant-ui/tool-ui/tree/49a870286facdbf28160cd647f0d337ebdc9b275) **archived** | tool-ui-www 0.2.0 (private) | [MIT](https://github.com/assistant-ui/tool-ui/blob/49a870286facdbf28160cd647f0d337ebdc9b275/LICENSE.md) | Zod 校验、工具专属组件和用户选择收据的设计便于理解。 | **参考**：仓库已归档。旧示例 Recharts 2.15.4 不代表当前 assistant-ui 依赖；不作为新增运行时。 |
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui/tree/3d98900e9b73c45f035f8109e9d41ba6a51685e7) | 以固定源码为准 | [MIT](https://github.com/shadcn-ui/ui/blob/3d98900e9b73c45f035f8109e9d41ba6a51685e7/LICENSE.md) | 组件源码归应用维护，可只采用所需交互原语和主题 token。 | **候选**：需要承担复制后维护和可访问性验证；本项目不为获得一个控件装整套样式体系。 |

## app-protocol

| 项目 / 固定源码 | 观察版本 | 许可证 | 取其所长 | 采用决定与边界 |
|---|---|---|---|---|---|
| [modelcontextprotocol/ext-apps](https://github.com/modelcontextprotocol/ext-apps/tree/82221c0c8ce7661efa6771c9d461511b1650495f) | @modelcontextprotocol/ext-apps 2.0.3 | [mixed Apache-2.0 / legacy MIT transition; non-spec documentation CC-BY-4.0](https://github.com/modelcontextprotocol/ext-apps/blob/82221c0c8ce7661efa6771c9d461511b1650495f/LICENSE) | UI resource、host bridge、能力协商、CSP 与 sandbox 为较开放应用提供清楚边界。 | **候选**：DSH 未验收此适配器。LICENSE 正在 Apache-2.0/历史 MIT 转换，普通文档 CC-BY-4.0；不能只看 package.json 的 MIT。 |

## dsh-plugin

| 项目 / 固定源码 | 观察版本 | 许可证 | 取其所长 | 采用决定与边界 |
|---|---|---|---|---|---|
| [omdsh-dev/dsh-genui](https://github.com/omdsh-dev/dsh-genui/tree/ad8dc166deaf4eee7dea758fc0a84a8728402b52) | @changfenhuang/dsh-genui 0.14.0 | [MIT](https://github.com/omdsh-dev/dsh-genui/blob/ad8dc166deaf4eee7dea758fc0a84a8728402b52/LICENSE) | 白名单组件、动作回传、有界本地状态与带状态的产物格式；已有 DSH 集成。 | **已有互通证据**：已实测的是冻结 npm 0.14.0；本次 main commit 是另一个源码快照。renderUiTool=false 仍保留其它生成指引；ECharts option 直通不移植。 |
| [pengyue-polaron/deepseek-harness-genui](https://github.com/pengyue-polaron/deepseek-harness-genui/tree/f6289bc709c5b1992c851bf5e63237a5fa453e1f) | dsh-plugin-genui 0.15.1 | [MIT](https://github.com/pengyue-polaron/deepseek-harness-genui/blob/f6289bc709c5b1992c851bf5e63237a5fa453e1f/LICENSE) | 任务型 React 应用、后续回合可读状态，以及候选/可用版本和显式能力授权。 | **参考**：manifest 声明 DSH 0.1.x 范围，不覆盖本项目 0.2.1-rc.2；不因功能更广就推荐直接安装。 |

## form-engine

| 项目 / 固定源码 | 观察版本 | 许可证 | 取其所长 | 采用决定与边界 |
|---|---|---|---|---|---|
| [rjsf-team/react-jsonschema-form](https://github.com/rjsf-team/react-jsonschema-form/tree/14cab6f31d09d85b6ec6a4cbe030044c403576fc) | @rjsf/core 6.11.0 | [Apache-2.0](https://github.com/rjsf-team/react-jsonschema-form/blob/14cab6f31d09d85b6ec6a4cbe030044c403576fc/LICENSE.md) | JSON Schema 与界面配置/validator 分离，跨主题的受控表单。 | **候选**：完整 schema/validator/自定义 widget 范围较大；先限制字段与规则目录，再设计 DSH 提交收据。 |
| [surveyjs/survey-library](https://github.com/surveyjs/survey-library/tree/3a28913a07b4aa1bed8db14ed0519688d3f8f97b) | 以固定源码为准 | [MIT](https://github.com/surveyjs/survey-library/blob/3a28913a07b4aa1bed8db14ed0519688d3f8f97b/LICENSE) | JSON 表单、多步骤、条件可见性和测验适合信息收集。 | **候选**：Form Library 为 MIT；Creator、Dashboard、PDF 属不同商业产品。复杂表达式/文件上传不直接进入模型可写目录。 |

## chart-engine

| 项目 / 固定源码 | 观察版本 | 许可证 | 取其所长 | 采用决定与边界 |
|---|---|---|---|---|---|
| [apache/echarts](https://github.com/apache/echarts/tree/34f4d927eafe251f26f63afd3aeefa30f2feba30) | echarts 6.1.0 | [Apache-2.0](https://github.com/apache/echarts/blob/34f4d927eafe251f26f63afd3aeefa30f2feba30/LICENSE) | 模块化 SVG/Canvas、系列/坐标轴交互丰富，当前引擎已稳定接入。 | **保留已有引擎**：继续用受限语义载荷编译配置；本轮补注册 AriaComponent 并让可访问描述随选择更新。 |
| [recharts/recharts](https://github.com/recharts/recharts/tree/acbf510580468fd2ce4fe15f49aef51894346f88) | recharts 3.11.0-canary.6 | [MIT](https://github.com/recharts/recharts/blob/acbf510580468fd2ce4fe15f49aef51894346f88/LICENSE) | React 声明式组件组合，SVG 易于随应用主题定制。 | **候选**：与现有 ECharts 重叠，不双装同类引擎；默认分支 manifest 为 canary，不等同稳定 npm 发行。 |
| [plouc/nivo](https://github.com/plouc/nivo/tree/0dae2c32052a573f9f1d66ec1b453b572119b265) | @nivo/core 0.99.0 | [MIT](https://github.com/plouc/nivo/blob/0dae2c32052a573f9f1d66ec1b453b572119b265/LICENSE.md) | 丰富预制 React 图形，SVG/Canvas 与主题能力方便应用使用。 | **候选**：图种数量不证明数据含义，需逐图验证；当前无必要叠加完整组件体系。 |
| [chartjs/Chart.js](https://github.com/chartjs/Chart.js/tree/76d8cf895a7485dc838c90ef37e2bc9d9e388fcb) | chart.js 4.6.1 | [MIT](https://github.com/chartjs/Chart.js/blob/76d8cf895a7485dc838c90ef37e2bc9d9e388fcb/LICENSE.md) | Canvas 图表与插件体系适合普通仪表盘。 | **候选**：Canvas 可访问性需应用补等价文本/源表；不能以 renderer 切换代替统计口径验证。 |
| [leeoniya/uPlot](https://github.com/leeoniya/uPlot/tree/7807ebb3e20a4f327628ca5413043e61934d101e) | uplot 1.6.32 | [MIT](https://github.com/leeoniya/uPlot/blob/7807ebb3e20a4f327628ca5413043e61934d101e/LICENSE) | 面向稠密时间序列，明确 aligned x/null 数据格式与 cursor/zoom。 | **候选**：适合作为将来大时序专用 renderer；厂商性能数字未复测，当前 2000 行不构成迁移动机。 |
| [plotly/plotly.js](https://github.com/plotly/plotly.js/tree/96c9eb33d55f4b3ef7ec177adfcc2f542904bfb2) | plotly.js 4.1.2 | [MIT](https://github.com/plotly/plotly.js/blob/96c9eb33d55f4b3ef7ec177adfcc2f542904bfb2/LICENSE) | 科学、统计、金融与 3D trace 覆盖较广。 | **候选**：专用复杂图候选，需要按 trace 拆包、WebGL 上下文预算和方法语义验证；不整包替换当前通用图表。 |
| [f5/unovis](https://github.com/f5/unovis/tree/616df8273c02b794deb12ab9b2e748f64099b32e) | @unovis/ts 1.7.1 | [Apache-2.0](https://github.com/f5/unovis/blob/616df8273c02b794deb12ab9b2e748f64099b32e/LICENSE) | 系列身份与配色一致；用纹理和线型补充颜色，支持主题与可访问表达。 | **采用设计**：采用稳定系列编码与填充纹理思路，继续使用 ECharts；不增加它的多框架与地图依赖。 |
| [visa/visa-chart-components](https://github.com/visa/visa-chart-components/tree/8b657d1ccc3f0799eccdba31c5f669e402d4133c) | @visa/visa-charts-data-table 3.0.2 | [MIT](https://github.com/visa/visa-chart-components/blob/8b657d1ccc3f0799eccdba31c5f669e402d4133c/LICENSE) | 同源图表与数据表、明确可访问说明和键盘路径。 | **采用设计**：采用图表/说明/表格/导出同源及明确 scope；不宣称实现其完整辅助技术能力。 |

## chart-grammar

| 项目 / 固定源码 | 观察版本 | 许可证 | 取其所长 | 采用决定与边界 |
|---|---|---|---|---|---|
| [vega/vega-lite](https://github.com/vega/vega-lite/tree/85fab8d12c873b3b224ef9a33c807642953325ba) | vega-lite 6.5.0 | [BSD-3-Clause](https://github.com/vega/vega-lite/blob/85fab8d12c873b3b224ef9a33c807642953325ba/LICENSE) | mark/encoding/transform/parameter 把图形和交互组合为声明式语法。 | **候选**：未来复杂统计/关联视图候选。原始 spec 有 URL 与表达式能力，不能作为当前模型 option 直通；需自己的安全子集和统计方法。 |
| [observablehq/plot](https://github.com/observablehq/plot/tree/535723d5e433727720d9b673c31622821bb03210) | @observablehq/plot 0.6.17 | [ISC](https://github.com/observablehq/plot/blob/535723d5e433727720d9b673c31622821bb03210/LICENSE) | 探索性统计图与 bin/group/window 等变换清楚分层。 | **采用设计**：吸收空箱/缺失和口径检查；不把含函数的 Plot/JS option 交给模型执行，也不自动补全分位数方法。 |
| [TanStack/charts](https://github.com/TanStack/charts/tree/778f2cc6ca174256ba9d9f6cf603af94bb70db8b) | tanstack-charts (private) | [MIT](https://github.com/TanStack/charts/blob/778f2cc6ca174256ba9d9f6cf603af94bb70db8b/LICENSE) | typed grammar、scene/renderer 分离、按子路径加载和可访问交互契约。 | **候选**：README 指明 main 未发布并指向 v1.1.0；renderer 支持不完全相同，不把原生端静态检查当设备验收。 |
| [antvis/G2](https://github.com/antvis/G2/tree/94526ab37787d5aee552042bc7708bdb447ace67) | @antv/g2 5.4.8 | [MIT](https://github.com/antvis/G2/blob/94526ab37787d5aee552042bc7708bdb447ace67/LICENSE) | 声明式图形语法与 AntV G 多 renderer/交互生态。 | **候选**：复杂语法要由可信编译器生成，不接收任意回调；已有 ECharts 时先证明特定需求。 |

## visualization-primitives

| 项目 / 固定源码 | 观察版本 | 许可证 | 取其所长 | 采用决定与边界 |
|---|---|---|---|---|---|
| [d3/d3](https://github.com/d3/d3/tree/3d1a90c30805c17b79eb24c13c5aa45454534850) | d3 7.9.0 | [ISC](https://github.com/d3/d3/blob/3d1a90c30805c17b79eb24c13c5aa45454534850/LICENSE) | 比例尺、形状、层次/地理/交互原语可分别组合。 | **参考**：自由度高，布局、可访问性和生命周期由应用承担；不是开箱即用的 Agent UI 协议。 |
| [airbnb/visx](https://github.com/airbnb/visx/tree/485c0359664ee8e612992defb16e1f035ed40b23) | @visx/root 0.0.0 (private) | [MIT](https://github.com/airbnb/visx/blob/485c0359664ee8e612992defb16e1f035ed40b23/LICENSE) | React+D3 的低层组件可制作产品特有图形。 | **候选**：构建完整坐标轴/控件/无障碍需要自己维护；root 私有包 0.0.0 不是组件发行版本。 |

## graph-ui

| 项目 / 固定源码 | 观察版本 | 许可证 | 取其所长 | 采用决定与边界 |
|---|---|---|---|---|---|
| [xyflow/xyflow](https://github.com/xyflow/xyflow/tree/8523d8dd9f1551954bc221dccabd6a3119ef9e22) | @xyflow/react 12.12.0 | [MIT](https://github.com/xyflow/xyflow/blob/8523d8dd9f1551954bc221dccabd6a3119ef9e22/LICENSE) | 节点界面、视口/选择/定位与自定义 React 节点成熟易组合。 | **保留已有引擎**：它是交互层，不是自动布局/事实推理。保留用户给定方向和边，Pro 模板与 MIT 核心区分。 |
| [antvis/G6](https://github.com/antvis/G6/tree/55a74698a9b432df993daae744c4c5526ab097b0) | @antv/g6 5.1.1 | [MIT](https://github.com/antvis/G6/blob/55a74698a9b432df993daae744c4c5526ab097b0/LICENSE) | 关系图布局、交互行为、combo 与渲染器生态较广。 | **候选**：复杂关系网候选；不与 React Flow 重复装载，不把图算法输出冒充用户事实。 |
| [cytoscape/cytoscape.js](https://github.com/cytoscape/cytoscape.js/tree/9aab1b4489645c15e82fce71fdce738f58d8165d) | cytoscape 3.35.0-unstable | [MIT](https://github.com/cytoscape/cytoscape.js/blob/9aab1b4489645c15e82fce71fdce738f58d8165d/LICENSE) | 图论分析与关系网络显示结合，适合分析型网络任务。 | **候选**：默认 unstable 分支的 manifest 不能作为生产版本；与流程节点 UI 的侧重点不同。 |

## graph-layout

| 项目 / 固定源码 | 观察版本 | 许可证 | 取其所长 | 采用决定与边界 |
|---|---|---|---|---|---|
| [dagrejs/dagre](https://github.com/dagrejs/dagre/tree/32e7f30f97f029fbfc89ce50e072d4fc16145838) | @dagrejs/dagre 3.1.2-pre | [MIT](https://github.com/dagrejs/dagre/blob/32e7f30f97f029fbfc89ce50e072d4fc16145838/LICENSE) | 方向性节点边图的初始分层布局，适合当前平面关系图。 | **保留已有引擎**：保留冻结 3.1.1；main 的 3.1.2-pre 不作为升级理由；不承诺复杂嵌套分组。 |
| [kieler/elkjs](https://github.com/kieler/elkjs/tree/95f18bf65e59b6a8973aece313ddfb04ca9a1bb1) | elkjs 0.13.0 | [EPL-2.0](https://github.com/kieler/elkjs/blob/95f18bf65e59b6a8973aece313ddfb04ca9a1bb1/LICENSE.md) | 层次布局、端口与复杂节点连接适合更复杂工程图。 | **候选**：仅布局引擎。EPL-2.0 文件与 manifest 的 EPL/GPL 选项应按实际发行核对；当前没有移植或再许可。 |

## 3d-engine

| 项目 / 固定源码 | 观察版本 | 许可证 | 取其所长 | 采用决定与边界 |
|---|---|---|---|---|---|
| [mrdoob/three.js](https://github.com/mrdoob/three.js/tree/ee6a50ecf766fd9010951ab384120db9dd13b902) | three 0.186.0 | [MIT](https://github.com/mrdoob/three.js/blob/ee6a50ecf766fd9010951ab384120db9dd13b902/LICENSE) | 通用 3D 场景和 WebGL/WebGPU renderer。 | **暂缓**：只有真实空间理解任务才考虑受限 Scene catalog；资源、资产来源与设备能力需单独设计，不能执行模型任意脚本。 |

## geo-engine

| 项目 / 固定源码 | 观察版本 | 许可证 | 取其所长 | 采用决定与边界 |
|---|---|---|---|---|---|
| [visgl/deck.gl](https://github.com/visgl/deck.gl/tree/abad7af23f682e22438a4bde06a919b865014c16) | @deck.gl/core 9.4.0-beta.4 | [MIT](https://github.com/visgl/deck.gl/blob/abad7af23f682e22438a4bde06a919b865014c16/LICENSE) | 可组合 GPU 地理/大数据图层，支持 picking/highlight/filter。 | **暂缓**：需要明确坐标系、数据归属与地图服务条件；科学数据可视化不是随便套地图，未做设备/性能验证。 |

## 核验边界

默认分支可能是 dev、unstable 或含预发布版本。源码 pin 用于复核设计，不能作为安装建议；既有运行依赖仍以本项目 package.json/lockfile 为准。项目主许可证不覆盖同品牌的所有商业产品、文档或素材。清单的源文件摘要为抓取文本的 UTF-8 SHA-256，不是上游签名证明。没有新增这些项目的运行依赖，也没有把其源代码复制进实现。
