# 显式补零假设的宿主答复

伴随客户端新增`--answer --hypothesis zero-fill`：在来源完整核对后，复用16归档里已有统计核心，输出有明确范围的假设均值及其相对实测均值的差。默认`--answer`不变；程序不根据题名或关键词猜测假设意图。该模式不能同时启用model-candidate或requests-file，新增模型回合为0。

这补上[前两次模型观察](CODEX-NUMERIC-OBSERVATION.zh-CN.md)暴露的宿主交付缺口，但没有重跑A/B、改写它们的原始stdout或证明后补指引的自然效果。新功能使用独立C/D合成来源；[完整回执](evidence/zero-fill-answer.json)分别记录正常交付与计算不可得边界。

## 直接运行

使用仓库当前伴随源码、已下载的preview.16运行包和manifest：

```sh
python3 examples/codex-readonly.py --answer --hypothesis zero-fill \
  --archive artifacts/releases/0.1.0-preview.16/whytan-dsh-semantic-ui-0.1.0-preview.16.tgz \
  --manifest artifacts/releases/0.1.0-preview.16/package-manifest.json \
  --source-file fixtures/zero-fill-answer/C-source.txt \
  --question-file fixtures/zero-fill-answer/C-question.txt \
  --source-kind observations-zh --component DataChart
```

例中8个原始位置为`-8、缺失、0、4、缺失、12、缺失、缺失`毫安。正常stdout先保留来源说明：4项实测平均2毫安、完整8项平均未知；再另列补零假设平均1毫安、分母8，相对实测口径的差为−1毫安。较低只描述两种计算口径，不能推断它低估未知真实完整均值。

## 计算与范围从哪里来

1. 现有source_check读取独立启动来源，核对文件、文本、选段SHA、JSON pointer与UTF-8范围，身份与世界事实认证仍为false。
2. 宿主从完整sourceObservations构造一份新的DataChart及一一对应mapping，保留原值、null mask、测量名、单位与顺序。x仅为原始1-based位置字符串。该view明确标为**宿主投影**，没有冒充模型生成。
3. 再用现有source_check完整比较，只有matched且来源身份/范围对应，才将同一份原始view送入现有semantic_ui_check。
4. 最终仅消费`dataFacts.series[].zeroFillIllustration`的mean/count/difference/direction等现成字段，同时核对原始统计范围、单位、系列与已观测统计。客户端没有均值或差值公式，不读取模型摘要、notes、canonicalSummary或候选作为认证值。

补零没有写回原source、原view或实测数据。输出保留`sourceFact:false`、`identityVerified:false`、`sourceFactsVerified:false`、`freeProseVerified:false`，并明确假设不能改变原始完整均值的已知/未知状态。没有新协议、renderer、会话库、运行依赖或模型路由。

## 实际验证与尚未完成

源、普通问题、独立算术与未知/拒绝判据在实现和运行前冻结，见[预期原件](../fixtures/zero-fill-answer/expectations.json)。新增四项客户端合同，加既有十项共14项通过：来源/选段改变或未matched时不调用统计工具；错误范围/单位/数量/非有限值/缺字段拒绝；未知不补0；原始数据不变。首次测试对`1`与等值`1.0`的字符串断言过严，已放宽，数学判据未改，首次失败原件保留。

两个实际个人Codex临时stdio入口均经正常工具路由完成，每例4次宿主工具调用：schema、来源读取、完整来源比较、统计check。全部是显式宿主调用，没有模型工具调用或turn/start。

| 新样本 | 独立预期 | 实际宿主结果 |
|---|---|---|
| C：8位置，含负值、实测0和4个缺失 | 实测2毫安/4；补零假设1毫安/8；差−1；完整未知 | **delivered**，来源与原值/null mask完整匹配，实际core字段进入正常stdout |
| D：3位置全部缺失 | 实测与完整均值未知；数学上的全补零假设为0，观测差未知 | **partial**：现有核心返回假设mean=null，宿主明确计算不可得，没有把null补成0 |

D的数学目标仍未完成，预期中的0没有改写成unknown。原因是既有numericStats在0个有效值时返回sum=null，chartFacts沿该字段不提供有限假设均值；此限制在实现前阅读现有源码时已记录。客户端守住不可得边界，没有复制公式绕过核心或更改已冻结16。若要补齐这项数学结果，需要另对统计核心作有范围的修正、验证与版本交付，不能把本段partial称为全通过。

源码为[93f9d25](https://github.com/WhyTan00/dsh-semantic-ui/blob/93f9d258c0b79fd7132206fc6286d4b88eeb8b51/examples/codex-readonly.py)，脚本SHA`74171839d9de8b154d54b0dfacfac0330a34ed9180a4aa5e4faef31dbb9ee621`。实际解压的MCP/core/protocol/skill身份、完整工具参数/结果、stdout及原件摘要分别见[C](evidence/zero-fill-answer/C.json)、[D](evidence/zero-fill-answer/D.json)。14项检查输出与[清理回执](evidence/zero-fill-answer/cleanup.json)单列。

本段新增模型推理0，两组自有进程和临时技能/目录均清理、全局配置摘要不变；没有新Release、重包16、旧自然题或旧DSH/Linux矩阵重跑。它是源码伴随客户端能力，当前主Codex桌面富UI、任意自由正文及DSH假设交付未新增验收。原始A/B候选、首次拒绝与旧0/6/18记录保持各自结果。
