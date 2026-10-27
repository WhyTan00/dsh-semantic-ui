# 单个未知当前事实的正常补充

**正式交付：** [preview.19](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/v0.1.0-preview.19)，冻结源码 `87e56ecfcff6fbf35622c14ac6130cb004c76ac5`。最终317文件实际归档在本机与 [Linux CI40458705531](https://github.com/WhyTan00/dsh-semantic-ui/actions/runs/40458705531) 的Native/PTC均通过，四份资产本机/Linux/匿名HTTPS下载字节一致。新增真实模型观察0；原始模型正文更新未核。完整[分层接受与首次失败](evidence/source-update.json)后补在仓库，不重包已发行归档。

preview.19 / DSH `0.2.1-rc.2`。这是一个有界的来源修订流程：在最新的、来源已绑定的 DecisionExplorer 中，明确补充一个原本声明为 unknown 的当前布尔条件，经正常聊天入口生成新的完整来源消息，再用新的来源检查与 render 形成新视图。它不是通用 RequestForm、任意来源编辑器或世界事实认证。

## 使用

1. 打开来源已绑定的比较视图，展开“补充未知来源条件”，点击“查看可补充条件”。只有完整 `decision-zh` 来源中的单次、明确 unknown 当前声明可选；未声明、重复声明、已知值与其它来源语法不开放编辑。
2. 选择一个条件及“是/否”，核对显示的改动范围，再点击“提交来源补充”。保留 unknown 与取消不会提交。需求试算控件仍只在本地求值，不修改来源。
3. 界面分别显示请求接收、持久消息及新视图是否可核实；可点击“核对原请求状态”。新图出现依赖正常 agent 调用来源检查/render，不能把请求接收直接显示为已采用。网络结果不明时只能查询原请求，不会自动重发。

补充只修改当前声明的确切 UTF-8 范围，例如 `当前公开服务未知` → `当前公开服务为是`。前后文本字节完整保留，条件分支、能力支持和价格不变；已有 `为未知` 保留原来的 `为`。完整新来源作为单个普通 text part 提交，不发送孤立的补充片段、不自动合并历史、不把用户问题或评审条件注入来源。条件名称来自实际解析结果，不按样本名称/方案 ID 分派。

这次是调用者通过控件作出的新声明，`identityVerified/sourceFactsVerified/freeProseVerified=false` 始终不变。当前 true 可以使某项需求成立；支持该能力只表示满足这一项，不能推导整体可行、唯一赢家或价格排序。

## 公共宿主合同与实现

固定公开 [DSH 源码身份](https://github.com/deepseek-ai/deepseek-harness/tree/687f282e8625c6b8d11ff58211a90524be2e4317)。实际核对已安装同版本的 `SessionPromptRequest`、Remote `prompt`、Connection Fetch、`SessionStore.flush`、投影和 CommandRuntime 命令生命周期；不根据 master 猜接口。

- 新的 owner-only 精确 Fetch 路由使用 Connection 原有 Host/Origin/认证策略。它取得真实 admitted Peer，经公开 `createSharedFetchHandler('/api').fetch(request, peer)` 调用原 `session/prompt`；正常 Remote 根据调用者产生 `source`，本插件不构造 user producer、不调用 `createUserMessage`、不 append `user/message`。
- 每次请求绑定 session、旧 turn/startSeq、message ID/seq、原文本 SHA-256、displayId/revision、一个条件和布尔新值。未知值、额外字段、多个字段、来源替换、错误/过期 base/view/session 均拒绝；新一次发送前再次检查最新基准。
- 分发前通过实际注入的公开 `commands.execute` 记录 `dsh-semantic-ui-source-update` 的 `command/run` / `command/done` 意图并等待 `sessions.flush`。只有 owner UI 本次准备的、session/内容均匹配的意图可以成功；普通直接输入内部命令不会提交。命令注册器拥有记录和 producer，插件不构造它们；命令不进模型消息表面、不打开回合。它只是发送意图，普通消息/checkpoint 仍由原宿主拥有，没有第二聊天库或业务账本。

- 纯投影验证 intent 的范围，并从真正的 `user/message.source.rpcId` 关联确切消息内容、哈希、turn 和 ID。新 checkpoint 必须来自该消息的当前回合并匹配新来源哈希和 view identity。旧来源/旧 checkpoint 不被改写或转作新结果。
- 持久化 barrier 前先捕获并分离 receipt 与日志位置 `asOfSeq`；返回的成功最多覆盖这一版本。flush 期间后到的消息或 checkpoint 不能搭车标成已持久，下一次捕获并真正 flush 后才推进状态。flush 无参与者或失败不返回已持久的消息/视图凭证。
- `accepted:true` 仅表示进入 inbox。只有实际消息且 flush 成功才是 `message-persisted`；只有另外匹配的新来源 checkpoint 且 flush 成功才是 `adopted`。模型自由正文没有自动认证。
- 同一 requestId 重复调用只对账；同一 base 的另一 requestId 返回原请求线索，不再发。不同内容复用 ID 会拒绝。不明/失败 intent 保留，不能以更换 ID 重试。每会话最多16个 intent，不淘汰旧 ID 来掩盖重复；达到上限明确拒绝。
- 重启后通过公开、非激活的 `session/projections` 从原持久日志恢复收据，仍只查询，不重发。格式迁移需要、缺记录、flush 失败或证据不明都不声称成功。

实现：[精确字段修订](../src/source-update.ts)、[宿主适配与投影](../src/dsh/source-update.ts)、[提交界面](../src/components/SourceUpdatePanel.tsx)。这些公开服务合同绑定上述 DSH 预览版；不承诺其它版本可用，也不绕过宿主保护或维护私有 fork。

## 边界与恢复

本版只允许修改**当前活跃 Session 的最新已绑定视图**。刷新页面仍可核对；历史旧视图在新输入或新 revision 后不再能编辑。宿主重启后的冷 Session 可以恢复原请求收据，尚未实现直接编辑冷历史：须在正常聊天中重新提供完整来源并获得新的当前绑定视图。不会为了激活会话暗中切模型、发送空消息或重放旧请求。

取消仅适用于发送之前；进入宿主后不承诺撤销。若 intent 已持久化而接收情况不明，只保留同一 ID 对账；未出现确切消息/新 checkpoint 就保持 unknown，不自动重发。收到其他来源或同回合多条用户消息导致歧义时，不把它认证为本次合法更新。旧 unknown 视图保持只读，局部 need 切换和刷新复位仍按原合同。

19 可读取旧的 sourceDelivery metadata；新记录可带 `hostContext.requestId`，严格的旧17 reader 不承诺读取这个新增字段。回退前保留 DSH 原会话及同版包；不迁移、删除或重写旧消息。协议1.4和三个语义组件不变。

## 验证范围

源码30项定向检查通过，含暂停 flush 时先后到达消息/新 checkpoint 的交错反例：第一次 unknown、下一次仅 message-persisted、再次 flush 才 adopted；18开发树的真实隔离 Native/PTC 流程通过后，实际归档安装暴露了下节SDK问题；19另完成预冻结包Native检查，以及最终317文件归档在本机/Linux的Native/PTC各一个完整新补充。最终归档覆盖6类拒绝、unknown/取消、本地试算边界、重复/冲突、结果不明、刷新和原历史。另实际模拟提交已 accepted 后丢失浏览器回执，用原 ID 查询恢复；模式切换时重启宿主，冷收据从原日志恢复。首次测试误取历史旧 source-check 的断言失败保留，修正选择当前新哈希的检查，没有修改独立预期。

最终不可变归档安装、Linux、资产 SHA 与发布结果见[本版分层接受](evidence/source-update.json)；它们不回灌或重打冻结包。开发树结果不代替归档接受。新增真实模型观察默认0，本轮宿主测试的 provider 明确是确定性夹具，模型自然采用和原始自由正文仍未验证；不重跑旧题或改写原0/6/18、首次失败及旧发行证据。

## 未发布的18候选与修复

18候选源码 `b352242a7379f936f1e4298046d10b6e0d58ae9c` 的315文件实际归档安装成功，但第一次来源提交未得到 accepted；本机与 [Linux CI 40457376833](https://github.com/WhyTan00/dsh-semantic-ui/actions/runs/40457376833) 均失败，未发布/未打标签。它的归档和首次失败保留，不覆盖、不重新打包。

根因已由实际安装插件的 SDK 路径与跨模块调用复现：两份同版本 `Session` 不同类，实验性 `appendPluginRecord` 的私有 receiver 检查拒绝另一个模块创建的 Session。19移除该运行时导入和插件记录，采用实际注入的 CommandRuntime 自身方法记录原生命令生命周期，19预冻结包已通过跨SDK实际安装的Native单路径检查，最终归档另行验收；没有访问私有字段、换宿主/主客户端或强行复用内部模块。
