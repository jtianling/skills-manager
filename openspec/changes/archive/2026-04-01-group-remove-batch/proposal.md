## Why

`group add` 支持按 group name, owner/repo, skill name 三种标识符批量添加 skill, 但 `group remove` 只支持单个 skill 移除.  用户无法执行 `group remove develop openspec` 或 `group remove develop obra/superpowers` 这样的批量操作, 与 `group add` 不对等.

## What Changes

- `executeGroupRemove` 复用 `resolveGroupAddIdentifier` 解析标识符, 支持三种类型:
  - `skill`: 单个 skill 移除 (现有行为)
  - `group`: 批量移除 — 从目标 group 中移除所有同时存在于源 group 的 skill
  - `repo` (owner/repo): 批量移除 — 从目标 group 中移除该 repo 下所有 skill
- 批量移除输出格式与 `group add` 的 batch 输出对称

## Capabilities

### New Capabilities

- `group-remove-batch`: `group remove` 支持 group name 和 owner/repo 批量标识符, 与 `group add` 对等

### Modified Capabilities

- `virtual-group`: `group remove` 子命令从单 skill 移除扩展为支持批量标识符

## Impact

- `src/commands/group.ts`: `executeGroupRemove` 重写, 复用 `resolveGroupAddIdentifier`
- `src/commands/group.test.ts`: 新增批量移除测试
