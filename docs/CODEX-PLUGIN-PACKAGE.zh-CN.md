# 可安装的本地Codex插件包

现在提供独立的 `semantic-ui-checks-codex` 分发包：技能、只读MCP、便携清单和本地插件源放在同一个ZIP中。安装后由插件启动检查工具，用户无需再单独执行 `codex mcp add`。它仍复用DSH Semantic UI的核对核心，不增加图形渲染器或模型调用层。

本地包版本为 `0.1.0-preview.27.1`，与DSH运行包 `0.1.0-preview.27` 分开。生成时先将当前核心的编译字节与选定27归档逐项对照，拒绝借用不同核心的身份；MCP入口另按插件版本编译。初始化自报版本过去硬编码为24，已修为包/构建版本，首次失败保留。已发布的DSH27归档不修改、不重发。

## 安装

从本仓库的独立 [Codex本地插件Release](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/codex-v0.1.0-preview.27.1)下载ZIP、`plugin-package-manifest.json` 与 `SHA256SUMS`，核对后解压到独立目录。在解压目录执行：

```sh
codex plugin marketplace add .
codex plugin add semantic-ui-checks@dsh-semantic-ui-personal
```

本机Codex CLI0.166.0的帮助已确认这两个命令的形式。它们由使用者选择执行，会登记/安装插件；本次开发没有执行它们，没有改你的全局配置或当前会话。安装后在新的本地会话中确认工具是否实际加载；支持的桌面端也可通过本地插件源安装。需要Node24+，运行包已包含MCP与核心，不要求安装DSH、开发依赖或配置新模型API。

清单采用官方的根 `plugin.json`、`mcp.json` 和 `skills/` 便携结构，使用 `${PLUGIN_ROOT}` 解析本地入口；本地插件源放在 `.agents/plugins/marketplace.json`。这些方式见 [OpenAI官方打包文档](https://developers.openai.com/plugins/build/plugins)。

## 实际能力

默认三个只读工具：

- `semantic_ui_schema`：按需读取组件字段合同。
- `semantic_ui_check`：核对结构并计算图关系、需求条件或数值事实。
- `semantic_ui_template_check`：核对显式传入的导出模板和当次新数据。

默认没有独立来源工具，不读取当前项目、账户或DSH私有模板。来源核对仍需调用者在服务器启动时明确固定一个来源快照；原[伴随CLI](CODEX.zh-CN.md)保留此入口。工具参数不能把模型提供的文本升级为独立来源。技能新增按需的[流程异常与权限边界指引](../skills/semantic-ui-checks/references/relations.md)，只在对应来源工具已配置时使用。

旧DSH27归档里的MCP仍自报24，原件保持；新Codex包报告自己的27.1构建版本。它们的核心字节对应由manifest单列核对，不能只靠自报版本认定来源相同。

这个包不读取当前Codex聊天的可信原文，不提供自定义UI资源或动作回传。输出可交给宿主已有可视化、Mermaid、表格或文字；不能由检查通过声称已经出图。模型是否选择工具、自由正文是否正确、当前App及主会话是否加载，分别验证。原六题0通过/6失败/18请求和所有首败不改判。

这是GitHub开源分发，不代表已发布到OpenAI官方插件目录。官方目录的本地MCP提交另有准入条件，见[官方桌面插件说明](https://developers.openai.com/plugins/deploy/desktop-only)；本项目没有访问组织设置、申请准入或提交目录。

## 从源码生成

在本仓库安装开发依赖后，使用已核对的运行归档和manifest，输出目录必须尚不存在：

```sh
node scripts/pack-codex-plugin.mjs \
  --archive artifacts/releases/0.1.0-preview.27/whytan-dsh-semantic-ui-0.1.0-preview.27.tgz \
  --manifest artifacts/releases/0.1.0-preview.27/package-manifest.json \
  --output artifacts/local/my-codex-plugin
```

命令只构建ZIP、manifest和校验文件，不下载、安装、登记插件或调用模型。核心不对应、SHA不符或目标目录已存在时拒绝。包内法律文件沿原归档保留，MCP与技能各有摘要；没有把用户文件或凭据打包进去。

验证使用独立解压目录（路径含空格）、没有`node_modules`的服务器和真实JSON-RPC stdio。它验证清单和实际工具，不代替当前Codex App安装或新的自然模型观察。最终分发与验证状态见[本地插件回执](evidence/codex-plugin-package.json)。
