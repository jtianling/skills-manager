# Design: w01-refactor-source-resolver

## Context

`install` 命令通过 `detectSourceType` + switch 派发, 支持 7 类输入: `remote-zip`, `local-zip`, `owner-repo`, `owner-repo-skill`, `remote-url`, `local-path`, `registry`.

`update` 命令只有一条快速路径 (local-path, `update.ts:276`) + 一条 fallback fuzzy 匹配 (`update.ts:324`):
```ts
const matchingKey = Object.keys(allSources).find(
  (k) => k === source || k.endsWith(`/${source}`) || allSources[k].repoName === source
);
```
这条匹配对 official owner 失效的原因: 用户输入 `anthropics/skills`, 但 source key 是 `official/anthropic/skills` (注意 `anthropic` 没有 s, 因 `findOfficialProvider` 把 GH owner 翻译成 provider key). `endsWith('/anthropics/skills')` 与 `official/anthropic/skills` 字面不匹配.

`uninstall` 命令分两路: `extractOwnerRepo` 成功走 `uninstallSource`, 否则走 `uninstallByName`.  `uninstallSource` 内部调用了 `findOfficialProvider`, 所以 official 翻译在 uninstall 上能工作 (洞 2 仅影响 update).  但 uninstall 完全不识别 URL, registry 包名, `owner/repo:skill` 单 skill 等形式.

sources.json v1 schema 已存在且被大量代码直接读取, 这次 change 不动 schema.

## Goals / Non-Goals

**Goals:**
- 修复 `update anthropics/skills` 等 official owner 输入的 fuzzy 匹配 bug (洞 2)
- 让 update / uninstall 接受 install 支持的所有**单 skill 范围** input 形式
- 把"input → 已安装 source key"的归一化逻辑集中到一个可测试的单元
- 为 w02/w03 的 bundle 支持铺路 (SourceResolver 后续会返回 bundle 而不是 source key 列表)
- 保持现有 update / uninstall 的命令行参数和输出格式不变 (只扩展输入接受范围)

**Non-Goals:**
- 本地 batch 目录的 update / uninstall 支持 (`update ./spec-tdd`) — w03
- group sync 语义 (新增/删除 skill 同步) — w03
- sources.json schema 升级 — w02
- install 命令本身的改动 — install 已经能工作, 不动
- `update --all` 命令 (无参数更新所有源) 的行为 — 保持现状

## Decisions

### D1. 新增 SourceResolver 而不是在 update/uninstall 里各自加逻辑

**选择**: 独立的 `src/services/source-resolver.ts`, 导出 `resolve(input)` 纯函数.

**备选**:
- (a) 在 update.ts 里复制 uninstall 的分支逻辑 — 违反 DRY, 后续 w02/w03 要改两处
- (b) 把逻辑塞到 `src/utils/source-detection.ts` — 该文件是纯解析, 加入 I/O (读 sources.json) 会破坏单一职责

**理由**: SourceResolver 需要读取 sources.json 做匹配, 已经不是纯解析; 独立服务让单元测试可以 mock SourcesService.  w02 加 bundle tracking 后, resolver 返回类型演进只需要改一个文件.

### D2. resolve() 返回 ResolvedTarget, 不直接返回 SourceKey[]

```ts
interface ResolvedTarget {
  kind: 'source' | 'skill' | 'batch-unsupported' | 'not-found';
  sourceKeys: SourceKey[];       // 匹配到的 source key, 可能多个 (owner/repo 下有多个 skill)
  skills?: SkillInfo[];          // kind === 'skill' 时使用, 精确到单 skill
  reason?: string;               // not-found / batch-unsupported 时的人类可读原因
  originalInput: string;         // 透传给上层做错误信息
}
```

**备选**: 直接返回 `SourceKey[]`, `null` 表示没找到

**理由**:
- update 对 owner/repo 和对 skill name 的行为不同 (前者多个 skill 一起更新, 后者只更单个) — resolver 要保留这个信息
- w03 需要区分"本地 batch 不支持" vs "真的没找到", 避免用户搞不清楚
- `originalInput` 让调用方不需要自己记参数

