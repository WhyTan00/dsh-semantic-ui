# 实际进度

状态：三轮共 33 题真实模型已执行；0.1.0-preview.3 准备发行，内容语义验收仍未全部通过。更新日期：2026-10-23。

## 有效范围与决定

- 沿用已有独立个人仓库及全部交接文件，未重建项目。会话从 AI 根目录定位本项目；代码、Git、构建与测试均在本项目独立仓库执行。私有接管回执与原始输入不公开。
- 仅使用公开上游和独立代码，不访问公司项目、配置、记录或服务，不调整共享模型和调度。个人 GitHub 身份与项目级作者已核实。
- 锁定 DSH 0.2.1-rc.2 / commit 687f282e8625c6b8d11ff58211a90524be2e4317、json-render 0.21.1，保持 developer preview 定位。
- 使用标准工具结果 presentation metadata 保存整值 UI；没有自定义必需事件、第二套会话库或 DOM 挂载补丁。三组件继续使用已有实现。

## 已完成并验证

- 三组件、统一 catalog/schema、严格语义校验、统计纯函数、声明式比较、本地交互、错误降级及按需工具说明。
- TypeScript、30 项测试、发行构建通过。新增修复：真正重启时的历史读取、不等宽直方图拒绝、重复时间点的不同 offset 校验。
- Native / PTC 各四个代表样例通过生成状态、工具过程折叠、交互、640/360px 容器、刷新、切会话、历史重开及 28 回合后的实际补页；pageerror 为 0。
- 公开 GenUI 0.14.0 的旧消息与新语义节点在隔离真实宿主并存，刷新与重启恢复；关闭本插件新生成后仍保留历史。GenUI 自身的指引无法通过 renderUiTool 完全关闭。
- 实测 24 节点/45 边关系图的 360px 概览和邻域定位；80 节点/240 边只验证纯布局和校验，不外推可读性。
- 68 项生产/peer 运行依赖保留实际许可证与 NOTICE，包括嵌套的第三方许可证。

## 发行与安装

- 个人公开仓库：[WhyTan00/dsh-semantic-ui](https://github.com/WhyTan00/dsh-semantic-ui)。版本化 tgz、SHA256SUMS、打包清单以 [v0.1.0-preview.3 Release](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/v0.1.0-preview.3) 为准；不宣称 npm 已发布。
- 最终 tgz 在新建隔离 profile 中通过真实 dsh plugin add 安装并运行四个 Native 样例；安装输入 SHA-256 见 [install.json](evidence/install.json)。安装、保留历史、完全停用及恢复同版本见 INSTALL。
- Linux CI 实际通过，含 30 项测试、真实 DSH Native/PTC 代表矩阵及打包，见 [linux-ci.json](evidence/linux-ci.json)。宿主侧栏 hover 的 Linux 鼠标遮挡限制已记录，CI 的系列复选框使用原生键盘操作；不宣称 Linux 实机或手机验收。
- 自有代码 MIT；依赖逐项保留许可证与 NOTICE。普通工具输出仅短回执，原始私有运行数据不随源码或包公开。

## 真实模型接入与剩余工作

已核实并复用用户现有的个人 WorkBuddy 登录：公开连接器 dsh-connect-workbuddy 5.6.2、workbuddy / deepseek-v4.1-flash、high。在任务独立 DSH profile 中通过连接器正常引用现有个人登录，不提取密钥，不修改现有服务或共享路由。此前新建官方模型 profile 的空授权状态不足以判断这个渠道不可用，该判断已纠正。

三轮固定题共 33 条已执行。第一轮 3 条通过、2 条有保留、6 条失败；第二轮 3/2/6；第三轮 4/3/4。所有首次模型可见输入、工具调用、拒绝、模型内部修正、正文、640/360px 与控件证据保留，公共版本移除机器路径。一次升级前旧版本误启动额外单列为设置失败，没有替换或隐藏。

0.1.0-preview.2 补充连续路径、未知初始条件和判断来源；0.1.0-preview.3 再明确禁止关系不能成为实际边、约束必须真正排除、未知比较不因优先级变成已知，以及零填补偏差方向。第三轮禁止关系与路径正确，七个模型组件控件和 640/360px 检查通过，页面错误为 0。前两轮 WorkBuddy 与宿主临时模型徽标冲突在独立 profile 通过公开停用徽标解决；现有服务未更改。

第三轮 D1/D2/D3/T2 仍有内容语义失败。后续重点是可解释比较中提议规则与用户事实的对应、未知比较不能自动胜出、额外自然语言结论的克制；不把 schema 通过、页面正常或完成题数当作内容正确。当前预览可安装，但不能据此声称完整语义验收或生产稳定性。
从 README、VALIDATION、fixtures/questions.json 和 natural-question-results.json 恢复。完整任务书仍为 DEVELOPMENT_BRIEF，不降低验收标准。私有运行日志及原始模型可见请求保留在本项目忽略目录，公共证据只含虚构示例与非敏感结果。
