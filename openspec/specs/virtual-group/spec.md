# Virtual Group

## Purpose
虚拟 skill 分组管理: 基于 groups.json 的 CRUD 操作和 CLI 子命令.
## Requirements
### Requirement: groups.json 存储

系统 SHALL 使用 `~/.skills-manager/groups.json` 存储所有 group 的元数据.  顶层结构为 `{ version: '2.0', groups: Record<string, GroupEntry> }`.  每个 GroupEntry 必含 `kind: 'virtual' | 'local-batch'` 字段:

- **virtual**: `{ kind: 'virtual', members: string[] }`
- **local-batch**: `{ kind: 'local-batch', url: string, installedAt: string, updatedAt: string }` (无 `members` 字段, 由 `~/.skills-manager/custom/<name>/` 物理目录实时派生)

文件不存在时视为 `{ version: '2.0', groups: {} }`.  旧格式 (顶层为 `Record<string, string[]>`, V1) 在 load 时自动迁移为 V2 (见 `group-as-first-class-unit` capability 的 "迁移策略" 需求).

#### Scenario: V2 groups.json 格式
- **GIVEN** 用户创建了逻辑 group `python` 含 2 个 skill, 安装了物理 group `tdd-spec` (源目录 `/dev/tdd-spec`)
- **THEN** `groups.json` 内容为:
  ```json
  {
    "version": "2.0",
    "groups": {
      "python": { "kind": "virtual", "members": ["custom/my-linter", "official/anthropic/skills/commit"] },
      "tdd-spec": { "kind": "local-batch", "url": "/dev/tdd-spec", "installedAt": "...", "updatedAt": "..." }
    }
  }
  ```

#### Scenario: groups.json 不存在时
- **WHEN** `~/.skills-manager/groups.json` 不存在
- **THEN** 系统 SHALL 视为 `{ version: '2.0', groups: {} }`, 不报错

#### Scenario: V1 格式自动迁移
- **GIVEN** `groups.json` 为 V1 格式 `{"python":["custom/foo"]}`
- **WHEN** 系统 load
- **THEN** 自动迁移为 V2, `python` entry 升级为 `{ kind: 'virtual', members: ['custom/foo'] }`
- **THEN** 写出 `groups.json.v1.backup`

### Requirement: GroupsService CRUD

系统 SHALL 提供 `GroupsService` 服务, 读写 `groups.json`, 提供以下方法:

- `listGroups()`: 返回所有 group 名数组 (含物理和逻辑)
- `getGroup(name)`: 返回 GroupEntry (含 kind 和对应字段), group 不存在时返回 `null`
- `getGroupKind(name)`: 返回 `'virtual' | 'local-batch' | null`
- `getGroupMembers(name)`: 返回 group 的 skill key 数组. 物理 group 实时扫 `~/.skills-manager/custom/<name>/`, 逻辑 group 读 `members` 字段
- `createGroup(name)`: 创建空逻辑 group (`{ kind: 'virtual', members: [] }`).  group 已存在时报错 (含同名物理 group)
- `createLocalBatchGroup(name, url)`: 创建物理 group entry (`{ kind: 'local-batch', url, installedAt, updatedAt }`).  group 已存在时报错
- `deleteGroup(name)`: 删除 group entry. 仅作用于 `groups.json`, 不删除 skill 文件, 不删除物理目录
- `deletePhysicalGroup(name)`: `deleteGroup` 的别名, 语义上专用于物理 group (调用方需自行处理物理目录)
- `addSkill(group, skillKey)`: 向**逻辑** group 添加 skill 引用. group 不存在时自动创建为逻辑 group. group 是物理 group 时 SHALL 报错
- `removeSkill(group, skillKey)`: 从**逻辑** group 移除引用. group 是物理 group 时 SHALL 报错 (物理 group 的 members 由物理目录派生, 不可手动移除)
- `removeSkillFromAll(skillKey)`: 从所有**逻辑** group 中移除指定 skill 引用. 物理 group 不影响 (物理目录自然反映)
- `renameGroup(oldName, newName)`: 重命名 group entry key.  仅 `groups.json` 改 key, 不动物理目录或 sources.json (物理 group 的完整 rename 由 `groupCommandRename` 协调多个 service)
- `updatePhysicalGroupTimestamp(name)`: 仅刷新物理 group 的 `updatedAt` 字段

