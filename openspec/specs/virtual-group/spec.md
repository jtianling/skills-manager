# Virtual Group

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

#### Scenario: identifier 匹配 group name — 批量添加
- **WHEN** 用户执行 `skillsmgr group add develop openspec`, 且 `openspec` 是已存在的 group 包含 10 个 skill key
- **THEN** 将 openspec group 的所有 skill key 复制到 develop group, 逐条显示添加结果

#### Scenario: identifier 匹配 owner/repo — 批量添加
- **WHEN** 用户执行 `skillsmgr group add develop obra/superpowers`, 且 `obra/superpowers` 下有 5 个已安装 skill
- **THEN** 将这 5 个 skill 的 key 全部添加到 develop group, 逐条显示添加结果

#### Scenario: owner/repo 未安装
- **WHEN** 用户执行 `skillsmgr group add develop foo/bar`, 且 `foo/bar` 未安装任何 skill
- **THEN** 输出 "No installed skills found for 'foo/bar'." 并退出

#### Scenario: 多类型匹配时交互选择
- **WHEN** 用户执行 `skillsmgr group add develop openspec`, 且同时存在名为 `openspec` 的 skill 和名为 `openspec` 的 group
- **THEN** 交互提示用户选择: `skill: openspec (custom/openspec)` 或 `group: openspec (10 skills)`

#### Scenario: 自引用防护
- **WHEN** 用户执行 `skillsmgr group add openspec openspec`, identifier 解析为 group `openspec`
- **THEN** 输出 "Cannot add a group to itself." 并退出

#### Scenario: 无任何匹配
- **WHEN** 用户执行 `skillsmgr group add python nonexistent`, 且无同名 skill, 无同名 group, 非 owner/repo 格式
- **THEN** 输出 "No skill, group, or repo found for 'nonexistent'." 并退出

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

#### Scenario: 从 group 移除单个 skill
- **WHEN** 用户执行 `skillsmgr group remove python commit`
- **THEN** 从 python group 中移除 commit 的引用, skill 文件不受影响

#### Scenario: 按 group 批量移除
- **WHEN** 用户执行 `skillsmgr group remove develop openspec`, 标识符解析为 group 类型
- **THEN** 从 develop 中移除所有同时存在于 openspec 中的 skill 引用

#### Scenario: 按 owner/repo 批量移除
- **WHEN** 用户执行 `skillsmgr group remove develop anthropic/skills`, 标识符解析为 repo 类型
- **THEN** 从 develop 中移除该 repo 下所有 skill 引用

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
