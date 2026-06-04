# Group As First-Class Unit

## Purpose
把 group 提升为一等公民单元: 区分 `local-batch` 物理 group 和 `virtual` 逻辑 group, 承载原批量 bundle 的语义, 并统一命名空间、解析、CRUD 和迁移路径.

## Requirements

### Requirement: Group 概念与 kind 区分

系统 SHALL 把 group 作为一等公民单元, 支持两种 kind:

- **`local-batch` 物理 group**: 拥有源路径 `url`, 拥有物理目录 `~/.skills-manager/custom/<name>/`, members 由该物理目录下含 `SKILL.md` 的子目录**实时派生**, 不持久化
- **`virtual` 逻辑 group**: 无源路径, 无物理目录, members 是显式维护的 skill source key 数组, 跨源 (custom/official/community)

物理 group 和逻辑 group 共享同一命名空间, 同名禁止.

#### Scenario: 物理 group 的 members 从物理目录派生
- **GIVEN** `~/.skills-manager/custom/tdd-spec/` 下有 `ts-apply/SKILL.md`, `ts-verify/SKILL.md`, 以及一个无 SKILL.md 的 `notes/` 子目录
- **WHEN** 系统查询物理 group `tdd-spec` 的 members
- **THEN** 返回 `["custom/tdd-spec/ts-apply", "custom/tdd-spec/ts-verify"]`
- **AND** 不读取 `groups.json` 或 `sources.json` 来获取 members

#### Scenario: 逻辑 group 的 members 显式维护
- **GIVEN** `groups.json` 中存在 `python: { kind: 'virtual', members: ['custom/foo', 'official/anthropic/skills/commit'] }`
- **WHEN** 系统查询逻辑 group `python` 的 members
- **THEN** 返回 `["custom/foo", "official/anthropic/skills/commit"]`

### Requirement: 物理/逻辑 group 命名冲突禁止

系统 SHALL 在以下写入路径强制检查命名冲突, 任一冲突 SHALL 报错并以非 0 退出码终止:

- `group create <name>`: 若存在同名物理 group, SHALL 报错
- `install <path>` 走批量分支时: 若 basename 与现存逻辑 group 同名, SHALL 报错并提示 `group rename`
- 迁移路径见 "迁移策略" 需求 (按 `<name>-legacy` 重命名)

#### Scenario: group create 撞名物理 group
- **GIVEN** 物理 group `tdd-spec` 已存在 (`groups.json` 中 `kind: 'local-batch'`)
- **WHEN** 用户执行 `skillsmgr group create tdd-spec`
- **THEN** 系统 SHALL 报错 `Group 'tdd-spec' already exists as a local-batch group (custom/tdd-spec/).`
- **AND** 不修改 `groups.json`

#### Scenario: install 撞名逻辑 group
- **GIVEN** 逻辑 group `tdd-spec` 已存在 (`groups.json` 中 `kind: 'virtual'`, members 任意)
- **WHEN** 用户执行 `skillsmgr install ./tdd-spec` 进入批量安装路径
- **THEN** 系统 SHALL 报错, 错误文案 SHALL 包含: 已存在同名逻辑 group, 请先 `skillsmgr group rename tdd-spec <new-name>` 或选择不同的目录名后再 install
- **AND** 不写入 `sources.json`, 不创建 `~/.skills-manager/custom/tdd-spec/`

### Requirement: SourceResolver 识别 group 作为 ResolvedTarget

`SourceResolver` SHALL 新增 `kind: 'group'` 的 `ResolvedTarget` 形态, 包含字段:

- `groupName: string`
- `groupKind: 'local-batch' | 'virtual'`
- `groupUrl?: string` (仅 local-batch)
- `members: string[]` (物理 group 实时派生, 逻辑 group 从 `groups.json` 读取)

`resolveBareword(input)` 查找顺序 SHALL 调整为: group → source → skill (group 命中即返回, 不再继续).

`resolveOwnerRepo(owner, repo)` 在 `owner === 'custom'` 时 SHALL 先尝试匹配同名 group, 命中则返回 `group` target, 未命中再走原有 git 路径 (会自然报 not-found).

`resolveLocalPath(absolutePath)` 命中 local-batch 时 SHALL 返回 `group` target (groupKind='local-batch'), 不再返回 `bundle` target.

