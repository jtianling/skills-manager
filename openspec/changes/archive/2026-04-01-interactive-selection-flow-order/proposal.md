## Why

当前 `add` 和 `remove` 命令的交互式界面顺序是先选 skill 再选 agent, 但更自然的操作顺序是先确定 "部署到哪里" (agent) 再选 "部署什么" (skill).  同时, `-y` 标志目前仅等价于 `--all`, 缺少智能推断能力, 无法根据已指定参数自动补全缺失的选择.

## What Changes

- **交互顺序反转**: `add`/`remove` 命令默认交互流程从 "skill → agent" 改为 "agent → skill"
- **智能跳过逻辑**: 已通过标志确定的选择自动跳过对应交互:
  - 指定 `-a`/`--same-agents` → 跳过 agent 选择, 直接进入 skill 选择
  - 指定 `-s skill`(精确 skill) → 跳过 skill 选择, 直接进入 agent 选择
  - 同时指定 agent 和 skill → 完全跳过交互, 直接操作
  - 指定 `-a`/`--same-agents` + `--all` → 完全跳过交互, 直接操作
- **`-y` 标志增强**: `-y` 智能补全缺失参数:
  - 省略 `-a` 时: `-y` 等效于 `--same-agents`
  - 省略 `--all` 时(对单个 owner/repo): `-y` 等效于 `--all`
  - 两者都省略时: `-y` 同时等效于 `--same-agents` + `--all`

## Capabilities

### New Capabilities
- `interactive-flow-order`: 交互式选择的启动顺序与智能跳过逻辑, 定义 agent/skill 交互的先后顺序及 `-y` 标志的智能推断规则

### Modified Capabilities
- `cli-interaction`: add/remove 命令新增 `-y, --yes` 选项声明, `--all` 选项(add 命令)
- `smart-add`: add 命令交互流程顺序变更, `-y` 标志语义扩展
- `skill-agent-flags`: `-y` 标志与 `-a`/`--same-agents`/`--all` 的交互规则

## Impact

- `src/commands/add.ts`: `handleRepoSkillSelection()` 等函数重构交互顺序, 新增 `-y` 逻辑
- `src/commands/remove.ts`: `removeByOwnerRepo()` 等函数同步交互顺序变更
- `src/commands/remove-owner-repo.ts`: 如存在, 同步变更
- `src/utils/prompts.ts`: `resolveTargetAgents()` 可能需要调整调用时机
- 测试文件: `add.test.ts`, `remove-owner-repo.test.ts`, `prompts.test.ts` 需更新
