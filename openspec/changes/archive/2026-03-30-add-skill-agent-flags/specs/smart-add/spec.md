## MODIFIED Requirements

### Requirement: -a/--agent 标志指定 agent

`-a`/`--agent` 标志 SHALL 接受可重复的 agent 名称, 跳过交互选择. 不再使用逗号分隔.

#### Scenario: 单个 agent
- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code`
- **THEN** 跳过 agent 选择, 部署到 claude-code

#### Scenario: 多个 agent
- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code -a cursor`
- **THEN** 跳过 agent 选择, 部署到 claude-code 和 cursor

#### Scenario: 无效 agent 名称
- **WHEN** 用户执行 `skillsmgr add code-review -a invalid-name`
- **THEN** 输出 `Unknown agent: 'invalid-name'. Available agents: claude-code, codex, ...`
- **AND** 以退出码 1 退出

### Requirement: -s/--same-agents 标志复用已配置 agent

`--same-agents` 标志 SHALL 使用项目已配置的 agents, 跳过交互选择. 不再有 `-s` 短参数.

#### Scenario: 项目有已配置 agent
- **WHEN** 用户执行 `skillsmgr add code-review --same-agents`
- **THEN** 跳过 agent 选择, 部署到已配置的 agents

#### Scenario: 项目无已配置 agent
- **WHEN** 用户执行 `skillsmgr add code-review --same-agents`
- **AND** 项目无已配置 agent
- **THEN** 输出 `No agents configured. Run 'skillsmgr init' or omit --same-agents flag.`
- **AND** 以退出码 1 退出

### Requirement: -a 和 --same-agents 互斥

`-a` 和 `--same-agents` 不可同时使用.

#### Scenario: 同时指定 -a 和 --same-agents
- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code --same-agents`
- **THEN** 输出 `Cannot use --agent and --same-agents together.`
- **AND** 以退出码 1 退出

## ADDED Requirements

### Requirement: --skill 参数跳过 skill 选择

add 命令 SHALL 支持 `-s, --skill <name>` 可重复参数. 指定时跳过 skill 选择交互, 仅操作指定的 skill.

#### Scenario: add owner/repo 带 --skill
- **WHEN** 用户执行 `skillsmgr add owner/repo -s frontend-design`
- **AND** 中央仓库中 owner/repo 下存在 `frontend-design` skill
- **THEN** 跳过 skill 选择, 直接进入 agent 选择 (或跳过, 如果 -a 也指定了)

#### Scenario: add owner/repo 带 --skill 指定不存在的 skill
- **WHEN** 用户执行 `skillsmgr add owner/repo -s nonexistent`
- **AND** owner/repo 下不存在名为 `nonexistent` 的 skill
- **THEN** 输出 `Skill 'nonexistent' not found.`
- **AND** 以退出码 1 退出

#### Scenario: add skill-name 带 --skill 无意义但不报错
- **WHEN** 用户执行 `skillsmgr add code-review -s code-review`
- **THEN** 正常执行, `-s` 在 skill-name 流程中被忽略 (arg 本身已经指定了 skill)
