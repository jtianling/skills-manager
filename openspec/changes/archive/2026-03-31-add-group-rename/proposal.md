## Why

虚拟 group 创建后无法改名, 用户只能 delete 再 create 并重新 add 所有 skill.  增加 `group rename` 命令解决这个问题.

## What Changes

- `GroupsService` 新增 `renameGroup(oldName, newName)` 方法, 将 groups.json 中的 key 重命名
- `group` 命令新增 `rename <old-name> <new-name>` 子命令
- 仅修改虚拟 group 名 (groups.json key), 不涉及物理目录或 skill key 变更

## Capabilities

### New Capabilities

(无新 capability, 此变更扩展已有 virtual-group)

### Modified Capabilities

- `virtual-group`: 新增 `renameGroup` 方法和 `group rename` 子命令

## Impact

- `src/services/groups.ts`: 新增 `renameGroup` 方法
- `src/commands/group.ts`: 新增 `rename` 子命令
- `src/services/groups.test.ts`: 新增测试
- `src/commands/group.test.ts`: 新增测试
