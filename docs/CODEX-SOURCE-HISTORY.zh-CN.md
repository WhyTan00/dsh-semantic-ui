# 在同一模型对话中修订完整来源

当前仓库的 [Python伴随客户端](../examples/codex-readonly.py) 增加 `--revision-file`：先回答第一份完整来源，再切换为调用者提供的新完整来源，在**同一个实际threadId**中提问。默认零模型；另加 `--model-candidate` 才允许最多两个候选attempt。它复用preview.26原运行归档，没有修改语义核心、技能或组件协议，不需要新运行包。

## 使用

在已被个人Codex配置认可信任的本仓库运行，日志也放在这个项目内。程序不会添加或保存信任决定。沿用现有26归档及manifest：

```sh
python3 examples/codex-readonly.py --answer \
  --archive artifacts/releases/0.1.0-preview.26/whytan-dsh-semantic-ui-0.1.0-preview.26.tgz \
  --manifest artifacts/releases/0.1.0-preview.26/package-manifest.json \
  --source-file fixtures/codex-source-revision/source-1.txt \
  --question-file fixtures/codex-source-revision/question-1.txt \
  --source-kind decision-zh --component DecisionExplorer \
  --revision-file fixtures/codex-source-revision/revision.json \
  --log-dir .handoff/my-source-revision
```

日志目录必须是新的私有目录。上述命令不启动模型，终端依次显示两版来源的有限宿主说明。需要真实模型候选时，显式再加 `--model-candidate`。这使用现有CLI登录和默认模型、推理、provider及tier，没有API备用或账号切换；后台模型请求总数不由回合数推定。

修订文件只有两个必需字符串字段，路径相对于该JSON自身：

```json
{
  "sourceFile": "source-2.txt",
  "questionFile": "question-2.txt"
}
```

可选 `sourceJsonPointer`、`questionJsonPointer` 和 `sourceExcerpt` 沿原输入合同选择文本；没有继承第一版的pointer/excerpt，以免误选新来源。第二版沿用同一source-kind和component。拒绝history、view、其它字段以及与requests-file/hypothesis混用；这里是完整新来源，不是增量指代、任意历史导入或修改已保存消息。

## 来源如何真正切换

两份调用者文档在启动前分别核对身份，并复制为只读快照，存于临时工作区之外。该工作区位于指定私有日志目录的runtime子目录，只有本任务生成的 `.codex/config.toml`。其它MCP、host文档/技能发现、shell、browser及apps继续沿原客户端隔离合同关闭。

