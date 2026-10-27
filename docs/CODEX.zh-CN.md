# Codex 原生交互 UI 与本项目的接入

preview.18的[单个来源事实补充](SOURCE-UPDATE.zh-CN.md)只接入个人DSH正常会话；Codex伴随CLI/MCP仍只读，不因此获得宿主提交、桌面控件或当前聊天全局安装能力。本轮新模型观察0。

preview.17的[条件来源](SOURCE-CONDITIONAL.zh-CN.md)已进入同一普通答复入口：先固定源与问题，25项定向检查及归档入口通过；两个新合成模型回合均实际source-check、首次当前view比较matched，原始正文按独立判据评读通过，模型调用5/4，后台请求数unknown。候选与宿主canonical分开；可选typed分支claim API本段未被模型选择，其核对另有离线/stdio证据，不冒自然采用。

全缺失假设的[后续小修复](CODEX-ZERO-FILL.zh-CN.md)已通过D失败回归：独立假设副本由同一16核心算出0，原source观测/完整未知不变；16项离线、0新模型，初次partial保留。没有新runtime或桌面/DSH UI接入。

初版伴随客户端增加[显式补零假设答复](CODEX-ZERO-FILL.zh-CN.md)，完整源匹配后复用已有统计core，0新增模型：C正常输出假设及与实测差，D首次partial保留，随后独立副本修复见上。它不是新renderer或DSH/桌面UI验收；原两次模型观察仍按原字节保留。

最新[数值来源观察](CODEX-NUMERIC-OBSERVATION.zh-CN.md)复用16归档与独立问题入口：两次有指引模型回合都实际调用来源工具，候选按冻结判据评读通过；两次首次比较拒绝后同回合修正。B合法补零假设仅在候选中计算，宿主canonical仍只保障原来源。原自然0调用与桌面UI边界保持，不以本段替代DSH自然验收。

新增 [来源保障的普通答复](CODEX-GROUNDED.zh-CN.md)：`--answer`零推理输出有限说明；显式加`--model-candidate`才运行一个有指引候选回合。两次新回归均出现真实模型检查调用，最终由宿主复用既有canonical交付；不改变下述旧两题或桌面UI边界。

后续已完成 [显式只读线程入口](CODEX-EXPLICIT.zh-CN.md)：现成preview.13归档通过真实Codex线程路由返回schema与source_check，并临时发现/读取自包skill。新增推理0，未重发归档；两题自然0调用和桌面富UI边界不变。

2026-10-27已完成两道真实个人Codex CLI自然输入验收，见 [逐题记录](evidence/codex-cli.json)：正常登录及MCP初始化成功，两题均0次实际MCP检查调用。D1正文未通过事前语义预期；N2正文通过，但不能归因为插件计算。preview.13增加初始化工作流元数据，SDK/归档/Linux7项合同通过，仍未证明自然采用或当前桌面富UI。

此前2026-10-25已核对官方Visualizations与插件合同；当前主会话提供原生Visualize入口，未把技能可用当作本插件已出图。展示仍使用宿主已有的可视化、Mermaid、表格或文字。

## 实际能力与范围

| 对象 | 已核实 | 边界 |
|---|---|---|
| 当前会话 | 已有内置 Visualize skill 和 HTML 交互输出合同；本机 codex-cli 0.164.0 | 不能外推所有账号、所有 Web/桌面端均已开通 |
| 官方 Visualizations | 官方明确ChatGPT网页/桌面/移动端的可用范围；图、图表、地图、计算器和可调交互按账号/平台滚动提供 | 官方明确 CLI/IDE 不渲染这种交互可视化 |
| Codex 插件 | 可分发 skills/MCP；公开目录与本地市场是不同发布渠道 | GitHub Release 不等于已上架官方插件目录 |
| MCP Apps UI | 公开 iframe/UI-resource 桥接协议，适合兼容宿主 | 本次没有实现或认证 Codex 的自定义 MCP UI；不将 ChatGPT 的 iframe 支持外推到全部 Codex 客户端 |
| 本项目薄适配 | 三个只读工具，真实 JSON-RPC stdio 测试；同一个 core 计算 | 没有第二套 renderer、用户动作回传、隐藏模板库或模型路由 |

preview.15补充 [数值来源绑定](SOURCE-NUMERIC.zh-CN.md)：现成启动快照与DataChart值、缺失mask、单位和均值范围逐项对照，正常伴随`--answer`可消费一项请求。本段不添加UI资源、模型路由、DSH数值源或全局注册。

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

