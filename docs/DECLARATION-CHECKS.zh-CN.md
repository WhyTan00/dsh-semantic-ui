# 声明一致性检查：preview.11

发行身份：**0.1.0-preview.11 / 协议1.4**。此前本地dev.0的来源检查保留原身份；本版实际归档安装、独立MCP和Linux按 [版本回执](evidence/preview11.json) 分别记录。这个增量检查结构化声明是否互相矛盾，不能证明模型忠实翻译了原问题，也不认证自由正文。

## 新增的可执行约束

布尔硬要求必须同时声明选项字段与本地输入的语义角色：

| relation | dimension.semanticRole | input.semanticRole | 比较含义 |
|---|---|---|---|
| supports | capability-support | capability-need | 选项支持能力，用户是否需要该能力 |
| requires-availability | resource-need | resource-available | 选项需要资源，用户是否具有该资源 |

角色缺失返回`DECLARATION_MISSING`，角色与关系相反返回`ROLE_RELATION`，角色字段的类型/单位不符返回`ROLE_TYPE`。错误带精确字段路径和修正提示；程序不根据标签、语言、供应商名、题号猜角色，不自动换方向。true/false/null、条件未激活与现有三值计算保持原样。数值关系仍要求相同明确单位；一般when开关不必伪装成能力/资源，但仍须声明作用。

每个本地输入必须声明`expectedEffect`，与真实引用图严格比较：

- `hard`：只引用于硬要求、硬约束或它们的when条件。
- `preference-only`：只引用于偏好规则；这是合法控件，不改变硬资格。
- `hard-and-preference`：两类引用都存在。

缺声明返回`DECLARATION_MISSING`，声明与实际图不一致返回`INPUT_EFFECT`；未使用的控件仍被拒绝。图包含未激活条件的引用，这不是“每次改变输入都必然改变结果”的承诺。程序不为了匹配声明而添加规则或改写策略。偏好继续默认withheld，局部探索不调用模型、不认证来源。

## 回执与界面

DSH与可选MCP共用`core`。新协议回执的`declarationMapping`完整保留要求ID、选项字段ID、输入ID、角色、关系、单位、预期/实际作用；引用图只保存一份，位于`decisionFacts.inputEffects`。数据不静默截断。合法输入若展开后的计算回执超过同一JSON预算，交付前返回`RECEIPT_LIMIT`，提示缩减或拆分比较；不发送残缺检查。

既有“Condition mapping”展开区新增实际字段、角色与预期作用，标记**source unverified**。角色、evidence和origin仍都是提交者提供的数据；`sourceFactsVerified`始终false。同一个模型也可以提交一组内部一致但错误的角色，这会通过一致性检查，仍不能当作来源认证。测试保留了这个反例。

## 历史和模板

1.0/1.1/1.2/1.3快照继续按原合同验证和读取，不补角色、不改日志或旧计算。新字段不能塞入旧协议；新交付也不能通过声明旧版本绕过1.4要求。已有模板保持原定义；新模板会保存角色与预期作用，角色/作用不同即不匹配，需要显式另存/新版本，不把旧观察值填进新数据。

## 可运行入口

在已有依赖的仓库中：

```sh
# 不启动DSH；直接检查公开的虚构夹具
pnpm exec tsx -e 'import {analyzeEnvelope} from "./src/core"; import {declaredResource} from "./fixtures/consistency"; console.log(JSON.stringify(analyzeEnvelope(declaredResource), null, 2));'

# 窄单元/协议检查，含实际MCP stdio
pnpm exec vitest run tests/decision-consistency.test.ts tests/grounding.test.ts tests/grounding-direction.test.ts tests/mcp.test.ts

# 构建本地候选，使用全新隔离DSH与本地确定性端点验证；不使用个人模型
pnpm build
pnpm test:consistency-host

# 已构建的独立MCP入口；客户端按JSON-RPC stdio连接
node dist/mcp.js
```

`fixtures/consistency.ts`为显式编写的新声明；`fixtures/grounding.ts`和原run9保留原身份。宿主检查覆盖Native/PTC正常两例、两种拒绝、旧1.3历史与跨进程读回、360px和本地控件无新增请求。额外的新进程读回未启用历史夹具工具，也未提交新问题。上述源码夹具不等于归档安装验收；本版另做正常归档安装。完整GenUI复验、当前Codex客户端加载和真机验收仍需独立证据。

本轮不新增自然模型调用。原run9六题仍为0通过/6失败/原18请求；A2/A3因果与独立性、N2/T2绕过本插件的输出不会因这个检查而被修复。更强的来源保证仍需要独立输入与逐题证据。

[本地dev.0原证据](evidence/declaration-consistency.json) · [本版归档回执](evidence/preview11.json) · [保留preview.10](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/v0.1.0-preview.10)