#### Scenario: bareword 命中物理 group
- **GIVEN** 物理 group `tdd-spec` 已存在
- **WHEN** 系统调用 `resolver.resolve("tdd-spec")`
- **THEN** 返回 `{ kind: 'group', groupName: 'tdd-spec', groupKind: 'local-batch', members: [...] }`

#### Scenario: bareword 命中逻辑 group
- **GIVEN** 逻辑 group `python` 已存在, 含 2 个 member
- **WHEN** 系统调用 `resolver.resolve("python")`
- **THEN** 返回 `{ kind: 'group', groupName: 'python', groupKind: 'virtual', members: [...] }`

#### Scenario: custom/<name> 命中物理 group
- **GIVEN** 物理 group `tdd-spec` 已存在
- **WHEN** 系统调用 `resolver.resolve("custom/tdd-spec")`
- **THEN** 返回 `group` target, 不再报 "No installed source found for custom/tdd-spec"

#### Scenario: 本地路径命中物理 group
- **GIVEN** 物理 group `tdd-spec` 已存在, url 指向 `/Users/u/dev/tdd-spec`
- **WHEN** 系统调用 `resolver.resolve("/Users/u/dev/tdd-spec")`
- **THEN** 返回 `group` target, `groupKind === 'local-batch'`, `groupUrl === '/Users/u/dev/tdd-spec'`
- **AND** 不再返回历史的 `kind: 'bundle'`

#### Scenario: bareword 既匹配 group 又匹配 skill 时优先 group
- **GIVEN** 物理 group `commit` 存在, 同时 skill `commit` 也存在 (来自 `official/anthropic/skills/commit`)
- **WHEN** 系统调用 `resolver.resolve("commit")`
- **THEN** 返回 `group` target (优先 group)
- **AND** 系统 SHALL 同时打印 disambiguation 提示, 告知存在同名 skill, 用户可用完整 source key 指代

### Requirement: 物理 group 卸载以物理目录扫描为权威

`group uninstall <name>` (及顶层 `uninstall` 路由到此的等价路径) 对物理 group SHALL 按以下算法执行:

1. 收集 `~/.skills-manager/custom/<name>/` 下所有含 `SKILL.md` 的子目录, 形成集合 `physicalKeys = {custom/<name>/<child>}`
2. 收集 `sources.json` 中所有 key 以 `custom/<name>/` 开头的 source, 形成集合 `recordedKeys`
3. `affectedKeys = physicalKeys ∪ recordedKeys` (合并去重)
4. 显示给用户确认列表 (sorted by skill name)
5. 用户确认 (或 `--force`) 后:
   - `removeDir(~/.skills-manager/custom/<name>/)` (整棵树)
   - 对 `affectedKeys` 中每个 key: `sourcesService.removeSource(key)`, `groupsService.removeSkillFromAll(key)` (清理逻辑 group 引用)
   - `groupsService.deletePhysicalGroup(<name>)` (删 `groups.json` 中的物理 group entry)
6. 输出卸载汇总: 实际删除的 skill 数量 + 物理 group 名称

#### Scenario: 物理目录有改名后的 skill, sources.json 仍是旧名字
- **GIVEN** 物理 group `tdd-spec`
- **AND** 物理目录 `custom/tdd-spec/` 含 `ts-apply/SKILL.md`, `ts-verify/SKILL.md`, `ts-newname/SKILL.md`
- **AND** sources.json 含 `custom/tdd-spec/ts-apply`, `custom/tdd-spec/ts-verify`, `custom/tdd-spec/tdd-old1` (旧, 物理已不存在)
- **WHEN** 用户执行 `skillsmgr uninstall tdd-spec` 并确认
- **THEN** affectedKeys = `{ custom/tdd-spec/ts-apply, custom/tdd-spec/ts-verify, custom/tdd-spec/ts-newname, custom/tdd-spec/tdd-old1 }`
- **THEN** `custom/tdd-spec/` 整棵树被删除
- **THEN** sources.json 中 `custom/tdd-spec/*` 全部 4 条被清除 (含已无物理目录的 tdd-old1)
- **THEN** `groups.json` 中物理 group `tdd-spec` 被删除
- **THEN** 任何逻辑 group 中对这些 key 的引用被清理

#### Scenario: 卸载前显示完整 affectedKeys 给用户确认
- **GIVEN** 同上场景的状态
- **WHEN** 用户执行 `skillsmgr uninstall tdd-spec` (无 `--force`)
- **THEN** 系统 SHALL 显示完整 4 项列表 (排序后), 包括 `ts-newname` 和 `tdd-old1`, 用户能在确认前看到全部影响

