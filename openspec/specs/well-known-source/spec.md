# well-known-source Specification

## Purpose
TBD - created by archiving change add-well-known-source. Update Purpose after archive.
## Requirements
### Requirement: well-known URL 的静态判定

`detectSourceType` SHALL 保持纯静态、零网络.  对 http(s) 输入, 当 hostname 不在 git 主机排除表内且路径不以 `.git` 结尾时, SHALL 返回 `'well-known'`.

git 主机排除表 SHALL 为常量: `github.com`, `gitlab.com`, `raw.githubusercontent.com`, `codeload.github.com`.  hostname 比较 SHALL 大小写不敏感.

`.zip` / `.skill` 结尾的 URL SHALL 继续优先归为 `'remote-zip'`, 不受本需求影响.

#### Scenario: 文档站 URL 判定为 well-known
- **WHEN** 输入为 `https://docs.stripe.com`
- **THEN** `detectSourceType` SHALL 返回 `'well-known'`

#### Scenario: GitHub URL 不受影响
- **WHEN** 输入为 `https://github.com/openai/skills`
- **THEN** `detectSourceType` SHALL 返回 `'remote-url'`

#### Scenario: .git 后缀判定为 git
- **WHEN** 输入为 `https://git.company.com/team/skills.git`
- **THEN** `detectSourceType` SHALL 返回 `'remote-url'`

#### Scenario: zip URL 优先级更高
- **WHEN** 输入为 `https://example.com/pack.zip`
- **THEN** `detectSourceType` SHALL 返回 `'remote-zip'`

#### Scenario: 判定过程不发起网络请求
- **WHEN** 对任意输入调用 `detectSourceType`
- **THEN** SHALL NOT 发起任何网络请求, 函数保持同步

### Requirement: well-known index 发现

系统 SHALL 按顺序探测下列路径, 第一个返回 200 且通过校验的即为命中:

1. `<origin>/.well-known/agent-skills/index.json`
2. `<origin>/.well-known/skills/index.json`

`<origin>` SHALL 为输入 URL 的 `protocol//host`, 输入 URL 的 path SHALL 被忽略 (只支持 origin 根).  探测路径清单 SHALL 定义为常量数组, 便于后续增删.

每次发现请求 SHALL 设置 10 秒超时.  两个路径都未命中时视为**发现失败**.

#### Scenario: 首选路径命中
- **GIVEN** 站点同时提供 `/.well-known/agent-skills/index.json` 与 `/.well-known/skills/index.json`
- **WHEN** 用户执行 `skillsmgr install https://example.com`
- **THEN** 系统 SHALL 使用 `/.well-known/agent-skills/index.json`, 不再请求 legacy 路径

#### Scenario: 回退到 legacy 路径
- **GIVEN** 站点只提供 `/.well-known/skills/index.json`
- **WHEN** 用户执行 `skillsmgr install https://example.com`
- **THEN** 系统 SHALL 使用 `/.well-known/skills/index.json`

#### Scenario: 输入带路径时仍用 origin 根
- **WHEN** 用户执行 `skillsmgr install https://example.com/docs/guide`
- **THEN** 系统 SHALL 探测 `https://example.com/.well-known/agent-skills/index.json`, 不探测 `https://example.com/docs/guide/.well-known/...`

#### Scenario: 发现请求超时
- **WHEN** index 请求超过 10 秒未返回
- **THEN** 该路径 SHALL 视为未命中, 继续探测下一路径

### Requirement: 发现失败报错中止

当 well-known 发现失败 (两个路径都未命中, 或命中后校验出的合法条目为 0) 时, 系统 SHALL 报错中止安装, SHALL NOT 回退到 git clone.

错误信息 SHALL 包含: 已探测的完整 URL 列表, 以及"若该地址是 git 仓库, 请用 `.git` 后缀显式声明"的提示.

#### Scenario: 无 well-known 端点的站点报错
- **WHEN** 用户执行 `skillsmgr install https://example.com` 且该站点无 well-known 端点
- **THEN** 系统 SHALL 报错中止
- **THEN** 错误信息 SHALL 列出已探测的两个 index URL
- **THEN** 错误信息 SHALL 提示可用 `.git` 后缀声明 git 源
- **THEN** 系统 SHALL NOT 调用 `installViaGitClone`

#### Scenario: index 存在但零合法条目也报错
- **GIVEN** 站点的 index.json 可访问, 但所有条目均未通过校验
- **WHEN** 用户执行安装
- **THEN** 系统 SHALL 报错中止, 并列出各条目被丢弃的原因

#### Scenario: 自建 git 裸 URL 报错而非 clone
- **WHEN** 用户执行 `skillsmgr install https://git.company.com/team/skills`
- **THEN** 系统 SHALL 按 well-known 发现并在失败后报错中止
- **THEN** 系统 SHALL NOT 尝试 git clone

#### Scenario: .git 后缀仍走 git 路径
- **WHEN** 用户执行 `skillsmgr install https://git.company.com/team/skills.git`
- **THEN** `detectSourceType` SHALL 返回 `'remote-url'`
- **THEN** 系统 SHALL 走 git clone 安装路径, 不发起 well-known 发现

