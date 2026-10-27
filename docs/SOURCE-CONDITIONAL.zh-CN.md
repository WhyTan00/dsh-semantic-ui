# 两分支条件式硬需求的有限来源交付

17归档已完成本机/Linux实际安装及Native/PTC各2例、普通Codex入口正例/未知与两次新有指引模型观察。完整原始候选、模型/宿主调用分层、源码/包/CI字节和发布身份见[后补接受回执](evidence/source-condition.json)。本页随源包冻结，后补接受不重打归档；旧失败保持原结果。

preview.17扩展现有decision-zh来源核对器：完整的“若字面布尔条件，则我们需要/不需要能力；否则我们需要/不需要同一能力”，可以归一化为当前capability-need。它复用现有DecisionExplorer、supports要求、core及普通Codex `--answer`，不新增组件协议、条件执行引擎或模型调用层。

## 完整有限语法

沿原[两方案来源合同](SOURCE-DECISION.zh-CN.md)，明确两个字面方案及能力支持事实，再给以下连续三段；逗号、分号等原有分隔符分段，不能跳过中间句：

```text
若字面条件，则我们需要字面能力；否则我们不需要同一字面能力。
当前字面条件为是 / 当前字面条件为否 / 当前字面条件未知。
```

两个分支可分别明确需要或不需要。`当前…为未知`也支持；未给当前条件时保留unknown。条件和能力是精确字面标签，不解释否定词内涵、指代、合取、未来计划或其它自然语言。每个能力只绑定一个完整两分支规则；不与同能力的独立当前需求混合。未知条件不能默认false；两个分支本来相同时，其相同结果不依赖当前条件。

缺少否则、两个分支能力不一致、重复/冲突规则或当前值、未知指代与未识别附加句会拒绝完整来源。“只有…才…”只给必要方向，不能充当本合同的两分支充分条件，明确拒绝。没有隐含else或模型兜底。

## 来源、条件、当前需求与声明

`sourceDecision.conditionalNeeds`保存条件名、whenTrue/whenFalse、current/currentSpans、每个分支及条件的UTF-8字节范围和derivedNeed。当前需求作为带derivation和全部依据范围的capability-need事实加入现有source映射；它是源内有限推导，不是把条件真假当能力支持。

视图仍用一个普通的“当前需要能力”布尔输入，initial必须等于derivedNeed，语义角色capability-need、expectedEffect=hard；与capability-support维度通过supports对应。输入false时本项不排除缺少能力的方案，null时仍未定。**不在组件上增加when或推荐规则**，也不建立一个额外的原始条件控件。该归一化只认证当前初值；本地需求切换属于另列假设，不改变原始条件，不声称所有控件组合均是来源分支。

原映射/claims继续有效，并可核对：

- `kind:"condition", name:<精确条件名>, value:<boolean|null>`：当前条件；缺失与明确unknown保留各自出处。
- `kind:"conditional-need", name:<能力>, condition:<精确条件名>, whenTrue:<boolean>, whenFalse:<boolean>`：同时声明两个方向，不能省略一个分支。
- 原`kind:"capability-need"`：核对派生的当前需求。派生unknown标为derived-unknown，不能冒明确false。

字段、当前输入或分支声明反向/遗漏/错值会拒绝有据说明。source-check返回的canonical除有限事实外，解释当前条件下本项适用/不排除/未知、缺什么以及两种分支如何改变该项结论。能力通过不代表整体可行或唯一赢家，未知价格不形成排序，偏好不形成硬需求。

## 普通入口及边界

使用本仓库伴随Python脚本、preview.17归档及manifest，按原正常入口传独立source-file和question-file，source-kind为decision-zh、component为DecisionExplorer。默认`--answer`不启动模型，来源声明与解释直接交付；只有另加`--model-candidate`才运行一个有指引候选回合。候选原文与宿主canonical分开，不拿canonical覆盖候选错误。

DSH复用现有当前own-turn来源适配及正常render/checkpoint：显式映射必须匹配完整来源，才保存原条件说明和重建的源内视图；后续本地需求假设不改变该快照。协议仍为1.4，未增加身份认证、任意自由正文判真或世界事实认证。`sourceFactsVerified/identityVerified/freeProseVerified`保持既有false边界。没有全局注册、主客户端热切或新renderer。

这是新runtime范围，不能把16旧归档当已支持条件语法；实际归档、普通入口、模型采用、宿主显示/恢复、CI和公开资产分别以17后补回执为准。原自然题/首次失败及旧0/6/18结果不回写。源码合同、确定性宿主验证、有指引模型评读是不同证据，不推普遍准确率。

后续以现有26归档完成[同会话完整来源修订](NORMAL-SOURCE-REVISION.zh-CN.md)：普通完整消息true→unknown→false，各自新source与新checkpoint对应，旧初值误用拒绝，本地试算不写回源，历史刷新保留各版本。Native/PTC各3个确定性回合、0真实模型，没有运行改动或新发行；这不扩成增量指代消息解析或模型原文理解验收。

另有[当前来源双撤回的一个新模型观察](CODEX-SOURCE-REVISION-OBSERVATION.zh-CN.md)：公共缓存支持false与当前条件true都在当前快照中变为未知，模型实际读源、新view首次matched，原文有限判据met。旧控制文本仅供离线评审，未给模型；普通问题里的旧排除断言是合成任务，不能当真实旧答复或同会话历史回传。工具、原文和宿主说明分别保留，不改变本合同或既有未知边界。

后续伴随入口支持[同thread完整来源修订](CODEX-SOURCE-HISTORY.zh-CN.md)，以一个真实模型thread的两回合验证：当前条件true→false按else得到need=false，余力true→unknown保持null；旧view两初值拒绝，旧无余力假设未当新事实。首轮首次标签失败与同回合修正、两raw、实际工具和宿主说明分别留证。它是现有26核心之上的客户端增量，不改本有限语法或增加图形交互回传。
