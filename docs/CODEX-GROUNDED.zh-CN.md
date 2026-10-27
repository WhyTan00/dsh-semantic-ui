# 受来源约束的普通答复

后续伴随入口增加[同thread完整来源修订](CODEX-SOURCE-HISTORY.zh-CN.md)：`--revision-file`正常换MCP启动快照并核新来源身份，默认两版都是零模型；显式model-candidate时最多两个候选attempt，旧历史和新当前值分别保存。使用当前仓库Python脚本及原26运行包，不改旧归档。

显式[补零假设模式](CODEX-ZERO-FILL.zh-CN.md)已进入伴随源码：`--answer --hypothesis zero-fill`完整绑定原来源后复用已有统计核心，另列假设均值与相对观测差；默认用法不变，0模型。正常值与计算不可得边界分别验证，不将未知字段补造0。

后续伴随源码已支持独立`--question-file`及可选`--question-json-pointer`；未传时保留原默认问题。preview.16的两个新合成来源观察、首次拒绝与候选原文见 [数值模型观察](CODEX-NUMERIC-OBSERVATION.zh-CN.md)，不要与本页原13的两次模型结果混算。

这是现有 [只读客户端](CODEX-EXPLICIT.zh-CN.md) 的伴随源码增量，复用已发布 preview.13 的MCP/core/skill，不修改或重打归档。默认仍为零推理；最终答复可以直接由现成检查器给出有限说明。

| 运行方式 | 新推理回合 | 输出 |
|---|---:|---|
| 原命令，不加选项 | 0 | schema和source_check原结构化结果 |
| `--answer` | 0 | 宿主交付来源内的有限说明，或明确拒绝 |
| `--answer --hypothesis zero-fill` | 0 | 来源完整匹配后另列现有核心的补零假设；不可得时明确partial/unknown |
| `--answer --model-candidate`，未传revision-file | 每次最多1个 | 显式skill/工作流指引下的模型候选另存，最终仍由宿主保障 |
| `--answer --revision-file …` | 0 | 同线程切换两份完整来源，分别交付宿主说明 |
| `--answer --model-candidate --revision-file …` | 最多2个attempt | 第一真实候选结束、来源实际切换后才开始第二回合；不重试、不预填历史 |

## 正常使用

在当前仓库源码根目录，沿用已经下载的preview.13运行包和manifest：

```sh
python3 examples/codex-readonly.py --answer \
  --archive artifacts/releases/0.1.0-preview.13/whytan-dsh-semantic-ui-0.1.0-preview.13.tgz \
  --manifest artifacts/releases/0.1.0-preview.13/package-manifest.json \
  --source-file fixtures/codex-decision-source.json \
  --source-json-pointer /question
```

这条已验证的命令输出普通可读答复，保留价格、反面责任和团队余力的未知。可换成自己的明确来源；有限语法和输入合同沿 [箭头选段](SOURCE-CHECKS.zh-CN.md)、[decision-zh](SOURCE-DECISION.zh-CN.md)、[permissions-zh](SOURCE-PERMISSIONS.zh-CN.md)及15起的[数值来源](SOURCE-NUMERIC.zh-CN.md)。不支持的完整来源会得到拒绝，未默默跳过难句。

另两种来源各完成了一次真实零推理答复验收，复用原A2/A3来源和先前独立预期。关系题仅选定原文中的箭头片段：

```sh
python3 examples/codex-readonly.py --answer \
  --archive artifacts/releases/0.1.0-preview.13/whytan-dsh-semantic-ui-0.1.0-preview.13.tgz \
  --manifest artifacts/releases/0.1.0-preview.13/package-manifest.json \
  --source-file docs/evidence/natural/r9-A2.json --source-json-pointer /question \
  --source-kind arrows --source-excerpt '入口→鉴权→库存→支付，支付→通知' \
  --component ArchitectureExplorer
```

`--source-excerpt`逐字透传给包中已有的选源逻辑。来源摘要绑定完整所选字符串，同时另记选段摘要和UTF-8字节范围；这里输出四条有向关系，**不回答原题中片段之外的通知重试、支付回滚或故障影响**。这是调用者明确选段，没有把完整自然问题宣称为支持。

权限题可直接读取原A3完整问题：

```sh
python3 examples/codex-readonly.py --answer \
  --archive artifacts/releases/0.1.0-preview.13/whytan-dsh-semantic-ui-0.1.0-preview.13.tgz \
  --manifest artifacts/releases/0.1.0-preview.13/package-manifest.json \
  --source-file docs/evidence/natural/r9-A3.json --source-json-pointer /question \
  --source-kind permissions-zh --component ArchitectureExplorer
```

实际输出区分访问、主体与目标之间的只读/读写、方向性禁止和仅限该主体的目标；没有声明的权限保持未知，不推成全局独占或故障保证。两项都是来源读取与有限说明，未请求view/claims比较，不能写成模型生成视图已匹配。见 [本次独立回执](evidence/grounded-answer-source-kinds.json)。本次客户端摘要为`76f19a221387a7582e6b27b8aca113bdef4fe643e1810058adcc3f9e14e13c74`，只增加选段透传；下节两次模型回归仍对应此前客户端摘要，未重跑或混算。

