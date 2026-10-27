# Codex数值来源：两个新合成样本的模型观察

后继[显式宿主补零模式](CODEX-ZERO-FILL.zh-CN.md)已用新C/D来源零推理验证：C正常交付假设值，D因旧核心不可得而明确partial。本页A/B原始观察、stdout与客户端字节保持原结果，没有回填或重跑。

2026-10-27，复用已冻结的preview.16运行包与现有个人Codex薄客户端，完成**两个新增observed model turns**。模型在两题中都实际调用了来源工具，原始候选按独立预期评读通过；两次首次结构化比较都被拒绝，随后在各自同一回合内修正。它们是显式skill与通用工作流指引下的受控合成样本，不能外推为无指引采用、真实业务通过或DSH图表已经渲染。

总览与逐项原文见 [回执](evidence/codex-numeric-observation.json)、[A全部语义工具调用及候选](evidence/codex-numeric-observation/A.json)、[B全部语义工具调用及候选](evidence/codex-numeric-observation/B.json)。完整原始事件保存在私有记录，公开导出保留工具参数、结果、候选全文与原件摘要，去除临时路径、Native标识及账户通知。

## 普通问题与来源分开

旧客户端从source-file提取模型问题，又用问题SHA核对来源SHA，无法表达独立的普通问题。现在可传`--question-file`，并可用`--question-json-pointer`选取其中的字符串；它们只用于`--answer`模式。未传时仍用原source-file/json-pointer文本作为问题。

来源身份从独立source-file/json-pointer计算。启动前固定document/text/excerpt SHA、JSON pointer与UTF-8选段范围，模型前后两次检查必须全部对应；选段没有替代全文摘要。来源身份与世界事实认证标记继续为false。预期和评分文件不进入模型工作区、skill、developer指引或提示。

使用仓库当前伴随脚本与已下载的16归档，可执行同类输入：

```sh
python3 examples/codex-readonly.py --answer --model-candidate \
  --archive artifacts/releases/0.1.0-preview.16/whytan-dsh-semantic-ui-0.1.0-preview.16.tgz \
  --manifest artifacts/releases/0.1.0-preview.16/package-manifest.json \
  --source-file fixtures/codex-numeric-observation/B-source.txt \
  --question-file fixtures/codex-numeric-observation/B-question.txt \
  --source-kind observations-zh --component DataChart
```

这会新增最多一个候选回合。去掉`--model-candidate`仅输出原始来源的有限说明，新增模型回合为0。两个文件都是明确编写的合成样本，未将来源配置或API的user输入类型当真人身份。脚本为源码伴随工具，不在已冻结的16归档内。

## 事前预期与实际结果

[来源及普通问题](../fixtures/codex-numeric-observation/)与[独立预期](evidence/codex-numeric-observation/expectations.json)在实现、检查器运行和模型观察前冻结。预期用字面读数和独立算术生成，没有从插件输出倒推。

| 样本 | 来源及独立预期 | 原始候选评读 | 首次比较与同回合修正 |
|---|---|---|---|
| A | 电压`1、4、缺失、8、11`伏；4项实测均值6伏，完整5项均值未知 | 明示实测位置/分母4、完整分母5与未知；不把缺失当0，不推时间或总体均值 | `SOURCE_ORDER`：x写成“位置1”等；改成`"1"`至`"5"`后matched |
| B | 电压`0、缺失、6、18、缺失、24`伏；4项实测均值12伏；补零假设6项均值8伏；完整真实均值未知 | 保留实测0与两个缺失；算出合法补零假设，未冒充完整真实均值；未据低于12伏就断言低估真实值 | `SOURCE_SERIES`及`SOURCE_ORDER`：改写了测量标签与x；恢复精确“电压”和位置字符串后matched |

B还正确给出：两个未知读数的数值若为a、b，完整均值为`(48+a+b)/6`伏；等于8伏需要`a+b=0`，目前没有依据确认。没有要求两个缺失都等于0，未根据已观测值推定缺失值范围或偏差方向。以上是对本次候选的人工评读，不是新增任意正文认证器。

