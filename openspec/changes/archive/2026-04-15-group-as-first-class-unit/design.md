## Context

当前 local-batch bundle 在系统里有三份并行真相:

1. **物理目录** `~/.skills-manager/custom/<dirName>/` — 实际文件系统状态
2. **`sources.json` 的 `bundles` 字段** — 持久化快照, 含 `members: string[]`
3. **`groups.json` 的同名 auto-group** — install 时自动建, 内容是 `members` 的影子

三份真相之间没有强一致性保证.  典型漂移:
- 用户在源目录里改了 skill 名 → 物理目录有新名字, bundle.members 还是旧名字, auto-group 可能不同步 (最近 `fix-update-bundle-group-sync` change 修过部分场景)
- 用户手动删了 `~/.skills-manager/custom/<name>/` 下的某子目录 → 物理目录少, bundle.members 多
- 用户重新 install 同路径 → bundle 沿用旧 members

`uninstall ./tdd-spec` 走 `bundleManager.remove(bundleId)`, 按 `bundle.members` 遍历删除.  对于 "源目录改名" 场景, 改名后的 skill 不在 members 里, 残留物理目录和 sources.json entry; 改名前的 skill 在 members 里但物理目录不存在, fileExists 跳过删目录但仍然 removeSource — 这部分本身 OK, 但完整性不足.

`groups.json` 的 group 是纯元数据集合, 没有 "kind" 概念.  install local-batch 时自动建的 auto-group 和用户手工 `group create` 的逻辑 group 没有任何区别, 只能从命名约定 (basename 同名) 间接推断.

用户期望: 把 group 提到一等公民, 物理 group 和逻辑 group 用同一套抽象, 操作面向 group, 不再"先转换到 skill 列表".

涉及代码: `src/services/sources.ts`, `src/services/groups.ts`, `src/services/source-resolver.ts`, `src/services/bundle-manager.ts`, `src/commands/uninstall.ts`, `src/commands/update.ts`, `src/commands/install.ts`, `src/commands/install-local.ts`, `src/commands/group.ts`.

## Goals / Non-Goals

**Goals:**
- group 成为一等公民: 物理和逻辑两种 kind 共存, 同一套 CLI 入口
- local-batch 单元的真相收敛到物理目录, 消除 "三份真相" 漂移
- uninstall 在源目录改名场景下做到零残留
- update 对物理 group 默认 "源为真" 同步, 改名场景自动收敛
- bareword `<name>` 和 `custom/<name>` 都能正确解析到 group, 不再被错误归到 owner/repo 分支
- 旧数据自动一次性迁移, 用户无需手动干预

**Non-Goals:**
- git bundle 的存储模型不变 (远程扫有代价, 继续用 `bundles` 字段的 members 快照)
- zip bundle 不变
- 虚拟 group 跨源管理能力不变 (仍可包含 custom/official/community 的 skill)
- skill 本身不被降级, 仍然可以被独立 uninstall/update — group 是新增一等公民, 不替代 skill
- 本次不引入"group 嵌套" (group of groups) — 保留为未来扩展
- 不改 `add` / `remove` / `deploy` 的 group 语义 (它们已经按 group 名工作)

## Decisions

### D1: 物理 group 的 members 不持久化, 从物理目录派生

物理 group 的 "true members" 是 `~/.skills-manager/custom/<name>/` 下所有含 `SKILL.md` 的子目录.  每次需要 members 列表时 (uninstall, update, list), 实时扫物理目录.

**Rationale:** 消除漂移源头.  扫本地目录是 O(子目录数), 远低于网络代价, 性能可接受.  同时 sources.json 里仍保留每个 `custom/<name>/<skill>` 的独立 source entry (含 installedAt/updatedAt 等元数据), 那些是 skill 级别的元数据, 不是单元成员关系.