#### Scenario: 物理 group 不存在
- **GIVEN** 物理 group `tdd-spec` 不存在 (`groups.json` 中无 entry, 物理目录也无)
- **WHEN** 用户执行 `skillsmgr uninstall tdd-spec`
- **THEN** 系统按现有 bareword 流程降级查找 source/skill, 全部 miss 后报错 `Skill 'tdd-spec' not found`

### Requirement: 物理 group 更新以源目录为权威

`group update <name>` (及顶层 `update` 路由到此的等价路径) 对物理 group SHALL:

1. 读取物理 group 的 `url` (源目录绝对路径)
2. 若源目录不存在, 走 rebind 路径 (复用 `local-update` 的 basename fallback 逻辑)
3. 扫源目录的 skill 子目录 `sourceSkills`, 扫物理目录 `~/.skills-manager/custom/<name>/` 的子目录 `targetSkills`
4. 对 `existing = sourceSkills ∩ targetSkills`: 比较 `SKILL.md` 内容, 不同则覆盖, 输出 `↑`; 相同则输出 `✓`
5. 对 `added = sourceSkills - targetSkills`: 安装新 skill, 写入 sources.json, 输出 `+`
6. 对 `orphaned = targetSkills - sourceSkills`:
   - **默认** (无 `--keep-local`): `removeDir`, `sourcesService.removeSource`, `groupsService.removeSkillFromAll`, 输出 `-`
   - 加 `--keep-local`: 保留物理目录和 sources.json entry, 输出 `- (kept locally)`

#### Scenario: 源目录新增 skill 自动 install
- **GIVEN** 物理 group `tdd-spec`, 源目录 `/dev/tdd-spec` 新增 `ts-newcap/SKILL.md`
- **AND** 物理目录 `custom/tdd-spec/` 尚无 `ts-newcap`
- **WHEN** 用户执行 `skillsmgr update tdd-spec`
- **THEN** `custom/tdd-spec/ts-newcap/` 被创建, sources.json 增加 `custom/tdd-spec/ts-newcap` entry
- **THEN** 输出 `+ ts-newcap`

#### Scenario: 源目录改名, 默认 sync 删除孤儿
- **GIVEN** 物理 group `tdd-spec`, 源目录原有 `tdd-old/SKILL.md`
- **AND** 用户在源目录里把 `tdd-old/` 改名为 `ts-renamed/`
- **WHEN** 用户执行 `skillsmgr update tdd-spec` (无 `--keep-local`)
- **THEN** `ts-renamed` 被识别为 added, 安装并加 sources entry
- **THEN** `tdd-old` 被识别为 orphaned, 物理目录删除, sources entry 清理, 逻辑 group 引用清理
- **THEN** 输出包含 `+ ts-renamed` 和 `- tdd-old`

#### Scenario: --keep-local 保留孤儿
- **GIVEN** 同上场景
- **WHEN** 用户执行 `skillsmgr update tdd-spec --keep-local`
- **THEN** `tdd-old` 物理目录和 sources entry 都保留
- **THEN** 输出 `- tdd-old (kept locally)`

#### Scenario: 源目录已不存在触发 rebind
- **GIVEN** 物理 group `tdd-spec`, 源目录 `/old/path/tdd-spec` 已不存在
- **AND** 用户在 `/new/path/tdd-spec/` 新建同 basename 目录 (含 skill 子目录)
- **WHEN** 用户执行 `skillsmgr update /new/path/tdd-spec`
- **THEN** 系统 SHALL 复用 `local-update` 的 basename fallback 流程, prompt 用户确认 rebind
- **THEN** rebind 后更新物理 group 的 `url`, 然后继续执行同步

### Requirement: 逻辑 group 更新遍历各 member 源

`group update <name>` 对逻辑 group SHALL 遍历每个 member, 调用对应源的 update 路径:

- member 的 source 为 git → 走 git source update
- member 的 source 为 local-copy → 走 local-update
- member 的 source 为 registry → 走 registry update
- member 的 source 已不存在 (悬空引用) → 输出警告, 不计入失败

最终汇总 updated/upToDate/failed/skipped 计数.