`remove` 命令移除 skill 后 SHALL 调用 `removeSkillFromAll(skillKey)` 清理引用, 与 `uninstall` 行为对齐.

#### Scenario: getGroup 返回带 kind 的 GroupEntry
- **WHEN** 物理 group `tdd-spec` 存在
- **THEN** `getGroup("tdd-spec")` SHALL 返回 `{ kind: 'local-batch', url: '...', installedAt: '...', updatedAt: '...' }`

#### Scenario: getGroup 不存在返回 null
- **WHEN** 请求不存在的 group
- **THEN** `getGroup("nonexistent")` SHALL 返回 `null`

#### Scenario: getGroupMembers 物理 group 实时派生
- **GIVEN** 物理 group `tdd-spec`, `custom/tdd-spec/` 含 `ts-apply/SKILL.md`, `ts-verify/SKILL.md`
- **WHEN** 调用 `getGroupMembers("tdd-spec")`
- **THEN** SHALL 扫 `custom/tdd-spec/` 子目录, 返回 `['custom/tdd-spec/ts-apply', 'custom/tdd-spec/ts-verify']`
- **AND** 不读取 `groups.json` 的 members 字段 (物理 group 没有该字段)

#### Scenario: getGroupMembers 逻辑 group 读字段
- **GIVEN** 逻辑 group `python` 含 `['custom/foo', 'official/anthropic/skills/commit']`
- **WHEN** 调用 `getGroupMembers("python")`
- **THEN** 返回该数组

#### Scenario: createGroup 空逻辑 group
- **WHEN** 调用 `createGroup("frontend")`
- **THEN** `groups.json[frontend]` 为 `{ kind: 'virtual', members: [] }`

#### Scenario: createGroup 撞名物理 group 报错
- **GIVEN** 物理 group `tdd-spec` 已存在
- **WHEN** 调用 `createGroup("tdd-spec")`
- **THEN** SHALL 抛出错误, 含 "already exists as a local-batch group"

#### Scenario: createGroup 撞名逻辑 group 报错
- **GIVEN** 逻辑 group `python` 已存在
- **WHEN** 调用 `createGroup("python")`
- **THEN** SHALL 抛出错误 `Group 'python' already exists.`

#### Scenario: createLocalBatchGroup 创建物理 group
- **WHEN** 调用 `createLocalBatchGroup("tdd-spec", "/dev/tdd-spec")`
- **THEN** `groups.json[tdd-spec]` 为 `{ kind: 'local-batch', url: '/dev/tdd-spec', installedAt: <now>, updatedAt: <now> }`

#### Scenario: createLocalBatchGroup 撞名报错
- **WHEN** 调用 `createLocalBatchGroup("tdd-spec", ...)`, group 已存在
- **THEN** SHALL 抛出错误

#### Scenario: addSkill 向物理 group 报错
- **GIVEN** 物理 group `tdd-spec` 已存在
- **WHEN** 调用 `addSkill("tdd-spec", "custom/tdd-spec/foo")`
- **THEN** SHALL 抛出错误, 含 "physical group, members are derived from custom/tdd-spec/"

#### Scenario: removeSkill 从物理 group 报错
- **GIVEN** 物理 group `tdd-spec` 已存在
- **WHEN** 调用 `removeSkill("tdd-spec", "custom/tdd-spec/foo")`
- **THEN** SHALL 抛出错误, 同上