两题各有**6次本包模型工具调用**：来源读取、schema、check、首次source比较拒绝、check修正、最终source比较；另各有2次内置MCP资源发现。模型工具采用由真实`mcpToolCall`事件确认。宿主另有各3次显式schema/来源调用，单列保存，没有算成模型主动使用。每题stdio原件中的9次语义工具调用与这两类来源对应。

## 四层证据与剩余范围

- **指引提供与接口接受**：包内skill被发现、逐字读取，以官方typed skill输入提供，回合正常接受。内部逐字注意不可观察。
- **实际模型采用**：两题都读取本次来源，并提交自己生成的DataChart及完整mapping/均值声明；最终匹配的SHA与选段范围均对应本题。不是手写view后冒充自然生成。
- **原始正文**：完整候选单独保留；按事前有限判据两题均通过，首次工具拒绝未覆盖。
- **宿主最终保障**：本次观察的最终stdout只交付原source_check的canonical说明，保留原始实测均值、完整未知及false身份边界。**本次B的8伏假设只在模型候选中计算，宿主canonical没有交付经程序认证的该项假设答复。** 因此不能声称该次普通问题已由宿主完整保障。

两组新来源另有[零推理确定性反例](evidence/codex-numeric-observation/counterchecks.json)：正确投影/声明通过，缺失冒实测0、补零均值冒完整事实、实测分母换成总位置数均拒绝。合法补零计算本身没有被一概禁止。首次离线评读误期待MCP提供DSH的`SOURCE_STATISTIC`错误码；原MCP回执已在claimChecks中标mismatch且withheld，修正的是评读断言，没有改检查器或事前算术判据。

## 字节与运行边界

实际模型观察使用[客户端commit f3f755e](https://github.com/WhyTan00/dsh-semantic-ui/blob/f3f755ed36d4f06b18fef13cf98acd3f78d10642/examples/codex-readonly.py)，客户端SHA为`8ade2dbab4bbab70b8852264e87bfd0256cf25e9d64a49caf727f5fede61eab5`。16归档SHA为`55e81da124ae0db8ae2696b58a1349de5b290c558e137f0228f493a0416ec9ae`；MCP/core/protocol/skill实际字节与来源/问题摘要见回执。

两次观察之后，伴随客户端通用workflow补明“series.label精确等于源测量名、x为纯1-based字符串”，并明确补零假设与来源声明的区别。它不含本题数值、名称、答案或评分。10项离线客户端合同在澄清前后通过；新指引的自然效果**未再运行模型验证**。新旧客户端SHA见[后续澄清](evidence/codex-numeric-observation/guidance-followup.json)，不将旧结果归给新字节。

Codex CLI0.164.0沿正常个人ChatGPT登录，模型/推理/provider/tier保持`gpt-6.1-sol/max/openai/default`。本段仅2个observed turns、2次客户端turn/start；每回合内部的后台推理请求数未公开，记unknown，不称免费或仅2次后台请求。没有第三次自动重试、账户/模型/全局路由变化、全局安装或主会话切换。官方接口来源为[OpenAI Docs：App Server](https://learn.chatgpt.com/docs/app-server)。

五个自建stdio运行（零推理预检、两组反例、A/B）均已退出，临时技能与目录清理、配置摘要不变，见[清理回执](evidence/codex-numeric-observation/cleanup.json)。未重复16的发布、下载或DSH/Linux矩阵；原0通过/6失败/18请求、旧自然题与既有发行保持各自原结果。当前桌面富UI/设备、来源作者、世界事实、任意自由正文仍未认证。

本次暴露的后续价值点已由[新的显式宿主模式](CODEX-ZERO-FILL.zh-CN.md)推进，仍保留计算不可得边界。不能用拒绝错误事实代替回答合法假设，也不能用本段两个受控候选称项目普遍完善。