#### Scenario: 逻辑 group update 遍历执行
- **GIVEN** 逻辑 group `python` 含 `custom/foo` (local-copy), `official/anthropic/skills/commit` (git), `custom/bar` (悬空, sources 中已无)
- **WHEN** 用户执行 `skillsmgr update python`
- **THEN** 系统对 `custom/foo` 执行 local-copy update, 对 `official/anthropic/skills/commit` 执行 git update
- **AND** 对 `custom/bar` 输出 `⚠ custom/bar: dangling reference, skipped`
- **AND** 输出汇总计数

### Requirement: group install 子命令

`skillsmgr group install <path|url>` SHALL 提供物理 group 安装的显式入口, 行为完全等价于 `skillsmgr install <path|url>` 的批量分支 (创建物理 group + 物理目录 + sources entries).

`skillsmgr install` 对本地批量目录的现有行为 SHALL 保持不变, 内部统一走 group install 实现.

#### Scenario: group install 等价于 install 批量
- **WHEN** 用户执行 `skillsmgr group install ./tdd-spec`
- **THEN** 行为完全等价于 `skillsmgr install ./tdd-spec` 的批量分支

### Requirement: group uninstall / update / rename 子命令

系统 SHALL 提供以下 group 子命令:

- `skillsmgr group uninstall <name>`: 走物理 group 卸载算法 (见上), 对逻辑 group SHALL 报错提示用 `group delete`
- `skillsmgr group update <name>`: 物理 group 走源目录同步, 逻辑 group 遍历 member
- `skillsmgr group rename <old> <new>`: 重命名 group, 物理和逻辑均支持

`group rename` 对物理 group SHALL:
1. 检查 `<new>` 不与任何现存 group 冲突 (物理或逻辑)
2. 物理目录改名 `~/.skills-manager/custom/<old>/` → `~/.skills-manager/custom/<new>/`
3. sources.json 里所有 `custom/<old>/*` key 改为 `custom/<new>/*` (key 名改, 内容不变)
4. groups.json 里物理 group key 改名, `installedAt`/`updatedAt`/`url` 不变, `updatedAt` 刷新
5. 所有逻辑 group 中对 `custom/<old>/*` 的引用同步更新为 `custom/<new>/*`

`group rename` 对逻辑 group SHALL 复用现有 `renameGroup` 方法 (仅 groups.json 改 key).

#### Scenario: group uninstall 物理
- **WHEN** 用户执行 `skillsmgr group uninstall tdd-spec`, `tdd-spec` 是物理 group
- **THEN** 走"物理 group 卸载以物理目录扫描为权威"需求的算法

#### Scenario: group uninstall 逻辑提示用 group delete
- **WHEN** 用户执行 `skillsmgr group uninstall python`, `python` 是逻辑 group
- **THEN** 系统 SHALL 报错 `'python' is a virtual group; use 'group delete' to remove it (skills are not affected)`

#### Scenario: group rename 物理 group 全链路改名
- **GIVEN** 物理 group `tdd-spec`, 物理目录 `custom/tdd-spec/` 含 `ts-apply`, sources 含 `custom/tdd-spec/ts-apply`, 逻辑 group `python` 引用了 `custom/tdd-spec/ts-apply`
- **WHEN** 用户执行 `skillsmgr group rename tdd-spec tdd-suite`
- **THEN** 物理目录改名为 `custom/tdd-suite/ts-apply/`
- **THEN** sources.json key `custom/tdd-spec/ts-apply` 改为 `custom/tdd-suite/ts-apply`
- **THEN** groups.json 中物理 group key 从 `tdd-spec` 改为 `tdd-suite`
- **THEN** 逻辑 group `python` 的 members 中 `custom/tdd-spec/ts-apply` 改为 `custom/tdd-suite/ts-apply`

#### Scenario: group rename 撞名报错
- **WHEN** 用户执行 `skillsmgr group rename tdd-spec python`, 而逻辑 group `python` 已存在
- **THEN** 系统 SHALL 报错 `Group 'python' already exists.`, 不修改任何文件

### Requirement: 顶层 install/uninstall/update 命令路由到 group

顶层命令 SHALL 在解析后根据 `ResolvedTarget.kind === 'group'` 自动路由到 group 路径:

- `uninstall <input>` 命中 group → 走 `group uninstall` 算法
- `update <input>` 命中 group → 走 `group update` 算法
- `install <path>` 批量分支 → 内部走 `group install` 实现

用户认知层无需区分顶层命令和 `group` 子命令, 行为完全一致.

