# 在个人Codex显式读取DSH保存结果

独立Codex伴随包`0.1.0-preview.31.1`增加完整结果入口，复用已经发行的DSH31解析器、语义核心、A/B和来源检查。DSH31包和个人3200入口继续沿用，不为这次桥接重打、重装或重启。

## 正常命令

从本仓库的独立`codex-v0.1.0-preview.31.1` Release下载ZIP、manifest和SHA256SUMS并核对。解压后只需Node24+，不要求开发依赖或另装DSH：

```sh
node /absolute/path/plugins/semantic-ui-checks/dist/result-readonly.js \
  --result-file /absolute/path/saved-result.json
```

默认通过真实stdio MCP调用`semantic_ui_result_check`，输出中文有限说明、结构化分层核对，以及完整的`document`。缺独立来源时明确标成未核；包的校验和、`bound`记录或来源标签不认证作者/现实事实。数字null、实测0和false、语言/主题、A/B选择和未应用草稿保留。

也可在仓库沿用已有Python伴随入口：

```sh
python3 examples/codex-readonly.py \
  --result-package /absolute/path/saved-result.json \
  --plugin-package /absolute/path/semantic-ui-checks-codex-0.1.0-preview.31.1.zip \
  --plugin-manifest /absolute/path/plugin-package-manifest.json
```

结果模式先核对ZIP和逐文件摘要，在仓库外含空格的临时目录运行相同客户端。不启动Codex进程、线程或模型，不读取/改写全局Codex配置；输入原件只读。旧`--answer`路径维持原来的合同，本轮没有运行它的模型模式。

## 固定来源和差异

来源在MCP服务器启动时由调用者的明确文件/选段/kind固定，沿用原有有限检查器。包和工具请求不能指定替代文件或批准者。以公开合成容量来源为例：

```sh
node /absolute/path/plugins/semantic-ui-checks/dist/result-readonly.js \
  --result-file /absolute/path/capacity-result.json \
  --source-file fixtures/capacity-source.json --source-json-pointer /text \
  --source-kind capacity-zh --mapping-file /absolute/path/capacity-mapping.json \
  --require-source
```

映射合同与原`semantic_ui_source_check`一致；容量映射为`capacityDimensionId`、`demandInputId`、`requirementId`，均引用原view中的真实ID。核对只针对包内**原始view**；已应用的B、保留A和草稿分别计算，不拿它们替换来源中的当前需求。容量80GB的原声明可以与A80/B120的本地试算并存；无效草稿NaN不会变成120或0。明确可能的未来点仍不是已确认计划，部署/维护/未知不互相补齐。

回执的`layers`分别列出包内声明、来源历史记录、固定源核对和本地计算。决策A/B复用同一个`decide`，保留变化字段、需求检查与未知；图表的计算注明原始完整范围，筛选/表格/图状态仍在原包，未把展示选择当新来源。历史来源摘要与当前固定来源不同会明确拒绝原来源一致性，不重写旧记录。

`checked`只表示有限字段核对匹配，身份/世界事实/任意正文仍为未认证。没有固定来源返回`checked-unverified`；错误映射或来源冲突返回`source-mismatch`；损坏、坏字段或不兼容结果返回拒绝。CLI在要求来源未满足、映射失败或坏包时以非零状态退出；不会覆盖原件、换源或请求模型补答案。

## 带回DSH

```sh
node /absolute/path/plugins/semantic-ui-checks/dist/result-readonly.js \
  --result-file /absolute/path/saved-result.json --emit document > copied-result-new.json
```

此模式仅向stdout输出原合同document，没有新包协议，也不添加认证或重写来源；输入仍只读。可把新文件导入兼容DSH继续。新工具读取格式1/2/3，格式3仍需DSH31或兼容reader；保存语言保留在文件内，接收端显示语言遵循其现有偏好。原始文件和DSH历史/私人模板库不由桥接修改。

## 当前客户端边界

当前Codex可以通过上述普通显式命令使用CLI/MCP，本轮不全局安装或自动注册新工具。主会话自然选择工具、原生富UI及自然模型内容正确性分别未验。官方[app-server API](https://learn.chatgpt.com/docs/app-server#api-overview)把`mcpServer/tool/call`定义为线程配置的MCP调用，`turn/start`会开始生成；原伴随旧路径创建临时thread，本次结果模式用直接stdio适配满足零新增线程和推理约束。工具返回数据与文本，不附UI资源或动作回传。

验证运行`pnpm typecheck`、`pnpm test`及新`tests/codex-result-interop.mjs`；独立包在无node_modules、含空格路径中核对MCP/CLI/原Python入口，输入字节和同合同输出、固定来源/缺来源/错映射/旧格式/坏包分别记录。开发首个工具数量断言仍期待3，已按新增第四个只读工具更正，来源门禁没有放松。最终包、两平台及公开下载接受在冻结后单列，不以脚本存在或模型回放替代。原六题0通过/6失败/18请求不变，本轮0新增自然模型/推理回合。
