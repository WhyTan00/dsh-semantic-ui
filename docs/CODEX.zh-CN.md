# Codex 原生交互 UI 与本项目的接入

核实：2026-10-25，再次读取官方Visualizations与插件打包文档。结论：当前会话已提供原生 Visualize 技能入口，未把技能可用当作本项目已在当前客户端出图验收；本项目接入 Codex 的价值在数据/规则校验与模板合同。展示使用宿主已有的可视化、Mermaid、表格或文字。

## 实际能力与范围

| 对象 | 已核实 | 边界 |
|---|---|---|
| 当前会话 | 已有内置 Visualize skill 和 HTML 交互输出合同；本机 codex-cli 0.164.0 | 不能外推所有账号、所有 Web/桌面端均已开通 |
| 官方 Visualizations | 官方明确ChatGPT网页/桌面/移动端的可用范围；图、图表、地图、计算器和可调交互按账号/平台滚动提供 | 官方明确 CLI/IDE 不渲染这种交互可视化 |
| Codex 插件 | 可分发 skills/MCP；公开目录与本地市场是不同发布渠道 | GitHub Release 不等于已上架官方插件目录 |
| MCP Apps UI | 公开 iframe/UI-resource 桥接协议，适合兼容宿主 | 本次没有实现或认证 Codex 的自定义 MCP UI；不将 ChatGPT 的 iframe 支持外推到全部 Codex 客户端 |
| 本项目薄适配 | 三个只读工具，真实 JSON-RPC stdio 测试；同一个 core 计算 | 没有第二套 renderer、用户动作回传、隐藏模板库或模型路由 |

## 可直接运行的可选 MCP 适配器

解压运行 tgz 后，`dist/mcp.js` 为包含 MCP SDK 与语义核心的独立 Node 入口。Node 24+ 可运行；默认三个工具不导入 DSH、不读取文件、登录、网络或模型凭据。开发候选 preview.12-dev.0 新增显式启动配置的单一来源文件快照，见 [来源核对](SOURCE-CHECKS.zh-CN.md)；不自动启用或全局注册。正常 DSH 安装方式仍见 INSTALL。

```sh
# 持久注册仅在希望新 Codex 会话加载它时执行：
codex mcp add semantic-ui-checks -- node /absolute/path/to/package/dist/mcp.js
# 查看/移除：
codex mcp get semantic-ui-checks
codex mcp remove semantic-ui-checks
```

真实 JSON-RPC stdio 三项测试已在仓库外的独立副本通过；Codex CLI 0.164.0 接受单次进程配置覆盖，未写全局配置。这些不是当前 Codex 对话已经加载工具或自定义 UI 已运行的证明。

适配器默认提供：

- `semantic_ui_schema`：按需返回一个组件的严格数据合同。
- `semantic_ui_check`：校验输入，计算图的共享目标/路径交集、数量要求、保守规则结果或统计；成功不意味着已经出图或事实真实。
- `semantic_ui_template_check`：检查用户显式传入的导出模板和当次新数据，不读取/修改 DSH 私有模板库。

仅在 preview.12-dev.0 的调用者启动配置提供 `--source-file` 时，增加 `semantic_ui_source_check`：对照已固定文件片段中的字面箭头、覆盖与方向，拒绝请求侧替换来源；作者身份、自由正文与因果仍未认证。已发布 preview.11 的默认三个工具和旧归档不改变，当前 Codex 客户端加载新候选仍未验证。

有可用原生可视化时，用这些确定性结果约束展示；CLI/IDE 使用相同工具返回的数据与文字。工具不会自己请求模型。`./core` 是无宿主依赖的程序入口，便于其它适配器复用。

根 `plugin.json` 和 `skills/semantic-ui-checks/` 提供可分发的技能包。这个最小包只含 skill；MCP 通过上述公开 CLI 显式注册。未修改用户的全局配置，也未自动添加到共享 AI 工作区或重启桌面程序。安装到新会话后才可声称该会话已加载；当前包的协议测试与宿主实际加载是两项独立证据。

## 为什么保留这一层

原生生成能力解决表达形式；可复用字段/单位/空值合同、确定版本、程序计算的要求检查和可追溯首次记录降低重复任务中的不确定性。模型和平台也可能内置这些能力，因此按实际重复任务的正确性、人工修正量和复用成本衡量价值，不承诺不会被替代。

## 官方来源

- [Visualizations](https://learn.chatgpt.com/docs/visualizations)：能力、可用范围和 CLI/IDE 限制。
- [Plugins](https://learn.chatgpt.com/docs/plugins)：支持表面、skill/MCP 和安装后新会话。
- [Build plugins](https://developers.openai.com/plugins/build/plugins)：portable plugin.json、技能目录和分发合同。
- [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)：UI 可选、数据与展示分离、MCP Apps bridge。

这些来源已实际检索并读取。没有把模型生图、静态 Mermaid、可交互视图、工具调用和业务状态持久化混为同一个能力。

preview.10继续只分发同一检查核心与便携skill，不增加renderer。归档提取的独立入口与skill文件已验，真实JSON-RPC stdio4项通过，见 [本版记录](evidence/preview10/standalone-mcp.json)。DSH的个人模板编辑与历史主题快照已有实现；Codex桥接只检查显式导出的模板，尚未接入跨宿主模板持久化。

本地preview.11-dev.0 /协议1.4进一步复用同一core的声明角色和作用交叉检查，编译后的独立MCP入口通过3项真实stdio测试；不等于当前Codex已加载，也不证明自由正文或来源真实。原已发布preview.10仍为1.3。新合同、本地入口及限制见 [声明检查](DECLARATION-CHECKS.zh-CN.md)。

preview.11将同一1.4核心与只读MCP归档交付；归档入口的独立协议验证见 [本版回执](evidence/preview11.json)，没有全局注册或当前会话已加载声明。
