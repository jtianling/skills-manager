## Context

`detectSourceType` 目前对 http(s) 输入只有两种归类: `.zip`/`.skill` 结尾 → `remote-zip`, 其余 → `remote-url` → `installViaGitClone`.  这个"URL 即 git remote"的假设在 self-hosted Gitea/GitLab 场景是对的, 但对按 RFC 8615 风格发布 skill 的文档站 (docs.stripe.com 等) 完全失效.

现有代码里已有一个非 git 源的完整先例: `registry` 源 —— `SKILL_SOURCES` 含 `'registry'`, 落盘 `~/.skills-manager/registry/{pkg}/{skill}/`, source key `registry/{pkg}`, `SourceInfo.type/installMethod` 各有一个 `'registry'` 取值, `SourceUpdater.updateSource` 首行就按 `info.type === 'registry'` 分流.  well-known 源沿这条已铺好的路走, 不需要新架构.

参考实现是 npm 包 `skills` (源码 `~/workspace/ref-repos/skills`), 本设计的协议细节与之对齐, 但**不照抄其源码结构**.

## Goals / Non-Goals

**Goals:**
- `skillsmgr install https://docs.stripe.com` 能装上该站发布的 skill
- 同时支持 v0.1.0 (legacy, 目录+files 清单) 与 v0.2.0 ($schema + 单 artifact + digest) 两种 index
- `update` / `uninstall` / `source-resolver` 与 install 能力对称 (项目硬规则)
- 对不可信远端内容 fail-closed: 校验失败即中止, 不静默降级
- 现有 GitHub / GitLab / self-hosted git URL 行为**零变化**

**Non-Goals:**
- **子路径 scope** (`https://host/s/my-list`): 参考实现支持, 本期不做.  RFC 8615 明确把 well-known URI 锚定在 origin 根, 子路径探测是参考实现的扩展; 同时它带来"scope 未命中要不要回退根 index"这类语义复杂度 (参考实现为此专门抛 `WellKnownScopeNotFoundError`).  只支持 origin 根
- **同 host 多 source**: 一个 hostname 对应唯一 source key, 不支持同域名下并存多个 skill 集合
- **发布端**: 只做消费侧, 不做 `skillsmgr publish` 到 well-known 的能力
- **URL 直链下载**: 参考实现在发现失败时会把 URL 当 SKILL.md/archive 直接下载; 本期不做
- **自建 git 主机的裸 URL 兼容**: 见 Decision 1, 明确作为 BREAKING 放弃

## Decisions

### Decision 1: 纯静态判定, 发现失败即报错, 不回退 git clone

`detectSourceType` 保持**纯静态、零网络**(现有全部单测依赖这一点).  新增判定规则: http(s) 且 hostname 不在 git 主机排除表 (`github.com` / `gitlab.com` / `raw.githubusercontent.com` / `codeload.github.com`) 且路径不以 `.git` 结尾 → `'well-known'`.

发现阶段失败 (两个 index 路径都非 200 / JSON 非法 / 校验后 0 条目) 时, 系统**报错中止**, 不回退 git clone.

这是一个**已知的 BREAKING 变更**: 自建 git 主机的裸 URL (`https://git.company.com/team/skills`, 无 `.git` 后缀) 此前会被 git clone 装上, 之后会失败.  用户已明确接受 —— 该场景无已知实际用户, 且用户可用 `.git` 后缀 (`https://git.company.com/team/skills.git`) 显式声明 git 源绕开.  错误信息 SHALL 主动提示这条出路.

- 备选 A (发现失败回退 git clone): 完全向后兼容, 但让一次失败的安装产生两轮网络往返与两套错误信息, 且"URL 到底是什么源"变成运行时才知道的隐式状态 —— 用户判定为不值得, 否决
- 备选 B (先探测再决定源类型): 让 `detectSourceType` 变成 async 且带网络, 污染大量现有同步调用点与单测 —— 否决

### Decision 2: 落盘 `well-known/{hostname}/{skillName}/`, 完全对齐 registry 源

