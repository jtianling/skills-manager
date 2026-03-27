## Why

`skillsmgr uninstall` 目前必须提供参数 (provider 名, owner/repo, 或 skill 名), 不支持交互式批量卸载.  用户需要逐个执行命令才能卸载多个 skill, 体验不一致 — 其他命令 (如 `init`, `install`) 在无参数时都有交互模式.

## What Changes

- `uninstall` 命令的 `<identifier>` 参数从必选改为可选
- 无参数时进入交互模式: 展示已安装 skill 的分组列表 (复用 init 的 interactiveCheckbox UI 和分组逻辑), 用户多选后批量卸载
- 列表默认全部不勾选 (卸载是破坏性操作), 无 suffix 标记
- 中央仓库为空时提示退出

## Capabilities

### New Capabilities
- `interactive-uninstall`: uninstall 命令无参数时的交互式批量卸载功能, 包括分组列表展示、多选、确认和批量删除

### Modified Capabilities
- `cli-interaction`: 命令表中 uninstall 的参数从必选改为可选

## Impact

- `src/commands/uninstall.ts`: 参数改为可选, 新增 interactiveUninstall 函数
- `src/utils/prompts.ts`: 新增 promptSkillsToUninstall 函数
- 不影响已有的带参数卸载逻辑
