## ADDED Requirements

### Requirement: -y/--yes 智能推断标志

`add` 和 `remove` 命令 SHALL 支持 `-y, --yes` 标志.  `-y` 在进入交互流程之前展开为等效标志:
- 若未指定 `-a` 且未指定 `--same-agents`: 设置 `sameAgents = true`
- 若未指定 `--all` 且未指定 `-s`: 设置 `all = true`
- 两条规则独立判断, 可同时生效

#### Scenario: -y 展开为 --same-agents + --all
- **WHEN** 用户执行 `skillsmgr add owner/repo -y`
- **AND** 项目已配置 agents
- **THEN** 等效于 `skillsmgr add owner/repo --same-agents --all`
- **AND** 无任何交互

#### Scenario: -y 不覆盖已指定的 -a
- **WHEN** 用户执行 `skillsmgr add owner/repo -a claude-code -y`
- **THEN** agent 使用 `-a` 指定的 claude-code
- **AND** skill 选择等效 `--all`
- **AND** 无任何交互

#### Scenario: -y 不覆盖已指定的 -s
- **WHEN** 用户执行 `skillsmgr add owner/repo -s my-skill -y`
- **AND** 项目已配置 agents
- **THEN** skill 使用 `-s` 指定的 my-skill
- **AND** agent 选择等效 `--same-agents`
- **AND** 无任何交互

#### Scenario: -y 不覆盖已指定的 --all
- **WHEN** 用户执行 `skillsmgr add owner/repo --all -y`
- **AND** 项目已配置 agents
- **THEN** `--all` 已确定 skill 选择
- **AND** `-y` 仅推断 `--same-agents`
- **AND** 无任何交互

## MODIFIED Requirements

### Requirement: --skill 和 --agent 组合跳过所有交互

当 `-s` 和 `-a` 都提供时, 命令 SHALL 完全跳过交互选择, 直接执行操作.  同理, `--all` + `-a`, `-s` + `--same-agents`, `--all` + `--same-agents` 等组合也 SHALL 完全跳过交互.

#### Scenario: add 完全非交互
- **WHEN** 用户执行 `skillsmgr add owner/repo -s skill1 -s skill2 -a claude-code`
- **THEN** 从 owner/repo 部署 skill1 和 skill2 到 claude-code, 无任何交互提示

#### Scenario: remove 完全非交互
- **WHEN** 用户执行 `skillsmgr remove owner/repo -s skill1 -a claude-code`
- **THEN** 从 claude-code 移除 skill1, 无任何交互提示

#### Scenario: --all 加 -a 完全非交互
- **WHEN** 用户执行 `skillsmgr add owner/repo --all -a claude-code`
- **THEN** 部署所有 skills 到 claude-code, 无任何交互提示

#### Scenario: -s 加 --same-agents 完全非交互
- **WHEN** 用户执行 `skillsmgr add owner/repo -s skill1 --same-agents`
- **AND** 项目已配置 agents
- **THEN** 部署 skill1 到已配置 agents, 无任何交互提示

### Requirement: 仅 --skill 时只跳过 skill 选择

当只提供 `-s` 不提供 `-a`/`--same-agents` 时, 跳过 skill 选择但仍交互选择 agent.

#### Scenario: add 有 skill 无 agent 进入 agent 选择
- **WHEN** 用户执行 `skillsmgr add owner/repo -s frontend-design`
- **THEN** 跳过 skill 选择, 直接进入 agent 选择交互

### Requirement: 仅 --agent 时只跳过 agent 选择

当只提供 `-a`/`--same-agents` 不提供 `-s`/`--all` 时, 跳过 agent 选择但仍交互选择 skill.

#### Scenario: add 有 agent 无 skill
- **WHEN** 用户执行 `skillsmgr add owner/repo -a claude-code`
- **THEN** 跳过 agent 选择, 直接进入 skill 选择交互
