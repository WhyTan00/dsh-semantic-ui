# 可发现的容量字段合同与精确诊断

preview.24 候选修复的是工具合同的可发现性和诊断，容量来源、算术、允许标签和正常投影规则保持原边界。最终归档安装/CI/公开交付另记，不能由开发检查推定。

23上的一个新受控合成模型观察，原始答复正确区分当前和未来可能需求，但其7次新view来源比较没有matched。实际初值、单位和at-least方向正确时，“需求”“本地容量需求”等标签仍被有限合同拒绝；旧错误将标签、类型、单位、初值等合成一个 `SOURCE_CURRENT_DEMAND`，没有给出允许标签，模型因此反复猜字段。首次原文与全部拒绝保留，不能因正文正确或宿主canonical完整而补记新view通过。

## 现有约束先公开

`semantic_ui_source_check` 在完整容量源可解析时返回 `viewContract`：

- 实际 component/protocol、mapping到字段ID的坐标说明。
- 单数值维度的字面标签 `容量上限`、kind与精确来源单位。
- 单数值输入的已有允许标签 `需求容量` / `需求容量（本地假设）`、type、精确单位、来源当前初值和 `expectedEffect:hard`。
- `omittedFields` 明示数值字段不带布尔 semanticRole/choices，硬条件不带when；at-least方向、空规则/约束与定性属性的独立说明。

这是字段合同，不是完整正确view、题目答案或授权。模型和普通调用者仍须自己建立实际ID与合法载荷。来源工具既有的有限说明保持原合同；当前需求、未来可能点、部署/维护未知、作者/世界事实和自由正文的边界不变。

## 错误定位到真正字段

标签不符返回 `SOURCE_INPUT_LABEL` 和具体 `.label` 路径，并指出已有允许标签；正确的180MB仍在 `inputChecks` 中matched。只有初值真的不同才返回 `SOURCE_CURRENT_DEMAND`，单位、数量、类型、效果与维度也分别定位。通用协议的 `ROLE_TYPE` 拒绝仍保留，并附可用的字段合同帮助纠正。

没有增加同义词白名单、题号/ID例外或自动修理被拒数据。未知标签、交换上限、错单位、错当前、反向硬条件、额外定性列/偏好策略仍被拒绝。调用者必须显式选择已有合法标签，再重新提交；正常render仍重新核来源，构建完整来源投影。

MCP说明、DSH describe/正常source-check与归档技能同时指向 `viewContract`，避免只在测试或某个客户端偷偷补标签。组件协议仍1.4、checkpoint与sourceDelivery结构不变；23资产及原自然失败不重包、不重写。

## 必要验证与观察分层

[回归数据](../fixtures/capacity-diagnostic-request.json)来自首次真实模型失败请求的安全子集，仅用于0模型诊断回归，不冒模型成功。检查旧请求仍因标签拒绝、实际当前量不被误报、调用者显式改标签后matched，以及错误数据/方向/角色继续拒绝。

正常MCP stdio和DSH Native/PTC需要实跑“错误标签source-check/render拒绝 → 明确改标签 → 新source-check/render和checkpoint刷新”；新包必须沿正常安装加载，不能以源overlay代替。24的真实模型采用另用先前已经冻结的第二个独立对照，最多剩1回合，不能重跑首题或追加第三回合。原始raw、模型工具、首次新view比较与宿主说明分别评读；任何UI或模型采用成功均需实际证据，不由本修复推断。
