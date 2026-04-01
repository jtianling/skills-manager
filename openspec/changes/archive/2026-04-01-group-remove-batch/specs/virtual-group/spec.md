# Virtual Group

## MODIFIED Requirements

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