### D3. Official owner 翻译归到 resolver 内部

resolver 内部对 owner/repo 输入先走 `findOfficialProvider(owner)`:
- 返回 provider key → 尝试匹配 `official/{providerKey}/{repo}`
- 返回 null → 尝试匹配 `community/{owner}/{repo}`
- 两者都没命中 → 尝试所有已安装 source 里 `url` 字段反解 owner/repo 做 URL 归一化匹配 (兜底 GitLab/BitBucket 等非 github)

**备选**: 在 `extractOwnerRepo` 里加 normalize, 让它返回带翻译的 source key

**理由**: `extractOwnerRepo` 是纯字符串解析 (被 install / update / uninstall 多处使用), 加入翻译破坏单一职责, 而且 install 时**不应该**翻译 (install 是创建, 不是查找).  翻译是"查找层"的特有逻辑.

### D4. URL 归一化统一走 `githubService.parseGitHubUrl` + sources.json 扫描

用户输入 `https://github.com/obra/superpowers` / `https://github.com/obra/superpowers.git` / `git@github.com:obra/superpowers` 应该都归到同一个 source key.

**实现**:
1. 用 `parseGitHubUrl` 提取 `{owner, repo}`
2. 走 D3 的 owner/repo 路径
3. 如果 `parseGitHubUrl` 失败 (非 github host), 扫 sources.json, 对每条 `url` 做字符串归一化 (去 `.git` 后缀, https/ssh 等价转换), 字面比较

**备选**: 只支持 github, 非 github URL 直接报错

**理由**: 现有代码 `install-git.ts` 已经能 clone 任意 git URL, uninstall spec 也提到 GitLab URL 支持.  保持对称.

### D5. registry @version 语义: 切换到指定版本

`update code-review@1.2.0` = 把已安装的 `registry/code-review` 切换到 1.2.0, 不管当前是什么版本.

**备选**:
- (a) 忽略 @version, 总是更新到 latest — 不一致于 install
- (b) 拒绝 @version 输入, 要求用户先 uninstall 再 install — 流程碎

**理由**: install 的 `@version` 是"装这个版本", update 的 `@version` 应该对称为"切到这个版本".  等价于 `uninstall` + `install @version` 的原子组合.

### D6. 裸词兜底按优先级顺序匹配

输入不含 `/` 也不是 URL 时 (比如 `update spec-tdd`, `update code-review`):

1. 先试 registry 包名模式 (走现有 `parseRegistryInput`)
2. 再试作为 source key 后缀 (已有 fuzzy 逻辑保留)
3. 再试作为 `repoName`
4. 再试作为 skill name (走 `resolveSkillByName`, 多匹配时交互选择)
5. 全部失败 → `not-found`

**理由**: registry 优先让"默认装 registry 包"的用户体验连贯.  skill name 最后, 因为它最容易误匹配.

### D7. 本地 batch 路径返回 `batch-unsupported` 而不是 `not-found`

用户输入 `./spec-tdd` 但它是 batch 目录 (无根 SKILL.md):
```ts
return {
  kind: 'batch-unsupported',
  sourceKeys: [],
  reason: 'Batch directory update/uninstall not yet supported (pending w03). Update individual skills: skillsmgr update ./spec-tdd/<skill-name>',
  originalInput: './spec-tdd',
};
```

update/uninstall 收到 `batch-unsupported` 时, 输出明确引导而不是"SKILL.md not found".

**理由**: 用户今天碰到的就是这个, 改进错误消息让后续 w03 上线前用户有合理 workaround.

### D8. resolve() 是 async

因为:
- 裸词在 skill name 多匹配时需要走交互式选择 (`resolveSkillByName`)
- 保持 `resolve()` 签名稳定, 未来扩展返回更多上下文时不需要再改调用方

说明: `resolveRegistry()` 当前只检查本地 `sources.json`, 不做网络请求; packument 校验仍由 `update` 的 registry 更新流程负责.

