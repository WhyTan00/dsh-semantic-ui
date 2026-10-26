# GenUI 吸收范围与缺口

原始研究日期：2026-10-23；实现状态复核至 `0.1.0-preview.11`（2026-10-27）。模板起于 preview.6，图表/关系图质量起于 preview.7，后续语义校验按各版本证据保留。本页回答“吸收到了哪里”，区分设计研究、功能实现和运行验证；没有声称逐文件审计或完整移植任何上游仓库。最新跨项目矩阵与优先级见 [采用复核](ABSORPTION-AUDIT.zh-CN.md)。

## 两个不同项目

- 白名单组件型：[omdsh-dev/dsh-genui，固定源码 ad8dc166](https://github.com/omdsh-dev/dsh-genui/tree/ad8dc166deaf4eee7dea758fc0a84a8728402b52)。已有共存/表单回传实测采用冻结 npm `@changfenhuang/dsh-genui@0.14.0`，源码快照与发行包分别记录，不能互相替代验收。
- 生成应用型：[pengyue-polaron/deepseek-harness-genui，固定源码 f6289bc7](https://github.com/pengyue-polaron/deepseek-harness-genui/tree/f6289bc709c5b1992c851bf5e63237a5fa453e1f)。研究其公开说明、类型和权限函数；本项目尚未执行这个插件，宿主版本范围仍按 [共存说明](../GENUI.zh-CN.md) 核实。

两个项目的主要产品能力已纳入下面的取舍表；这不等于每种控件、边界分支、示例和历史提交都已审查。固定源码文件清单及 SHA-256 在 [projects.json](projects.json)。preview.5 的研究记录是 116 份文件，随后状态/产物/模板补读至126份，preview.7扩展后为 **35 个项目、139 份文件**。2026-10-27另有包含两类GenUI的定向来源快照，见 [absorption-audit.json](absorption-audit.json)；没有改写上述旧源码身份或冻结的npm共存测试。研究文件数量不能充当能力覆盖率。

## 逐项取舍

| 上游能力 | 本项目当前状态 | 吸收决定与后续边界 |
|---|---|---|
| 组件白名单、参数校验和错误反馈 | 三类语义组件、schema/语义检查、工具错误回执已实现 | 沿用受限输入；没有采用其围栏 DOM 接管和同回合 steering 实现 |
| 表格、卡片、媒体、画廊、数学表达等组件组合 | 仅三组件内必要展示；无等价通用组件库 | 需求驱动补充；组件数量本身不作为目标 |
| 图表预设、函数图、Mermaid、3D | ECharts 的三类数值表达与 React Flow/Dagre 关系图已实现 | 其它能力保留候选；不直接开放完整 ECharts option、任意表达式或应用代码 |
| 本地排序、筛选、参数探索 | 已有本地范围/系列/条件/关系探索 | 吸收减少模型往返的原则；未声称复制其全部交互 |
| 表单、测验及用户动作回传 | 本插件未实现；冻结 GenUI 的一次真实表单提交已验证 | 在个人模板复用之后接入有界 RequestForm 与宿主接受收据，合同见 [ADOPTION](ADOPTION.zh-CN.md)；测验另待需求 |
| 持久化交互状态 | 本插件内容依赖 DSH checkpoint；控件偏好刷新复位 | 借鉴稳定身份、内容版本及有界存储；不把浏览器草稿当宿主已接受记录 |
| 带状态 JSON 和独立 HTML 导出 | 本插件未实现可移植交互产物格式 | 纳入候选；必须说明离线依赖、外部媒体、模型动作失效/降级与版本迁移 |
| 模板预览与自定义设计 | preview.6 已有三组件的个人模板、受限主题、版本和导入导出 | 独立实现字段合同、数据剥离、owner 私有库和历史快照；[实际范围](../TEMPLATES.zh-CN.md)，未移植上游整个模板中心 |
| 常驻面板、徽章、侧会话表面 | 本插件无对应功能 | 暂缓；先证明已有三类任务的完成价值，不引入额外工作区/历史真相 |
| 增量围栏渲染、局部修复、延迟加载 | 本插件使用原生节点和整值 checkpoint；没有等价围栏流式实现 | 借鉴渐进呈现/资源按需加载；不能为修复显示而默默修改事实或缺失值 |
| 生成 React 应用及其版本/构建证据 | 本插件未实现 | 参考候选/可用版本分离；现阶段不扩展成通用应用生成平台 |
| 工具/外部接口权限、状态进入下轮 | 本插件无外部执行或用户动作反馈能力 | 操作按宿主授权并返回真实结果；生成的按钮/动作名不产生执行授权 |
| 安装、历史恢复、测试与文档 | 本项目独立实现并有 Native/PTC、历史共存等证据 | 借鉴验证方法，分别保留自己的测试、真实失败和公开发行包；不挪用上游运行结果 |

## 本次补读源码带来的具体认识

白名单 GenUI 的 [interaction-store](https://github.com/omdsh-dev/dsh-genui/blob/ad8dc166deaf4eee7dea758fc0a84a8728402b52/src/client/interaction-store.ts) 使用会话、块位置与内容指纹作为键，并限制浏览器存储规模。存储失败时允许退回内存。它说明存在持久化机制，不能证明每个生成表单、每种时序或跨设备都恢复成功。本项目 E4 与早先 C4 的实例及时序不同，现有观察不构成因果结论。

[submission-registry](https://github.com/omdsh-dev/dsh-genui/blob/ad8dc166deaf4eee7dea758fc0a84a8728402b52/src/client/submission-registry.ts) 将成员身份、提交范围、完成度和本地判卷条件分开。值得吸收的是显式范围和实际控件值；不同业务对空值、未选择和完成度的定义仍须由自己的合同决定。

[artifact/types](https://github.com/omdsh-dev/dsh-genui/blob/ad8dc166deaf4eee7dea758fc0a84a8728402b52/src/client/artifact/types.ts)、[create](https://github.com/omdsh-dev/dsh-genui/blob/ad8dc166deaf4eee7dea758fc0a84a8728402b52/src/client/artifact/create.ts) 与 [portability](https://github.com/omdsh-dev/dsh-genui/blob/ad8dc166deaf4eee7dea758fc0a84a8728402b52/src/client/artifact/portability.ts) 已表达版本、规范化 spec、交互状态、呈现信息及所需资源。导出会处理特定秘密字段；资源扫描会列出外部媒体和模型动作。这些能力已有先例，不能把“支持导出/保存”宣传成本项目独有优势，也不能据此保证任意导出完全离线可用。

生成应用型的 [artifact types](https://github.com/pengyue-polaron/deepseek-harness-genui/blob/f6289bc709c5b1992c851bf5e63237a5fa453e1f/src/artifacts/types.ts) 分开候选/可用/失败版本、构建与浏览器验证状态；[permissions](https://github.com/pengyue-polaron/deepseek-harness-genui/blob/f6289bc709c5b1992c851bf5e63237a5fa453e1f/src/runtime/permissions.ts) 按能力声明指纹及到期时间匹配授权。其 [公开说明](https://github.com/pengyue-polaron/deepseek-harness-genui/blob/f6289bc709c5b1992c851bf5e63237a5fa453e1f/README.zh-CN.md) 描述保存状态进入下一轮及失败版本回退。这里只确认源码结构/作者声明，未在本项目宿主运行这些路径，也未做完整安全审计。

## 什么才算吸收完成

研究完成的是主要能力的取舍、选定源码阅读和路线建议。preview.11已有三组件、模板和内部一致性校验，但提交闭环与可迁移交互结果仍未实现。可采用设计须逐项通过本项目测试和真实任务，才能转成 supported。全量复制会引入不需要的范围、宿主假设及维护负担；选择性实现和明确暂缓同样是有效采用决定。当前没有复制这些上游实现，没有新增运行依赖。

与模型进步相关的定位和检验方法见 [产品价值与模型进步](MODEL-PROGRESS.zh-CN.md)。
