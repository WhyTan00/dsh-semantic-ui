# DSH数值来源正常交付

preview.16将[有限读数来源](SOURCE-NUMERIC.zh-CN.md)接到现有DSH正常render/checkpoint。MCP15的文件来源和零推理文字答复保持各自版本证据；本页是新的宿主链路，不把夹具当自然模型采用。

## 正常调用与拒绝

适用来源仍为完整observations-zh合同，当前调用所属own-turn只有一个受支持user-source文本。宿主从公开会话投影读取原输入，排除合成上下文（含锁定公开包产生的agent-instructions/AGENTS基线）；无当前来源、来源歧义或身份字段不能认证时，拒绝映射/声明或明确标未核，不从工具参数或旧会话补源。消息ID/producer=user及文本SHA是定位信息，不是人类认证或抗篡改证明。

先用`action=source-check`读取源范围和unknown，再按原schema构造DataChart。`action=render`需要fresh view和完整`mapping={seriesId,rows:[{sourceIndex,rowId},…]}`；可带现成`claims`中的typed mean（observed/complete、value、denominator、unit）。全部位置、值、null mask、单位、单组category bar/input顺序与统计声明重新核对，旧check或handle不能授权。其它组件的render不能借claims伪装数值来源。

错误不自动修复：把缺失变为实测0、遗漏/打乱位置、换单位、错误分母或把完整均值未知写成0，均保存可读拒绝checkpoint，不交付坏图。对不支持的完整来源不跳过难句。原工具调用/摘要/注释留在会话原件，不篡改或倒推成模型正确。

只有完整核对通过后，宿主从来源重建一份**新投影**：保留已核ID/值与原单位，位置标签对应原顺序，去除当次模型summary/title/fullDataExplanation等未核注释的依赖，生成有限来源说明。它不是对任意模型正文做关键词编辑或判真。

## 保存、恢复与本地探索

checkpoint保存新投影、有限说明、source text SHA/own-turn消息定位及viewIdentity。`kind=observations-zh`必须对应DataChart；turn/displayId/revision/component不对应的metadata不接受。刷新和历史恢复只恢复当时快照，不用后来输入重新认证、推断或改写过去。此前metadata类型和无metadata旧协议仍保留原读取范围。当前来源投影缓存版本升为4，仅重放本会话事件以计算当前回合，不重新认证或改写历史checkpoint。

组件顶部注明**原始全部读数与统计范围**。已观测均值用非缺失分母；有缺失时完整均值保持unknown。下方筛选/补零对照是明确的本地探索，不能补齐原缺失或修改上方来源说明；刷新后局部筛选复位，保存的来源范围不变。

`identityVerified=false`、`sourceFactsVerified=false`，组件外自由正文未认证。没有新图型、外部脚本、会话库、跨设备状态、模型路由或用户动作回传。

## 证据层次

原N2输入、文件/文本SHA和独立预期沿此前冻结记录；本段先保存正常交付/拒绝与恢复合同。见 [数值交付回执](evidence/numeric-delivery.json)，区分源码检查、最终归档实际安装、Native/PTC确定性正反例、UI恢复、LinuxCI与公开发行。源阶段回执不能代替最终归档；冻结tar内保持当时阶段记录，后续证据补充到公开仓库，不重打包。

15及13的发行、14未发行候选、原0通过/6失败/18请求及全部首次失败保留；本段0真实模型推理，不改变此前自然题结果。仅本页明确的有限来源和宿主范围，不外推当前主客户端、手机、任意自然语言或全文正确性。
