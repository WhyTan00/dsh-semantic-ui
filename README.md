# DSH Semantic UI

[English](README.en.md) · [安装](docs/INSTALL.zh-CN.md) · [语言设置](docs/LANGUAGE.zh-CN.md) · [验证证据](docs/evidence/language.json)

**默认简体中文，支持可记忆的「简体中文 / English」切换。** 每个组件顶部都有「界面语言」，同页同步切换，刷新后保留选择。图表、决策面板、架构图、模板主题与状态提示共用同一语言设置；你提供的来源和数据保持原样。

DSH Semantic UI 是个人开源的受约束语义界面插件。它把关系、取舍和数值整理成可交互组件，并把来源、计算结果、本地假设与模型说明分开。

| 组件 | 可以做什么 |
|---|---|
| 架构关系图 | 搜索和定位节点、查看职责与约束、情景高亮、文字关系列表 |
| 决策比较 | 对齐方案维度、调整本地条件、核对硬性需求与未知值、显式探索偏好规则 |
| 数据图表 | 折线、柱状和直方图；筛选、等价表格、下载、共同分箱、缺失与实测零的对照 |

个人模板支持主题、字体、疏密、字号与布局预览，保存版本、导入导出和使用新数据复用。模板不携带旧观测值、规则或结论。

## 安装新版

下载 [0.1.0-preview.26 公开预发布](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/v0.1.0-preview.26)的运行包，核对同页 `SHA256SUMS` 后安装：

```sh
dsh plugin --profile web add /绝对路径/whytan-dsh-semantic-ui-0.1.0-preview.26.tgz
```

本项目锁定 DSH `0.2.1-rc.2` 与 json-render `0.21.1`，组件协议为1.4。完整配置、兼容范围与历史版本见[安装说明](docs/INSTALL.zh-CN.md)。当前共享工作台不会因源码更新而自动升级，请按自己的运行环境安装新包。

## 本版实际验证

- 默认中文；四类视图同页同步切换，中英文刷新记忆，切换不重置本地筛选、不请求模型。
- 类型检查及245项单元检查通过。388文件最终归档正常隔离安装，未用语义插件源码覆盖。
- macOS/Linux分别验证 Native/PTC，每组四类视图，360px容器无根溢出，页面错误为0。[CI](https://github.com/WhyTan00/dsh-semantic-ui/actions/runs/40515658647)与[分层回执](docs/evidence/language.json)可查。

浏览器禁止本地存储时，本页仍可切换，但无法保证刷新记忆。语言功能不自动翻译用户来源、节点名称、单位或模型正文。窄屏容器测试不等于真机或完整读屏验收。

## 与 GenUI 及其他开源项目的关系

项目借鉴 json-render、A2UI、AG-UI、Tambo、assistant-ui、Vega-Lite、Observable Plot、ECharts、React Flow 等的受约束渲染、状态分层、统计范围和可访问性设计，并保留固定公开来源及许可证记录。研究覆盖35项目、139份固定文件；研究覆盖不等于功能采用完成率，具体实现与缺口见[采用复核](docs/research/ABSORPTION-AUDIT.zh-CN.md)。

本插件可与 GenUI 分工使用，不能完整替代通用应用生成、任意表单提交、复杂统计图和完整可迁移交互结果。两类 GenUI 的对照与分版本证据见[兼容边界](docs/GENUI.zh-CN.md)。

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
- [零模型启动：在真实DSH中交互查看已保存模型结果](docs/SAVED-MODEL-HOST-REPLAY.zh-CN.md)
- [实际进度](docs/PROGRESS.zh-CN.md)、[成熟度](docs/MATURITY.zh-CN.md)与[验证](docs/VALIDATION.zh-CN.md)
- [第三方说明](THIRD_PARTY_NOTICES.md)与 [MIT 许可证](LICENSE)
