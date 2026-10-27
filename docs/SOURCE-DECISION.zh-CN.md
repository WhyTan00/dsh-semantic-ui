# 普通比较问题的有限来源核对

后续preview.17新增[显式两分支条件来源](SOURCE-CONDITIONAL.zh-CN.md)：完整若/则/否则及当前布尔条件有独立出处，派生当前需求进入既有supports输入。它没有开放任意组件when，旧合同及下文的历史证据保持各自版本；[新包与模型/宿主接受](evidence/source-condition.json)单列。

开发候选 `0.1.0-preview.12-dev.1` 新增 `decision-zh` 来源模式，核对合同1.0，Envelope仍为1.4。这是现有只读 MCP 的可选模式；默认三个工具与原 `arrows` 模式不变。下文是该增量的文件来源合同与证据；后续dev.2的 [DSH当前输入适配](HOST-SOURCE.zh-CN.md) 复用同一核对器，另列实际宿主证据。两段均没有新Release、归档安装、模型调用或当前Codex客户端加载验证。

## 已能完成的任务

对调用者启动时固定的普通问题原文，完整解析下面公布的有限语法，区分：方案是否支持某能力、谁负责更新、是否需要某个责任人维护、责任人是否有维护余力、价格未知、当前硬需求与偏好。再对照 DecisionExplorer 的字段值、初始条件和要求方向，返回逐字段出处和有据的有限说明。

这条路径直接接受原 D1 的完整 `/question`，不要求把它先改写成模型自己填写的事实表：

> 虚构团队在选托管平台与虚拟机。前者由供应商更新、没有私网；后者支持私网、需要团队维护。两边价格都未知。我们暂时不需要私网，该怎样权衡？

独立预期在实现前固定于 [最小公开预期](../fixtures/source-decision-expectations.json)。原件 [r9-D1](evidence/natural/r9-D1.json) SHA-256为 `d47b26ee4b18104228b5a9c76b51c15079c65cc080be4f96b0c31fedf25c2b61`，问题文本SHA-256为 `c5bf2820e29db28ebed0c30be9fa6473b57ff9e46def418e82658705055360a1`。

该来源只能支持：

- 托管平台由供应商更新、不支持私网；是否需要团队维护未声明，不能自动填false。
- 虚拟机支持私网、需要团队维护；是否由供应商更新未声明，也不能自动填false。
- 当前不需要私网，不据此排除缺少该能力的方案；团队维护余力未声明，保持null。
- 两边价格未知，不能添加元/月、月费、便宜/贵或推荐结论。

原首次view中的反面false、维护关系 `supports` 和擅加的价格单位会被拒绝。改成 `requires-availability` 只修正关系方向，不会使其它事实自动正确。明确另写的来源对齐夹具可以通过；它不是重新生成的自然题答案，原首次结果没有改写，run9仍0通过/6失败/18请求。

## 正常使用入口

```sh
node dist/mcp.js \
  --source-file /absolute/path/to/source.json \
  --source-json-pointer /question \
  --source-kind decision-zh
```

也可指定纯文本文件，不传JSON pointer。无需 `--source-excerpt` 即可处理上例完整问题；若调用者主动裁剪，核对范围仅限裁剪后的片段，不认证被移除的上下文。来源快照、文件/字节限制及启动后不自动重读的合同沿 [来源核对](SOURCE-CHECKS.zh-CN.md)。请求不能替换文件、原文、模式或认证身份。

显式配置后，第四个工具仍名为 `semantic_ui_source_check`。先以 `{}` 检查来源事实和未知，再传真实 `view` 与 `mapping`。映射只指定输出字段对应哪个来源概念，**不提供事实真值或授权**；实际值必须对照已固定的原文。

```json
{
  "mapping": {
    "dimensions": [
      {"id":"net","kind":"capability","name":"私网"},
      {"id":"updates","kind":"actor-updates","actor":"供应商"},
      {"id":"maintenance","kind":"maintenance-need","actor":"团队"},
      {"id":"price","kind":"price"}
    ],
    "inputs": [
      {"id":"need","kind":"capability-need","name":"私网"},
      {"id":"available","kind":"actor-available","actor":"团队"}
    ]
  }
}
```

这个片段说明映射结构，须与带相同字段ID的实际 DecisionExplorer `view` 一起使用；单独传映射不会报告图已匹配。IDs可任意改变，方案按精确且唯一的来源名称对应，视图行顺序不影响前后者解析。新增方案、同义词猜测、角色自证和漏映射都不算通过。

支持的维度为 `capability`、`actor-updates`、`maintenance-need`、`price`；输入为 `capability-need`、`actor-available`。布尔字段无单位；未知价格用未声明kind/unit的null列。要求必须分别使用能力→需求的 `supports`，或维护负担→同一责任人余力的 `requires-availability`。有条件的when、任意约束、推荐规则和权重不在本合同中。偏好不构成硬需求，已有1.4角色/作用校验仍独立执行。

