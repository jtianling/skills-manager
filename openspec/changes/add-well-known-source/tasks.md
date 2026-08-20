## 1. 类型与常量地基

- [x] 1.1 `src/constants.ts`: `SKILL_SOURCES` 新增 `'well-known'`; 新增 `GIT_HOST_EXCLUSIONS` 常量 (`github.com` / `gitlab.com` / `raw.githubusercontent.com` / `codeload.github.com`) 与 `WELL_KNOWN_PATHS` 常量数组 (`.well-known/agent-skills` / `.well-known/skills`)
- [x] 1.2 `src/services/sources.ts`: `SourceInfo.type` 与 `installMethod` 联合类型各新增 `'well-known'`; 新增可选字段 `skillDigests?: Record<string, string>`
- [x] 1.3 `src/utils/source-detection.ts`: `SourceType` 联合类型新增 `'well-known'`
- [x] 1.4 `pnpm run build` 通过, 确认新增联合类型没有击穿现有 exhaustive switch (`installBySourceType` / `SourceResolver.resolve` 的 `never` 断言应报错, 作为下一步的待办清单)

## 2. source 判定 (TDD)

- [x] 2.1 `src/utils/source-detection.test.ts`: 按 `unified-source-detection` delta 的 4 个新 scenario 写 RED 测试 (非 git 主机 URL → well-known; github/gitlab → remote-url; `.git` 后缀 → remote-url; `git@` SSH → remote-url)
- [x] 2.2 补一条断言 `detectSourceType` 全程无网络且保持同步 (mock `globalThis.fetch` 断言未被调用)
- [x] 2.3 实现 `detectSourceType` 的 well-known 分支, 顺序严格按 spec: zip → git 主机排除表 → `.git` 后缀 → well-known
- [x] 2.4 回归: 现有 `source-detection.test.ts` 全绿, 确认 zip / owner-repo / local-path / registry / unknown 分类无变化

## 3. well-known 发现与校验 (TDD)

- [x] 3.1 新建 `src/services/wellknown/index-schema.ts`: 手写 type-guard `validateIndex(raw, indexUrl)`, 返回归一化条目数组 + 丢弃原因列表
- [x] 3.2 `index-schema.test.ts`: 覆盖 `well-known-source` capability "index schema 判定与校验" 的 6 个 scenario (未知 `$schema` 拒绝整个 index; 非法 name / 缺 SKILL.md / 路径逃逸 / 跨源 url / 超长 description 逐条丢弃)
- [x] 3.3 补测: 顶层非对象、`skills` 非数组 → 拒绝整个 index; 合法条目为 0 → 视为发现失败
- [x] 3.4 新建 `src/services/wellknown/discovery.ts`: 按 `WELL_KNOWN_PATHS` 顺序探测 `<origin>/.well-known/*/index.json`, 10s 超时, 输入 URL 的 path 一律忽略
- [x] 3.5 `discovery.test.ts`: 覆盖首选路径命中 / 回退 legacy / 带路径输入仍用 origin 根 / 超时视为未命中 4 个 scenario, 用本地 fixture + fetch mock, 不触外网

## 4. 传输安全层 (TDD)

- [x] 4.1 新建 `src/services/wellknown/fetch-guard.ts`: https-only (loopback 白名单 `localhost` / `127.0.0.1` / `[::1]` 放行 http)、拒绝跨 host 重定向、idle 超时
- [x] 4.2 `fetch-guard.test.ts`: 覆盖 "传输安全约束" 的 4 个 scenario (非 loopback http 被拒 / loopback http 放行 / 跨 host 重定向被拒 / 脚本文件告警)
- [x] 4.3 archive 解包防护: 复用/对齐 codeload 现有实现的上限 (50MB 解压态 / 1000 文件 / 拒绝 `..` 与绝对路径), 优先复用 `repo-clone.ts` 已有的解包工具而非重写

## 5. 内容拉取与 digest (TDD)

- [x] 5.1 新建 `src/services/wellknown/fetch-skill.ts`: v0.1.0 按 `files` 串行拉取, 单文件失败即整体失败并清理已写入部分
- [x] 5.2 `fetch-skill.test.ts`: 覆盖 "v0.1.0 文件拉取" 的 2 个 scenario (多文件完整落盘 / 单文件失败整体清理无残留)
- [x] 5.3 v0.2.0 分支: `skill-md` 直写 SKILL.md, `archive` 解包; 下载后计算 sha256 与 `digest` 比对, 不符即失败清理
- [x] 5.4 补测 "v0.2.0 artifact 拉取与 digest 校验" 的 5 个 scenario (digest 匹配 / 不匹配 fail-closed / 解压超限 / 文件数超限 / 逃逸路径被拒)
- [x] 5.5 新建 `computeSkillDigest(files)`: 按相对路径升序 `hash.update(path)` + `'\0'` + `content` + `'\0'`; v0.2.0 直接采用 index 自带 digest
- [x] 5.6 `digest.test.ts`: 断言算法稳定 (同内容不同插入顺序得同一 digest)、内容变更 digest 变化

## 6. install 接入