#### Scenario: removeSkillFromAll 仅清理逻辑 group
- **GIVEN** 逻辑 group `python` 含 `custom/foo`, 物理 group `tdd-spec` 存在
- **WHEN** 调用 `removeSkillFromAll("custom/foo")`
- **THEN** `python` 中 `custom/foo` 被移除
- **THEN** 物理 group `tdd-spec` 不被影响

#### Scenario: addSkill 自动创建逻辑 group
- **WHEN** group "new-group" 不存在, 调用 `addSkill("new-group", "custom/foo")`
- **THEN** 系统 SHALL 自动创建 `{ kind: 'virtual', members: ['custom/foo'] }`

#### Scenario: addSkill 重复添加幂等
- **WHEN** `custom/foo` 已在逻辑 group `python` 中, 再次调用 `addSkill("python", "custom/foo")`
- **THEN** SHALL 不重复添加, members 中仍只有一个

#### Scenario: deleteGroup 删除 entry 不动物理目录
- **WHEN** 物理 group `tdd-spec` 存在 + `custom/tdd-spec/` 含 skills, 调用 `deleteGroup("tdd-spec")`
- **THEN** `groups.json` 中 `tdd-spec` 被删
- **THEN** `custom/tdd-spec/` 物理目录 NOT 受影响

#### Scenario: deleteGroup 不存在报错
- **WHEN** 调用 `deleteGroup("nonexistent")`
- **THEN** SHALL 抛出错误

### Requirement: physical group 与 virtual group 命名空间统一

`groups.json` 中所有 group entry SHALL 共享同一命名空间, 物理和逻辑 group MUST NOT 同名.  此约束 SHALL 由 `createGroup` / `createLocalBatchGroup` / `renameGroup` 在写入路径强制.

#### Scenario: 命名空间统一查找
- **GIVEN** 物理 group `tdd-spec` 和逻辑 group `python` 均存在
- **WHEN** 调用 `listGroups()`
- **THEN** 返回 `["python", "tdd-spec"]` (排序), 不区分 kind

### Requirement: group name 验证
group name SHALL 仅允许字母, 数字, 连字符, 下划线.

#### Scenario: 合法 group name
- **WHEN** group name 为 `"python-3"` 或 `"my_tools"`
- **THEN** 验证通过

#### Scenario: 非法 group name
- **WHEN** group name 包含空格, 斜杠, 或特殊字符 (如 `"my tools"`, `"a/b"`)
- **THEN** 系统 SHALL 报错 "Group name must contain only letters, numbers, hyphens, and underscores"

### Requirement: group list 子命令
`skillsmgr group list` SHALL 列出所有 group 及其 skill 数量.  `skillsmgr group list <name>` SHALL 列出指定 group 内的 skill 详情.

#### Scenario: 列出所有 group
- **WHEN** 用户执行 `skillsmgr group list`, 存在 python (2 skills) 和 rust (1 skill)
- **THEN** 输出每个 group 名及其 skill 数量

#### Scenario: 列出指定 group 内容
- **WHEN** 用户执行 `skillsmgr group list python`
- **THEN** 输出 python group 内所有 skill 的 source key

#### Scenario: 指定 group 不存在
- **WHEN** 用户执行 `skillsmgr group list nonexistent`
- **THEN** 输出 "Group 'nonexistent' not found." 并退出

#### Scenario: 无任何 group
- **WHEN** 用户执行 `skillsmgr group list` 且无任何 group
- **THEN** 输出 "No groups defined."

### Requirement: group create 子命令
`skillsmgr group create <name>` SHALL 创建一个空 group.

#### Scenario: 创建新 group
- **WHEN** 用户执行 `skillsmgr group create python`
- **THEN** 创建空 group, 输出成功消息

#### Scenario: group 已存在
- **WHEN** 用户执行 `skillsmgr group create python`, 且 python group 已存在
- **THEN** 输出 "Group 'python' already exists." 并退出

### Requirement: group delete 子命令
`skillsmgr group delete <name>` SHALL 删除指定 group.  不删除任何 skill 文件.

