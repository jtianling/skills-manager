## Why

`skillsmgr uninstall owner/repo` 需要 `--all -f` 两个 flag 才能跳过交互直接卸载所有关联 skills.  `-y` 作为常见的 "yes to all" 快捷方式, 可以一步到位完成非交互式批量卸载.

## What Changes

- 为 `uninstall` 命令添加 `-y` flag, 语义等同于 `--all --force` (跳过选择提示 + 跳过确认提示)
- 当 `-y` 与 `owner/repo` 格式配合使用时, 直接卸载该 owner/repo 下所有已安装 skills
- 当 `-y` 与 skill name 配合使用时, 等同于 `-f` (跳过确认)
- `-y` 可与 `--all`, `-f` 自由组合, 不冲���

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `skill-lifecycle`: 新增 `-y` flag 作为 `--all --force` 的快捷方式

## Impact

- `src/commands/uninstall.ts`: 添加 `-y` option 定义, 在 `executeUninstall` 中将 `-y` 映射到 `options.all` 和 `options.force`
- 现有 `--all` 和 `-f` 行为不变, `-y` 是附加快捷方式
