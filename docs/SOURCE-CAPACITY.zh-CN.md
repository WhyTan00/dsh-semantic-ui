# 容量来源、当前需求与本地假设

这是 preview.23 的有限实现合同；最终归档、正常安装、Linux CI与公开下载接受另记，不能用开发源码检查代替。它复用现有 DecisionExplorer 和数字硬条件，不增加组件协议字段、图引擎或预留开关。

原始 D2 的问题是：A 上限100GB、部署简单，B 上限1000GB、维护复杂；现在需求80GB，以后可能到300GB。旧核心已有容量算术，但旧来源合同不能独立核对这些量值，模型又混同部署/维护，并承诺只连偏好的 reserveNow 会改变硬性排除。原 [D2证据](evidence/natural/r9-D2.json)与[旧缺口记录](GROUNDING-FOLLOWUP.zh-CN.md)保留，不修改原 view、正文或测试结果。

## 完整来源合同

新 `capacity-zh` 支持以“存储选项”（可加虚构/合成前缀）开头的完整文本：

```text
虚构存储选项 A 上限 100GB、部署简单，B 上限 1000GB、维护复杂。
现在需求 80GB，以后可能到 300GB。不同需求下该如何选？
```

两个不同的字面选项各有一个容量上限，一个明确的现在/当前需求；以后/未来可能点可省略。部署和维护分别支持简单、复杂、未知，未声明的对应属性保持未知。支持单位为 MB、GB、TB、MiB、GiB、TiB，**同一完整来源必须逐字同单位，不隐式换算**。量值是0至10¹²的有限非负十进制，最多6位小数，不支持指数写法；会被舍入为另一数字字符串的量值拒绝。句子、字段和问句只有文档化的有限语法；额外价格、已确认计划、模糊指代或未知单位使完整来源拒绝，不跳过再称完整匹配。

来源须覆盖所选文本全部字节，保留文档/文本/选段 SHA 和 UTF-8 spans。不能只截取容量句而丢掉当前需求、未来限定词或部署/维护属性。实际解析与检查在 [source-capacity.ts](../src/source-capacity.ts)，没有按题名、固定ID、A/B或80/300查答案。

事前独立预期的原私有回执 SHA-256 为 `0981d6b6307e4c0f32171a3b2c2b2771b23b6f1af394bc51f05f8c53548bc090`；原始 D2 `/question` 为 `8deea750b000b6ab6ffca75c3b162cbd29ea375e352d1e870fc9949ae9cc330c`。安全正反例先固定在[容量预期](../fixtures/source-capacity-expectations.json)，含甲/乙、200/700GB、当前150GB与可能550GB的独立变体。负需求的[追加边界预期](../fixtures/source-capacity-domain-expectations.json)来自冻结前静态对照，原预期不回写。

## 绑定现有硬条件

先 `source-check`，再以新 view 和实际ID提供：

```json
{"capacityDimensionId":"ceiling","demandInputId":"demand","requirementId":"capacity"}
```

来源检查要求恰好一个 `kind:number` 的“容量上限”维度、一个 `type:number` 的需求控件及一个无条件 `at-least` requirement。维度是可提供量，输入是所需量，实际比较 **上限 ≥ 需求**。两方案标签、上限、单位、原始需求初值和 `expectedEffect:hard` 都核对；任意真实ID可用。交换上限、用MB冒GB、把可能300当原始80、反转关系、漏硬条件或新增推荐策略均拒绝。

原始80GB时，容量上两者满足。只有明确按300GB作本地需求假设时，A容量不足、B满足；不建立整体赢家、价格、迁移代价或已确认预留计划。有限说明中的当前与可能点分别调用现有容量核心，`computedCapacity`保留实际 requirements、来源量值、角色和spans，而非另写容量算术。

来源检查不认证模型标题、注释或任意正文。正常 `render` 重核完整当前源，随后重建数值控件、硬条件、方案说明和完整来源解释；不会把模型注释当来源，也不按关键词删掉错误句。部署和维护在来源派生说明中分别列出，A未给维护、B未给部署仍是未知，不为塞入一个布尔维度造对偶或打分。

## 本地探索与历史

新投影只有一个“需求容量（本地假设）”控件。合法数值真正连接容量硬条件，编辑不发模型请求、不更新来源。仅对已绑定的 capacity-zh 投影应用[同一容量域](../src/capacity-domain.ts)：负数、超界或非有限值不显示有效通过，结果按未知计算；不会静默改为0或沿用原80。清空未知，0是有效需求，合法正数照常计算。其他比较与图表中的负数保持原合同。

原始当前需求和未来可能点始终留在来源说明。控件变化标为本地假设，重置/刷新从 checkpoint 恢复原始需求；它不替换旧 D2 的 preference-only 控件，也不补造人类确认计划。

组件协议仍为1.4。新 `sourceDelivery.kind=capacity-zh` 需要23 reader；不承诺旧22 reader读取新kind。新reader继续保留旧协议和历史合同，具体恢复接受按实际宿主证据读取。模板沿用同一数值字段/单位合同，主题不改变容量事实或求值。

## 正常入口与验证边界

MCP显式启动参数使用 `--source-kind capacity-zh`，DSH则由当前唯一正常用户来源的完整语法选择，工具参数不能换来源、kind或身份。[示例来源](../fixtures/capacity-source.json)、[正确请求](../fixtures/source-capacity-request.json)和[错误初值请求](../fixtures/source-capacity-refused.json)是显式数据夹具，不是自然模型表现。

伴随入口沿 `examples/codex-readonly.py --answer`，配置该来源和种类，默认0模型；正常说明包含当前容量结果与明确的可能点假设。带错误请求时 withheld，不能用旧matched回执授权新请求。`--model-candidate`不是本轮验收步骤，本段不调用模型。

核对来源/core、正常CLI、真实DSH Native/PTC、本地容量变化、无效值、刷新/旧历史和最终归档分别留证。原六题0pass6fail18requests、A2勘误、G/H观察及原D2正文不升级为自然通过。`sourceFactsVerified`、`identityVerified`、`freeProseVerified` 均为false；无真实存储、云服务、部署或外部动作。
