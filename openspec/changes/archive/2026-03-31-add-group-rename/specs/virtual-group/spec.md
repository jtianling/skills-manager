## ADDED Requirements

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