**Alternatives considered:**
- 保留 members 快照 + 每次操作前 re-sync: 复杂度高, 漂移问题只是延后, 不彻底
- 完全废弃 sources.json 里 custom/* entries, 全部从物理目录推导: 失去 installedAt 等元数据, 影响 `list --json` 等

### D2: groups.json schema 升级, 引入 kind 字段

旧格式:
```json
{ "python": ["custom/foo", "official/anthropic/skills/commit"] }
```

新格式 (V2):
```json
{
  "version": "2.0",
  "groups": {
    "tdd-spec": {
      "kind": "local-batch",
      "url": "/Users/.../tdd-spec",
      "installedAt": "2026-...",
      "updatedAt": "2026-..."
    },
    "python": {
      "kind": "virtual",
      "members": ["custom/foo", "official/anthropic/skills/commit"]
    }
  }
}
```

**Rationale:** kind 字段把物理和逻辑显式区分.  物理 group 不存 members (D1).  逻辑 group 继续存 members.  顶层加 `version` 字段方便后续迁移.

**Alternatives considered:**
- 用两个 JSON 文件 (`groups.json` + `physical-groups.json`): 文件分散, 命名冲突检查跨文件
- 在 sources.json 里加新字段: sources.json 已经混乱, 不再加重负担

### D3: sources.json `bundles` 字段仅保留 git/zip, local-batch 迁出

V3 的 sources.json:
```json
{
  "version": "3.0",
  "sources": { ... },
  "bundles": { "git:...": {...}, "zip:...": {...} }   // 仅 git, zip
}
```

local-batch bundle 在迁移时被读出, 转写到 groups.json 作为物理 group, 然后从 sources.json 删除.

**Rationale:** sources.json 的 `bundles` 字段语义变成"需要 members 快照的远程/打包源", 与"本地实时扫"的物理 group 分离, 各自有清晰职责.

### D4: SourceResolver 新增 group target kind, 优先级 group → source → skill

`ResolvedTarget` 增加 `kind: 'group'`, 携带 `groupName: string` 和 `groupKind: 'local-batch' | 'virtual'`.

`resolveBareword(input)` 的查找顺序:
1. 是 group 名 (物理或逻辑) → 返回 `group` target
2. 是 source key 前缀/精确匹配 → 返回 `source` target (现有逻辑)
3. 是 skill 名 → 返回 `skill` target (现有逻辑)

`resolveOwnerRepo(owner, repo)` 在 owner === 'custom' 时, 先检查 group 是否存在, 命中则返回 `group` target.  其他 owner 走原有 git 路径.

`resolveLocalPath(absolutePath)` 命中 local-batch 时, 不再返回 `bundle` target, 改返回 `group` target (groupKind=local-batch).

**Rationale:** group 优先级最高保证 "用户用直觉的名字" 能命中.  命名冲突 (D5) 已经禁止同名, 优先级实际不会引入歧义, 但仍按"明确单元 → 模糊单元"排序更直观.

**Alternatives considered:**
- 把 `group` target 复用现有的 `bundle` target: bundle 概念在 git 场景仍要保留, 复用导致两个 kind 含义混杂
- 只在 group 子命令里识别 group, 顶层 uninstall/update 仍按旧路径: 用户体验割裂, 顶层和子命令行为不一致

### D5: 物理/逻辑 group 禁止同名, 在写入路径强制

执行点:
- `group create <name>`: 检查物理 group, 冲突报错
- `install <path>`: install 前检查 basename 是否冲突逻辑 group, 冲突报错并提示 `group rename`
- 迁移路径: 见 D7

**Rationale:** 一等公民 = 唯一命名权.  避免 "该名字指代什么" 的运行时歧义.  现有 `install` 已经有同 basename 不同 URL 冲突检测 (`install-directory-batch` capability), 现在扩展同 basename 与逻辑 group 冲突.

### D6: install / uninstall / update 顶层命令保留, local-batch 走 group 路径

用户认知层:
- `install ./tdd-spec` ≡ `group install ./tdd-spec` (物理 group)
- `install <repo>` (非本地) → 旧逻辑, 不创建 group
- `uninstall tdd-spec` (bareword 命中物理 group) → 走 group uninstall 路径
- `uninstall ./tdd-spec` → 同上
- `update tdd-spec` → 走 group update 路径

新增 `group install/uninstall/update/rename` 子命令, 是显式入口, 行为完全等价于顶层命令对 local-batch 的处理.

**Rationale:** 不破坏现有用户习惯, 同时给 group 显式入口.

### D7: 自动一次性迁移 (V2→V3 sources.json + V1→V2 groups.json)

迁移时机: 任何命令首次 load `sources.json` 或 `groups.json`, 检测 version 不匹配则自动迁移并写回.

迁移步骤:
1. **load `sources.json`** (V2): 读取所有 `bundles` entry
2. 对每个 `local-batch` bundle:
   - 计算 `groupName = basename(bundle.url)`
   - 检查 `groups.json` 是否已有同名 entry
     - 若有且 `kind === 'virtual'` (用户手工建): 重命名为 `<name>-legacy` (递增数字直到不冲突: `<name>-legacy`, `<name>-legacy-2`, ...).  打印 WARN 到 stderr
     - 若有且来自 auto-group (旧 install 自建, 仍是 `string[]` 格式): 视为同源, 直接合并/覆盖 (auto-group 内容本就是 bundle.members 的影子, 物理 group 的 members 由物理目录推导, 不需保留)
     - 若无: 直接创建
   - 在 `groups.json` 创建 `{ kind: 'local-batch', url, installedAt, updatedAt }`
   - 从 `sources.json` 的 `bundles` 字段删除该 entry
3. **save `sources.json`** (V3): 升级 version, 写回
4. **save `groups.json`** (V2): 升级 version + 包到 `{ version, groups }` 结构, 写回
5. 对其他剩余的纯 `string[]` group entry (用户手工建, 没冲突), 升级为 `{ kind: 'virtual', members }`

迁移日志样式:
```
Migrating skills-manager data...
  ✓ sources.json V2 → V3: 3 local-batch bundles → physical groups
  ✓ groups.json V1 → V2: 5 groups upgraded
  ⚠ Group naming conflict: virtual group 'tdd-spec' renamed to 'tdd-spec-legacy'
    (a physical group with the same name was migrated from local-batch bundle)
  Migration complete.
```

**Rationale:**
- 一次性: 用户无感, 不需要手动命令
- 无 opt-out: 系统数据格式必须收敛, opt-out 会留长期支持负担
- 冲突重命名而非合并: 用户手工建的逻辑 group 可能引用了非 custom 的 skill, 合并到物理 group 会破坏其语义.  重命名保留全部信息, 用户事后可决定如何处理

**Alternatives considered:**
- 提示用户手动选择冲突处理方式: 中断流程, 用户体验差
- 合并冲突 group 到物理 group: 物理 group 的 members 由物理目录推导, 多余的逻辑引用无处存放

### D8: 物理 group uninstall 算法 — 物理目录为权威

```
groupUninstall(groupName):
  groupDir = ~/.skills-manager/custom/<groupName>
  collected = set()

  # 1. 扫物理目录里所有 skill 子目录
  for child in scanDirsWithSkillMd(groupDir):
    collected.add(`custom/<groupName>/${child}`)

  # 2. 扫 sources.json 里所有 custom/<groupName>/* key
  for key in sources where key startsWith `custom/<groupName>/`:
    collected.add(key)

  # 3. 给用户确认列表 (sorted, deduped)

  # 4. 物理删除
  removeDir(groupDir)              # 整棵树

  # 5. 清理元数据
  for key in collected:
    sourcesService.removeSource(key)
    for g in groupsService.virtualGroupsContaining(key):
      groupsService.removeSkill(g, key)
  groupsService.deletePhysicalGroup(groupName)
```

**Rationale:** 物理目录 + sources.json keys 双源合并, 覆盖"漂移到只有一边记录"的 skill.  避免改名场景下泄漏.

### D9: 物理 group update 算法 — 源目录为权威

```
groupUpdate(groupName, options):
  group = groupsService.get(groupName)  # kind=local-batch
  sourceDir = group.url
  targetDir = ~/.skills-manager/custom/<groupName>

  if !exists(sourceDir):
    error "Source path no longer exists, run rebind first"

  sourceSkills = scanDirsWithSkillMd(sourceDir)
  targetSkills = scanDirsWithSkillMd(targetDir)

  added = sourceSkills - targetSkills
  existing = sourceSkills ∩ targetSkills
  orphaned = targetSkills - sourceSkills

  for skill in existing:
    if skillMdChanged: copy and report ↑
    else: report ✓

  for skill in added:
    install, addSource, report +

  for skill in orphaned:
    if options.keepLocal: report - kept
    else: removeDir, removeSource, removeFromAllGroups, report -
```

**默认 sync** (移除孤儿), `--keep-local` 保留.  对应当前 `update --sync` 是默认开启.

**Rationale:** 物理 group 的 "源目录是真相" 语义清晰. 用户如果不希望自动删, 用 `--keep-local`.  这是"以源为真"模型自然推导, 也修复了用户改名场景.

### D10: SKILL.md 内容比较只用于 "is updated", 不做 rename detection

显式不做 rename detection (内容哈希识别).  改名 = 旧 skill 删除 + 新 skill 安装, 中间无身份延续.  影响:
- deployment 里 symlink 失效 → 用户需要 `deploy --refresh`
- 由 `--keep-local` 给出 escape hatch

**Rationale:** rename detection 误判风险高 (改名 + 改内容容易判错).  显式语义比聪明语义可预测.

## Risks / Trade-offs

[**用户手动放进 `custom/<name>/` 的 skill 会被当作单元成员**] → 文档明确 "custom/<name>/ 目录是物理 group 拥有的边界, 不要手动放无关文件".  uninstall 前列表展示给用户确认, 用户可以发现意外情况.

[**迁移失败导致 sources.json/groups.json 损坏**] → 迁移用 atomic write (临时文件 + rename, 沿用现有 SourcesService.save 模式).  迁移前打印数据快照, 失败时回滚.  增加迁移单元测试覆盖各种边界.

[**逻辑 group 撞名物理 group 被重命名, 用户没注意到**] → 迁移日志写到 stderr 和 `~/.skills-manager/migration.log` (新增).  下次 `group list` 显示 `-legacy` group 时可加 hint.

[**bareword 命中物理 group 但用户原意是同名 skill (即使禁止同名, skill 和 group 仍可同名)**] → 优先级 group → skill, 同名情况打印 disambiguation 提示, 类似现有 skill disambiguation.

[**update 默认 sync 行为变化, 现有用户脚本依赖 `--sync` 显式开关**] → 对外仍保留 `--sync` 作为 no-op 兼容标记.  `--keep-local` 是新行为开关, 默认关闭.  changelog 明确说明.

[**git bundle 不迁移, 模型不一致**] → 接受.  git/zip 远程性质决定 members 必须快照, 不能实时扫.  代码里通过 D3 的字段分离体现.

## Migration Plan

### 部署
1. release 版本中包含迁移逻辑
2. 用户首次运行任何命令 → 自动迁移
3. 迁移日志同时写 stderr 和 `migration.log`

### 回滚
- sources.json 和 groups.json 在迁移前自动写 `.backup` 副本 (`sources.json.v2.backup`, `groups.json.v1.backup`)
- 用户如需回滚: 降级 skillsmgr 包, 手动恢复 `.backup` 文件

### 测试
- 新增 `migration.test.ts`: V2 → V3 sources.json, V1 → V2 groups.json, 命名冲突重命名, 多个 local-batch bundle, 没有 local-batch bundle, 已经是 V3 不重复迁移
- 现有 `sources.test.ts`, `groups.test.ts` 适配新 schema

## Open Questions

1. **`group rename` 的实现细节** — 物理 group rename 涉及物理目录改名 + sources.json keys 改名 + groups.json key 改名 + 引用此 group skill 的逻辑 group 引用更新.  本次 change 是否要完整实现 `group rename`, 还是仅占位接口由后续 change 补充?  倾向 **完整实现**, 否则 D5 提示用户 "请用 `group rename`" 而该命令不存在, 体验差.

2. **`groups.json` migration backup 文件是否需要 retention 策略** (例如 30 天后自动清)?  本次 change 不做, 文档说明用户可手动删除.

3. **`list` / `list --json` 是否要把 group 显式作为顶层条目展示**?  现在 list 只展示 skill.  group 一等公民后, list 的展示方式可能要调整.  本次 change 暂不改, 保持 list 输出兼容, 留作后续 UX change.
