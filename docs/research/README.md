# 交互式与生成式 UI：开源生态研究

核实日期：2026-10-23。范围为个人 DSH Semantic UI；只研究公开资料和公开源码。结论：**没有理由把目录外任务一律优先交给某个 GenUI。应按所需能力、实际可用工具、宿主兼容和状态/反馈语义选择。**

本次核对 33 个仓库的固定 commit、许可证和选定的 manifest/契约/实现文件。可复核清单见 [PROJECTS](PROJECTS.md)，事实源为 [projects.json](projects.json)。这是一轮有选择的源码研究，不是对 33 个系统的完整审计、性能横评或运行认证。源码 HEAD 中的 canary、dev、unstable 版本都标为观察值，不冒充已发布稳定包。

补充研究：[GenUI 吸收范围与缺口](GENUI-ABSORPTION.zh-CN.md) 逐项说明已实现、设计采用及暂缓项；[产品价值与模型进步](MODEL-PROGRESS.zh-CN.md) 记录可检验的定位、个人模板与主题优先的迭代顺序，以及停止重复建设的条件。当前清单扩展至 126 份固定源码文件；preview.5 发行时的 116 份记录保留为历史证据。

## 先分清四种责任

| 层 | 代表 | 负责什么 | 不能由它证明什么 |
|---|---|---|---|
| 组件描述与运行时 | json-render、A2UI、OpenUI、assistant-ui | 可用词汇、组件树/属性、绑定、可信 renderer | 不证明模型事实、统计口径或当前 DSH 兼容 |
| 会话/交互协议 | AG-UI、MCP Apps、DSH 原生接口 | 生命周期、状态、动作、资源和宿主边界 | 不等于一套图表组件；不能并行造第二套会话真相 |
| 交互组件与表单 | shadcn、RJSF、SurveyJS、Tool UI | 输入、校验、控件组合、提交体验 | 点击发生不等于执行成功或持久化成功 |
| 图形与布局引擎 | ECharts、Vega-Lite、Plot、D3、React Flow、ELK | 绘制、比例尺、视口、布局或图算法 | 图漂亮不等于数据正确；布局不创造业务关系 |

当前仓库继续由 DSH 保存会话和整值 checkpoint，json-render 组合三组件，ECharts 绘制数值，React Flow/Dagre 处理关系图。吸收设计优点不等于替换这些稳定边界。

## 精选项目中真正值得学习的部分

