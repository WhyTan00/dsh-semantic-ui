# 安装、隔离验证和回退

本预览支持 **DSH 0.2.1-rc.2、Node 24+、pnpm**。已有其他 DSH 安装并不需要重装；使用公开发行版的准确可执行路径即可。不要修改正在运行的实例。

## 使用 Release 包

从个人仓库 Releases 下载 tgz 和 SHA256SUMS，同目录验证：

```sh
# macOS
shasum -a 256 -c SHA256SUMS
# Linux
sha256sum -c SHA256SUMS

dsh --version
dsh plugin --profile web add /absolute/path/to/whytan-dsh-semantic-ui-0.1.0-preview.1.tgz
```

`dsh plugin` 安装包并组合公开 bundle patch；普通 `npm install` 本身不等于插件已启用。首次安装后重启所选 profile，刷新 DSH 页面，检查插件列表。不要在已有生产/共享实例中进行本项目验收。

自然使用需要在这个 profile 的 **Settings → Models** 通过正常界面授权个人模型。插件不包含模型密钥、不导入其他工具凭据、不读取其他项目配置。已有服务的 401 只说明该请求未通过浏览器认证，不能证明模型不可用。

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

## macOS / Linux

开发命令使用 Node、pnpm，不依赖 macOS GUI。无模型时 `pnpm test:host` 使用明确标注的本地确定性夹具运行真实 DSH；它不计为自然提问验收。测试用的浏览器为 Playwright Chromium，可用 `pnpm exec playwright install chromium` 安装。

Linux CI 与 Linux 实机必须分开记录；CI 构建/测试通过不能替代用户 Linux 桌面和个人模型验证。锁屏只影响真实 GUI 操作，不影响本项目 CLI、安装和测试执行。