#### Scenario: 顶层 uninstall 命中物理 group
- **GIVEN** 物理 group `tdd-spec` 存在
- **WHEN** 用户执行 `skillsmgr uninstall tdd-spec`
- **THEN** SourceResolver 返回 `kind: 'group'` target
- **THEN** 顶层 uninstall 调用与 `group uninstall tdd-spec` 完全相同的实现路径

#### Scenario: 顶层 uninstall 命中逻辑 group 给提示
- **GIVEN** 逻辑 group `python` 存在
- **WHEN** 用户执行 `skillsmgr uninstall python`
- **THEN** 系统 SHALL 报错 `'python' is a virtual group; use 'group delete python' to remove it (skills are not affected)`
- **AND** 不删除任何 skill

### Requirement: 迁移策略 (V2 → V3 sources.json + V1 → V2 groups.json)

系统 SHALL 在首次 load `sources.json` 或 `groups.json` 时检测旧版本并自动一次性迁移. 迁移是无 opt-out 的.

迁移步骤:

1. 读取 `sources.json`, 若 `version !== '3.0'`:
   - 写 backup `sources.json.v2.backup`
   - 收集所有 `bundles` 中 `type === 'local-batch'` 的 entry
   - 对每个 local-batch bundle:
     - 计算 `groupName = basename(bundle.url)`
     - 调用 `groupsService.migrateLocalBatchToPhysicalGroup(groupName, bundle)` (见步骤 3)
     - 从 `bundles` 字段删除该 entry
   - 升级 `version` 为 `'3.0'`, atomic 写回

2. 读取 `groups.json`, 若顶层不是 `{ version, groups }` 结构 (旧 V1 格式):
   - 写 backup `groups.json.v1.backup`
   - 把每个 `name: string[]` entry 升级为 `name: { kind: 'virtual', members: string[] }`
   - 包入 `{ version: '2.0', groups: {...} }` 结构, atomic 写回

3. `migrateLocalBatchToPhysicalGroup(name, bundle)` SHALL:
   - 检查 `groups.json` 中是否已有 `name` entry:
     - 若有且 `kind === 'virtual'` (用户手工建): 重命名为 `<name>-legacy` (递增数字直到不冲突: `<name>-legacy`, `<name>-legacy-2`, ...).  打印 WARN 到 stderr 并写入 `~/.skills-manager/migration.log`
     - 若有且为旧 `string[]` 格式 (auto-group, 与 bundle.members 同源): 视为同源, 直接覆盖. 不计入冲突
     - 若无: 直接创建
   - 创建 `{ kind: 'local-batch', url: bundle.url, installedAt: bundle.installedAt, updatedAt: bundle.updatedAt }`

#### Scenario: 首次迁移 V2 sources.json + V1 groups.json
- **GIVEN** 旧 sources.json 含 1 个 local-batch bundle (`url=/dev/tdd-spec`, members 任意), 旧 groups.json 含 `tdd-spec: ['custom/tdd-spec/ts-apply', ...]` (auto-group) 和 `python: ['custom/foo']` (用户手工)
- **WHEN** 系统首次 load
- **THEN** sources.json 升到 V3, `bundles` 不再含 local-batch entry
- **THEN** groups.json 升到 V2 结构, `tdd-spec` 变为 `{ kind: 'local-batch', url: '/dev/tdd-spec', installedAt, updatedAt }`, `python` 变为 `{ kind: 'virtual', members: ['custom/foo'] }`
- **THEN** 写出 `sources.json.v2.backup` 和 `groups.json.v1.backup`

#### Scenario: 迁移命名冲突 — 用户手工逻辑 group 撞名
- **GIVEN** 旧 sources.json 含 local-batch bundle url 的 basename = `tdd-spec`, 旧 groups.json 含**用户手工建**的 `tdd-spec: ['official/anthropic/skills/commit']`
- **WHEN** 系统首次 load
- **THEN** 物理 group `tdd-spec` 被创建 (来自 bundle)
- **THEN** 原逻辑 group `tdd-spec` 被重命名为 `tdd-spec-legacy`, 内容 `['official/anthropic/skills/commit']` 保留
- **THEN** stderr 打印 `⚠ Group naming conflict: virtual group 'tdd-spec' renamed to 'tdd-spec-legacy' (a physical group with the same name was migrated from local-batch bundle)`
- **THEN** `migration.log` 包含同样的 entry

