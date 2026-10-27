# 安装、隔离验证和回退

当前推荐[preview.22](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/v0.1.0-preview.22)：371文件最终归档已在macOS/Linux的Native/PTC正常安装验证，[完整异常规则](SOURCE-WORKFLOW.zh-CN.md)及普通答复正反例分层接受，四份匿名资产同字节，见[回执](evidence/source-workflow.json)。新workflow-zh来源metadata需要22兼容reader；既有组件/来源历史保留，旧21/20/19资产不覆盖。

历史已核版本[preview.19](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/v0.1.0-preview.19)，317文件归档已在本机/Linux定向安装验收，四份资产匿名回验一致；[新证据](evidence/source-update.json)随仓库单列。18候选因真实安装失败未发行。

preview.19新增[单个未知当前事实补充](SOURCE-UPDATE.zh-CN.md)：owner明确提交走正常prompt，accepted、持久新消息和新来源checkpoint分层；不明/重复只核原ID，不重发。新metadata带可选requestId，严格旧17 reader不承诺读取；旧历史仍可由19读取。最终归档验收单独记录，不回灌不可变包。

本预览支持 **DSH 0.2.1-rc.2、Node 24+、pnpm**。已有其他 DSH 安装并不需要重装；使用公开发行版的准确可执行路径即可。不要修改正在运行的实例。

preview.17的条件来源核对需要17或实现该增量的兼容版本；协议仍为1.4。本机/Linux实际归档安装、Native/PTC、普通Codex入口和两次有指引模型观察分别见[本版接受](evidence/source-condition.json)，不外推当前主客户端或真机。

preview.16新增的数值来源交付已在最终归档上完成隔离Native/PTC正反例及刷新检查；其它功能仍按各版本证据读取，不把此定向检查当全矩阵。新来源checkpoint要求16或兼容reader，回退旧15不承诺读取新kind。

## 使用 Release 包

从个人仓库 Releases 下载运行包、独立证据包与 SHA256SUMS。下面的全量校验需要两个 tgz 都在同一目录；证据包无需安装。只下载运行包时，可单独计算其 SHA-256 与 SHA256SUMS 的对应行比较。

```sh
# macOS
shasum -a 256 -c SHA256SUMS
# Linux
sha256sum -c SHA256SUMS

dsh --version
dsh plugin --profile web add /absolute/path/to/whytan-dsh-semantic-ui-0.1.0-preview.22.tgz
```

`dsh plugin` 安装包并组合公开 bundle patch；普通 `npm install` 本身不等于插件已启用。首次安装后重启所选 profile，刷新 DSH 页面，检查插件列表。不要在已有生产/共享实例中进行本项目验收。

运行包包含简要验证说明和证据索引；冻结源码前的历史输入/结果与截图位于独立的 `whytan-dsh-semantic-ui-evidence-0.1.0-preview.22.tgz`。本版归档的后补接受另存仓库[本版回执](evidence/source-workflow.json)及子目录，不回灌或重打不可变包。`package-manifest.json` 分别记录运行包和证据包的 SHA-256、大小及文件清单/数量，首次失败始终保留。

自然使用需要这个 profile 中已有可用的个人模型渠道，可通过 **Settings → Models** 管理。既有 WorkBuddy 等连接器可正常复用用户已授权的个人登录；没有官方 DeepSeek API Key 不代表其他模型渠道未授权。插件不包含模型密钥、不导入其他工具凭据、不读取其他项目配置。已有服务的 401 只说明该请求未通过浏览器认证，不能证明模型不可用。

## 项目内隔离实例

```sh
pnpm install --frozen-lockfile
pnpm check
export DSH_HOME="$PWD/artifacts/local/personal-dsh"
pnpm exec dsh --profile web --no-open --port 3197
# 在另一个终端，使用相同 DSH_HOME：
export DSH_HOME="$PWD/artifacts/local/personal-dsh"
pnpm exec dsh plugin --profile web add /absolute/path/to/release.tgz
```

这只建立独立 profile；不复制其他 DSH_HOME 的配置、记录或凭据。首次启动打印的本地授权入口只在私人终端使用，不进入仓库、截图或公开报告。

从源码开发也可用公开 overlay：`- insert: [{id: dsh-semantic-ui, name: '/absolute/path/to/this/repo/dist/host.js'}]`，然后传 `--patch`。必须指向 host.js；ESM 不接受直接目录导入。不要扫描或修改宿主 DOM 来挂载结果。

## 停用、保留历史与回退

完全停用：在所选 profile 的插件管理中停用 dsh-semantic-ui，或移除包并重新加载。已有 DSH 日志不改写；没有 renderer 时组件事件无法显示，但普通文字摘要仍保留在助手回复中。重新启用相同兼容版本后可恢复。

只停用新生成而保留历史：将此插件行配置设为 `generation: false`。工具、系统指引和 Skill 不再注册；同包 client 继续注册历史聊天节点。重启所选 profile、刷新页面后核对。恢复为 true 或移除此选项以重新启用。

