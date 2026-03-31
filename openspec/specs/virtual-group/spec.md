# Virtual Group

虚拟 skill 分组管理: 基于 groups.json 的 CRUD 操作和 CLI 子命令.

## Requirements

### Requirement: groups.json 存储
系统 SHALL 使用 `~/.skills-manager/groups.json` 存储所有虚拟 group 的元数据.  格式为 JSON 对象, key 为 group name, value 为 skill source key 数组.  文件不存在时视为空 `{}`.

#### Scenario: groups.json 格式
- **WHEN** 用户创建了 python 和 rust 两个 group 并添加了 skill
- **THEN** `groups.json` 内容为 `{"python":["custom/my-linter","official/anthropic/skills/commit"],"rust":["custom/my-linter"]}`

#### Scenario: groups.json 不存在时
- **WHEN** `~/.skills-manager/groups.json` 不存在
- **THEN** 系统 SHALL 视为空 `{}`, 不报错

### Requirement: GroupsService CRUD
系统 SHALL 提供 `GroupsService` 服务, 读写 `groups.json`, 提供以下方法:
- `listGroups()`: 返回所有 group 名数组
- `getGroup(name)`: 返回指定 group 的 skill key 数组, group 不存在时返回 `null`
- `createGroup(name)`: 创建空 group (空数组), group 已存在时报错
- `deleteGroup(name)`: 删除整个 group, group 不存在时报错
- `addSkill(group, skillKey)`: 向 group 添加 skill 引用, group 不存在时自动创建
- `removeSkill(group, skillKey)`: 从 group 中移除 skill 引用
- `removeSkillFromAll(skillKey)`: 从所有 group 中移除指定 skill 引用

`remove` 命令移除 skill 后 SHALL 调用 `removeSkillFromAll(skillKey)` 清理引用, 与 `uninstall` 行为对齐.

#### Scenario: listGroups 返回所有 group 名
- **WHEN** groups.json 包含 python 和 rust 两个 group
- **THEN** `listGroups()` SHALL 返回 `["python", "rust"]`

#### Scenario: getGroup 返回 skill key 数组
- **WHEN** python group 包含 `["custom/my-linter", "official/anthropic/skills/commit"]`
- **THEN** `getGroup("python")` SHALL 返回该数组

#### Scenario: getGroup 不存在的 group
- **WHEN** 请求不存在的 group
- **THEN** `getGroup("nonexistent")` SHALL 返回 `null`

#### Scenario: createGroup 创建空 group
- **WHEN** 调用 `createGroup("frontend")`
- **THEN** groups.json 中新增 `"frontend": []`

#### Scenario: createGroup 已存在的 group
- **WHEN** python group 已存在, 调用 `createGroup("python")`
- **THEN** SHALL 抛出错误

#### Scenario: deleteGroup 删除 group
- **WHEN** 调用 `deleteGroup("python")`
- **THEN** groups.json 中移除 `"python"` 键

#### Scenario: deleteGroup 不存在的 group
- **WHEN** 调用 `deleteGroup("nonexistent")`
- **THEN** SHALL 抛出错误

#### Scenario: addSkill 向 group 添加引用
- **WHEN** 调用 `addSkill("python", "custom/my-linter")`
- **THEN** python group 数组中新增 `"custom/my-linter"`

#### Scenario: addSkill 自动创建 group
- **WHEN** group "new-group" 不存在, 调用 `addSkill("new-group", "custom/my-linter")`
- **THEN** 系统 SHALL 自动创建 "new-group" 并添加该 skill

#### Scenario: addSkill 重复添加
- **WHEN** `"custom/my-linter"` 已在 python group 中, 再次调用 `addSkill("python", "custom/my-linter")`
- **THEN** SHALL 不重复添加, 数组中仍只有一个该 key

#### Scenario: removeSkill 移除引用
- **WHEN** 调用 `removeSkill("python", "custom/my-linter")`
- **THEN** python group 数组中移除 `"custom/my-linter"`

#### Scenario: removeSkillFromAll 全局清理
- **WHEN** `"custom/my-linter"` 存在于 python 和 rust 两个 group 中, 调用 `removeSkillFromAll("custom/my-linter")`
- **THEN** 两个 group 中均移除该引用

#### Scenario: remove 命令调用 removeSkillFromAll
- **WHEN** 用户通过 `skillsmgr remove` 移除了 skill `my-linter`
- **AND** 该 skill 的 key 为 `custom/my-linter`
- **THEN** `removeSkillFromAll("custom/my-linter")` SHALL 被调用
- **AND** `groups.json` 中所有对该 key 的引用被清除

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
`skillsmgr group add <group> <skill>` SHALL 将已安装的 skill 加入指定 group.  skill 参数先按 name 匹配, 同名冲突时报错要求用完整 source key.

#### Scenario: 按 name 添加唯一匹配
- **WHEN** 用户执行 `skillsmgr group add python commit`, 且只有一个名为 commit 的 skill (key: `official/anthropic/skills/commit`)
- **THEN** 将 `official/anthropic/skills/commit` 添加到 python group

#### Scenario: 同名冲突
- **WHEN** 用户执行 `skillsmgr group add python commit`, 且存在 `official/anthropic/skills/commit` 和 `community/someone/tools/commit` 两个同名 skill
- **THEN** 输出 "Multiple skills named 'commit'. Specify full key:" 并列出所有匹配的完整 key

#### Scenario: 使用完整 source key 添加
- **WHEN** 用户执行 `skillsmgr group add python official/anthropic/skills/commit`
- **THEN** 将该 key 添加到 python group

#### Scenario: skill 未安装
- **WHEN** 用户执行 `skillsmgr group add python nonexistent`, 且无名为 nonexistent 的 skill
- **THEN** 输出 "Skill 'nonexistent' not found." 并退出

#### Scenario: skill 已在 group 中
- **WHEN** `official/anthropic/skills/commit` 已在 python group 中, 用户再次执行 `skillsmgr group add python commit`
- **THEN** 输出 "Skill 'commit' is already in group 'python'."

#### Scenario: group 不存在时自动创建
- **WHEN** 用户执行 `skillsmgr group add newgroup commit`, 且 newgroup 不存在
- **THEN** 自动创建 newgroup 并添加 skill

### Requirement: group remove 子命令
`skillsmgr group remove <group> <skill>` SHALL 从指定 group 中移除 skill 引用.  不删除 skill 文件.

#### Scenario: 从 group 移除 skill
- **WHEN** 用户执行 `skillsmgr group remove python commit`
- **THEN** 从 python group 中移除 commit 的引用, skill 文件不受影响

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