#### Scenario: 迁移命名冲突 — `<name>-legacy` 已被占用递增
- **GIVEN** 旧 groups.json 同时含用户手工建的 `tdd-spec` 和 `tdd-spec-legacy`, sources.json 含 local-batch bundle 撞名 `tdd-spec`
- **WHEN** 系统首次迁移
- **THEN** `tdd-spec` 被重命名为 `tdd-spec-legacy-2`, 物理 group `tdd-spec` 创建, 原 `tdd-spec-legacy` 不动

#### Scenario: 已是 V3 不重复迁移
- **GIVEN** sources.json `version === '3.0'`, groups.json 顶层为 `{ version: '2.0', groups: {...} }`
- **WHEN** 系统 load
- **THEN** 不执行迁移逻辑, 不写 backup, 不打印迁移日志

#### Scenario: 迁移 atomic 失败时不损坏数据
- **WHEN** 迁移过程中 atomic write 失败
- **THEN** 原 sources.json/groups.json 保持不变 (临时文件被清理)
- **THEN** 系统 SHALL 抛出错误并以非 0 退出码终止
- **THEN** backup 文件如果已写出, 保留

### Requirement: 自动同名 group (auto-group) 概念废弃

旧模型中 install local-batch 时 `groupsService.createGroup(<dirName>)` + `addSkill` 形成的 "auto-group" 概念 SHALL 被废弃.  物理 group 本身承载该语义 (同名 + members 实时派生).

install 路径不再调用 `createGroup`/`addSkill` 给同名 group 添加 members. 物理 group 的 `groups.json` entry 仅含 metadata (`kind`, `url`, `installedAt`, `updatedAt`).

#### Scenario: install 后 groups.json 物理 group 不存 members
- **WHEN** 用户执行 `skillsmgr install ./tdd-spec`, 安装 8 个 skill
- **THEN** `groups.json[tdd-spec] === { kind: 'local-batch', url: '...', installedAt: ..., updatedAt: ... }` (无 members 字段)
- **THEN** 查询 members 时实时扫物理目录返回 8 个

### Requirement: install --group 限定为加到逻辑 group

`install <path|repo> --group <name>` 的 `<name>` SHALL 必须是逻辑 group:

- `<name>` 是物理 group → 报错, 提示物理 group 的 members 由物理目录派生, 不接受外部添加
- `<name>` 是逻辑 group → 把安装的 skill key 添加到该逻辑 group
- `<name>` 不存在 → 自动创建逻辑 group 并添加

#### Scenario: --group 指向物理 group 报错
- **GIVEN** 物理 group `tdd-spec` 已存在
- **WHEN** 用户执行 `skillsmgr install obra/superpowers --group tdd-spec`
- **THEN** 系统 SHALL 报错 `Cannot add to physical group 'tdd-spec'. Members of physical groups are derived from custom/tdd-spec/.  Use a virtual group name instead.`
- **AND** 不安装 skill, 不修改 groups.json

#### Scenario: --group 指向逻辑 group
- **GIVEN** 逻辑 group `python` 已存在 (或不存在均可)
- **WHEN** 用户执行 `skillsmgr install obra/superpowers --group python`
- **THEN** 安装 obra/superpowers 后, 把所有安装的 skill key 添加到逻辑 group `python` (group 不存在时自动创建)

### Requirement: 物理 group 边界 — custom/<name>/ 整目录归属

`~/.skills-manager/custom/<name>/` 目录 SHALL 被视为对应物理 group `<name>` 的边界, 目录内所有内容均属于该 group 单元:

- `group uninstall <name>` SHALL 删除整棵 `custom/<name>/` 树, 即使其中存在用户手动放入但未在 sources.json 登记的 skill 或文件
- `group update <name>` 的 orphaned 检测对未登记的物理子目录, 行为同已登记孤儿 (默认删除, `--keep-local` 保留)

文档 SHALL 明确说明此边界, 提示用户不要把无关文件手动放入 `custom/<name>/`.

#### Scenario: uninstall 删除手动放入的未登记 skill
- **GIVEN** 物理 group `tdd-spec`
- **AND** 用户手动在 `custom/tdd-spec/manual-x/` 放了一个 SKILL.md (没在 sources.json 登记)
- **WHEN** 用户执行 `skillsmgr uninstall tdd-spec` 并确认
- **THEN** `manual-x` 被列在 affectedKeys 里, 用户能在确认前看到
- **THEN** `custom/tdd-spec/` 整棵树删除, 包括 `manual-x`