#### Scenario: 删除 group
- **WHEN** 用户执行 `skillsmgr group delete python`
- **THEN** 删除 python group, 输出成功消息, skill 文件不受影响

#### Scenario: group 不存在
- **WHEN** 用户执行 `skillsmgr group delete nonexistent`
- **THEN** 输出 "Group 'nonexistent' not found." 并退出

### Requirement: group add 子命令
`skillsmgr group add <group> <identifier>` SHALL 将已安装的 skill 加入指定 group.  identifier 支持四种格式: skill name, full source key, group name, owner/repo.  多类型匹配时交互提示用户选择.  添加时 SHALL 检测 name 级别冲突.

此外, `skillsmgr group add <group> --group <src>` SHALL 向 group 写入对 src 的**动态引用** (`group:<src>` 引用项), 语义独立于 positional identifier 匹配 group name 时的一次性快照复制: positional = 复制 src 当前成员, `--group` = 动态跟随 src.  两条路径并存.  `--group` 的 src 等于 target 时 SHALL 报错 "Cannot reference a group from itself.".

#### Scenario: 按 name 添加唯一匹配
- **WHEN** 用户执行 `skillsmgr group add python commit`, 且只有一个名为 commit 的 skill (key: `official/anthropic/skills/commit`)
- **THEN** 将 `official/anthropic/skills/commit` 添加到 python group

#### Scenario: 同名 skill 冲突
- **WHEN** 用户执行 `skillsmgr group add python commit`, 且存在 `official/anthropic/skills/commit` 和 `community/someone/tools/commit` 两个同名 skill
- **THEN** 交互提示用户选择其中一个

#### Scenario: 使用完整 source key 添加
- **WHEN** 用户执行 `skillsmgr group add python official/anthropic/skills/commit`
- **THEN** 将该 key 添加到 python group

#### Scenario: skill 已在 group 中
- **WHEN** `official/anthropic/skills/commit` 已在 python group 中, 用户再次执行 `skillsmgr group add python commit`
- **THEN** 输出 "Skill 'commit' is already in group 'python'."

#### Scenario: group 不存在时自动创建
- **WHEN** 用户执行 `skillsmgr group add newgroup commit`, 且 newgroup 不存在
- **THEN** 自动创建 newgroup 并添加 skill

#### Scenario: identifier 匹配 group name — 批量添加 (快照)
- **WHEN** 用户执行 `skillsmgr group add develop openspec`, 且 `openspec` 是已存在的 group 包含 10 个 skill key
- **THEN** 将 openspec group 的当前所有 skill key 复制到 develop group (快照, 不建立引用), 逐条显示添加结果

#### Scenario: identifier 匹配 owner/repo — 批量添加
- **WHEN** 用户执行 `skillsmgr group add develop obra/superpowers`, 且 `obra/superpowers` 下有 5 个已安装 skill
- **THEN** 将这 5 个 skill 的 key 全部添加到 develop group, 逐条显示添加结果

#### Scenario: owner/repo 未安装
- **WHEN** 用户执行 `skillsmgr group add develop foo/bar`, 且 `foo/bar` 未安装任何 skill
- **THEN** 输出 "No installed skills found for 'foo/bar'." 并退出

#### Scenario: 多类型匹配时交互选择
- **WHEN** 用户执行 `skillsmgr group add develop openspec`, 且同时存在名为 `openspec` 的 skill 和名为 `openspec` 的 group
- **THEN** 交互提示用户选择: `skill: openspec (custom/openspec)` 或 `group: openspec (10 skills)`

#### Scenario: 自引用防护 (positional 快照)
- **WHEN** 用户执行 `skillsmgr group add openspec openspec`, identifier 解析为 group `openspec`
- **THEN** 输出 "Cannot add a group to itself." 并退出

#### Scenario: 无任何匹配
- **WHEN** 用户执行 `skillsmgr group add python nonexistent`, 且无同名 skill, 无同名 group, 非 owner/repo 格式
- **THEN** 输出 "No skill, group, or repo found for 'nonexistent'." 并退出