仅当你需要生成和检查模型候选时，再加 `--model-candidate`。这显式使用本机正常登录、默认模型/推理/provider/service tier；没有API备用或账户切换。程序在相同临时进程中保留技能额外根，发送官方 `UserInput {type:'skill',name,path}` 和普通原问题，附加通用developer workflow。主问题没有手工view、正确答案或验收预期。这是宿主选择的有指引路径，不冒称模型无指引自然选择。

## 数值来源与图表请求

preview.15新增`--source-kind observations-zh`，将实际值/缺失mask/单位与DataChart位置及均值分母逐项绑定。完整正常命令、正例与同均值填零拒绝见 [数值来源](SOURCE-NUMERIC.zh-CN.md)。`--answer --requests-file`可传**一项**完整source_check请求；最终仍仅来自该次来源检查，不把view注释当有据说明。此用法需要15归档，不能外推到13；与`--model-candidate`同时使用请求文件会拒绝。本段零新模型回合，旧模型验收仍按各自版本保留。

## 最终文字来自哪里

宿主先通过真实Codex线程读取现成 `source_check`，核对独立来源的文本摘要。当前伴随脚本另核document/excerpt SHA、JSON pointer及UTF-8选段范围；问题SHA不替代来源SHA。可选模型回合结束后，再读同一启动快照。只有完整有限说明可用、来源对应且身份/世界事实未认证的边界保持时，默认交付检查器原有的 `canonicalExplanation`，加固定范围说明。显式补零模式另经完整来源比较后消费原始view的现有core统计；它没有扩大source canonical的认证范围。独立问题中未被实际计算覆盖的部分，仍不能声称已由宿主保障。

模型正文不会传入这个交付函数。没有任意正文判真、关键词删除、D1固定答案或从模型输出反推source真值。来源不支持或不对应时交付有限拒绝；可选模型回合在前置来源拒绝时不会启动。`sourceFactsVerified=false`、`identityVerified=false`一直保留。

终端正常显示宿主答复。后续伴随源码已将数值比较拒绝显示为位置、来源值/缺失与收到值，以及已拒绝均值声明的范围、单位和分母；没有候选时不暗示生成了候选。不回显任意prose、身份、路径或整份报文，超出显示数量/单位文本边界时明确省略并保留私有原件。它只格式化既有rowChecks/claimChecks/issues，仍为withheld，不是新checker或通过证明。这项客户端改动不在已冻15的runtime内，使用仓库当前Python脚本；一次真实零推理拒绝及补充兼容证据见 [拒绝收口](evidence/refusal-details.json)。私有日志目录另存 `answer.md`、`model-candidate.md`、完整API/MCP报文、typed输入、模型事件及终态。`model-candidate.md`保持候选原文，并不因为某题评读通过就自动成为已核正文。脚本没有将日志上传公开。

## 本轮真实验收

先冻结 [原始问题与正反预期](evidence/grounded-answer/expectations.json)，再实现新指引和交付逻辑；随后仅2个新observed model turns，各1次。问题为原D1和独立名称/顺序/需求变化的 [对照来源](../fixtures/grounded-answer-counterexample.json)。运行环境为Codex0.164.0、Python3.14.8、Node24.22.1，默认gpt-6.1-sol/max/openai/default保持。本段客户端验收在macOS，没有新增Linux或桌面富UI验收；preview.13旧CI只覆盖原包范围。

- **G1-D1**：模型实际调用本包4次（来源读取、schema、check、完整source比较），另有2次内置MCP资源发现；结构化比较matched。候选不再无据优先托管，明确保留反面责任、报价和余力未知；按本题事前预期评读通过。宿主最终交付独立来源说明。
- **G2对照**：本包5次调用，另有2次资源发现；首次比较因输入标签“现在需要私网”不在有限允许表达内被拒绝，模型在同一回合改为支持的字面标签后matched。首次拒绝完整保留，不记成首次结构化调用即通过。候选区分蓝不满足当前私网硬条件、橙只满足这一项而整体未知；按本题预期评读通过，宿主最终仍不用候选原文。
- 原默认入口、零推理 `--answer` 和不支持来源的前置拒绝均实际验证；4项离线合同检查覆盖默认禁推理、单次预算、来源失配/错误授权拒绝及最终正文独立性。

[逐题候选、最终答复、全部模型工具调用及原件摘要](evidence/grounded-answer.json) 分开记录。后台推理请求数客户端未逐次暴露，记unknown；2个observed turns不能写成2次后台请求。没有第三次模型重试。

## 仍未证明

这是官方typed skill的实际提供、接口接受及后续模型工具行为证据；模型内部逐字消费并不可直接观察，也不能由技能发现或初始化指引返回单独推断。本题评读通过不是通用自动正文验证。原C1-D1/C2-N2的0次模型MCP、原DSH run9的0通过/6失败/18请求和A2勘误保持；新路径不回写旧题。

当前主会话未全局装载，桌面富UI、任意自然语言/图表来源、世界事实、来源作者及更多正常任务仍需独立验收。宿主可交付的范围限现成语法和canonical说明，不宣称全面替代GenUI或项目普遍完美。

官方：[App Server Skills输入](https://learn.chatgpt.com/docs/app-server#skills)。实际字段按本机生成schema核对；没有使用本机不存在的perCwdExtraUserRoots。
