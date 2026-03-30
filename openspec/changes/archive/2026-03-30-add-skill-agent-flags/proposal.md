## Why

install, uninstall, add, remove 四个命令缺少精确指定 skill 和 agent 的能力, 用户每次操作都必须经过交互式选择界面. 对于已知目标的场景 (脚本化, 批量操作, 重复操作), 交互界面是不必要的阻碍. 需要添加 `-s/--skill` 和 `-a/--agent` 可重复参数, 让用户能精确指定操作目标, 并在信息充足时完全跳过交互.

## What Changes

- 所有四个命令 (install, uninstall, add, remove) 新增 `-s, --skill <name>` 可重复参数, 用于精确指定 skill
- install, add, remove 三个命令新增 `-a, --agent <name>` 可重复参数, 用于精确指定 agent (uninstall 操作中央仓库, 不涉及 agent)
- `-a` 参数从逗号分隔 (`-a claude-code,opencode`) 改为可重复 (`-a claude-code -a opencode`), **BREAKING**
- add 命令的 `-s` 短参数从 `--same-agents` 转移给 `--skill`, `--same-agents` 不再有短参数, **BREAKING**
- 当 `-s` 和 `-a` 都提供时, 跳过所有交互选择, 直接执行操作
- remove 命令保留 positional arg `[name]` 兼容, 同时支持 `-s` 追加更多 skill

## Capabilities

### New Capabilities

- `skill-agent-flags`: 为 install, uninstall, add, remove 命令添加 `-s/--skill` 和 `-a/--agent` 可重复参数, 实现精确指定操作目标和跳过交互选择

### Modified Capabilities

- `cli-interaction`: 命令选项表变更 — add 的 `-s` 短参数重新分配, `-a` 语法从逗号分隔改为可重复
- `smart-add`: agent 选择逻辑变更 — `-a` 从逗号分隔改为可重复, 新增 `--skill` 参数跳过 skill 选择
- `skill-lifecycle`: remove 命令从 `<name>` 必填参数改为 `[name]` 可选, 支持 `-s` 批量移除和 `-a` 指定 agent

## Impact

- **命令行接口**: 4 个命令的选项定义变更 (Commander.js `.option()` 调用)
- **参数解析**: add 命令的 `-a` 解析从 `string.split(',')` 改为 Commander collector 模式返回 `string[]`
- **交互流程**: `selectSkills()`, `resolveTargetAgents()` 等函数需要接受预选值并在有值时跳过交互
- **向后兼容**: `-a` 逗号分隔写法不再支持, `-s` 短参数含义变更 (从 same-agents 到 skill)
