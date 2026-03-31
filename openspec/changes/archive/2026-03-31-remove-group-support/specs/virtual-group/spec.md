## MODIFIED Requirements

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
