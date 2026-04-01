## MODIFIED Requirements

### Requirement: CLI help shows add options with -s as --skill

`add` 命令 SHALL 支持以下选项:
- `--copy`: 复制模式部署
- `-a, --agent <name>`: 指定目标 agent (可重复)
- `--same-agents`: 使用已配置 agents
- `-s, --skill <name>`: 指定 skill (可重复)
- `-g, --group <name>`: 按组批量部署
- `--all`: 选择所有 skills, 跳过 skill 交互
- `-y, --yes`: 智能推断缺失参数, 尽可能跳过交互

#### Scenario: CLI help shows add options with -s as --skill
- **WHEN** 用户执行 `skillsmgr add --help`
- **THEN** `-s` 对应 `--skill`, 不再对应 `--same-agents`
- **AND** `--same-agents` 无短参数
- **AND** 输出包含 `--all` 选项
- **AND** 输出包含 `-y, --yes` 选项

### Requirement: CLI help shows remove with optional name

`remove` 命令 SHALL 支持以下选项:
- `-s, --skill <name>`: 指定 skill (可重复)
- `-a, --agent <name>`: 指定 agent (可重复)
- `--all`: 选择所有 skills, 跳过 skill 交互
- `-y, --yes`: 智能推断缺失参数, 尽可能跳过交互

#### Scenario: CLI help shows remove with optional name
- **WHEN** 用户执行 `skillsmgr remove --help`
- **THEN** name 参数显示为 `[name]` (可选), 而非 `<name>` (必填)
- **AND** 输出包含 `-s, --skill <name>` 和 `-a, --agent <name>` 选项
- **AND** 输出包含 `--all` 选项
- **AND** 输出包含 `-y, --yes` 选项