#### Scenario: --group 添加动态引用
- **WHEN** 用户执行 `skillsmgr group add vercel-develop --group develop`
- **THEN** vercel-develop 写入 `group:develop` 引用项, 不复制 develop 的成员快照

#### Scenario: --group 自引用防护
- **WHEN** 用户执行 `skillsmgr group add develop --group develop`
- **THEN** 输出 "Cannot reference a group from itself." 并退出, 不写入引用

#### Scenario: name 冲突检测 — 单个添加
- **WHEN** develop group 已有 `community/alice/tools/commit` (name: commit), 用户执行 `skillsmgr group add develop commit` 解析为 `official/anthropic/skills/commit`
- **THEN** 提示用户: 覆盖 (替换为 `official/anthropic/skills/commit`) 或跳过 (保留 `community/alice/tools/commit`)

#### Scenario: name 冲突检测 — 批量添加
- **WHEN** develop group 已有 `custom/my-explore` (name: explore), 用户通过 group 批量添加, 其中包含 `custom/openspec/openspec-explore` (name: openspec-explore, 无冲突) 和 `custom/other/explore` (name: explore, 冲突)
- **THEN** 对无冲突的 skill 直接添加, 对冲突的 skill 逐个提示覆盖或跳过

#### Scenario: 批量添加 key 已存在时静默跳过
- **WHEN** develop group 已有 `custom/openspec/openspec-explore`, 用户通过 group 批量添加 openspec, 其中包含该 key
- **THEN** 该 skill 静默跳过 (key 级别幂等), 输出标记 "already in develop, skipped"

#### Scenario: 空 group 批量添加
- **WHEN** 用户执行 `skillsmgr group add develop empty-group`, 且 `empty-group` 存在但无 skill
- **THEN** 输出 "Group 'empty-group' is empty, nothing to add."

### Requirement: group remove 子命令
`skillsmgr group remove <group> <identifier>` SHALL 从指定 group 中移除 skill 引用.  identifier 支持 skill name/key, group name, owner/repo 三种格式.  不删除 skill 文件.

此外, `skillsmgr group remove <group> --group <src>` SHALL 从 group 移除对 src 的**动态引用** (`group:<src>` 引用项), 与 `group add --group` 对称.

#### Scenario: 从 group 移除单个 skill
- **WHEN** 用户执行 `skillsmgr group remove python commit`
- **THEN** 从 python group 中移除 commit 的引用, skill 文件不受影响

#### Scenario: 按 group 批量移除
- **WHEN** 用户执行 `skillsmgr group remove develop openspec`, 标识符解析为 group 类型
- **THEN** 从 develop 中移除所有同时存在于 openspec 中的 skill 引用

#### Scenario: 按 owner/repo 批量移除
- **WHEN** 用户执行 `skillsmgr group remove develop anthropic/skills`, 标识符解析为 repo 类型
- **THEN** 从 develop 中移除该 repo 下所有 skill 引用

#### Scenario: --group 移除动态引用
- **WHEN** vercel-develop 含 `group:develop`, 用户执行 `skillsmgr group remove vercel-develop --group develop`
- **THEN** 移除 `group:develop` 引用项, develop 本身不受影响

#### Scenario: --group 移除不存在的引用
- **WHEN** vercel-develop 不含 `group:develop`, 用户执行 `skillsmgr group remove vercel-develop --group develop`
- **THEN** 输出提示该引用不存在, 不报致命错误

#### Scenario: skill 不在 group 中
- **WHEN** 用户执行 `skillsmgr group remove python nonexistent`
- **THEN** 输出提示信息并退出

#### Scenario: group 不存在
- **WHEN** 用户执行 `skillsmgr group remove nonexistent commit`
- **THEN** 输出 "Group 'nonexistent' not found." 并退出

