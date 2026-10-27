# 在真实DSH中查看已保存的模型视图

这个按需示例把[同一模型对话的两轮真实结果](CODEX-SOURCE-HISTORY.zh-CN.md)送进个人隔离的DSH Native正常render，显示两份可交互组件。**它是既有模型结果的呈现回放，始终0新增模型。** 来源、原始模型参数、正常宿主安全投影与最终checkpoint分别留证，不把截图或终端说明当成原候选已原样显示。

## 启动示例

在仓库根目录完成 `pnpm install --frozen-lockfile`，使用已经下载的[preview.26运行包和manifest](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/v0.1.0-preview.26)：

```sh
node examples/dsh-model-history.mjs \
  --archive artifacts/releases/0.1.0-preview.26/whytan-dsh-semantic-ui-0.1.0-preview.26.tgz \
  --manifest artifacts/releases/0.1.0-preview.26/package-manifest.json \
  --open
```

脚本创建新的私有profile，通过正常 `dsh plugin add` 安装本地原归档，启动自己的loopback宿主与确定性回放传输，依次提交两份完整来源。准备完成后，在macOS现有Edge中打开页面；无需真实模型账号、API密钥或新模型请求。其它平台可省略 `--open`，从本次输出目录的受保护 `OPEN-PRIVATE.txt` 取得本地访问地址。首次使用若没有Playwright Chromium，先执行 `pnpm exec playwright install chromium`；它用于本地启动与验收，不是模型服务。

页面的会话名和回答明确标为“已保存模型结果的呈现回放”。可以查看旧true/true与新false/unknown的两个历史组件，切换“需要离线”“小组维护余力”，看局部需求检查变化。来源说明保留检查器的布尔字面值true/false，分别表示“是/否”；操作控件使用中文，未知单独显示。

默认命令保持页面可用，**Ctrl+C结束本次自有服务**。私有profile、原生会话与诊断保留在忽略提交的 `artifacts/local/`，不注册永久后台或修改共享工作台。每次创建新目录；也可显式指定新的 `--output`。

仅做自动窄验并清理时，使用同一命令但把 `--open` 换成 `--check`。这会核两个实际模型view、四次局部切换、来源/历史不写回、刷新还原，以及640/360px截图；不执行旧版本完整矩阵。原生宿主与包入口来自安装的26，不用语义插件源码overlay，也不重查388个包文件；只核本地归档摘要和5个运行入口的身份。

## 真实模型候选怎样进入宿主

[加载器](../examples/saved-model-history.mjs)先核公开source-history清单中的证据文件原字节与raw final摘要。然后按每轮实际completed `semantic_ui_source_check` 的matched状态及其source SHA，选择最近一次真实匹配的view/mapping。没有按题名、displayId、答案或手工expected筛选，也没有从host canonical重建候选。

| 来源 | 原Codex事件 | 本次Native正常输入 → checkpoint | 原初值 |
|---|---|---|---|
| 第1版 | turn `01a17e15-fbfc-7662-8329-0ce20c926bd8`，公开tool item index8 | message seq10 → checkpoint seq29，宿主turn1 | 离线需求true / 余力true |
| 第2版 | turn `01a17e17-68d2-7c83-b578-df88a1b1db2c`，公开tool item index2 | message seq39 → checkpoint seq62，宿主turn2 | 离线需求false / 余力null |

原模型thread是 `01a17e15-f5b9-79e2-bea6-b73206aa14d0`；这里创建的是另外的DSH回放session。原模型出处、source/raw摘要、合法回放requestId、持久user消息、实际工具调用和checkpoint逐项关联，见[完整分层回执](evidence/model-view-host.json)。正常入口生成的producer.kind=user只证明输入定位，不认证独立人类或作者。

两种接口的必要差异也保留：原MCP候选的typed claims完整送给正常source-check；Decision render按既有合同只收view/mapping，因此适配仅省略source-check专用claims并增加action=render。**传入render的view与mapping保持原模型值，view的JSON字节摘要相等。** 这里的参数摘要定义为UTF-8 `JSON.stringify`，不冒原wire空白的字节摘要；原证据文件和raw final则核完整原字节。

宿主再次核当前来源，然后按原安全合同形成新checkpoint：重建summary和标题、替换两方案未认证的suitableWhen，加入正常presentation。两份实际投影差异都是这5处；维度、方案标签/单元格、输入/初值、requirements与原候选一致。原模型注释没有被称为已认证，原候选仍可在[第1轮](evidence/source-history/phase-1.json)和[第2轮](evidence/source-history/phase-2.json)查看。原始首轮标签失败及同回合修正也保持原记录，回放没有把它改成首次成功。

## 可见结果与交互

第2版中，模型原view的false/null进入正常render；两方案离线项均未启用，本地维护条件未知。把离线需求本地改为“是”，在线方案的该项转为不满足；把未知余力改为“否”，本地维护项转为不满足。第1版的两个相应切换同样改变局部结果。

四次操作前后，完整原生journal cut与事件列表一致，来源说明和checkpoint未变，回放传输没有新增请求。每次刷新都恢复两个历史组件各自的原初值；新来源没有覆盖旧消息或旧checkpoint。把旧true/true模型view用于新来源，正常source-check和render都拒绝两个SOURCE_INITIAL。

| 旧来源，360px | 新来源，360px |
|---|---|
| [实际组件截图](evidence/model-view-host/phase-1-360.png) | [实际组件截图](evidence/model-view-host/phase-2-360.png) |

另有[第1版640px](evidence/model-view-host/phase-1-640.png)、[第2版640px](evidence/model-view-host/phase-2-640.png)。所有截图来自实际DSH页面中的组件根，实际宽度分别640/360，无根溢出、pageerror0；不是独立静态网页或手工重算的展示。

## 验收范围

3项离线来源选择/频道适配合同通过，已加入后续CI入口；本次没有启动新的CI或发行。一次 `--check` 完成两轮回放与四次交互；另一次默认serve确认页面就绪、两组件正常显示，并实测Ctrl+C收口。两次共4个确定性fixture Agent回合、20个本机传输POST，真实新模型回合和调用均为0。

两次安装器、Native宿主、浏览器seed进程全部终态，浏览器正常关闭，自有HTTP传输关闭，端口均已关闭。没有停止或改动共享服务、全局账号/模型/路由/trust；原26归档、旧模型预算和首次失败不变。本次只有示例、窄验和文档，不重包或重发26。

本次主张的是macOS **DSH Native** 正常工具与图形组件呈现，没有新增PTC、Linux宿主、真机或Codex主界面富UI验收，也不是同轮实时跨客户端流或DSH控件回传模型。既有raw的有限met保持原范围，本段没有生成新raw；`sourceFactsVerified=false`、`identityVerified=false`、`freeProseVerified=false`继续成立。
