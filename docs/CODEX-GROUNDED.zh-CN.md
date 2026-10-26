# 受来源约束的普通答复

这是现有 [只读客户端](CODEX-EXPLICIT.zh-CN.md) 的伴随源码增量，复用已发布 preview.13 的MCP/core/skill，不修改或重打归档。默认仍为零推理；最终答复可以直接由现成检查器给出有限说明。

| 运行方式 | 新推理回合 | 输出 |
|---|---:|---|
| 原命令，不加选项 | 0 | schema和source_check原结构化结果 |
| `--answer` | 0 | 宿主交付来源内的有限说明，或明确拒绝 |
| `--answer --model-candidate` | 每次最多1个 | 显式skill/工作流指引下的模型候选另存，最终仍由宿主保障 |

## 正常使用

在当前仓库源码根目录，沿用已经下载的preview.13运行包和manifest：

```sh
python3 examples/codex-readonly.py --answer \
  --archive artifacts/releases/0.1.0-preview.13/whytan-dsh-semantic-ui-0.1.0-preview.13.tgz \
  --manifest artifacts/releases/0.1.0-preview.13/package-manifest.json \
  --source-file fixtures/codex-decision-source.json \
  --source-json-pointer /question
```

这条已验证的命令输出普通可读答复，保留价格、反面责任和团队余力的未知。可换成自己的明确来源；现有三种有限语法和输入合同沿 [来源说明](SOURCE-CHECKS.zh-CN.md) / [decision-zh](SOURCE-DECISION.zh-CN.md)。不支持的完整来源会得到拒绝，未默默跳过难句。

仅当你需要生成和检查模型候选时，再加 `--model-candidate`。这显式使用本机正常登录、默认模型/推理/provider/service tier；没有API备用或账户切换。程序在相同临时进程中保留技能额外根，发送官方 `UserInput {type:'skill',name,path}` 和普通原问题，附加通用developer workflow。主问题没有手工view、正确答案或验收预期。这是宿主选择的有指引路径，不冒称模型无指引自然选择。

## 最终文字来自哪里

宿主先通过真实Codex线程读取现成 `source_check`，核对选定问题的文本摘要。可选模型回合结束后，再读同一启动快照。只有完整有限说明可用、来源文本相同且身份/世界事实未认证的边界保持时，才交付检查器原有的 `canonicalExplanation`，加固定范围说明。

模型正文不会传入这个交付函数。没有任意正文判真、关键词删除、D1固定答案或从模型输出反推source真值。来源不支持或不对应时交付有限拒绝；可选模型回合在前置来源拒绝时不会启动。`sourceFactsVerified=false`、`identityVerified=false`一直保留。

终端正常显示宿主答复。私有日志目录另存 `answer.md`、`model-candidate.md`、完整API/MCP报文、typed输入、模型事件及终态。`model-candidate.md`保持候选原文，并不因为某题评读通过就自动成为已核正文。脚本没有将日志上传公开。

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