**A2UI / AG-UI：先说清客户端能做什么。** A2UI 的 catalog 由客户端决定，AG-UI 的 capability discovery 区分已声明能力与未知能力。它们在不同层协作，不能互称兼容。本项目新增只读 `action=catalog`，明确三组件、本地操作、内容恢复及未实现的反馈/状态能力；没有实现两个上游的 wire adapter。[A2UI catalogs](https://github.com/a2ui-project/a2ui/blob/020a9d6f694761ad16b35bc38945e4ccd0ac14e8/docs/public/concepts/catalogs.md)、[AG-UI capabilities](https://github.com/ag-ui-protocol/ag-ui/blob/ec24165f725a5b01ecddb1f62df305855a7917c8/docs/concepts/capabilities.mdx)。A2UI 文档当前为 0.9.1、1.0 为 candidate，版本升级须分别验证。

**assistant-ui：词汇表、已知工具 UI 与动作处理分开。** 当前生成 UI 的 `present`、toolkit 和 action registry 比一张大组件菜单更有参考价值。表单收集使用控件实际值，未注册动作不能假装成功。但其默认 [chartData](https://github.com/assistant-ui/assistant-ui/blob/c015c32a08c0cd01b9f436b2759e3d4ada69a9e5/packages/generative-ui/src/vocabulary/chartData.ts) 会补齐短系列并将无效/缺失数值转为零：本项目明确不采纳。独立 [tool-ui](https://github.com/assistant-ui/tool-ui) 已归档，只保留其校验与收据设计参考，不作为新增默认依赖。

**OpenUI：按能力拆分，流式阶段要有明确的不完整状态。** lang-core、renderer、headless chat 与 UI library 分开，有助于避免为了一个图表加载整套聊天系统。当前 [react-ui manifest](https://github.com/thesysdev/openui/blob/c9f93b6e57d05b19b9781846769da530c6741dc4/packages/react-ui/package.json) 与 [BarChart](https://github.com/thesysdev/openui/blob/c9f93b6e57d05b19b9781846769da530c6741dc4/packages/react-ui/src/components/Charts/BarChart/BarChart.tsx) 使用 D3 相关能力，不能继续按旧 Recharts 实现描述它。本项目保留完整校验后提交 checkpoint；不移植 DSL/表达式求值，也不把厂商的 token/延迟对比当本项目测量。

**Tambo / CopilotKit：状态所有权和反馈环路比控件数量更重要。** Tambo hook 显式处理同步、等待、错误和防抖，完整方案还带自己的 agent/会话后端。CopilotKit 提供跨前端的共享状态、人参与与生成 UI。借鉴这些边界即可；本项目不为此替换 DSH 后端、模型或存储。托管产品能力与开源 SDK 的可用范围应分别核对。[Tambo state hook](https://github.com/tambo-ai/tambo/blob/6e2c1bff3b68a00c094b6d876788cc8f33f7bb02/react-sdk/src/v1/hooks/use-tambo-v1-component-state.ts)、[CopilotKit](https://github.com/CopilotKit/CopilotKit/tree/6d9264274b9952e1a89ed01d1ef3507c72f67aab)。

**MCP Apps：较开放应用需要宿主边界。** UI resource、bridge、能力、CSP 与 sandbox 适合未来应用类适配器，不能简化为任意 iframe 或 HTML 直通。当前只研究，没有接入 DSH。其 [LICENSE](https://github.com/modelcontextprotocol/ext-apps/blob/82221c0c8ce7661efa6771c9d461511b1650495f/LICENSE) 正处于 Apache-2.0 与历史 MIT 转换，普通文档另有 CC-BY-4.0；不能只凭 manifest 的 MIT 字段决定复制范围。

**RJSF / SurveyJS / shadcn：下一个值得做的是有界输入。** 学习 schema 与 UI 配置分离、实际值收集、错误定位和可组合控件。未来 RequestForm 应先解决缺失条件与少量选择，不直接引入完整表达式/文件上传/任意 action。SurveyJS 的 [MIT Form Library](https://github.com/surveyjs/survey-library/blob/3a28913a07b4aa1bed8db14ed0519688d3f8f97b/LICENSE) 与 Creator、Dashboard、PDF 是不同授权产品，见 [官方许可说明](https://surveyjs.io/licensing)。

## 它们到底用了什么图表体系

| 具体对象 | 源码中核实到的实现/依赖 | 对本项目的判断 |
|---|---|---|
| DSH Semantic UI | ECharts 6.1.0 + 自有数据语义；React Flow + Dagre | 保留；补实际 ARIA 注册与动态描述 |
| 当前 OpenUI react-ui | D3 scale/selection/shape 与自有 Charts 组件 | 学习拆分，不按旧版 Recharts 推断 |
| 已归档 Tool UI 示例站 | Recharts 2.15.4、Radix、Zod | 历史示例；不等于当前 assistant-ui 底层 |
| 当前 assistant-ui | generative-ui 词汇表；另有 diagrammatic 包 | 核对组件数据处理，不以“React 图表”替代语义审查 |
| A2UI vegachart catalog | Vega 5 / Vega-Lite 5 / vega-embed 的显式依赖 | 可选 catalog，不是 A2UI 协议固有能力；不直接跳至当前 Vega-Lite 6 |
| 生成应用式 DSH GenUI | manifest 包含 Recharts 3；React 应用沙箱路线 | 协议与 DSH 支持范围另行核实；不能当本项目 drop-in |

以上依赖出处逐项记录在 projects.json 的 `manifestObservations` 和固定源码链接中。库名相同也不能证明包装层保留了空值、负数、时间、分箱或交互状态的正确语义。

## 图表与关系图：精选后的取舍

| 需求 | 保留/候选 | 精华 | 过滤掉的误用 |
|---|---|---|---|
| 当前趋势、类别与等宽分布 | **ECharts 保留** | 模块化、SVG、现有控件/源表、正确缺失与分母 | 不开放任意 option，不为了图种数量换引擎 |
| 复杂统计、分面、关联选择 | Vega-Lite、Observable Plot、G2 候选 | 声明式编码、变换与交互分层 | 不执行任意 JS、URL 或表达式，不补造统计方法 |
| React 产品定制图 | Recharts、visx、Nivo、TanStack Charts 候选 | 可组合组件、主题或 typed grammar | 不同时堆多个同类引擎；HEAD/renderer/设备支持须分开 |
| 稠密时间序列 | uPlot 候选 | aligned 数据、null 缺口、cursor/zoom 侧重点 | 厂商性能数字未复测；当前规模无迁移理由 |
| 科学/专用 3D 图 | Plotly 候选 | 丰富 trace | 先拆包、核对统计方法与设备资源；非全量默认包 |
| 当前平面依赖图 | **React Flow + Dagre 保留** | 节点交互与自动布局职责分开 | 布局不新增边；80 节点纯布局证据不等于可读性 |
| 复杂网络/嵌套端口 | G6、Cytoscape、ELK 候选 | 图论/网络与更复杂布局 | 未做规模实测；ELK 仅布局，许可按具体发行核对 |
| 地理图层/通用 3D | deck.gl、Three.js 暂缓 | 图层/场景的领域表达 | 没有真实空间任务时不用；不引入任意脚本/远程资产 |

Chart.js 适合常规 Canvas 图，但当前与 ECharts 重叠。D3 是底层原语，不是 Agent 交互协议。详细候选、许可证、观察版本与未采用原因见 PROJECTS。

图表选择优先看任务：时间变化用有序时间轴，类别比较保留零/负数，分布区分 histogram 与 category bar，比例必须有明确分母。缺失点不能补零或跨缺口连线；空箱不能因过滤而伪装成连续观测。可见范围、统计数值和等价表格应来自同一选择。参考 [Plot bin](https://observablehq.github.io/plot/transforms/bin)、[Vega-Lite parameters](https://vega.github.io/vega-lite/docs/parameter.html) 和 [ECharts ARIA](https://echarts.apache.org/handbook/en/best-practices/aria/)。

## 如何选择，而不是默认指定 GenUI

1. 文字足够就用文字；不要为展示组件补造事实或维度。
2. 三组件能解决的关系、比较、数值问题，可使用本插件的受限语义表达。
3. 需要填写、提交、测验反馈、持续应用状态或空间展示时，先核对**实际暴露**的工具和其宿主范围、数据协议、回传及持久化语义，再选择 renderer。
4. 同一视图只选一条生成通道。原 GenUI 历史继续由原 renderer 读取，不改写旧消息。
5. 没有适合且已可用的工具时，说明缺口并使用文字；不凭仓库名或组件截图承诺能力。

这次已实际采用的代码变化和未来表单的最小合同见 [ADOPTION](ADOPTION.zh-CN.md)。未来候选是明确的开发方向，不是已实现能力。更新时重新核对源码/发行/许可证，运行 `pnpm research:generate` 与 `pnpm research:check`；这两个命令不自动联网、安装或启用候选项目。