- `SKILL_SOURCES` 新增 `'well-known'`
- 目录 `~/.skills-manager/well-known/{hostname}/{skillName}/`
- source key `well-known/{hostname}`
- `SourceInfo`: `type: 'well-known'`, `installMethod: 'well-known'`, `url: 'https://{hostname}'`, `repoName: {hostname}`

hostname 小写归一化; 端口存在时并入 (`localhost:8787` → 目录名 `localhost_8787`, 冒号在部分文件系统不安全).

- 备选 A (塞进 `community/{hostname}/`): community key 是三段 `community/{owner}/{repo}`, hostname 只有一段, 会破坏 `source-management` 已定的 key 规则和物理 group 的三段假设 —— 否决
- 备选 B (塞进 `custom/`): custom 是平铺单层且不追踪来源, 会丢失 update 能力 —— 否决

### Decision 3: 统一 digest 作为更新检测依据

每个 skill 记一个 `sha256:<hex>` digest:
- v0.2.0: 直接用 index 条目自带的 `digest`, 并在下载后**实际校验** artifact 内容, 不符即该 skill 失败 (fail-closed)
- v0.1.0: index 不带 digest, 由本地对拉到的全部文件内容按路径排序算出 (`sha256(path\0content\0...)`), 仅作变更检测, 不具备防篡改意义

update 时重新发现 index, 逐 skill 比 digest: 不同 → 删目录重下载并标 updated; 相同 → upToDate.  这比现有 git 源"只比 SKILL.md 字节"更准确.

digest 存哪里: `SourceInfo` 新增 `skillDigests?: Record<skillName, string>`.

- 备选 (只存 index 整体摘要): index 任意一处变动就会触发全量重装, 粒度太粗 —— 否决

### Decision 4: 手写 type-guard 校验, 不引入 zod

项目当前零校验库依赖 (`plugin-manifest.ts` / `manifest.ts` 全是手写 type-guard).  为一个源类型引入 zod 不符合 YAGNI 与"最小变更".  校验规则 (全部 fail-closed, 单条不合法即丢弃该条目; 合法条目为 0 视为发现失败):

| 项 | 规则 |
|---|---|
| skill name | `^[a-z0-9-]+$`, 长度 1–64, 不以 `-` 开头/结尾, 不含 `--` |
| description | 非空 string, ≤1024 字符 |
| v0.1.0 `files` | 非空数组; 每项不以 `/` `\` 开头、不含 `..` 与 `\0`; 必须含 (大小写不敏感) `SKILL.md` |
| v0.2.0 `type` | 只能是 `'skill-md'` / `'archive'` |
| v0.2.0 `digest` | `^sha256:[a-f0-9]{64}$` |
| v0.2.0 `url` | 可被 `new URL(url, indexUrl)` 解析; 解析后 host 必须与 index 同源 |
| `$schema` | 缺省 → v0.1.0; 等于 v0.2.0 schema URL → v0.2.0; 其他值 → 拒绝整个 index |

v0.2.0 条目 url 的**同源约束**是本设计比参考实现更严的一处: 参考实现允许 artifact 指向任意主机, 那等于让 index 把下载重定向到第三方.

### Decision 5: 网络与解包安全边界, 复用 codeload 那套既定约束

`source-management` spec 已为 codeload 定下一套防护 (https-only / 超时 / 压缩态与解压态上限 / path traversal 拒绝), well-known 沿用同一套, 数值对齐参考实现:

- 传输: **https-only**, 例外仅 loopback (`localhost` / `127.0.0.1` / `[::1]`) 允许 http —— 这是 ACME/OIDC 生态的通行做法, 也是本地 e2e 起 fixture server 的必要口子
- 发现请求超时 10s; 文件/artifact 下载设 idle 超时
- archive 解包上限 50MB / 1000 文件
- 解包路径限定在目标目录内, 拒绝含 `..` 或绝对路径的条目
- 不跟随跨源重定向到非同 host 的地址
- 落盘前对脚本文件走现有 `warnScriptFiles`, 与 registry/git 源一致

### Decision 6: uninstall 对称性靠 source-resolver 新增 case 拿到

`SourceResolver.resolve` 的 switch 现在按 `detectSourceType` 分流, 新增 `'well-known'` case.  该 case 复用已有的 `findSourceByNormalizedUrl(url)` —— `normalizeGitUrl('https://docs.stripe.com')` 已能归一化出 `https://docs.stripe.com`, 与 `SourceInfo.url` 精确匹配, 所以 uninstall/remove 的 URL 定位几乎零新增逻辑.  仅在无匹配时把 reason 文案改成 well-known 语境.

