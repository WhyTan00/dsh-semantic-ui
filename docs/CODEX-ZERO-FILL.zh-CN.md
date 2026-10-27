# 显式补零假设的宿主答复

伴随客户端新增`--answer --hypothesis zero-fill`：在来源完整核对后，复用16归档里已有统计核心，输出有明确范围的假设均值及其相对实测均值的差。默认`--answer`不变；程序不根据题名或关键词猜测假设意图。该模式不能同时启用model-candidate或requests-file，新增模型回合为0。

这补上[前两次模型观察](CODEX-NUMERIC-OBSERVATION.zh-CN.md)暴露的宿主交付缺口，但没有重跑A/B、改写它们的原始stdout或证明后补指引的自然效果。新功能使用独立C/D合成来源；[完整回执](evidence/zero-fill-answer.json)分别记录正常交付与计算不可得边界。

后续已修复D首次partial：只回归该失败样本，通过同一核心计算一份**独立的补零假设副本**，正常交付0毫安/3位置，同时原始观测/完整均值与相对观测差仍未知。原partial和冻结预期不改，新源码/完整路由见[修复回执](evidence/zero-fill-all-missing.json)。无需修改或重包16核心。

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

若原始视图没有有效观测、所有位置均为null，且有效回执未提供假设均值，当前源码另作深拷贝，仅将副本null变0，保留单位/位置/mapping，用明确假设标题和不同displayId调用同一统计工具。该副本没有source_check matched声明；它的completeDataMeanKnown=true和内部差0仅属于已假定的数据集，**不会覆盖原来源的false/unknown**。最终只取副本实际计算的假设均值，原观测差和方向继续未知。原来源失配、字段缺失/非有限或非全缺失的计算不可得不会被此路径掩盖。

补零没有写回原source、原view或实测数据。输出保留`sourceFact:false`、`identityVerified:false`、`sourceFactsVerified:false`、`freeProseVerified:false`，并明确假设不能改变原始完整均值的已知/未知状态。没有新协议、renderer、会话库、运行依赖或模型路由。

## 实际验证与尚未完成

源、普通问题、独立算术与未知/拒绝判据在实现和运行前冻结，见[预期原件](../fixtures/zero-fill-answer/expectations.json)。新增四项客户端合同，加既有十项共14项通过：来源/选段改变或未matched时不调用统计工具；错误范围/单位/数量/非有限值/缺字段拒绝；未知不补0；原始数据不变。首次测试对`1`与等值`1.0`的字符串断言过严，已放宽，数学判据未改，首次失败原件保留。

两个实际个人Codex临时stdio入口均经正常工具路由完成，每例4次宿主工具调用：schema、来源读取、完整来源比较、统计check。全部是显式宿主调用，没有模型工具调用或turn/start。

| 新样本 | 独立预期 | 实际宿主结果 |
|---|---|---|
| C：8位置，含负值、实测0和4个缺失 | 实测2毫安/4；补零假设1毫安/8；差−1；完整未知 | **delivered**，来源与原值/null mask完整匹配，实际core字段进入正常stdout |
| D：3位置全部缺失 | 实测与完整均值未知；数学上的全补零假设为0，观测差未知 | **partial**：现有核心返回假设mean=null，宿主明确计算不可得，没有把null补成0 |
| D失败后的必要回归 | 同一份独立预期，未改数学0或来源 | **delivered**：独立假设副本的实际core mean=0、分母3；原观测/完整/观测差未知，源null保留 |

D首次partial的原因是既有numericStats在0个有效值时返回sum=null，原始视图的chartFacts因此不提供假设均值。这个限制属于原始视图；当前独立假设副本的数值已明确，现有核心即可计算，无须核心改版。上轮将它视为必须修改runtime的判断已纠正，首次失败及预期0继续保留，没有用新结果回填旧回执。

修复源码[7422467](https://github.com/WhyTan00/dsh-semantic-ui/blob/742246799ef1689be7ff2611a86e211b27064455/examples/codex-readonly.py)的脚本SHA为`4de061d8c9591b2c4e46d34d3820f0dd4ae5c3cf63056404effdb30b513d0262`。16项共享离线检查通过，包括无效原回执/副本结果拒绝和非全缺失不可得不回退；仅D执行一次必要零模型回归，5次宿主工具调用，0turn/start。C成功实际入口及旧自然题没有重跑，资源已清理。

初版源码为[93f9d25](https://github.com/WhyTan00/dsh-semantic-ui/blob/93f9d258c0b79fd7132206fc6286d4b88eeb8b51/examples/codex-readonly.py)，脚本SHA`74171839d9de8b154d54b0dfacfac0330a34ed9180a4aa5e4faef31dbb9ee621`。该版实际解压的MCP/core/protocol/skill身份、完整工具参数/结果、stdout及原件摘要分别见[C](evidence/zero-fill-answer/C.json)、[D首次partial](evidence/zero-fill-answer/D.json)。原14项检查输出与[清理回执](evidence/zero-fill-answer/cleanup.json)保留，新修复另列。

初版C/D两组及D修复回归一组均新增模型推理0，自有进程和临时技能/目录清理、全局配置摘要不变；没有新Release、重包16、旧自然题或旧DSH/Linux矩阵重跑。它是源码伴随客户端能力，当前主Codex桌面富UI、任意自由正文及DSH假设交付未新增验收。原始A/B候选、首次拒绝与旧0/6/18记录保持各自结果。
