## Why

`remove` 命令的交互列表是扁平的, 没有 group 分组, 也不支持 `--group` 批量操作.  用户按 group 安装 skill (`add --group`), 却无法按 group 移除, 操作不对称.  同时 `remove` 删除 skill 后不清理 `groups.json` 中的引用, 导致悬空引用.

## What Changes

- `remove` 命令新增 `--group <name>` flag, 从指定 group 中筛选已部署 skill 进行批量移除
- `remove` 交互列表按虚拟 group 分组显示 (可折叠, 可批量选中), 未入组 skill 归入 `(ungrouped)`
- 新增通用 helper `buildVirtualGroupChoices`, 将已部署 skill 按 `groups.json` 构建分组 choices, 可被 remove 及未来命令复用
- `remove` 完成删除后调用 `GroupsService.removeSkillFromAll()` 清理悬空引用, 与 `uninstall` 对齐

## Capabilities

### New Capabilities
- `remove-by-group`: remove 命令的 --group 批量移除和交互列表虚拟 group 分组显示
- `virtual-group-choices`: 通用的虚拟 group 分组 choices 构建 helper

### Modified Capabilities
- `virtual-group`: remove 删除 skill 后需调用 removeSkillFromAll 清理 group 引用

## Impact

- `src/commands/remove.ts`: 新增 --group flag, 交互列表改用分组显示, 删除后清理 group 引用
- `src/utils/prompts.ts`: 新增 `buildVirtualGroupChoices` 通用 helper
- `src/services/groups.ts`: 无代码改动, 仅新增调用点
- 测试: remove 单元测试和 e2e 测试需新增 group 相关场景