## Risks / Trade-offs

- **`agent-skills` / `skills` 两个 suffix 未在 IANA well-known URI 注册表登记** (已核对当前注册表 112 条, 无任何含 "skill" 的条目), 属事实标准, 未来可能改名或收敛 → 探测路径表做成 `constants.ts` 里的常量数组, 增删一行即可跟进
- **v0.1.0 的 digest 无防篡改意义** (自己算自己的内容) → spec 与代码注释都写明它只用于变更检测; 真正的完整性保证只在 v0.2.0 路径成立
- **自建 git 裸 URL 从此装不上** (BREAKING, 已接受) → 发现失败的错误信息中明确给出 `.git` 后缀这条出路, 并在 CHANGELOG 中标注 BREAKING
- **一个 index 里几十个 skill 全量拉取会打很多次 HTTP** (Stripe 的 legacy index 就是每 skill 多文件) → 只对用户选中的 skill 拉文件, 发现阶段只取 index; 单 skill 内的多文件串行拉取, 不做并发 (避免对文档站造成压力, 也避免新增并发控制代码)
- **hostname 作为唯一身份, 同域名换发布内容无法区分** → 这正是该协议的信任模型 (域名 + TLS 即身份), 接受
- **loopback 允许 http 是一个显式放宽** → 限定在 loopback 主机名白名单, 不接受任意 IP; 非 loopback 的 http 直接报错中止

## Migration Plan

纯增量, 无数据迁移:
- `sources.json` schema 版本**不变** (仍 `3.0`).  `SourceInfo.type` / `installMethod` 是开放联合类型的扩展, 老版本 skillsmgr 读到 `type: 'well-known'` 的条目会在 update 时走不到任何分支 —— 需确认降级路径不崩 (见 Open Questions)
- `SKILL_SOURCES` 新增一项后, `registry.ts` / `scanner.ts` 的枚举自动覆盖新目录, 无需迁移已有安装
- 回滚: 移除该源类型后, `~/.skills-manager/well-known/` 目录与 sources.json 中对应条目成为孤儿, 需手工清理; 记入 CHANGELOG

## Open Questions

1. ~~老版本 skillsmgr 读到 `type: 'well-known'` 的 sources.json 条目时会不会崩~~ **已解决 (2026-08-19)**: 用已发布的 `skillsmgr@0.11.2` 实测, `sources.json` 中放一条 `type: 'well-known'` / `installMethod: 'well-known'` 条目后, `update <hostname>`、`update` (全量)、`list` 三个命令均正常退出 (exit 0), 只打印 `⚠ Cannot parse URL: https://docs.stripe.com` 并计 0 updated/0 failed, 无未捕获异常, 且 `sources.json` 内容不被改写.  同一文件里的 git source 条目也不受影响.  结论: 不需要额外的 forward-compat 跳过逻辑.  (本变更仍在**新**版本的 `SourceUpdater` 里加了未知 `type` 显式跳过分支, 那是为满足 `source-management` 的 "未知 type 不导致崩溃" 需求, 与本 Open Question 的降级方向无关)
2. 用户已通过 `install-git` 装过某个非 git 主机 URL (存量数据), 之后再对同一 URL 执行 `update`: 该 source 的 `installMethod` 是 `'git'`, 应继续走 git 路径还是迁移到 well-known?  倾向"尊重存量 `installMethod`, 不自动迁移", 待 specs 阶段确认