- [x] 6.1 新建 `src/commands/install-wellknown.ts`: 发现 → 校验 → `selectSkills` 交互选择 (复用 `install-utils.ts` 现有 helper) → 拉取落盘到 `~/.skills-manager/well-known/{hostname}/{skill}/` → `warnScriptFiles` → `addSource` 写 `well-known/{hostname}` 与 `skillDigests`
- [x] 6.2 hostname 归一化 helper: 小写化, 端口冒号替换为下划线, 供目录名与 source key 共用
- [x] 6.3 `src/commands/install.ts`: `installBySourceType` 新增 `case 'well-known'`; 发现失败时抛错, 错误信息含已探测的 index URL 列表与 `.git` 后缀提示
- [x] 6.4 `install-wellknown.test.ts`: 覆盖 `source-management` delta 的安装元数据 4 个 scenario (记录 source 元数据 / 记录每 skill digest / sources.json 版本不变且 bundles 不新增 / 无副作用: 原有 git 与 registry source 不变)
- [x] 6.5 覆盖 "发现失败报错中止" 的 4 个 scenario (无端点站点报错 / 零合法条目报错 / 自建 git 裸 URL 报错而非 clone / `.git` 后缀仍走 git), 断言 `installViaGitClone` 未被调用
- [x] 6.6 覆盖 "well-known 来源分类与存储路径" 的 4 个 scenario (安装路径 / 带端口 host 目录名 / hostname 大小写归一 / 新目录被 `list` 枚举覆盖)

## 7. update 接入

- [x] 7.1 `src/services/source-updater.ts`: `updateSource` 在 registry 分支后新增 `info.type === 'well-known'` 分支; 该分支不得调用 `parseGitHubUrl` / `cloneRepoToTemp`
- [x] 7.2 实现 digest 比对更新: 不同则删目录重下载计入 `updated` 并写回新 digest; 相同计入 `upToDate`; 远端已下架打印 "not found in remote" 且不删本地
- [x] 7.3 `source-updater.test.ts` 补测 "skill digest 记录与更新检测" 的 4 个 scenario, 含无副作用验证 (只有 digest 变化的 skill 被重装, 另一个内容与 mtime 不变)
- [x] 7.4 补测 "update 分流识别 well-known source" 的 3 个 scenario (按 hostname 匹配 / 全量 update 覆盖且不 git clone / 未知 type 不抛未捕获异常)
- [x] 7.5 补测 "存量 git installMethod 不自动迁移": 构造 `installMethod: 'git'` 的非 git 主机 source, 断言 update 走 git 路径且无 well-known 发现请求

## 8. uninstall / remove 对称性

- [x] 8.1 `src/services/source-resolver.ts`: `resolve` 新增 `case 'well-known'`, 复用 `findSourceByNormalizedUrl`; 无匹配时 reason 使用 well-known 语境文案
- [x] 8.2 `source-resolver.test.ts` 补测 `source-management` delta "remove / uninstall 通过 well-known URL 定位 source" 的 5 个 scenario (URL 卸载 / URL remove / 末尾斜杠 / 未安装报未找到且不发网络请求 / 卸载后清理 source 条目且其他条目不变)
- [x] 8.3 `uninstall` delta 的 "通过 well-known 站点 URL 卸载" scenario 落测, 并回归原有 3 个 git URL 卸载 scenario 不变
- [x] 8.4 自查命令对称性: install 支持的输入形态, uninstall / remove / update 是否都已覆盖; 结果写入 PR 描述

## 9. 前向兼容验证

- [x] 9.1 验证 design.md Open Question 1: 用当前已发布的旧版本 skillsmgr 读取含 `type: 'well-known'` 条目的 `sources.json`, 执行 `update`, 确认不抛未捕获异常
- [x] 9.2 若 9.1 发现会崩, 实现 `SourceUpdater` 的未知 type 跳过逻辑并补测; 若不崩, 在 design.md 中把该 Open Question 标记为已解决并记录结论

## 10. 集成验证与收尾

- [x] 10.1 新建 e2e fixture: 本地 HTTP server 托管一份 v0.1.0 index 与一份 v0.2.0 index (含合法与非法条目), 端到端跑 install → list → update → uninstall 全链路
- [x] 10.2 e2e 资源清理: fixture server 在 `finally` 中关闭, 临时目录用实例字段存并在 cleanup 中 `rmSync`; 自检 `$TMPDIR` 无 `smgr-*` 残留
- [ ] 10.3 `pnpm run test:all` — **部分达成**.  单测 `pnpm test` 已核实 988/988 全绿 (load 9 时), `e2e/wellknown-install.e2e.ts` 4/4 通过.  **tmux 类 e2e 未跑**: 本机有 ~18 个其他 agent 的实时 tmux session, 按 CLAUDE.md 的 tmux 安全硬规则不得在此状态下跑全量套件.  需在无实时 session 的环境补跑一次 `pnpm run test:all` 确认
- [x] 10.4 手工冒烟 (可选, 需外网): `node dist/index.js install https://docs.stripe.com --skill stripe-apps`, 验证真实站点可用后 `uninstall` 清理
- [x] 10.5 更新 `CLAUDE.md` 的"架构 / 关键 service"段落, 补 `services/wellknown/` 一行说明