初始MCP配置从这个已受信任项目中的临时配置正常加载。第一回合终态后，只原子替换该临时配置中本工具的启动参数，再按官方 [App Server合同](https://learn.chatgpt.com/docs/app-server)调用 `config/mcpServer/reload`，params为null。此app-server由本次命令独占，里面只有这个工具和一个线程；不操作共享实例或全局配置。

**reload返回成功不足以证明切源。** 程序随后实际调用 `source_check({})`，同时核对新document/text/excerpt摘要、pointer和UTF-8选段身份。若仍读旧源或无法形成有限说明，就保存source-not-current/withheld结果，第二模型回合不启动。新来源从启动文件读取，没有作为source_check参数偷渡。

第一模型回合实际生成且已经matched的view请求另行保存；切源后由宿主对它们重新检查，结果记入previousViewComparisons。来源变化可能不影响某些视图，因此这个通用入口记录实际比较结果，不预设所有修订都应拒绝。模型第二回合依然只有它自己的新普通问题与原typed skill，旧view/宿主评语不拼入提示。先前真实模型与工具历史留在同一个活跃线程中，不fork、resume预填或inject历史。

## 输出、次数与收口

第一版的raw final、source/view/tool和宿主说明保留原文件；第二版放在 `revision/`。根result的newModelTurns为合计，answer为第一回合，revision.answer为第二回合；source-transition.json另存实际换源和旧view检查。conversation-answer.md与终端仅交付两版宿主说明，modelCandidateUsed=false，不能拿它给模型原文判正确。

candidate-budget.json在首次app-server启动前计第一attempt，因此启动失败也占用；只有第一回合completed且第二来源实际核对通过，才在第二次turn/start前计第二attempt。RPC另限制同一owned thread最多两次，不允许同时存在两个活跃turn。异常和中断不自动重试，没有第三次。第一回合正文若有误但终态completed，第二回合仍是原计划的新来源任务，不是纠正重跑第一题。

退出时撤回extra skill根、取消本线程订阅、结束自有app-server/MCP并移除runtime目录；完整日志保留私有。程序比较全局配置前后字节摘要，不能因为本工具只发读调用，就省略这项实际核对。完整wire/reasoning/配置不自动公开。

## 实际两回合观察

在零模型入口稳定后，于2026-10-27 15:58:50 UTC冻结客户端、归档、技能、通用指引及两组source/question；独立预期已于15:34:39 UTC冻结，原件SHA为 `4bdf0622634225cad64ce03c01b18702634d71ec16d937c259f535e92088481e`，没有进入提示、模型工作区或resources。使用[完整安全题目与预期摘录](evidence/source-history/criteria-cases.json)中的新合成场景，没有重播原六题。

真实执行只有一个thread/start、两个同threadId的turn/start，第一轮completed早于reload和第二轮开始，没有fork、resume预填、inject或拼旧assistant文字。技能和通用指引沿原归档；这是有指引的工具采用，source_check也会正常给出有限canonical explanation，不是无帮助推理。完整层次见[分层回执](evidence/source-history.json)。

| 观察层次 | 第1轮：原来源与明确假设 | 第2轮：合法完整来源修订 |
|---|---|---|
| 当前条件 / 维护余力 | 禁止外传true / 余力true | 禁止外传false / 余力unknown |
| 当前离线需求初值 | true | false；明确选择else，不是unknown |
| 模型自己的语义调用 | 9次 | 8次 |
| 模型内置资源发现 | 0次 | 0次 |
| 新view来源比较 | 首次两个SOURCE_FIELD_LABEL；同一回合改为普通标签后matched | 首次matched，initial=false/null |
| 假设 | 无余力是假设；在线离线项仍失败，本地维护项失败 | 旧假设false没有冒充当前unknown；条件表继续明确标为假设 |
| 原始回答人工评读 | 本次有限语义判据met | 本次有限语义判据met |
| 宿主最终说明 | 独立delivered，不用候选正文 | 独立delivered，不用候选正文 |

第一轮原始标签带有“初值来自当前条件；改动为本地假设”等注释，超出现有有界来源角色标签合同。source-check正确拒绝，core仍能计算这一view，但core validated没有认证来源映射。模型随后在同一回合修正标签，使来源比较matched。**首次失败和全部中间计算原样保留，不能写成两轮都首次matched。** 未发现checker将错源当正确的通用运行缺陷，因此没有改语义核心或再发运行包。

切源后，宿主把第一轮实际matched的view重新对照新来源，两个旧初值均被SOURCE_INITIAL拒绝。第二轮模型自己的source_check读到新SHA，新的view与typed条件/余力声明都绑定新来源。原始回答明确撤回“本地满足当前两项条件”，保留在线仍不支持离线、但当前不再需离线的区别；维护余力保留unknown，未沿用旧true或旧假设false。未知费用和未给的反面责任也未补造，没有保证整体适用或推荐。

[第一轮原文](evidence/source-history/phase-1-candidate.md)、[第二轮原文](evidence/source-history/phase-2-candidate.md)、[逐项人工评读](evidence/source-history/review.json)、[实际来源切换及旧view拒绝](evidence/source-history/source-transition.json)分别保存。宿主7次显式调用与模型17次语义调用按时间区间和完整参数/返回逐项对账，不混计。typed skill已发现、读取、提供并被接口接受，内部attention不可直接观察；两个candidate运行时仍为unverified。

本新段 **2/2 attempt**用完，两个真实回合均completed，无重试或第三次。旧1420余1未继承，所有旧2/2、独立1/1、原自然题0 pass / 6 fail / 18 requests保持原结果。后台总请求unknown，未探额度/key，不称免费。客户端commit `86e8bb51c0648942498be67377d71124ec495797`，SHA `1b8ec271fda208ff4d878bff76a968e0e4aed291f0cb1c9c9d3ca4a3168d5efe`，运行包仍是原26；[执行指纹](evidence/source-history/fingerprints.json)和[计数](evidence/source-history/budget.json)另记。

## 零模型、资源与界面边界

已通过26项Python合同检查，以及macOS官方CLI0.164.0的正常零模型双来源入口：同threadId、原true/true到新false/unknown来源摘要实际切换，两版宿主说明delivered，全局配置字节不变。独立零模型接口探针另外确认旧view两个过期初值被SOURCE_INITIAL拒绝。

首次探针也保留：仅改tap配置内容后reload，实际仍读旧源；无回合的ephemeral和persistent线程resume均返回no rollout found，不能据此推断上游不支持多轮。尝试对临时目录设置进程信任时，SDK产生两条全局临时信任记录；已只移除本次两条，核对其它配置语义未变。最终入口采用原已受信任项目，不再设置信任，后续实际核全局字节相等。

上述6个零模型探针/入口与1个两回合模型进程均已终态，app-server exit0、自有MCP进程不存在、runtime目录移除、extra skill根撤回。最终修订入口、原单来源入口和真实两回合的全局配置字节均相等，早期两条临时信任记录的清理另记，没有覆盖其它设置。见[零模型与纠正记录](evidence/source-history/zero-probes.json)和[实际模型进程清理](evidence/source-history/cleanup.json)。

这是macOS个人官方CLI0.164.0/default路径的新伴随能力，本段未新跑Linux、DSH Native/PTC或主客户端图形UI。实际可见输出是[终端两版宿主文字](evidence/source-history/terminal-answer.md)，stdout与保存文字只相差一个print换行。MCP只读view没有在本段渲染为图形界面，不能由matched推断已显示富UI或接收了DSH控件反馈；原26的宿主与中文接受各自保持。世界事实、作者身份和任意自由正文认证继续为false，有限两回合正确不变成普遍正确率。