回退：先保存 profile 的 patch/package 元数据和 DSH 自有会话备份，再用 `dsh plugin --profile web add /absolute/path/to/previous.tgz` 恢复兼容包。协议不支持时显示可读错误，不迁移或改写旧消息。不对 0.1.x 宣称兼容。

旧公开包 v0.1.0-preview.1 仍可下载并通过相同命令回退；它尚无当时完成的自然问题证据，旧版与当前版都不作生产稳定性承诺。也可停用生成、完全停用插件，或重新安装同一版本。完全移出 composition 后普通会话仍可读取，重新启用同版本后历史组件恢复，已在任务独立实例测试。

## macOS / Linux

开发命令使用 Node、pnpm，不依赖 macOS GUI。无模型时 `pnpm test:host` 使用明确标注的本地确定性夹具运行真实 DSH；它不计为自然提问验收。测试用的浏览器为 Playwright Chromium，可用 `pnpm exec playwright install chromium` 安装。

Linux CI 与 Linux 实机必须分开记录；CI 构建/测试通过不能替代用户 Linux 桌面和个人模型验证。锁屏只影响真实 GUI 操作，不影响本项目 CLI、安装和测试执行。

## WorkBuddy 连接器的独立兼容提示

本次使用公开 `dsh-connect-workbuddy@5.6.2`，个人模型登录通过连接器正常使用，未提取或复制密钥。DSH 0.2.1-rc.2 的临时 DeepSeek 1017 模型标签与该连接器争用 single slot，在前两轮测试产生一个页面注册错误。第三轮仅在隔离测试 profile 的 `cordis.patch.yml` 关闭该临时标签后错误消失：

```yaml
- id: ui-deepseek-model-label-1017
  disabled: true
```

它只停用显示徽标，不改变模型目录、请求参数或 WorkBuddy 路由。本插件本身不改此设置，也不替用户修改已有服务。使用其他连接器/版本时，不应无依据套用这个开关。

## 个人模板与回退

preview.6 以 profile 名称分隔个人模板库。复制或修改默认主题不改历史；跨 profile 迁移使用显式导出/导入。操作入口和保留字段见 [模板说明](TEMPLATES.zh-CN.md)。回退到 preview.5 可以读取旧 1.0 节点，新的 1.1 节点需恢复 preview.6 renderer 才能显示；不会自动降级重写历史。

## Codex 可选接入

DSH 安装与 Codex 接入独立。无需把 DSH renderer 装进 Codex；可复用同包 `dist/mcp.js` 的只读检查工具，步骤、原生 UI 支持范围及移除命令见 [CODEX](CODEX.zh-CN.md)。本次未修改全局 Codex 配置或共享路由。

## 按版本保留本地产物

`pnpm release:pack` 输出到 `artifacts/releases/<package-version>/`。每版各有运行包、证据包、SHA256SUMS和manifest，不覆盖旧preview.8的根目录产物。preview.9安装/旧协议回读及Linux按各自SHA/commit记录，见 [安装证据](evidence/preview9/install.json)、[CI](evidence/preview9/linux-ci.json)。

preview.10沿用协议1.3，增加同表格范围的缺失值对照；仅重验改动图表的Native/PTC安装路径，既有完整矩阵仍按preview.9记录。当前安装与Linux检查见 [preview.10证据](evidence/preview10.json)。可回退到保留的 [preview.9 Release](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/v0.1.0-preview.9)，不改写保存的会话。

preview.11使用协议1.4的新角色/作用合同，保存的1.0–1.3快照保持原解释。新交付请先describe，提供明确字段角色与expectedEffect。实际版本归档安装、MCP和Linux结果见 [本版回执](evidence/preview11.json)；可回退到保留的 [preview.10](https://github.com/WhyTan00/dsh-semantic-ui/releases/tag/v0.1.0-preview.10)，不改写会话。

preview.12支持当前输入的有限Decision/权限来源绑定，普通render仍为唯一入口。打包要求干净的源码commit，manifest记录完整sourceCommit和各运行入口SHA-256；同版本输出若与已冻结字节不同则拒绝覆盖。`pnpm test:installed-source`将包正常装入新profile，启动前逐文件核字节，再检验必要的Native/PTC交付及旧1.0读取。窄矩阵不等于旧全矩阵重新通过，有限来源核对也不等于原自然题通过。

实际发布、归档安装、独立MCP、Linux和匿名HTTPS检查见 [preview.12回执](evidence/preview12.json)。source tag固定实现commit，后续交付文档单独提交，不改变已发布四份资产。

preview.13只改MCP初始化工作流，DSH四入口与preview.12同字节，未重跑旧DSH矩阵。独立归档/stdio/Linux检查与两题真实Codex结果见 [本版回执](evidence/preview13.json)：MCP正常启动，两题均没有实际检查调用，不能以N2正文正确宣称插件已被采用。当前Codex/全局配置未改；安装新会话不等于自动采用。