### Requirement: renameGroup 方法
`GroupsService` SHALL 提供 `renameGroup(oldName, newName)` 方法, 将 groups.json 中的 group key 从 `oldName` 重命名为 `newName`, 保留原有的 skill key 数组不变.

#### Scenario: 成功重命名
- **WHEN** 存在 group "python" 包含 `["custom/my-linter"]`, 调用 `renameGroup("python", "py-tools")`
- **THEN** groups.json 中 "python" key 被移除, 新增 "py-tools" key, 值为 `["custom/my-linter"]`

#### Scenario: oldName 不存在
- **WHEN** 调用 `renameGroup("nonexistent", "new-name")`
- **THEN** SHALL 抛出错误 "Group 'nonexistent' not found."

#### Scenario: newName 已存在
- **WHEN** "python" 和 "rust" 两个 group 都存在, 调用 `renameGroup("python", "rust")`
- **THEN** SHALL 抛出错误 "Group 'rust' already exists."

#### Scenario: newName 格式非法
- **WHEN** 调用 `renameGroup("python", "my tools")`
- **THEN** SHALL 抛出 validateGroupName 的错误

#### Scenario: 相同名字
- **WHEN** 调用 `renameGroup("python", "python")`
- **THEN** SHALL 抛出错误 "New name is the same as the current name."

### Requirement: group rename 子命令
`skillsmgr group rename <old-name> <new-name>` SHALL 重命名指定的虚拟 group.

#### Scenario: 成功重命名
- **WHEN** 用户执行 `skillsmgr group rename python py-tools`
- **THEN** 输出 "Renamed group 'python' to 'py-tools'."

#### Scenario: 旧 group 不存在
- **WHEN** 用户执行 `skillsmgr group rename nonexistent new-name`
- **THEN** 输出 "Group 'nonexistent' not found." 并退出

#### Scenario: 新名字已存在
- **WHEN** 用户执行 `skillsmgr group rename python rust`, 且 rust group 已存在
- **THEN** 输出 "Group 'rust' already exists." 并退出

#### Scenario: 新名字格式非法
- **WHEN** 用户执行 `skillsmgr group rename python "my tools"`
- **THEN** 输出 name 验证错误并退出

### Requirement: group 成员恒为 skill key

虚拟 group 与 collection group 的 `members` 数组中, 每一项 SHALL 是下列两种形态之一:

- **skill key**: `{source}/{name}`, 唯一定位一个已安装 skill, 满足 `` `${skill.source}/${skill.name}` === member ``
- **group 引用**: `group:<name>` 前缀项 (见 `group-references` capability)

系统 SHALL NOT 向 `members` 写入 **source key** (如 `community/{owner}/{repo}`、`registry/{pkg}`、`well-known/{host}`).  该约束适用于所有写入路径, 包括但不限于 `group add`、`install --group`、`install --from <collection>` 的 collection group 生成、以及未来新增的任何 source 类型.

判定方法: 对 custom 来源 source key 与 skill key 取值相同, 不构成违反; 对多段 source, 写入的成员必须比其 source key 多一段.

#### Scenario: 多段 source 的成员比 source key 多一段
- **GIVEN** source key 为 `well-known/docs.example.com`
- **WHEN** 该来源的 skill `foo` 被加入某 group
- **THEN** 成员 SHALL 为 `well-known/docs.example.com/foo`

#### Scenario: 写入 source key 的成员无法被解析
- **GIVEN** 某 group 的 members 含 `community/obra/superpowers` (source key)
- **WHEN** 用户执行 `skillsmgr add --group <name>`
- **THEN** 该成员 SHALL 匹配不到任何 skill 并被跳过并提示

#### Scenario: custom 来源两者同形不构成违反
- **GIVEN** custom skill `my-linter`, source key 与 skill key 均为 `custom/my-linter`
- **WHEN** 该 skill 被加入某 group
- **THEN** 成员 SHALL 为 `custom/my-linter`, 符合本需求

### Requirement: install --from 生成的 collection group 成员格式

