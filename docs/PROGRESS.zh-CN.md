# 实际进度

状态：0.1.0-preview.1 预览发行；自然问题模型验收尚未完成。更新日期：2026-10-23。

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

- 个人公开仓库：[WhyTan00/dsh-semantic-ui](https://github.com/WhyTan00/dsh-semantic-ui)。版本化 tgz、SHA256SUMS、打包清单以 [v0.1.0-preview.1 Release](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/v0.1.0-preview.1) 为准；不宣称 npm 已发布。
- 最终 tgz 在新建隔离 profile 中通过真实 dsh plugin add 安装并运行四个 Native 样例；安装输入 SHA-256 见 [install.json](evidence/install.json)。安装、保留历史、完全停用及恢复同版本见 INSTALL。
- Linux CI 实际通过，含 30 项测试、真实 DSH Native/PTC 代表矩阵及打包，见 [linux-ci.json](evidence/linux-ci.json)。宿主侧栏 hover 的 Linux 鼠标遮挡限制已记录，CI 的系列复选框使用原生键盘操作；不宣称 Linux 实机或手机验收。
- 自有代码 MIT；依赖逐项保留许可证与 NOTICE。普通工具输出仅短回执，原始私有运行数据不随源码或包公开。

## 唯一外部依赖与恢复入口

固定 11 题的两轮自然问题共 22 条仍未执行。任务独立个人 profile 的公开接口确认账户 signed-out、官方模型 API Key 未配置；没有读取或复制秘密。完成正常个人模型授权后，在同一渠道/模型/可控设置下每题新会话运行，保留所有首次结果与重试，再完成第二轮；不以确定性夹具替代。

从 README、VALIDATION、fixtures/questions.json 和 natural-question-results.json 恢复。完整任务书仍为 DEVELOPMENT_BRIEF，不降低验收标准。私有运行日志及原始模型可见请求保留在本项目忽略目录，公共证据只含虚构示例与非敏感结果。
