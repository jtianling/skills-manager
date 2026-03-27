## MODIFIED Requirements

### Requirement: Command alias for install
The `install` command SHALL have alias `i`.

| 命令 | 别名 | 参数 | 选项 | 说明 |
|------|------|------|------|------|
| install | i | \<source\> (必填) | --all, --custom, -f/--force, -g/--group, -s/--skill, -a/--agent | Install skills from a repository |
| uninstall | - | [identifier] (可选) | -f/--force, -s/--skill | Remove skills from ~/.skills-manager/ |
| add | - | [arg] (可选) | --copy, -a/--agent, --same-agents, -s/--skill, -g/--group | Add a skill to the project |
| remove | - | [name] (可选) | -s/--skill, -a/--agent | Remove a skill from the project |

#### Scenario: CLI help shows install options including --skill and --agent
- **WHEN** 用户执行 `skillsmgr install --help`
- **THEN** 输出包含 `-s, --skill <name>` 和 `-a, --agent <name>` 选项

#### Scenario: CLI help shows add options with -s as --skill
- **WHEN** 用户执行 `skillsmgr add --help`
- **THEN** `-s` 对应 `--skill`, 不再对应 `--same-agents`
- **AND** `--same-agents` 无短参数

#### Scenario: CLI help shows remove with optional name
- **WHEN** 用户执行 `skillsmgr remove --help`
- **THEN** name 参数显示为 `[name]` (可选), 而非 `<name>` (必填)
- **AND** 输出包含 `-s, --skill <name>` 和 `-a, --agent <name>` 选项

#### Scenario: CLI help shows uninstall with --skill
- **WHEN** 用户执行 `skillsmgr uninstall --help`
- **THEN** 输出包含 `-s, --skill <name>` 选项
- **AND** 不包含 `-a, --agent` 选项

#### Scenario: add 命令接受 --agent 选项
- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code`
- **THEN** `-a` 接受单个 agent 名称 (不再是逗号分隔)
