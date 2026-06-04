# Group Remove Batch

## Purpose
`group remove` 支持 group name 和 owner/repo 批量标识符, 与 `group add` 对等.

## Requirements

### Requirement: group remove 支持 group 标识符批量移除
`group remove <target-group> <source-group>` SHALL 从 target-group 中批量移除所有同时存在于 source-group 中的 skill.

#### Scenario: 批量移除 group 中的 skill
- **WHEN** `develop` 包含 `["official/anthropic/skills/commit", "custom/my-linter", "official/anthropic/skills/review"]`, `openspec` 包含 `["official/anthropic/skills/commit", "official/anthropic/skills/review"]`
- **AND** 用户执行 `skillsmgr group remove develop openspec`
- **THEN** 从 `develop` 中移除 `official/anthropic/skills/commit` 和 `official/anthropic/skills/review`
- **AND** `develop` 仍包含 `custom/my-linter`

#### Scenario: 部分 skill 不在目标 group 中
- **WHEN** `openspec` 包含 3 个 key, 其中只有 2 个在 `develop` 中
- **AND** 用户执行 `skillsmgr group remove develop openspec`
- **THEN** 移除 2 个交集 skill, 第 3 个标记为 "not in develop, skipped"

#### Scenario: 不能从自身移除
- **WHEN** 用户执行 `skillsmgr group remove develop develop`
- **THEN** 输出 "Cannot remove a group from itself." 并退出

#### Scenario: 源 group 为空
- **WHEN** `empty-group` 存在但无 skill, 用户执行 `skillsmgr group remove develop empty-group`
- **THEN** 输出 "Group 'empty-group' is empty, nothing to remove."

### Requirement: group remove 支持 owner/repo 标识符批量移除
`group remove <group> <owner/repo>` SHALL 从 group 中批量移除该 repo 下的所有 skill.

#### Scenario: 批量移除 repo 的 skill
- **WHEN** `develop` 包含 `["official/anthropic/skills/commit", "official/anthropic/skills/review", "custom/my-linter"]`
- **AND** 用户执行 `skillsmgr group remove develop anthropic/skills`
- **THEN** 从 `develop` 中移除 `official/anthropic/skills/commit` 和 `official/anthropic/skills/review`
- **AND** `develop` 仍包含 `custom/my-linter`

#### Scenario: repo 无匹配 skill
- **WHEN** `develop` 中没有属于 `obra/superpowers` 的 skill
- **AND** 用户执行 `skillsmgr group remove develop obra/superpowers`
- **THEN** 输出移除 0 个 skill 的汇总

### Requirement: group remove 批量输出格式
批量移除的输出 SHALL 与 `group add` 的 batch 输出对称.

#### Scenario: batch 输出格式
- **WHEN** 用户执行 `skillsmgr group remove develop openspec`, 其中 2 个 skill 被移除, 1 个不在 develop 中
- **THEN** 输出:
  ```
  Removed 2 skills from group 'openspec' in 'develop':
    · commit (removed)
    · review (removed)
    · archive (not in develop, skipped)
  ```

### Requirement: group remove 单 skill 行为不变
单 skill 标识符的 `group remove` SHALL 保持现有行为不变.

#### Scenario: 单 skill 移除
- **WHEN** 用户执行 `skillsmgr group remove develop commit`
- **THEN** 解析 `commit` 为 skill key, 从 `develop` 中移除, 输出 "Removed 'official/anthropic/skills/commit' from group 'develop'."

#### Scenario: 标识符歧义时 prompt 选择
- **WHEN** 标识符 `openspec` 同时匹配一个 skill name 和一个 group name
- **THEN** 弹出 prompt 让用户选择是按 skill 还是按 group 操作
