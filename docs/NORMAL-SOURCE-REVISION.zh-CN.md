# 同会话的完整来源条件修订

**现有 preview.26 已能正确处理完整来源从“是”撤回为“未知”，再明确为“否”。** 本段只补实际隔离宿主证据和可复现的测试，运行代码、协议、版本和不可变归档均未修改，没有新模型调用、CI任务或发行。

这与本地试算分开：普通聊天提交完整的新来源后，当前回合重新核对来源并交付新视图；旧视图保留当时的来源快照。现有“补充未知条件”面板继续沿它原来的窄合同使用。增量指代消息（例如只有一句“刚才改成未知”）不在本次完整来源合同内。

## 固定来源与普通入口

事前独立判据于2026-10-27 14:26:43 UTC冻结，原件SHA-256为 `ebde53c86dc94f207915ff3fa059bc4bbbf5cf666ba19bb8e7b2aafa2bef43e4`。[公开安全摘录](evidence/normal-source-revision/criteria-cases.json)保留合成来源和判据，不冒充完整私有原件的同字节副本。

三份完整来源都说明：托管空间由供应商更新、没有私网；自建节点支持私网、需要团队维护；价格均未知；团队有维护余力。明确两分支规则为“若资料需在私网流转，则需要私网；否则不需要私网”，仅当前条件分别为是、未知、否。没有从供应商负责更新推出托管空间不需要团队维护。

每种模式各用一个独立的实际DSH会话，在该会话内依次调用既有公开 `session/prompt`，提交三份完整文本。来源身份字段由正常入口产生，没有手改producer。每个输入的requestId、持久message ID/seq、turn、source SHA和checkpoint均逐项对账。被测工作区为空的任务私有目录，验收预期不放入被测会话工作区或请求。

| 来源状态 | 当前条件与派生私网需求 | 私网硬条件的实际结果 |
|---|---|---|
| 是 | true / true | 托管空间fail，自建节点pass；仍不建立整体赢家 |
| 撤回为未知 | null / null | 两方案均unknown；不继承旧true，也不当成false |
| 明确为否 | false / false | 两方案该项均inactive；私网不再作为当前硬筛选 |

上表只报告私网这一项。价格和托管方案的团队维护需求保持未知，整体偏好策略为空，没有整体推荐。

## 原输入、新视图和旧历史的对账

| 模式 | 第1轮：消息seq → checkpoint seq | 第2轮 | 第3轮 |
|---|---|---|---|
| Native | 10 → 29 | 39 → 62 | 72 → 95 |
| PTC | 10 → 34 | 45 → 77 | 88 → 120 |

完整message ID、requestId、turn与SHA见 [Native原始选定证据](evidence/normal-source-revision/native.json)和 [PTC原始选定证据](evidence/normal-source-revision/ptc.json)。两种模式是各自的会话，不能混成一个session。

第二、三轮均先把上一轮已比对并用于交付的调用方view/mapping再次提交。当前来源核对返回 `SOURCE_INITIAL`，普通render拒绝旧初值，再交付与新来源一致的新视图。最终每个会话有3个来源绑定checkpoint和2个持久拒绝checkpoint；旧来源事件和旧checkpoint原件保留。

每轮都实际改变本地“当前需要私网”控件：显示的局部硬条件随之变化，来源说明、消息和checkpoint不变。只读journal cut和全部事件前后相等，没有新的传输请求。刷新后本地试算复位，各历史视图分别恢复true、unknown、false和各自的来源说明；新来源没有覆盖旧历史。

## 首次失败与证据层次

首次Native运行提交了前两份来源后，取证脚本从全部聊天历史中误选了旧source-check回执，断言失败。按当前完整输入之后的工具响应重新对账，实际新来源已为unknown，旧true视图被拒绝，新unknown视图正常交付。修复的是回执归属：先按真实输入边界选择，再检查结果，**没有按预期SHA筛选响应，也没有修运行代码**。首次原日志、旧脚本摘要及[对账说明](evidence/normal-source-revision/first-failure.json)保留，原UUID没有重发。

修正后的新独立QA运行中，Native/PTC各完成3次确定性fixture Agent回合、16个本机fixture HTTP请求。连同首次的2回合/10请求，合计8个fixture回合、42个本机请求；**真实模型回合与外部模型请求均为0**。这里没有可评读的模型原文，来源检查、正常交付和保存的界面分别留证，不能算自然模型理解通过。

使用已有26运行归档正常 `dsh plugin add` 到本任务私有profile，没有语义插件源码overlay；388个包内文件启动前和结束后均与同一原归档一致。类型检查通过，Native/PTC各pageerror0、360px容器无根溢出。首次和最终运行的自有宿主/fixture均终态，专用端口关闭。既有26 CI40515658647及Release425531255已查证终态；不重发、不重复下载已验资产。见[完整分层回执](evidence/normal-source-revision.json)。

`sourceFactsVerified=false`、`identityVerified=false`、`freeProseVerified=false`保持。正常入口得到的 `producer.kind=user` 是实际输入定位，不能认证独立人类身份或世界事实。原六题0 pass / 6 fail / 18 requests、A2勘误、此前所有2/2观察及中文26接受保持原范围。

## 复现与下一独立问题

取得原26归档并核对SHA后，在本仓库执行：

```sh
INSTALL_PACKAGE="$PWD/artifacts/releases/0.1.0-preview.26/whytan-dsh-semantic-ui-0.1.0-preview.26.tgz" \
NORMAL_CONDITION_ONLY=1 SOURCE_HOST_ONLY=1 \
NORMAL_CONDITION_CRITERIA="$PWD/docs/evidence/normal-source-revision/criteria-cases.json" \
node tests/host-lifecycle.mjs
```

这仍是确定性宿主验证。下一项有独立价值的问题是：**模型在保留旧视图与本地假设的聊天历史中，能否采用新完整来源的撤回，而不是继承旧结论。** 可另冻结两种普通解释任务：一份将已知true撤回为unknown并询问当前能否排除方案；另一份明确false并询问与unknown有何区别。每种都应保留源、实际工具调用、原始模型正文和宿主说明，分别核未知价格、维护责任和整体赢家。新问题、事前判据及模型范围另行固定；本段没有自动启动该观察，也不在任何旧2/2段追加第三次。