dev.1另提供显式 `--source-kind decision-zh` 的 [普通比较来源核对](SOURCE-DECISION.zh-CN.md)：区分能力、维护责任/资源余力、未知价格与当前条件，核对字段和有据说明。它仍是同一可选只读工具，没有新增Codex renderer、全局配置或当前会话加载声明。

dev.2 的 [当前输入适配](HOST-SOURCE.zh-CN.md) 属于 DSH Host：从执行 Agent 的实际 Session 通过公开投影读取当前 own-turn user-source 消息，Native/PTC 均做了隔离确定性验证。它没有接入当前 Codex 的消息来源，也不把宿主消息 ID 或 source.kind 当成独立人类认证；MCP 默认和显式文件来源入口保留。

dev.4的显式 `--source-kind permissions-zh` 增加 [访问/权限核对](SOURCE-PERMISSIONS.zh-CN.md)，仍复用同一只读MCP来源工具。它只核有限直接访问、方向性禁止和局部权限，不增加Codex renderer、全局注册或当前客户端来源访问；原arrows/decision模式保留。

dev.5的 [来源绑定交付](SOURCE-DELIVERY.zh-CN.md) 只接现有DSH render与checkpoint；MCP默认工具和来源核对仍独立只读，没有新增Codex UI资源、全局注册或当前客户端采用证明。

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

preview.12已把同一只读核心与有限来源检查实际归档发布，仓库外独立入口验证见 [回执](evidence/preview12/standalone-mcp.json)。正常来源绑定render仅在DSH；未修改当前Codex配置、未提供新UI资源或宣称当前对话已加载。

## preview.13：初始化时提供检查工作流

真实个人Codex CLI的第一次D1验收已完成：preview.12的MCP成功初始化并返回四工具目录，但模型未调用任何工具，正文还优先推荐托管；按事前预期判定失败，见 [完整首次回答](evidence/codex-cli/c1-D1-preview12.json)。不能把工具目录存在写成模型已采用，更不能由它证明正文或桌面富UI。

preview.13将现有只读工作流放入MCP初始化的 `instructions`：先schema后check处理数值计算，有独立来源时先检查其有限语法，再对照新view。前512字符独立交代范围；来源内容绝不拼入指令。未配置来源时不宣称有来源工具，源kind/文件、事实与身份边界仍由原合同维护。实现使用MCP SDK公开ServerOptions，没有第二套模型/renderer或全局配置。官方合同见 [MCP初始化指引](https://learn.chatgpt.com/docs/extend/mcp)。指引帮助采用，并不能强制模型正确或证明D1已修好。

真实验收只使用单次 `codex exec --ephemeral --ignore-user-config` 配置，显式保持原默认模型、推理和正常登录入口；read-only、禁shell/浏览器及其它MCP/apps/plugins/记忆/Goal/hooks，仅暴露本包只读工具。期望与原source先冻结，普通问题不含正确view、工具名或预期答案。JSONL、MCP原始报文与正文分别留存，后台推理请求数若未暴露则记unknown。`--ignore-user-config`不是更换账户；没有复制凭据或修改全局配置。官方入口见 [非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)。

### 两题结果与剩余问题

| 自然输入 | 实际归档/工具采用 | 内容判断 |
|---|---|---|
| 原D1条件权衡 | preview.12，4工具初始化成功，0次调用 | 直接优先托管并推当前维护减负，未通过独立预期；价格仍未知，不能用其它正确部分抵消无据策略 |
| 原N2读数解释/均值 | preview.13，3工具及初始化指引成功返回，0次调用 | 3个有效值均值0℃、全部4次均值未知，正文通过；没有插件计算或来源核对发生 |

普通问题未包含工具名、合法view或预期答案。C2有服务器初始化工作流，不能称无指引择工具；初始化返回也不证明模型实际读取/服从。两题的模型与推理沿本机默认值，没有改账户/路由或使用API备用；不同问题和版本不能计算准确率提升。共观察到2个自然回合，后台推理请求数未由CLI逐请求暴露，记unknown；没有第三题或重试D1。原DSH run9仍0通过/6失败/18请求。

本机无模型调用的prompt-input调试没有显示MCP指引或工具名，但该输出不含独立tools/selector元数据，所以不能据此判定客户端丢失指引。已证实的是正常授权可用、MCP启动正常、自然工具采用未通过；下一步需要验证便携skill/客户端的实际工具暴露与采用路径，不能用手工SDK call替代。当前主对话未全局加载，桌面UI未验收。

[preview.13发行与stdio/Linux回执](evidence/preview13.json) 将新MCP工作流与未通过的自然采用分开。DSH四个运行入口和preview.12同字节，旧宿主/GenUI矩阵保持各自原版本范围。
