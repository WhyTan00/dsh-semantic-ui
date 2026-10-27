# 明确读数来源与图表绑定

preview.15 / 协议1.4 的独立 MCP 增量。它把已有 `numericStats` 接到启动时固定的来源文件，再核对 DataChart 的每个值、缺失位置、单位和统计范围。不是任意中文解析、世界事实认证、DSH 新来源适配或 Codex 自定义富UI。

候选preview.14在公开发布前发现大量空格导致匹配超时，未发布；源码、归档及失败探针保留。preview.15将有界头部、列表和单位分开解析，并增加受超时保护的回归和归档实际输入检查。

## 有限来源合同

`--source-kind observations-zh` 接受完整选定字符串：

```text
主体N次测量读数是 数字、缺失、数字 单位。请解释这批数据，能计算平均值吗？
```

- 主体1–80字符、测量名1–40字符，作为字面标签；不解析它们的业务含义。
- N为1–128的阿拉伯数字，或标准中文一至九十九；必须等于列表位置数。
- 列表仅接受有限数字字面量（可带符号、小数、指数）或`缺失`，以`、`分隔；单位前必须有空白，单位为1–24字符的单一字面标签。
- 末句仅支持上例或`能计算平均值吗？`。完整锚定，不跳过额外、条件性、矛盾或难懂的句子。超限、非有限数、空位置、缺单位均拒绝。
- 数字沿JavaScript IEEE-754运算，不做隐含舍入或容差匹配；求和超限明确unknown。无时间信息、无单位换算、无加权/总体推断。百分比、百分点等不会互相换算；排序值也不会被当成比例。仅将明确单位下的读数作未加权算术计算。

文件、JSON指针和可选原文选段沿既有启动配置捕获一次；工具参数不能换源、选择kind或自称权威。文件摘要、文本摘要、选段摘要和UTF-8位置分别记录。选段外内容不在核对范围；文件摘要不认证作者。

## 图表与统计的实际绑定

`semantic_ui_source_check` 不带view时返回全部读数、来源位置、缺失mask，以及两个不同范围：

- `observed`：只用实际观测，保留实测0和负数；分母是有效观测数。
- `complete`：全部位置；任何缺失都会令完整均值保持null/unknown。无有效观测或数值求和超限时也保持unknown，不发布非有限结果。

传入view时必须带mapping：

```json
{"seriesId":"reading-series","rows":[{"sourceIndex":0,"rowId":"reading-1"}]}
```

这里仅展示一个坐标格式，真实请求必须覆盖全部位置。当前只支持**一组类别柱状图**：`chartType=bar`、`x.kind=category`、`x.order=input`，系列标签与来源测量名相同，单位逐字相同。row/series/display ID可自定；每个sourceIndex与rowId必须唯一、完整，实际行保留来源顺序，x为从`1`开始的位置字符串。没有依据就不声称时间间隔或排名。其它图型/排序/时间元数据在这个来源合同中拒绝，不影响原DataChart通用能力。

均值声明为 `{kind:'mean',population:'observed'|'complete',denominator,value,unit}`。完整均值未知时正确的value为null；即使把缺失填零后数值碰巧相同，也会因mask、范围或分母不一致被拒绝。标题、摘要、fullDataExplanation和自由正文仍是未核注释，不由字段匹配获得认证。

## 普通零推理使用

在源码仓库根目录使用已经核对SHA的preview.15归档；伴随Python客户端不在runtime包内。正确请求和故意错误的填零请求是公开可检查的例子：

```sh
python3 examples/codex-readonly.py --answer \
  --archive artifacts/releases/0.1.0-preview.15/whytan-dsh-semantic-ui-0.1.0-preview.15.tgz \
  --manifest artifacts/releases/0.1.0-preview.15/package-manifest.json \
  --source-file docs/evidence/natural/r9-N2.json --source-json-pointer /question \
  --source-kind observations-zh --component DataChart \
  --requests-file fixtures/source-numeric-request.json
```

将末行换为`--requests-file fixtures/source-numeric-zero-fill-request.json`可核对有意义的拒绝：源中缺失被改成实测0，已观测分母改成4，还声称完整均值0。尽管数值巧合相同，宿主不会交付“已核”答复。请求文件是显式数据投影，不是模型自然生成的验收。

`--answer`只接受一项source_check请求；不加requests-file时为来源读取`{}`。与`--model-candidate`同时传requests-file会被拒绝，防止混用有指引模型流程。所有这些正常命令均不发送turn/start。最终只采用该次来源检查器的有限说明；不对应、冲突或不支持时，canonical withheld，普通stdout明确拒绝，详细错误单独保存。preview.13不识别新kind，不能用旧归档冒充新功能。

## 证据层次

独立预期在实现前冻结于 [source-numeric-expectations.json](../fixtures/source-numeric-expectations.json)，原N2首次记录不改；另含不同主体、数量、数值、顺序、单位和ID的反例。源码测试、实际归档STDIO、正常Codex客户端、Linux CI和发行各按最终字节记录，见 [本段交付证据](evidence/source-numeric.json)。归档内保留源码冻结时的阶段回执；后续验收补充到公开仓库同路径，不重打已冻归档。

`sourceFactsVerified=false`、`identityVerified=false`、`freeProse.status=not-verified`保持。没有新自然模型回合，不回写原0通过/6失败/18请求，不把离线投影或客户端文字当DSH自然提问、当前桌面富UI、真机或读屏验收。