返回的 `fieldChecks` / `inputChecks` 分别列出实际值、来源预期、来源是否明确声明、出处范围与 matched/unknown/declared-unknown/mismatch。只有来源比较匹配时才附上原有确定性 `computedDecision`。余力已知不会填补未知的方案责任；现有保守null求值保持。`canonicalExplanation` 只由解析出的声明与未知组成，出现不匹配或越界说法则withheld。

也可用受限 `claims` 核对单项陈述：已知kind与上述来源概念相同，另有 `preference`；使用精确 `option`、`name` 或 `actor` 及boolean/null `value`。例如 `{"kind":"maintenance-need","option":"虚拟机","actor":"团队","value":true}`。价格只核对未知，不推算金额。其它说法只传 `kind`/`text`，如 `{"kind":"cost-ranking","text":"某方案更便宜"}`，明确返回未核对；不能在已核对布尔陈述里夹带解释text。

## 公布的有限语法

源文本须完整符合以下范围；不是通用中文理解器，也没有隐藏模型兜底：

| 部分 | 语法 |
|---|---|
| 开头 | `主体在选/在选择/在比较方案甲与/和方案乙`；恰好两个不同字面名称。主体只作标签，不认证用户或解释主体内的业务条件 |
| 方案引用 | `前者`、`后者`或精确方案名；逗号/顿号内可延续最近明确方案，句号/分号/换行后必须重新指明方案 |
| 能力 | `支持X`、`不支持X`、`没有X`、`X支持未知` |
| 更新责任 | `由责任人更新`、`不由责任人更新`、`责任人更新责任未知`；不等于团队维护负担 |
| 维护负担 | `需要责任人维护`、`不需要责任人维护`、`责任人维护需求未知` |
| 价格 | 方案下的`价格未知`，或`两边/两者价格都未知/价格未知` |
| 当前硬需求 | `我们[暂时/目前/现在]需要X/不需要X`、`我们对X的需求未知` |
| 偏好 | `我们[目前/现在/暂时]更看重X/偏好X`；不能据此创建硬要求或推荐策略 |
| 资源余力 | 已在责任事实中引入的精确责任人`有/没有维护余力`、`维护余力未知/未说明`；不自动把“我们”或新词指向某个责任人 |
| 问法 | `该怎样权衡`、`如何权衡`、`该如何权衡`、`应该怎样选择`、`该怎样选择`、`怎么选`、`请比较` |

名称最多80字符，由字母、数字、中文、空格、下划线或连字符组成；不能含需要、支持、没有、未知、负责、如果、但/且、与/和等保留结构词。复杂连接、未支持的同义词、未来计划、数字价格、不明指代及矛盾整段返回 source-unsupported，不跳过难句后宣布完成。

输出字段标签也有明确有限表达。例如能力列用`X/支持X/X支持/是否支持X`；更新列用`由责任人更新/责任人更新/责任人负责更新/是否由责任人更新`；维护列用`需要责任人维护/需责任人维护/需责任人自行维护/责任人维护需求/是否需要责任人维护`；价格列只用`价格`。需求输入用`需要X/当前需要X/是否需要X/X需求/当前X需求`；余力输入用`责任人有维护余力/责任人维护余力/责任人是否有维护余力`。完整合同亦可从实际MCP schema与 `src/source-decision.ts` 核对；未识别的标签不会被模糊匹配成已验证角色。

## 证据与仍未完成的范围

原问题内容对照、源码入口与最终构建入口分别见 [本轮证据](evidence/source-decision.json)。测试包含原首次反例、改名称/ID/视图顺序、能力反向、当前硬需/不需要/偏好、维护否定及actor方向、余力肯定/否定/未知、缺字段、矛盾/指代、成本/推荐越界、请求换源拒绝和旧协议读取。

旧1.0–1.4按原合同读取，不补角色或改历史；需要1.3 `requires-availability` 的新来源对照不能通过声明旧版本来改变旧语义。来源作者、原用户身份、任意自由正文及世界事实仍未认证，`sourceFactsVerified=false`。现有公开DSH会话接口不等于独立真人签名；dev.1证据不包含DSH原消息来源接入；后续dev.2另见 [实际宿主适配](HOST-SOURCE.zh-CN.md)，仍未加载到当前Codex客户端。最终构建入口通过也不代表归档安装或自然模型理解通过。

锁定DSH commit的 [会话事件类型](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/core/session/src/types.ts) 明确 `user/message` 也承载合成上下文；[消息类型](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/packages/llm/llm/src/message.ts) 的 user source标签本身不是principal或签名证明。这里区分“收到的消息/配置文件内容”和“独立人类身份”，不把尚未接入说成接口不存在。
