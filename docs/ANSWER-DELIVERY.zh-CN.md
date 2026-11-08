# 完整答复与有限来源交付

`codex-v0.1.0-preview.31.2` 是独立离线核心及正常文件入口的伴随包，使用当前源码，不借用旧DSH31/伴随31.1的核心字节身份。它不安装到当前聊天、注册新工具或启动MCP。原DSH发行、中文切换与用户现页沿用。

结构匹配、一条正确断言、有效校验和都不能批准整篇回答。例如“已观测3个读数的均值为0摄氏度，并且这证明设备永不故障。”，旧有限断言诊断能识别均值，但同句额外保证可能没有出现在`uncovered`中。此次不扩充关键词或自然语言语法，也不把原段落裁成一份“通过”的答复。

`checkAnswerDelivery`接收原始view、字段映射、可选完整候选和独立来源快照。全部view文字与候选始终是未核数据；诊断的断言范围不是文字覆盖证明。`coverage`把完整规范化view JSON及逐字候选列为全范围未核，`wholeCandidateVerified`和`wholeViewProseVerified`始终为false。候选由调用者提供，不能由此证明它等于聊天正文；`externalAssistantBodyIntercepted=false`保留这个边界。

交付只允许两种结果：

- `limited-source-output`：原view通过既有有限来源核对，且既有来源构造器可为完整选定文字生成程序说明。`text`只取这份说明，`textOrigin`为`program-derived finite source projection`，原候选仍未获批准。
- `refused`：无独立来源、来源摘要/范围不完整、旧绑定、历史来源变化、原view不匹配或没有有限程序说明时，`text=null`，不会从候选里摘出片段代替。

程序说明沿用工作流、直接访问权限、决策、容量和有序读数五种有限语法。任意概念性解释及仅有箭头拓扑没有这份完整说明时保持拒绝。来源是调用者本次明确选择的文字，不认证作者、权限或世界事实。

## 正常文件入口

在本仓库使用已有入口，完整候选文件最多24,000个UTF-8字节：

```sh
node --import tsx scripts/result-local.ts \
  --result-file docs/evidence/codex-result-interop/examples/capacity-returned.json \
  --answer-file fixtures/result-answer-mixed.txt \
  --mapping-file fixtures/result-capacity-mapping.json \
  --source-file fixtures/capacity-source.json --source-json-pointer /text \
  --source-kind capacity-zh --require-source --emit grounded
```

这份公开合成候选混入“未来必定已有9999GB容量”。输出只有来源中的容量、当前需求和可能的未来需求，不继承该保证。省略`--emit grounded`得到中文回执及完整原document；`--emit document`只是原合同数据迁移，不能当作有据答复。编译包里的同一入口是`plugins/semantic-ui-checks/dist/result-local.js`，依赖已编入，无需MCP连接或全局安装；包内README提供自带样例的完整命令。

结果回执用`structuredStatus:checked`表示原有限结构匹配；顶层成功改为`limited-delivery`，不再使用笼统的`checked`。缺源读取为`checked-unverified`，明确要求来源或有据文字时非零退出；原view不匹配为`source-mismatch`；来源匹配但交付条件不满足为`delivery-refused`。这些状态不代表模型原回答通过。

## 绑定与失效

每次重算`answerDelivery.binding`：校验器合同版本、独立来源文件/文字/范围的SHA-256、完整view及规则SHA-256、映射SHA-256、含候选的组合SHA-256。来源快照在读取结果前捕获一次，没有后台重载。必须覆盖完整选定文字；`--source-excerpt`若只选其一部分，不能冒作完整来源来交付。

需要沿用前一次精确条件时，把回执的`answerDelivery.binding`另存为JSON，通过`--binding-file`传入。来源、view修订/规则/任何文字、映射、候选或合同版本不同都拒绝旧绑定。绑定用于一致性检查，不是签名或身份认证；提交伪造的`verified`、覆盖证明或包内换源字段不能提升批准。原包、null/unknown、A/B、草稿、语言与主题保留。

## 本次证据

131项答复/正文定向检查、45项核心/协议/结果回归及类型检查通过，含同句漏项、矛盾、无据段、旧候选/源/映射/规则、部分来源、伪造证明、原包保留与超限。保存六题离线复核：四份原view来源不匹配，N2/T2无本插件原view，六份原正文均保留未核；五种既有程序参考可输出有限说明，T2保持拒绝。这是程序参考替代与拒绝验证，没有把任何原模型失败改判通过。

实际文件入口的读取、原合同输出、有据输出、缺源/错源/旧绑定与文件限制检查另列在[新回执](evidence/answer-delivery.json)。MCP实现完成静态编译；本轮没有连接MCP、访问浏览器/DSH、调用模型或改全局配置。原六题仍为0通过/6失败/18请求；原宿主消费者、模型自然采用与Codex原生富UI分别未验。

[31.2公开预发布](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/codex-v0.1.0-preview.31.2)已完成：干净源码/tag `beed0c7af350b305e7ea2c6da558576dbac4bef3`，240文件、ZIP847368字节，SHA-256 `155f335b687c67da13b7a62d713152a900c39bec5e98acabb9cc746e6bfd7ed8`。最终编译入口19项通过，实际冻结core复核六题及自带样例通过；三公开工件匿名全量下载HTTP200、字节/SHA和GitHub服务器digest均一致。本接受单独提交，不重打或修改冻结包。
