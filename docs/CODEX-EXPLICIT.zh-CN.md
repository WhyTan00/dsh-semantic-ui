# Codex 线程的显式只读入口

已在 Codex CLI **0.164.0**、Node **24.22.1**、Python **3.14.8** 上实际验证。使用官方实验性 app-server STDIO API、单次进程及临时线程，将现有 preview.13 归档接到正常客户端工具路由；不启动推理回合。其它客户端版本须核对其本机协议。

这补齐了显式调用和便携技能发现的入口。它不代表模型自然选择了工具、当前主会话加载了插件或桌面富 UI 已渲染。[两道自然题](evidence/codex-cli.json) 的0次模型工具调用和原始正文结论保持。[本段实际回执](evidence/codex-explicit-route.json) 单独保存显式路由结果。

## 一条可运行的办法

从本仓库当前源码根目录执行；需要 Python3.12+、Node24+、Codex0.164.0。先把已发布 preview.13 的运行 tgz 和 manifest 放入下面的相对位置，或将参数改为已下载文件的绝对路径。无需重打包或全局安装。SHA256SUMS 的核对步骤见 [安装说明](INSTALL.zh-CN.md)。

```sh
python3 examples/codex-readonly.py \
  --archive artifacts/releases/0.1.0-preview.13/whytan-dsh-semantic-ui-0.1.0-preview.13.tgz \
  --manifest artifacts/releases/0.1.0-preview.13/package-manifest.json \
  --source-file fixtures/codex-decision-source.json \
  --source-json-pointer /question
```

[示例脚本](../examples/codex-readonly.py) 是源码仓库的伴随客户端，**不在已经冻结的 preview.13 tgz 内**。它解开并核对现成包，通过 `codex --no-daemon app-server --stdio` 创建独立连接，保留本机默认模型、推理与权限；继承的其它 MCP 均按次禁用，apps/plugins/shell/记忆/Goal/hooks 不参与。没有配置写入、端口服务或模型路由。

[输入快照](../fixtures/codex-decision-source.json) 只有原D1问题文本，来自保留的首次记录，不包含正确view或答案。也可传你自己的明确来源文件；`--source-kind` 支持当前包既有的 `arrows`、`decision-zh`、`permissions-zh`，JSON文件通过 `--source-json-pointer` 选择字符串。源文件在 MCP 启动时捕获，工具请求不能换源。

默认输出先取得 DecisionExplorer schema，再读取有限来源的声明与unknown，包括未知价格、未声明的反面维护事实和团队余力。它没有手工生成合法投影，也没有给原D1正文盖章。需要对照既有有界claims时，可传 `--requests-file`，内容为一到十六个原 `source_check` 请求对象的JSON数组。每项服务器返回或RPC错误完整保留；进程完成不等于每个语义检查都通过。

## 实际路由和技能行为

客户端经新线程的 `mcpServerStatus/list` 检查目录，再使用该 `threadId` 与唯一活跃semantic服务器调用 `mcpServer/tool/call`。只暴露 `semantic_ui_schema` 与 `semantic_ui_source_check` 两项。禁用服务器仍会出现在状态元数据中，本例检查它们为disabled且没有工具/资源，不把元数据行误称为连接。

- 正常入口：2次显式工具调用，schema与来源事实返回成功。
- 定向反例：4次显式调用，读取有限声明；依次得到supported、unknown、unsupported-by-source、not-assessed；不支持结论的说明被withheld，请求侧换源被拒绝。双层请求参数及响应正文/structuredContent一致。
- 两轮均为独立临时线程，没有 `turn/start` 或推理调用，正常默认模型/推理保持，本机全局配置摘要未变；进程已退出。

本包的 `skills/semantic-ui-checks` 通过 `skills/extraRoots/set` 临时加入当前进程，再以 `skills/list` 被发现，最后经正常 `fs/readFile` 读取该归档路径，内容逐字节相同。清除extraRoots后目标技能不再出现。API的 `scope=user` 是该额外根的分类，不能理解为全局安装。标准列表同时保留本机默认技能元信息；本例只读取自包技能正文，没有加载其它技能内容到模型。

## 证据和边界

脚本默认建立权限为700的私有日志目录；完整app-server/MCP JSONL、线程ID、运行参数、结果与退出状态均保留，终端输出给出其位置。源码示例不上传日志。`finally` 清除技能额外根、取消本线程订阅、关闭自有进程并删除自建解压目录。不要把含真实来源的日志提交开源。

本次公开回执保留来源/归档/入口摘要、实际结构化结果及双层报文摘要；完整原件留在本任务私有记录。`sourceFactsVerified=false`、`identityVerified=false`：有限文字核对不认证作者、真实世界或任意正文。技能可发现/可读也不证明模型在下一回合采用它。原D1无据推荐与自然工具采用仍待后续独立验收，本段新增推理为0。

官方合同：[App Server](https://learn.chatgpt.com/docs/app-server)、本机 `codex app-server generate-json-schema --experimental`。本机0.164.0的 `skills/list` schema没有文档中提到的perCwdExtraUserRoots字段，实际采用已存在的 `skills/extraRoots/set`；未猜接口或改全局注册。
