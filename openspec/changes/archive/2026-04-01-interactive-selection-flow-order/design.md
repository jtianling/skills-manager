## Context

当前 `add` 和 `remove` 命令的交互流程为 skill 选择 → agent 选择.  用户希望反转为 agent 选择 → skill 选择, 理由是先确定部署目标再选内容更符合操作直觉.  同时需要增强 `-y` 标志, 使其能智能推断缺失的参数.

当前实现:
- `add.ts#handleRepoSkillSelection()`: 先调用 `promptSkillsFromRepo()`, 再调用 `resolveTargetAgents()`
- `remove.ts#removeByOwnerRepo()`: 先进行 skill 选择, 再(仅 `-g` 模式)进行 agent 选择
- `-y` 仅等价于 `--all`, 无 agent 推断能力

## Goals / Non-Goals

**Goals:**
- 反转 add/remove 的交互顺序为: agent 选择 → skill 选择
- 已通过标志确定的选择自动跳过对应交互步骤
- `-y` 智能补全: 省略 `-a` 时等效 `--same-agents`, 省略 `--all` 时等效 `--all`
- 保持命令对称性: add 和 remove 遵循相同的交互顺序逻辑

**Non-Goals:**
- 不修改 `install`/`uninstall` 命令的交互流程(它们不涉及 agent 选择)
- 不修改 `deploy` 命令的交互流程
- 不改变 `-a`/`--same-agents`/`-s`/`--all` 各标志本身的语义

## Decisions

### Decision 1: `-y` 标志在交互前展开

`-y` 在进入任何交互流程之前, 展开为等效标志:
- 若未指定 `-a` 且未指定 `--same-agents` → 设置 `options.sameAgents = true`
- 若未指定 `--all` 且未指定 `-s` → 设置 `options.all = true`

**理由**: 早期展开使后续流程无需感知 `-y` 的存在, 复用已有的 `--same-agents` 和 `--all` 处理逻辑.

**替代方案**: 在各交互点分别判断 `-y` — 增加分支复杂度, 容易遗漏.

### Decision 2: 统一交互流程函数

提取通用的交互决策逻辑, add 和 remove 共用:

```
resolveInteractiveFlow(options) → { agents, needSkillPrompt }
  1. 展开 -y
  2. 解析 agents (resolveTargetAgents)
  3. 判断是否需要 skill 交互
```

**理由**: 避免 add/remove 各自维护一套跳过逻辑, 保持命令对称性.

**替代方案**: 各命令内联处理 — 容易导致不对称行为.

### Decision 3: 交互顺序反转点

修改点集中在:
- `add.ts#handleRepoSkillSelection()`: 先调用 `resolveTargetAgents()`, 再调用 `promptSkillsFromRepo()`
- `add.ts#handleSkillName()`: 已经是先确定 skill 再选 agent, 无需改动(skill name 已确定, 只需 agent 选择)
- `remove.ts#removeByOwnerRepo()`: 先调用 agent 解析, 再进行 skill 选择
- `add.ts#handleRemoteInstallAndDeploy()`: 先解析 agent, 再选 skill

### Decision 4: add 命令新增 `--all` 和 `-y` 选项

当前 `add` 命令已支持 `--all` (内部使用), 需在 Commander.js 选项声明中显式添加 `--all` 和 `-y, --yes`.  `remove` 命令同理需要检查 `-y` 支持.

## Risks / Trade-offs

- [用户习惯变更] 已习惯先选 skill 再选 agent 的用户可能需要适应 → 交互提示文字不变, 仅顺序调整, 适应成本低
- [-y 展开的隐式行为] `-y` 隐式设置 `--same-agents` 可能在无已配置 agent 的项目中报错 → 与显式 `--same-agents` 行为一致, 报错信息明确
- [命令对称性] remove 命令在非 `-g` 模式下原本不需要 agent 选择 → 保持现有行为, 仅在需要 agent 选择时才应用新顺序
