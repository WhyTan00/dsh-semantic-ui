# 个人项目内直接读取保存结果

本地入口修订2：`scripts/result-local.ts`，独立伴随包31.2还编入同一文件入口`dist/result-local.js`。在本仓库现有Node24+和开发依赖环境中运行，直接复用`checkResultPackage`、`readResult`和来源快照读取器，不启动MCP、Codex进程、模型、DSH或服务。[完整答复交付门](ANSWER-DELIVERY.zh-CN.md)保留原候选未核，只交付当前有限来源的程序说明。旧DSH31/伴随31.1既有发行不变，没有全局安装。

## 正常使用

从个人仓库目录运行下面这条真实可用的命令。输入、来源与映射均为仓库已有或明确列出的公开合成文件：

```sh
node --import tsx scripts/result-local.ts \
  --result-file docs/evidence/codex-result-interop/examples/capacity-returned.json \
  --source-file fixtures/capacity-source.json --source-json-pointer /text \
  --source-kind capacity-zh --mapping-file fixtures/result-capacity-mapping.json \
  --require-source --emit explanation
```

会输出中文有限核对：原来源需求80；保留A80满足A、B，本地B120只满足B；当前查看A，NaN草稿无效且未应用。A/B只是同一原始view上的本地条件，不会替换固定来源，也不会确认任意模型注释。去掉`--emit explanation`可取得完整JSON回执：`document`保留原合同，`layers`分别列出声明、来源核对、A/B差异、草稿与当前选择。顶层`limited-delivery`只允许`answerDelivery.text`这份程序来源说明；`structuredStatus:checked`只表示有限字段匹配，原候选全文未认证。

不需要独立来源时，可以明确只读保存状态：

```sh
node --import tsx scripts/result-local.ts \
  --result-file docs/evidence/scenarios/examples/pair.json
```

这份示例会返回`checked-unverified`：A需求100、团队条件null，B需求220、团队条件true，仍查看A；价格null不变成0，来源没有升级为已核。这是读取未核数据，不是来源验收。加上`--require-source`而未取得固定源匹配会返回`source-required`并以2退出。

## 参数与退出

| 参数 | 含义 |
| --- | --- |
| `--result-file` | 一个明确保存包，最多128KiB；只读，不搜索其他文件 |
| `--source-file` | 调用者独立指定的固定来源，在读包之前捕获一次 |
| `--source-json-pointer`、`--source-excerpt`、`--source-kind` | 沿用既有来源选段及有限语法；没有源文件时拒绝 |
| `--mapping-file` | 明确字段映射JSON；与原来源检查合同一致 |
| `--answer-file` | 调用者明确提供的完整UTF-8候选；最多24,000字节，逐字保留未核 |
| `--binding-file` | 前次answerDelivery.binding；当前源、view/规则、映射或候选改变即拒绝 |
| `--require-source` | 未取得固定来源匹配就拒绝继续，不换源或补值 |
| `--emit report` | 默认；中文说明、完整document和结构化核对 |
| `--emit explanation` | 只显示同一核心生成的中文有限说明 |
| `--emit grounded` | 只输出当前来源的程序说明；缺源或交付拒绝时非零退出 |
| `--emit document` | 输出未核原合同供数据迁移，不是答复认证；失败非零退出 |
| `--help`、`--version` | 查看中文帮助、入口修订及沿用合同版本；不读取结果或来源 |

成功或明确的未核读取退出0；损坏、格式/依赖不兼容、错误映射、参数/文件错误和要求来源未满足退出2。未知或重复参数、软链接、非普通文件、过大文件、非法JSON/UTF-8会拒绝。文件读取前后核对大小及修改信息；包内声明不能指定另一来源文件、权限、批准者或工具。来源读取失败也不会回退到包内记录。

需要携带结果时，用一个新文件接收stdout；下面的另存方式避免覆盖已有文件：

```sh
(set -C; node --import tsx scripts/result-local.ts \
  --result-file docs/evidence/codex-result-interop/examples/capacity-returned.json \
  --source-file fixtures/capacity-source.json --source-json-pointer /text \
  --source-kind capacity-zh --mapping-file fixtures/result-capacity-mapping.json \
  --require-source --emit document > copied-result-new.json)
```

命令不写入原件、历史或模板库。当前读取既有格式1–5；接收端须支持该格式。此前已完成的DSH导回继续验证直接沿用，本次没有访问或重启3200，也没有重复旧宿主、中文化和模型矩阵。

## 本次实际采用与边界

修订1的原业务会话采用保留在[旧回执](evidence/codex-local-entry.json)，不改写其状态。修订2新增完整候选、有限交付和旧绑定拒绝，正常源码及最终编译消费者的结果见[新回执](evidence/answer-delivery.json)。入口进程的网络/子进程拒绝守卫核对零尝试，导入图不含MCP SDK、服务器、传输或网络/子进程模块。原输入与来源字节未变，0新增MCP连接、0新模型/API推理、0新Codex线程，没有全局配置变化。

这是当前Codex会话可以明确运行的项目命令，不代表当前主聊天已注册专用工具、模型会自然选择它或已有原生富UI。31.1的[独立ZIP与原Python入口](CODEX-RESULTS.zh-CN.md)仍使用stdio MCP，本次没有调用它们。原六题0通过/6失败/18请求、旧首败与冻结预算保持不变。
