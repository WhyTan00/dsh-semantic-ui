# 六题：现有修复、真实剩余与当前采用

原run9仍是 **0通过 / 6失败 / 18请求**。原问题、工具参数、回答、首败和A2归因勘误保持原字节。本轮复核发现，已知结构化错误的可控部分已有preview.12–27的通用实现；当前31源码编译的host与个人3200安装字节一致，七份历史来源说明也与当前有限检查器一致。因此本轮保持核心/renderer代码不变，采用已有成果，不再重写解析器或制造新运行版本。

## 逐题范围

| 原题 | 原错误 | 当前已具备的可控修复 | 真实剩余 |
| --- | --- | --- | --- |
| A2 | 从通知失败推断反向回传受阻、上游已完成；原视图缺完整异常策略映射 | workflow-zh完整解析正向关系和明确retry-only/no-rollback；普通render重核映射，正文投影只保留有据规则。共享payment→notify勘误保留 | 原模型选择、执行/故障因果自由正文未重新验收；库存失败策略未知 |
| A3 | Client替代原文“客户端”；只读推成不影响写、故障独立；共享节点数被当作耦合宽度 | 精确名称、方向、逐对权限、禁止和主体only-targets；来源绑定后重建正文/节点说明，不从缺边推出隔离或替代路由 | 原整段正文和模型采用未重验；任意故障/耦合解释不认证 |
| D1 | 需要团队维护被映成支持维护，资源谓词颠倒；编造费用周期和维护事实 | resource-need与requires-availability；未声明反面保持null，拒绝虚构价格单位；无据优缺点/政策不进入来源投影 | 原自然映射及额外费用/维护正文未重新通过 |
| D2 | 预留开关只连偏好却承诺300GB硬排除；部署简单混成维护简单 | 完整容量/精确单位、当前需求与未来可能量分开；数字硬要求真实相连，部署/维护属性分别投影，不形成整体推荐 | 原正文未重验；迁移、成本和未来计划的缺失事实仍未知 |
| N2 | GenUI称任意填值都会改变均值，中位数不受影响 | 逐位置值/null/实测0/单位核对，观测与完整分母分开；typed mean和补零假设共用已有统计核心 | GenUI原文字、模型是否选择检查、任意中位数等附加正文未认证 |
| T2 | 把补零对均值/总量/告警的方向普遍化 | 已有负值/零和反例；没有具体读数的概念问题不强制作图、不取得有限来源批准 | 概念性自由正文仍未通过，不将拒绝认证称为修复原回答 |

具体旧修复与真实宿主范围见[权限/条件来源交付](SOURCE-DELIVERY.zh-CN.md)、[流程规则](SOURCE-WORKFLOW.zh-CN.md)、[容量](SOURCE-CAPACITY.zh-CN.md)、[数值来源](NUMERIC-DELIVERY.zh-CN.md)、[补零假设](ZERO-FILL-CHART.zh-CN.md)。[六题原来源参考](ORIGINAL-CASE-REFERENCE.zh-CN.md)已记录较早的正常Native交付；本轮直接复用这些记录，不重跑旧宿主矩阵。

T2的数学边界仍需明确：补零相对已观测均值可升、降或相同；观测之和加0不变，未知完整总量的方向不能确定，告警取决于另行给定规则。这些已有反例不构成对原概念性自由正文的整体认证。

## 在现有个人DSH读取有据结果

**[打开个人DSH交互视图（本机3200）](http://127.0.0.1:3200/)**，在已有语义消息中展开“保存与携带完整结果”，选择下载后的结果JSON。入口与认证的实际边界见[免命令操作说明](INTERACTIVE-ENTRY.zh-CN.md)。

| 结果 | 来源与核对记录 |
| --- | --- |
| [A2流程与明确异常规则](evidence/six-grounding-current/results/A2.json) | [原问题](evidence/natural/r9-A2.json) · [原文片段/关系/规则坐标](evidence/six-grounding-current/traces/A2.json) |
| [A3访问与权限](evidence/six-grounding-current/results/A3.json) | [原问题](evidence/natural/r9-A3.json) · [原文片段/权限坐标](evidence/six-grounding-current/traces/A3.json) |
| [D1资源条件与未知](evidence/six-grounding-current/results/D1.json) | [原问题](evidence/natural/r9-D1.json) · [原文片段/角色/条件坐标](evidence/six-grounding-current/traces/D1.json) |
| [D2容量与当前/未来](evidence/six-grounding-current/results/D2.json) | [原问题](evidence/natural/r9-D2.json) · [原文片段/量值/条件坐标](evidence/six-grounding-current/traces/D2.json) |
| [N2读数与统计范围](evidence/six-grounding-current/results/N2.json) | [原问题](evidence/natural/r9-N2.json) · [位置/缺失/单位/分母](evidence/six-grounding-current/traces/N2.json) |

这五个包的view及sourceRecord来自既有正常Native实际checkpoint，逐项原值保留。它们是程序依据来源构成的有限参考，**不是原模型的修正回答或新的模型通过**。来源记录保留原文本摘要、消息序号及当时有限说明；校验和检测数据完整性，不认证作者、人类身份或现实事实。

另有两份[既有真实模型结果的来源修订快照1](evidence/six-grounding-current/results/revision-1.json)、[快照2](evidence/six-grounding-current/results/revision-2.json)，来自已记录的正常Native回放投影。它们保留各自来源和原始条件，不把后来false/unknown覆盖到早先true/true，也不代表原六题的新模型回答。[数据清单与SHA](evidence/six-grounding-current/packages.json)注明各包归属和作者层次。

导入后，展开“保存时的来源说明”可读有限正文；顶部明确显示历史来源记录。它不是当前回合的新核对，旧host引用不会取得当前来源补充权限。本地改变条件/筛选不会重写来源；“保存结果到当前环境”后刷新、读取并重开即可继续。T2没有兼容的有限来源包，原文字仍在原记录，不补造图表。

## 本次新验证及边界

- 七个包都以独立文件/选段来源重新核对，有限字段匹配，历史说明与当前canonical文本相同。源码host编译字节及安装host/client与冻结31相符，不需要更新或重启宿主。
- 新的保存包组合反例：原N2包对修订读数返回source-mismatch；新来源的正例匹配且观测均值4/3；即使均值仍0，把null伪装成实测0也拒绝。矛盾回滚声明使canonical withheld；无据故障独立声明保持not-assessed。
- 当前个人3200正常文件选择器实际采用D1、N2与两份既有模型修订记录：D1本地余力false排除虚拟机但原来源未知不变；N2本地筛选均值1与原完整来源均值0/完整均值未知分开。保存、刷新、重开与两版来源独立恢复均通过，历史记录没有升级为新批准。
- 93历史压缩字节/metadata、模板、配置和原私有结果保留；本轮正常采用的六份测试副本及首次脚本文字预期错误留下的一份精确副本均按归属清理，pageerror=0。首次失败和恢复原件保留，来源算法没有为测试放松。

[完整分层接受](evidence/six-grounding-current.json)明确区分旧Native/PTC证据复用、本轮离线字段组合检查和本轮正常保存恢复；没有把它们合成新的自然模型验收。本轮0新增模型/API推理、MCP连接、服务、fixture Agent回合或运行版本，未重装/重发31/31.1。

原模型的整段自由正文、自然选择何种工具和第三方GenUI内容仍不由本插件认证。后续自然验收须在独立可证的既有免费渠道资格及剩余预算下做受控新观察，不能清零旧消耗或改写首败。当前Codex原生富UI、用户Edge视觉及真实手机/读屏效果也保持原边界。
