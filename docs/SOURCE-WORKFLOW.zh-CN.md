# 明确失败规则的来源核对

冻结发行后另有[两个真实模型引导观察](CODEX-WORKFLOW-OBSERVATION.zh-CN.md)，复用下述22运行字节：G的明确规则与未知分支正确，附加边界覆盖partial；H未知策略保持、首次新图比较matched。该2次观察独立于下面0模型发行接受，不更新旧自然题结果或归档。

[preview.22已公开预发布](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/v0.1.0-preview.22)，冻结源码/tag `a0ca980884adbc21d476ffcf92133e3305df67cc`。组件协议仍为1.4，DSH0.2.1-rc.2。371文件最终归档在macOS/Linux的Native/PTC各6例及旧1.0图恢复通过；正常`--answer`正例delivered、错误支付回滚withheld，双层wire一致、0新模型。CI40479181323成功且四资产与匿名HTTPS200下载同字节，完整[分层接受](evidence/source-workflow.json)为冻结后的独立提交，不回灌或重打归档。

原问题在[首次A2记录](evidence/natural/r9-A2.json)的`/question`，全文SHA-256 `aee8484a0dc18764e15eaa2713e5ceffbae6399e12412e100eb32e85875839b0`。原文件SHA `17a3d65a7367f5b4686b9cc57867e7bbc265e11ff5f91fb9d1d00a2f59f2104e`。本次[独立事前判据](https://github.com/WhyTan00/dsh-semantic-ui/blob/main/fixtures/source-workflow-expectations.json)在实现前固定，不从结果改预期。原[共享支付→通知的归因勘误](GROUNDING-FOLLOWUP.zh-CN.md)和首次模型正文/0通过6失败18请求保持；本有限修复不把旧自然A2判通过。

## 核对什么

| 声明 | 有据范围 |
| --- | --- |
| 入口→鉴权→库存→支付、支付→通知 | 四条给定有向拓扑；每条有UTF-8来源范围 |
| 通知失败只重试通知 | 触发分支为通知失败，仅重试对象为通知，不扩为整个流程 |
| 此分支不回滚支付 | 明确给定的局部负向规则，可核；不等于支付已经完成或必成功 |
| 库存失败的补偿/重试/回滚 | 未声明，保持未知，不能套用通知分支 |
| 故障传播、反向回传、实际执行/阻塞、上游已完成、次数与必成功 | 不从拓扑或重试规则推出；typed未知声明not-assessed，任意正文不认证 |

这是合成来源中的规则映射，不执行支付、回滚、通知或任何外部动作。`sourceFactsVerified/identityVerified/freeProseVerified=false`始终保持。

## 完整有限语法

完整所选文本必须全部被支持：有界可选流程头（如`虚构订单流程为`、`合成处理链为`），字面`→`/`->`链，明确`失败/出错`触发、`只/仅重试`对象和`不回滚`对象。规则的两个动作分句可以调换；支持`若通知出错，不回滚支付，仅重试通知`及不带`若`的原形式。节点标签必须确切出现在拓扑中；不按题名、固定ID或原句选择答案。可选问题形式为`甲出错与乙出错分别会影响哪里`或单分支形式，仅记录查询对象，不从问句造事实。

完整来源最多16384 UTF-8字节、80个节点；单个拓扑分句最多80个箭头断言，分句去重关系数累计最多80、12条不同触发规则；还受既有图schema与回执预算约束，超限明确拒绝，不截规则。重复触发、残缺动作、未列语法、相反政策`回滚支付、不重试通知`或额外保证会使**整个来源unsupported**。相反政策尚未支持，不能沿用此前matched。`workflow-zh`拒绝从较大来源选出的箭头子串；原`arrows`模式仍仅核选段拓扑，不能据此称全问题/异常规则已核。

## 核心、映射和正常交付

`semantic_ui_source_check`或DSH `action=source-check`省略view时返回完整拓扑、规则和查询对象。触发、仅重试和不回滚分句分别保留来源范围；文件入口保留document/text/excerpt hash和JSON pointer，原生入口保留当前own-turn消息身份与全文hash。

比较ArchitectureExplorer时还需显式映射所有规则到实际节点ID：

```json
{"mapping":{"failurePolicies":[{"trigger":"notify-id","retryOnly":["notify-id"],"noRollback":["payment-id"]}]}}
```

坐标不提供真值。拓扑四边匹配而缺失规则、换触发、扩大重试或错误不回滚对象均为mismatch；来源无规则时必须显式给空数组，不能造原规则。不同来源每次重核，旧检查或delivery handle不能授权新render。支持的typed claims使用**原文字面标签**：`{kind:"retry-only",trigger:"通知",nodes:["通知"]}`和`{kind:"rollback",trigger:"通知",target:"支付",value:false}`；与明确规则相反为contradicted，未给触发/对象为not-assessed。其它kind只能给text并保持not-assessed，不按正文关键词删句或认证。

DSH普通`render`在核心完整比较通过后，才从当前来源派生新的节点约束、拓扑路径说明和完整规则说明。候选的标题、职责、约束、边标签、情景说明和摘要整段不进入有据投影；这是一次从来源重建的projection，不是对模型正文删词。错误映射/typed claims先拒绝，不能自动修成成功。完整来源说明出现在正常聊天组件和返回回执，并经原生checkpoint保存/恢复。节点选择可以查看对应局部规则；图高亮只是拓扑路径，不是模拟执行器。

复用原三组件、统计/布局与模板合同，没有新图引擎或组件payload字段。新`sourceDelivery.kind=workflow-zh`需要22及兼容reader；新reader继续读取旧1.0–1.4组件和既有来源metadata，旧21 reader不承诺读取新来源kind。不会重写旧日志或改变旧checkpoint含义。

## 普通答复入口

本仓库的`examples/codex-readonly.py`新增显式`--source-kind workflow-zh`，默认仍是已有decision-zh。正常`--answer`消费同一个来源checker的有据说明，默认0模型；不用新正文模板替换数学/拓扑核心。冻结包和manifest必须对应，命令使用本人既有个人CLI入口，不把Codex登录当DSH API key：

```sh
python3 examples/codex-readonly.py \
  --archive artifacts/releases/0.1.0-preview.22/whytan-dsh-semantic-ui-0.1.0-preview.22.tgz \
  --manifest artifacts/releases/0.1.0-preview.22/package-manifest.json \
  --source-file fixtures/workflow-source.json --source-json-pointer /source \
  --source-kind workflow-zh --component ArchitectureExplorer \
  --requests-file fixtures/source-workflow-request.json --answer
```

正例与`source-workflow-refused.json`支付回滚反例使用同一全文来源。最终正常入口实测结果单独记录，不把离线helper或新schema当用户已得到答复；没有新模型候选、付费API、全局注册或主客户端UI采用宣称。

## 验证层次

开发阶段：原全文与事前预期hash、四拓扑/三类规则范围、矛盾/未知/缺覆盖、相反/缺失/局部来源、同义与标签ID变化、普通binder、真实stdio MCP及旧拓扑/模板/历史窄回归。原生开发构建Native/PTC各六例：原文与异名正例、先matched后缺覆盖、错误回滚、同会话新相反来源和旧1.0图恢复；检查节点详情、完整来源说明、正常消息可见、刷新/重开、360px与pageerror。首次宿主测试实际已拒绝相反政策，但测试错取同会话旧delivered回执；原失败保留，修正到当前源消息后的工具回执，没有改规则或独立预期。

最终包须先逐字节核所有安装文件，再做同一必要路径及Linux定向CI，Mac/Linux四份资产与匿名HTTPS分别核对。原自然正文、世界事实、真实手机/读屏和全GenUI替代仍未完成。本段新模型严格0，0520既有2/2不重置，旧21及更早资产、六题矩阵不重演。


最终归档与开发构建各有不同原件。额外在同一已安装22归档中只读补页打开较早Native记录，等待布局稳定后确认360px图框内五节点完整可见，[截图](evidence/source-workflow/workflow-rules-360px.png)与几何坐标单列。首次截图抓到布局动画过渡，不作为最终可读性图；前三次附加诊断未展开/补页的侧栏导航超时也保留。冻结后的测试脚本追加等待几何稳定，属于验证修订；不把它写成原Linux矩阵已执行的额外断言，不改renderer或重包22。真实手机/读屏仍未验收。
