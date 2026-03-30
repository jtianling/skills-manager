## Why

`uninstall` 带参数时 (如 `uninstall owner/repo`) 直接批量删除所有 skills, 不给用户选择机会.  而 `install owner/repo` 默认弹出交互式 checkbox 让用户选择.  两个命令对同一参数的交互模式不对称.  同时 `uninstall anthropic` 作为 provider shorthand 已无意义 (install 已移除该路径), 裸词应统一视为 skill name.

## What Changes

- `uninstall owner/repo` 默认进入交互式 checkbox, 展示该 source 下的 skills 让用户选择卸载哪些
- 新增 `--all` 参数: 跳过交互直接批量删除 (恢复原行为)
- **BREAKING**: 移除 `OFFICIAL_OWNERS` provider 分支, 裸词统一走 `uninstallByName()`
- 当 scope 内只有一个 skill 时, 跳过 checkbox 直接走确认流程

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `interactive-uninstall`: 扩展交互模式 — `uninstall owner/repo` 默认进入 scoped 交互选择, 新增 `--all` 跳过交互
- `cli-interaction`: 命令选项变更 — uninstall 新增 `--all` 参数

## Impact

- `src/commands/uninstall.ts`: 重构 `uninstallProvider()` 和 `uninstallCommunitySource()` 为统一的 scoped 交互流程, 移除 `OFFICIAL_OWNERS` 分支
- CLI 接口: `uninstall anthropic` 不再按 provider 整删, 而是按 skill name 查找
- 向后兼容: 使用 `--all` 可恢复原批量删除行为
