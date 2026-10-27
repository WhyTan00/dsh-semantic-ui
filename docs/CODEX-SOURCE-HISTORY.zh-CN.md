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

## 当前验收范围

已通过26项Python合同检查，以及macOS官方CLI0.164.0的正常零模型双来源入口：同threadId、原true/true到新false/unknown来源摘要实际切换，两版宿主说明delivered，全局配置字节不变。独立零模型接口探针另外确认旧view两个过期初值被SOURCE_INITIAL拒绝。

首次探针也保留：仅改tap配置内容后reload，实际仍读旧源；无回合的ephemeral和persistent线程resume均返回no rollout found，不能据此推断上游不支持多轮。尝试对临时目录设置进程信任时，SDK产生两条全局临时信任记录；已只移除本次两条，核对其它配置语义未变。最终入口采用原已受信任项目，不再设置信任，后续实际核全局字节相等。

这些是客户端与来源切换的零模型证据，不是模型理解已通过。真实两回合应另核原文、实际工具采用、旧假设与新当前值、终态和计数。这里交付的是只读MCP与终端文字；view matched不是DSH或Codex主客户端已经显示富UI，原26的Native/PTC与中文验证保持各自范围。世界事实、作者身份和任意自由正文认证继续为false。
