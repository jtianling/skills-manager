## Why

`skillsmgr install <url>` 目前把任何非 `.zip` 的 http(s) 输入都当成 git remote (`detectSourceType` → `remote-url` → `installViaGitClone`), 所以 `skillsmgr install https://docs.stripe.com` 会以 `fatal: repository 'https://docs.stripe.com/' not found` 失败.  而以 Stripe 为代表的一批厂商已经在自己域名下按 RFC 8615 风格发布 skill (`/.well-known/skills/index.json`), 这是当前 skill 生态里增长最快的分发形态 — 无需 registry 账号、无需 git, 域名本身就是身份锚点, 由 TLS 证书背书.  skillsmgr 声称"统一管理 44 种工具的 skills", 却接不上这条主流分发链路.

## What Changes

- 新增 **well-known** 源类型: 排除已知 git 主机后的普通 http(s) URL, 走 well-known 发现协议安装, 而不是 git clone
- 发现流程: 依次探测 `<url>/.well-known/agent-skills/index.json` (首选) 与 `<url>/.well-known/skills/index.json` (legacy), 命中即用
- 支持两种 index schema:
  - **v0.1.0 (legacy)**: `{skills:[{name, description, files:[...]}]}`, 按 `files` 清单逐个 GET 目录下的文件
  - **v0.2.0**: `$schema: https://schemas.agentskills.io/discovery/0.2.0/schema.json`, 每项 `{name, type: 'skill-md'|'archive', description, url, digest: 'sha256:<64hex>'}`, 按 digest 校验完整性
- 安装落盘到 `~/.skills-manager/well-known/{hostname}/{skillName}/`, `SKILL_SOURCES` 新增 `'well-known'` (沿用现有 `registry/` 源的形状)
- sources.json 记录 `type: 'well-known'` / `installMethod: 'well-known'`, source key 为 `well-known/{hostname}`, 并记录 index 摘要用于更新检测
- `update` 支持 well-known source: 重新拉取 index, 按内容/digest 比对决定是否重装
- 按项目**命令对称性**硬规则, `uninstall` 同步支持传入同一个 URL 卸载, `source-resolver` 识别该源类型
- 边界校验 fail-closed: skill name 白名单、description 长度上限、文件路径禁 `..`/绝对路径、archive 解包大小与文件数上限、https-only、发现请求超时
- **BREAKING**: 自建 git 主机的 http(s) URL (不以 `.git` 结尾, 如 `https://git.company.com/team/skills`) 不再走 git clone, 而是按 well-known 发现; 发现失败即报错中止.  该场景当前无已知用户, 需要时用 `.git` 后缀显式声明为 git 源
- 现有 GitHub / GitLab URL 与 owner/repo 输入行为完全不变

## Capabilities

### New Capabilities
- `well-known-source`: well-known 发现协议的完整源类型 — URL 判定、index 发现与 schema 校验、两种 schema 的文件拉取、安全边界、落盘布局、更新与卸载语义

### Modified Capabilities
- `unified-source-detection`: `detectSourceType` 的 `SourceType` 联合类型新增 `'well-known'`; 非 git 主机的普通 http(s) URL 不再归为 `'remote-url'`
- `source-management`: 来源分类表新增 well-known 类别及其存储路径与 source key 规则; `SourceInfo.type` / `installMethod` 新增 `'well-known'`; 更新流程新增 well-known 分支
- `uninstall`: "通过 URL 卸载"需求扩展 — well-known URL 按 `well-known/{hostname}` 定位卸载, 不再降级为按 skill 名查找而失败

## Impact

**新增代码**
- `src/services/wellknown/` — index 发现、schema 校验、文件/archive 拉取
- `src/commands/install-wellknown.ts` — 安装分支

**修改代码**
- `src/utils/source-detection.ts` — `detectSourceType` 新增分支 + 已知 git 主机排除表
- `src/commands/install.ts` — `installBySourceType` 新增 case
- `src/commands/uninstall.ts` — URL 卸载分支
- `src/services/source-resolver.ts` — `resolveUrl` 识别 well-known
- `src/services/source-updater.ts` — well-known 更新分支
- `src/services/sources.ts` — `SourceInfo` 类型扩展
- `src/constants.ts` — `SKILL_SOURCES` 新增 `'well-known'`
- `src/services/registry.ts` / `scanner.ts` — 枚举新目录

**依赖**: 复用现有 `node:zlib` + `node-tar` (codeload 路径已引入), 不新增第三方依赖

**外部契约**: `agent-skills` / `skills` 两个 well-known suffix 均**未**在 IANA well-known URI 注册表登记, 属事实标准; 实现需容忍其未来变动

**测试**: 单测用本地 fixture + fetch mock, 不依赖外网; e2e 用本地 HTTP server 托管 fixture index