### Requirement: index schema 判定与校验

系统 SHALL 按 `$schema` 字段判定 index 版本:

- 字段缺省 → **v0.1.0 (legacy)**
- 字段等于 `https://schemas.agentskills.io/discovery/0.2.0/schema.json` → **v0.2.0**
- 字段为其他值 → SHALL 拒绝整个 index (视为该路径未命中)

顶层 SHALL 为对象且 `skills` SHALL 为数组, 否则拒绝整个 index.

条目级校验 SHALL 逐条进行, 不合法条目 SHALL 被丢弃且向 stderr 打印原因, SHALL NOT 静默吞掉:

| 项 | 规则 |
|---|---|
| `name` | `^[a-z0-9-]+$`, 长度 1–64, 不以 `-` 开头或结尾, 不含 `--` |
| `description` | 非空 string, 长度 ≤1024 |
| v0.1.0 `files` | 非空 string 数组; 每项不以 `/` 或 `\` 开头, 不含 `..`, 不含 `\0`; 至少一项 (大小写不敏感) 等于 `SKILL.md` |
| v0.2.0 `type` | 只能是 `'skill-md'` 或 `'archive'` |
| v0.2.0 `digest` | 匹配 `^sha256:[a-f0-9]{64}$` |
| v0.2.0 `url` | 可被 `new URL(url, indexUrl)` 解析, 且解析结果的 host 与 index 同源 |

#### Scenario: 未知 $schema 拒绝整个 index
- **WHEN** index 的 `$schema` 为 `https://example.com/unknown/schema.json`
- **THEN** 系统 SHALL 拒绝该 index, 该探测路径视为未命中

#### Scenario: 非法 skill name 条目被丢弃
- **GIVEN** index 含 3 个条目, 其中一个 `name` 为 `My_Skill`
- **WHEN** 系统解析 index
- **THEN** 该条目 SHALL 被丢弃并打印原因
- **THEN** 另外 2 个合法条目 SHALL 正常可安装

#### Scenario: v0.1.0 缺 SKILL.md 的条目被丢弃
- **WHEN** 某 v0.1.0 条目的 `files` 不含 `SKILL.md`
- **THEN** 该条目 SHALL 被丢弃

#### Scenario: 含路径逃逸的 files 条目被丢弃
- **WHEN** 某 v0.1.0 条目的 `files` 含 `../../etc/passwd`
- **THEN** 该条目 SHALL 被丢弃

#### Scenario: v0.2.0 跨源 artifact url 被丢弃
- **GIVEN** index 位于 `https://example.com/.well-known/agent-skills/index.json`
- **WHEN** 某条目的 `url` 解析后 host 为 `evil.example.net`
- **THEN** 该条目 SHALL 被丢弃

#### Scenario: description 超长被丢弃
- **WHEN** 某条目的 `description` 长度超过 1024
- **THEN** 该条目 SHALL 被丢弃

### Requirement: v0.1.0 文件拉取

对 v0.1.0 条目, 系统 SHALL 按其 `files` 清单逐个 GET `<origin>/.well-known/<命中的路径段>/<name>/<file>`, 全部落到 `~/.skills-manager/well-known/{hostname}/{name}/` 下的对应相对路径.

单个文件请求失败 (非 200 / 超时) SHALL 使该 skill 整体安装失败并清理已写入的部分文件, SHALL NOT 留下残缺 skill 目录.

文件拉取 SHALL 串行进行, 不做并发.

#### Scenario: 多文件 skill 完整落盘
- **GIVEN** 条目 `files` 为 `["SKILL.md", "references/a.md"]`
- **WHEN** 用户安装该 skill
- **THEN** `~/.skills-manager/well-known/{hostname}/{name}/SKILL.md` 与 `references/a.md` SHALL 存在且内容与远端一致

#### Scenario: 单文件失败则整体失败并清理
- **GIVEN** 条目 `files` 为 `["SKILL.md", "references/a.md"]`, 其中 `references/a.md` 返回 404
- **WHEN** 用户安装该 skill
- **THEN** 系统 SHALL 报错
- **THEN** `~/.skills-manager/well-known/{hostname}/{name}/` SHALL NOT 残留

### Requirement: v0.2.0 artifact 拉取与 digest 校验

对 v0.2.0 条目, 系统 SHALL 从解析后的 `url` 下载 artifact:

- `type: 'skill-md'` → 内容直接写为该 skill 的 `SKILL.md`
- `type: 'archive'` → 按压缩包解包到该 skill 目录

下载完成后 SHALL 计算内容的 `sha256` 并与条目 `digest` 比对, **不符即该 skill 安装失败并清理**, SHALL NOT 降级为"仅告警继续".

archive 解包 SHALL 满足: 解压总量上限 50MB, 文件数上限 1000, 写盘路径限定在该 skill 目录内, 拒绝含 `..` 或绝对路径的条目.

#### Scenario: digest 匹配则安装成功
- **WHEN** 下载的 artifact sha256 与 `digest` 一致
- **THEN** 该 skill SHALL 安装成功

