# 验证证据与未通过项

状态：预览；不是完整自然问题验收完成，不是生产稳定性认证。所有数据和问题均为虚构。

## 当前实际证据

- macOS 原生命令环境：联网依赖安装、HTTPS 请求、本地随机端口 HTTP 监听/回读均实际通过。执行边界的私有证据不随项目公开。
- 固定公开 DSH 0.2.1-rc.2、真实 Web Client、真实工具注册与 DSH 自有日志；以本地确定性 HTTP 夹具替代模型，仅用于宿主链路。UI 整值载荷保存在标准工具结果的 presentation metadata，模型只收到短回执。
- Native：ArchitectureExplorer、DecisionExplorer、折线 DataChart、histogram DataChart 已通过实际工具执行、聊天挂载、过程持续折叠、控件改变内容、刷新、切会话及新页面历史重开。实际组件容器为 640px 和 360px；各例组件根横向溢出为 0。局部表格允许显式可访问横向滚动。
- 本地交互刷新复位；重放后每个展示 ID 只显示一个组件。
- PTC 已独立跑通四个代表样例的同一生命周期矩阵，结果见 evidence/ptc-lifecycle.json。夹具曾漏传 run_code 必需 description，另有等待最终 turn 完成的时序问题；均修复后重跑，不用首次失败冒充成功。Native 结果见 evidence/native-lifecycle.json。
- TypeScript、30 项协议/引用/路径/决策/统计/重放/合同测试及发行构建通过；计数见 [checks.json](evidence/checks.json)。
- 运行时依赖逐项保留许可证，实际包括 MIT、Apache-2.0、Python-2.0、ISC、BSD-3-Clause、0BSD，不能一概称为 MIT。

版本包安装证据单独保存在 [固定 Release 的 install.json](https://github.com/WhyTan00/dsh-semantic-ui/blob/v0.1.0-preview.1/docs/evidence/install.json)，其中的 SHA-256 对应实际安装的 tgz。该回执不嵌入 tgz，避免包内自包含自身校验和。

原始请求、宿主日志与浏览器状态仅保留在 git 忽略的本地验证目录，避免公开私人环境上下文或本地认证资料。公开记录只包含非敏感聚合结果。

## 有限的能力边界

- 生成中：由真实宿主的模型/工具过程承担；本插件仅在校验后的整值 checkpoint 完成时交付，不宣称有增量 spec 流。
- 无数据、验证失败、协议版本不支持及渲染异常有可读降级。空/全零/负数/缺失与分箱边界在纯函数测试中覆盖。
- Native 和 PTC 各四个样例均以 28 回合真实历史验证补页：最早组件不在初始窗口，通过实际 session/page 请求恢复，重复组件数为 0。见 [Native](evidence/native-pagination.json) 与 [PTC](evidence/ptc-pagination.json)。
- 较大关系图在真实宿主验证 24 节点、45 边、360px 容器的概览、定位、5 节点邻域、隐藏计数及恢复全图；复杂图需要定位后阅读。80 节点、240 边仅测校验和纯布局耗时，不作为该规模的浏览器可读性保证，见 [scale.json](evidence/scale.json)。复杂嵌套分组不支持。
- 不支持操作回传模型、跨设备显示偏好同步、脚本规则、任意图表配置或任意生成应用。
- 固定公开 `@changfenhuang/dsh-genui` 0.14.0 在隔离真实 DSH 安装并与本插件并存，旧 dsh-ui 消息仍由原 renderer 显示；刷新、切会话及进程重启后的恢复已验证。本插件 `generation: false` 去掉工具与常驻指引并保留历史。详细结果见 [GenUI 说明](GENUI.zh-CN.md)。用户实际目标环境和两个插件同时启用时的自然模型表达选择仍未验收。
- 直方图首版只支持等宽分箱；不等宽区间返回 BIN_WIDTH，避免在等宽轴上误画。加权平均、分位数、任意 ECharts option 不受支持。

## 发现并修正的实际问题

跨进程重启发现，早期未发布实现追加的自定义必需事件会被 DSH 的持久化读取器拒绝，普通页面刷新不能暴露这一点。现改为 `output.presentationMeta`：Native 的 tool/result 与 PTC 的 tool/ptc-dispatch 保存完整载荷，不增加必需事件、不修改旧消息，也不调用上游明确禁止外部使用的实验记录 API。重启及停用生成的集成复测通过；原失败日志只留在私有验证目录。

同时修复了不等宽直方图和相同时间点不同 UTC offset 的重复输入校验。测试夹具自身的 run_code 参数、完成等待及宿主附加 user-role 提醒导致的场景选择问题也保留失败记录后修正；它们不计为自然模型首次结果。

## 自然问题模型验收

`fixtures/questions.json` 在首次自然测试前固定为 11 题：架构 3、比较 3、数据 3、文字对照 2。每题包含事实标准，允许合理文字表达，不以强制出图率判成功。

`natural-question-results.json` 保留第一轮及第二轮各 11 个条目，目前均为 **not-run**，首次结果为 null，重试为空。通过任务独立 profile 的公开 account/getState、credentials/describe 和正常 Models 引导确认：账户 signed-out，官方模型 API Key configured=false。这里只检查了授权元数据，未读取或复制秘密；这不代表其他个人服务不存在，也不把 Codex 登录视为 DSH API 凭据。见 [授权状态证据](evidence/model-authorization.json)。

后续须在隔离 profile 正常完成个人模型授权，选择相同模型渠道/标识/可控设置，为每题新建会话，保留全部首次输入、实际工具调用、显示与事实检查；任何重试另存。第二轮完整重复同一题集。未完成这些之前维持 preview。

## 系统区分

macOS：本轮本地实测。Linux：同一 Node/pnpm 构建与测试命令已提供；CI 运行状态另行记载，不声称 Linux 实机、真实移动设备或用户个人模型验证已经通过。

Linux Chromium 的宿主侧栏 hover card 曾遮挡系列复选框的鼠标点击；CI 保留失败记录，并使用真实 focus + Space 键验证该复选框的可访问交互，未使用 force click 或移除宿主 DOM。macOS 的鼠标路径已通过。这是锁定宿主的 UI 边界，CI 通过也不等于 Linux 全部鼠标路径已验收。

## 可查看的真实宿主截图

以下为真实 DSH 内组件截图，使用确定性夹具，不是自然问题模型效果：

![Architecture 360](evidence/architecture-360.png)

![Decision 360](evidence/decision-360.png)

![DataChart 640](evidence/chart-640.png)

![Histogram 360](evidence/histogram-360.png)