### D9. 不动 install, 但 install 保留独立 detectSourceType 分发

将来可能重构, 但本 change 只动"查找端". install 的"创建端"逻辑不变, 保证实现风险可控.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| fallback fuzzy 匹配替换后, 部分边缘 input 行为变化 (例如 `update skills` 原来命中 `official/anthropic/skills`, 新实现的优先级可能变) | 在 tasks 里写明迁移矩阵, 对所有已知 input 形式写回归测试; 在 CHANGELOG 标注行为变化 |
| SourceResolver 承担过多职责, 未来 w02 加 bundle 后返回类型会再变 | D2 的 ResolvedTarget 设计已经为 bundle 留了扩展位 (加 `bundle?: Bundle` 字段不破坏现有调用) |
| URL 归一化规则复杂 (https/ssh/.git 后缀/gitlab/自定义 host), 边缘 case 难穷尽 | 覆盖 github https, github ssh, gitlab https 三种主流, 其它走字面字符串匹配兜底; 单元测试为每种写 case |
| `update code-review@1.2.0` 语义是"装新版本", 如果用户只想"检查更新"需要新命令 | 目前没这个需求, 不加新命令, 文档说明 update 就是"切版本" |
| 本地 batch 路径的 "batch-unsupported" kind 让调用方要处理 4 种 kind, 代码分支多 | 用 exhaustive switch + TypeScript never 类型保证覆盖 |
| update / uninstall 测试矩阵膨胀 | 把 input 识别测试归到 source-resolver.test.ts, 命令级测试只验证"resolver 返回 X → 命令行为 Y"的契约 |

## Migration Plan

此 change 没有数据迁移 (不动 sources.json schema).  部署步骤:

1. **阶段 1: 引入 SourceResolver + 测试**
   - 新增 `src/services/source-resolver.ts` 和 `src/services/source-resolver.test.ts`
   - 所有 input 形式的单元测试在此阶段通过
   - 此时 update/uninstall 还是老逻辑, 不影响用户

2. **阶段 2: update 切换**
   - `update.ts` 的 fallback fuzzy 匹配替换为 `resolver.resolve(source)`
   - 对每种 `ResolvedTarget.kind` 映射到现有 `updateSource` / `updateLocalCopy` / `updateRegistrySource`
   - 跑 `update.test.ts`, 新增 official owner / URL / registry @version 的回归测试

3. **阶段 3: uninstall 切换**
   - `uninstall.ts` 的 `extractOwnerRepo` + `uninstallByName` 二分替换为 `resolver.resolve(identifier)`
   - 保留现有交互流程 (确认提示, symlink 警告)
   - 跑 `uninstall.test.ts`, 新增 URL / registry / owner/repo:skill 的回归测试

**回退**: 如果出现严重问题, 回退 `update.ts` 和 `uninstall.ts` 到 resolver 调用之前的版本, SourceResolver 文件保留作为下一次尝试的基础.

## Open Questions

1. **`update skills` (裸词) 行为变化要不要算 BREAKING?**
   现在靠 fuzzy 可能命中 `official/anthropic/skills`.  新实现按 D6 优先级, 可能命中 registry 包或 skill name 先.  建议: 提示用户用完整形式 `update anthropics/skills` 或 `update official/anthropic/skills`, 保留裸词为降级 fallback.

2. **SourceResolver 要不要同时服务 `deploy` 命令的 source 选择?**
   `deploy` 也接受 source 参数, 理论上也能复用.  但 deploy 的语义不是"查找已安装 source", 是"从 skill 列表里筛选一批".  决定: 本 change 不碰 deploy, 避免 scope 扩大.

3. **`update owner/repo:skill` 单 skill 更新的实际价值多大?**
   install 支持 `install obra/superpowers:foo` 精确安装单个 skill.  update 支持它的意义: 只更新这一个 skill 而不是整个 repo.  决定: 实现, 对称性优先.  但是如果 `skill` 在已安装列表里不存在, 走 `not-found` 而不是自动安装 (那是 w03 的 group sync 范畴).