`skillsmgr install --from <collection-ref>` 在安装完成后 SHALL 以该 collection ref 为名生成或更新一个 collection group.  其 `members` SHALL 为本次安装的每个 skill 的 skill key, 每个 skill 一条.

当同时指定 `--group <name>` 时, 写入该虚拟 group 的成员 SHALL 同样为 skill key.  两条写入路径 SHALL NOT 写入 source key.

#### Scenario: collection group 成员为 skill key
- **GIVEN** collection `@alice/kit` 含 registry 包 `pack-a` (2 个 skill) 与 `pack-b` (1 个 skill)
- **WHEN** 用户执行 `skillsmgr install --from @alice/kit`
- **THEN** collection group `@alice/kit` SHALL 含 3 条成员, 形如 `registry/pack-a/{skill}` 与 `registry/pack-b/{skill}`
- **THEN** SHALL NOT 含 `registry/pack-a` 或 `registry/pack-b`

#### Scenario: --from 同时指定 --group
- **WHEN** 用户执行 `skillsmgr install --from @alice/kit --group tools`
- **THEN** group `tools` SHALL 含全部 3 条 skill key 成员
- **THEN** collection group `@alice/kit` SHALL 同样含这 3 条成员

#### Scenario: collection group 成员可被 add --group 部署
- **GIVEN** 用户已执行 `skillsmgr install --from @alice/kit`
- **WHEN** 用户在某项目执行 `skillsmgr add --group @alice/kit`
- **THEN** 系统 SHALL 解析出全部 3 个 skill, SHALL NOT 输出 `No valid skills found in group`

### Requirement: update <collection-ref> 重写成员时保持 skill key

`skillsmgr update <collection-ref>` 同步 collection group 快照时 SHALL 写回 skill key, SHALL NOT 用 source key 覆盖已有的 skill key 成员.

每个 collection 成员包的 skill key SHALL 按下列优先级确定:

1. 本次新装的包 → 采用安装结果报告的 skill key
2. 快照中已有该包前缀 (`registry/{pkg}/`) 的成员 → 原样保留
3. 磁盘上该包已安装的 skill → 由其枚举生成 (使早于本变更的 source key 快照自然迁移)
4. 以上都取不到 → **原样保留快照中该包的既有条目**, SHALL NOT 把该包从 group 中移除

第 4 条是对数据的保护: 推导不出 skill key 时保留一个可见的旧条目, 优于静默清空用户的 group.  被保留的旧条目仍会在 `add --group` 时报"匹配不到"并跳过.

#### Scenario: 不用 source key 覆盖 skill key 成员
- **GIVEN** collection group 成员为 `registry/@alice/a/a-one` 与 `registry/@alice/a/a-two`
- **WHEN** 用户执行 `skillsmgr update @alice/kit` 且服务端该包无变化
- **THEN** 写回的成员 SHALL 仍为这两条 skill key
- **THEN** 写回的成员 SHALL NOT 含 `registry/@alice/a`

#### Scenario: 新装的包按安装结果写入 skill key
- **GIVEN** 服务端新增包 `@alice/b`, 安装后产出 2 个 skill
- **WHEN** 用户执行 `skillsmgr update @alice/kit`
- **THEN** 写回的成员 SHALL 含该包的 2 条 skill key, SHALL NOT 含 `registry/@alice/b`

#### Scenario: 服务端下架的包从快照移除
- **GIVEN** 快照含 `registry/@alice/dropped/gone`, 服务端已无该包
- **WHEN** 用户执行 update
- **THEN** 该成员 SHALL 从快照移除, 本地副本 SHALL 保留

#### Scenario: 推导不出时保留旧条目而非清空
- **GIVEN** 快照含早于本变更的条目 `registry/@alice/a` (source key), 且磁盘上无该包的 skill
- **WHEN** 用户执行 update
- **THEN** 写回的成员 SHALL 仍含 `registry/@alice/a`
- **THEN** SHALL NOT 把该包从 group 中移除