#### Scenario: digest 不匹配 fail-closed
- **WHEN** 下载的 artifact sha256 与 `digest` 不一致
- **THEN** 系统 SHALL 报错并中止该 skill 的安装
- **THEN** 该 skill 目录 SHALL NOT 残留

#### Scenario: archive 超过解压上限中止
- **WHEN** archive 解压总量超过 50MB
- **THEN** 系统 SHALL 中止解包并报错

#### Scenario: archive 文件数超限中止
- **WHEN** archive 条目数超过 1000
- **THEN** 系统 SHALL 中止解包并报错

#### Scenario: archive 逃逸路径被拒
- **WHEN** archive 含以 `..` 或 `/` 开头的条目
- **THEN** 系统 SHALL 拒绝该 archive, 不在目标目录外写盘

### Requirement: 传输安全约束

well-known 的全部网络请求 (index 发现、文件拉取、artifact 下载) SHALL 满足:

- **https-only**: 非 https 的 URL SHALL 报错中止, 例外仅 loopback 主机 (`localhost`, `127.0.0.1`, `[::1]`) 允许 http
- 重定向 SHALL NOT 跨 host; 重定向到不同 host 时 SHALL 报错中止
- 下载 SHALL 设置 idle 超时, 防止挂死连接
- 落盘后 SHALL 复用现有 `warnScriptFiles` 对脚本文件告警, 与 git / registry 源一致

#### Scenario: 非 loopback 的 http 被拒
- **WHEN** 用户执行 `skillsmgr install http://example.com`
- **THEN** 系统 SHALL 报错中止, 不发起 index 请求

#### Scenario: loopback http 放行
- **WHEN** 用户执行 `skillsmgr install http://127.0.0.1:8787`
- **THEN** 系统 SHALL 正常执行发现流程

#### Scenario: 跨 host 重定向被拒
- **WHEN** artifact 下载被重定向到不同 host
- **THEN** 系统 SHALL 报错中止, 不读取响应体

#### Scenario: 落盘脚本文件告警
- **WHEN** 安装的 skill 含可执行脚本文件
- **THEN** 系统 SHALL 通过 `warnScriptFiles` 打印告警

### Requirement: skill digest 记录与更新检测

每个已安装的 well-known skill SHALL 在 `SourceInfo.skillDigests` 中记录一个 `sha256:<64hex>` digest:

- v0.2.0: 直接采用 index 条目自带的 `digest`
- v0.1.0: 由本地实际拉到的全部文件内容计算, 算法为按文件相对路径升序, 依次 `hash.update(path)`, `hash.update('\0')`, `hash.update(content)`, `hash.update('\0')`

v0.1.0 的 digest 仅用于变更检测, SHALL NOT 被当作防篡改保证; 真正的完整性校验只在 v0.2.0 路径成立.

`update` 对 well-known source SHALL 重新发现 index, 逐 skill 比对 digest: 不同则删除本地目录重新下载并计入 `updated`; 相同则计入 `upToDate`; 本地已装但远端 index 已无该 skill 时打印 "not found in remote" 且 SHALL NOT 删除本地.

#### Scenario: digest 变化触发重装
- **GIVEN** 本地记录的 digest 与远端 index 的 digest 不同
- **WHEN** 用户执行 `skillsmgr update {hostname}`
- **THEN** 系统 SHALL 删除本地 skill 目录并重新下载
- **THEN** 结果计入 `updated`, 并写回新的 digest

#### Scenario: digest 相同则跳过
- **GIVEN** 本地记录的 digest 与远端一致
- **WHEN** 用户执行 update
- **THEN** 系统 SHALL NOT 重新下载, 结果计入 `upToDate`

#### Scenario: 远端已下架的 skill 不删本地
- **GIVEN** 本地装有 skill `foo`, 远端 index 已不含 `foo`
- **WHEN** 用户执行 update
- **THEN** 系统 SHALL 打印 "not found in remote"
- **THEN** 本地 `foo` 目录 SHALL 保留

#### Scenario: 无副作用验证
- **GIVEN** 同一 source 下装有 skill `a` 与 `b`, 仅 `a` 的 digest 变化
- **WHEN** 用户执行 update
- **THEN** `a` SHALL 被重装
- **THEN** `b` 的目录 mtime 与内容 SHALL 保持不变

### Requirement: 存量 git installMethod 不自动迁移

对 `sources.json` 中已存在、`installMethod` 为 `'git'` 的非 git 主机 URL source, `update` SHALL 继续按其记录的 `installMethod` 走 git 路径, SHALL NOT 因为 URL 现在会被判定为 well-known 就自动改走 well-known 流程.

用户如需迁移, SHALL 先 `uninstall` 再重新 `install`.

#### Scenario: 存量 git source 保持 git 更新路径
- **GIVEN** `sources.json` 含 key `community/example/skills`, `url` 为 `https://git.example.com/example/skills`, `installMethod` 为 `'git'`
- **WHEN** 用户执行 `skillsmgr update`
- **THEN** 该 source SHALL 走 git clone 更新路径
- **THEN** SHALL NOT 发起 well-known 发现请求

