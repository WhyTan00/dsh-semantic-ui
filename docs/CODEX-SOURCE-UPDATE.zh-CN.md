# 来源补充后的 Codex 快照采用

这是 preview.19 发行后的独立观察，使用其原运行包与未改动的 `examples/codex-readonly.py`。先从已安装19的任务隔离 profile 完成一个新来源补充，再将实际宿主消息的原/新文本分别导入两个独立的个人 Codex 只读回合。它验证文件快照的工具采用与原始正文，不是实时 DSH→Codex 回调、同线程状态更新或主客户端安装。

## 先冻结，再取得实际来源

2026-10-27 06:19:19UTC，独立冻结来源、普通问题、单字段范围及评读预期；SHA-256 `530600d91f2c626750fad55bf02dc70a47639ddc2650bd2fd25550bd859597e8`。评审文件未进入模型 prompt、skill、cwd 或 MCP resources。完整安全副本在[独立预期](evidence/source-update-adoption/independent-expectations.json)，公开复制发生在两回合结束、临时根删除之后。

来源是明确的安全合成声明：澄月支持回放，青禾不支持，两者价格未知；**若即时核对则不需要回放，否则需要回放**。原当前条件未知，owner UI 只补充“当前即时核对为否”。这个反向分支用来检验 `current=false` 不等于 `need=false`。

复用已经接受的19安装，没有重装、下载或重跑整套矩阵。通过原正常补充控件与认证接收接口，宿主保存新的完整 `user/message`，原 unknown 消息和视图仍保留；新 source-check/render/checkpoint 中 `current=false`、`derivedNeed=true`，pageerror=0，旧新视图刷新恢复。

| 快照 | 实际宿主来源 | Codex 读取的文件内容 | 当前条件 / 需求 |
|---|---|---|---|
| 原始 | turn1、消息序号10、原 requestId | 从该真实事件提取，SHA `3d5cc19fe1de9380c36cd31591d95253ff8a6667c787cd0b3416635f838f5629` | unknown / unknown |
| 补充后 | turn2、消息序号36、新 requestId | 从该真实事件提取，SHA `78828cde6ded6cf9e05a695cfca01670682bf593362e5536a0cf87b66258aad9` | false / true |

消息ID、requestId、turn/startSeq、文本与导入文件摘要逐项对应，见[来源链接](evidence/source-update-adoption/input-links.json)和[原生证据](evidence/source-update-adoption/native-host.json)。新场景没有另外保留瞬时 admission ACK 报文；确切 requestId 的持久用户消息证明正常 prompt 已被接受，不能据此声称捕获了 ACK 响应。19发行时另外保留的 ACK/丢失响应验收仍按[原19证据](evidence/source-update.json)读取，没有重播。

每份导入文件不可变，纯文本 document/text/excerpt SHA 一致。两份零推理入口检查先确认原 unknown 与反向 else 的合同；它们没有模型回合。实际消息身份只是宿主记录关联，作者、独立人类及世界事实均未认证。

## 两个真实回合分别评读

沿正常个人官方 CLI0.164.0 / app-server ChatGPT 登录，默认 `gpt-6.1-sol / max / openai / default` 保持。通过官方 [typed skill 输入](https://learn.chatgpt.com/docs/app-server#skills)提供已归档 skill，普通问题与 source 分开。模型未收到正确 view、人工结论或评审预期；通用 workflow 与客户端均未为这个样本改写。其它工具按原临时进程合同隔离，没有全局配置或账户切换。

先保留、评读第一回合，确认未暴露需修复的通用缺陷后才预留第二回合。两个 `turn/start` 各一次，均 completed，没有重试或第三回合。0520委托的2个 NEW observed turns 至此用完；后台推理请求数仍为 unknown。

| 层次 | 原 unknown | 新 false |
|---|---|---|
| 模型自己的语义调用 | 4次：source读取、schema、core check、带view的source比较 | 同样4次 |
| 模型内置资源发现 | 2次，单列 | 2次，单列 |
| 宿主显式调用 | 3次，单列，不计模型采用 | 3次，单列，不计模型采用 |
| 模型生成输入 | 当前回放需求 initial=null | 当前回放需求 initial=true |
| 首个带view的来源比较 | matched，无首次拒绝 | matched，无首次拒绝 |
| 原始 final 人工评读 | 保留当前需求未知、两方案回放支持差异、价格与整体选择未知 | false明确选择else，回放需求true；澄月满足本项，青禾不满足；价格/整体适用性未知 |
| 宿主最终保障文本 | 另行 source-canonical 交付 | 另行 source-canonical 交付 |

两份 raw final 按事前有限判据评读为 met。第一份用“能否即时核对”自然转述条件，评读不据此建立另一个已知能力或计划事实；完整原文保留供复核。模型自由正文的运行时认证标志仍为 false，不以人工看过两题建立通用认证。

原始正文：[unknown](evidence/source-update-adoption/original-candidate.md)、[false](evidence/source-update-adoption/updated-candidate.md)。完整模型参数/结果、宿主前后检查与 final 分别在[原始观察](evidence/source-update-adoption/original.json)、[新快照观察](evidence/source-update-adoption/updated.json)。`candidateStatus=unverified` 原样保留，宿主没有拿 canonical 替换候选来判通过。

typed skill 已提供、发现、读取并由接口接受；模型自己的实际工具行为另有证据，内部逐字消费不可直接观察。可选 typed condition/conditional-need claim API 本段没有自然使用，不能把带view比较冒作该 API 的采用。

## 可重复入口与本轮边界

[宿主脚本](../tests/source-update-adoption.mjs)只接收本仓库内、安装回执与19运行字节相符的隔离测试目录；拒绝复用其它位置。`VALIDATE_REUSED_INSTALL_ONLY=1`只检查身份，不启动服务或改 profile。正常单场景通过[浏览器脚本](../tests/source-update-adoption-browser.mjs)执行；数据是[显式夹具](../fixtures/source-update-adoption.json)，不会提供给模型作为正确 view。

```sh
ADOPTION_OUTPUT="$PWD/artifacts/local/snapshot-adoption" \
ACCEPTED_HOST_RUN="/absolute/path/to/this/repository/artifacts/local/accepted-fixture-run" \
ADOPTION_SCENE="$PWD/fixtures/source-update-adoption.json" \
node tests/source-update-adoption.mjs
```

模型观察沿现有只读伴随入口，用该次输出的 `original-source.txt` 或 `updated-source.txt` 加对应普通问题；默认 `--answer` 不推理，显式加 `--model-candidate` 才有一次回合。此页是已完成结果说明，没有自动重播模型的任务或定时器。

所有本轮 app-server/MCP 进程已退出、临时根已删除，extra skill 根已撤回、全局配置摘要未变；本任务恢复的宿主/端口已关闭，原私有 profile patch 已还原。源消息及原始日志仅保留在任务私有资料中，公开内容为安全合成来源与选定语义证据，不包含完整 wire、reasoning、配置或凭据。

本轮没有 runtime、core、协议、Python客户端或skill更改，不新发Release、不重包19。原19的0模型发行验收保持原样；本页2次观察独立计数。原0/6/18、A2、E/F与所有旧首次结果不重写；没有完整GenUI共存、设备/读屏或自由语言普遍验收。长期目标仍开放。

[本轮分层摘要](evidence/source-update-adoption.json)记录全部身份、计数与边界。
