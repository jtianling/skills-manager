## MODIFIED Requirements

### Requirement: 命令结构

程序名: `skillsmgr`
框架: Commander.js

| 命令 | 别名 | 参数 | 选项 | 说明 |
|------|------|------|------|------|
| setup | - | - | - | 初始化 ~/.skills-manager/ |
| install | i | \<source\> (必填) | --all, --custom | Download skills from a repository |
| custom-install | ci | \<name\> (必填) | -f, --force | Install a local skill to custom directory |
| update | - | [source] (可选) | - | Update installed skills to latest version |
| list | - | - | --deployed | List available or deployed skills |
| init | - | - | --copy | Deploy skills to current project |
| add | - | [arg] (可选) | --copy, -a/--agent, -s/--same-agents | Add a skill to the project |
| remove | - | \<name\> (必填) | - | Remove a skill from the project |
| uninstall | - | [identifier] (可选) | -f, --force | Remove skills from ~/.skills-manager/ |
| sync | - | - | Sync and verify deployed skills |

变更点:
- `add` 命令的 `<name>` 参数从必填改为可选 `[arg]`
- `add` 命令新增 `-a`/`--agent` 和 `-s`/`--same-agents` 选项

#### Scenario: add 命令参数可选
- **WHEN** 用户执行 `skillsmgr add` (无参数)
- **THEN** 命令正常执行, 进入 init 流程

#### Scenario: add 命令接受 --agent 选项
- **WHEN** 用户执行 `skillsmgr add code-review --agent claude-code`
- **THEN** 使用 claude-code 作为目标 agent

#### Scenario: add 命令接受 -a 短标志
- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code`
- **THEN** 与 `--agent` 行为一致

#### Scenario: add 命令接受 --same-agents 选项
- **WHEN** 用户执行 `skillsmgr add code-review --same-agents`
- **THEN** 使用项目已配置的 agents

#### Scenario: add 命令接受 -s 短标志
- **WHEN** 用户执行 `skillsmgr add code-review -s`
- **THEN** 与 `--same-agents` 行为一致

### Requirement: 工具选择 (promptTools)

工具选择提示 SHALL 使用 "agents" 术语替代 "tools".

提示消息: "Select target agents:" (原 "Select target tools:")

行为不变:
- 使用 `interactiveCheckbox`
- 按 `SUPPORTED_TOOLS` 顺序显示
- 已配置的 agent 标记 "[configured]" 并默认选中
- 导航不循环

#### Scenario: 提示消息使用 agents 术语
- **WHEN** 用户进入 agent 选择
- **THEN** 提示消息为 "Select target agents:"

### Requirement: 前置条件检查

更新 add 命令的前置条件检查:

| 命令 | 条件 | 不满足时的行为 |
|------|------|---------------|
| add (无参数) | 同 init 的前置条件 | 同 init |
| add (skill name) | name 未找到 | exit(1), 提示 "Skill 'xxx' not found in central repository.\nUse 'skillsmgr add owner/repo' or a full URL to install from remote." |
| add (-a 指定无效 agent) | agent 名称不合法 | exit(1), 提示 "Unknown agent: 'xxx'. Available agents: ..." |
| add (-s 无已配置 agent) | 无已配置 agent | exit(1), 提示 "No agents configured. Run 'skillsmgr init' or omit -s flag." |
| add (-a 和 -s 同时使用) | 互斥 | exit(1), 提示 "Cannot use --agent and --same-agents together." |

#### Scenario: skill name 未找到提示改进
- **WHEN** `skillsmgr add xxx` 未找到 skill
- **THEN** 输出 "Skill 'xxx' not found in central repository.\nUse 'skillsmgr add owner/repo' or a full URL to install from remote."

#### Scenario: 无效 agent 名称报错
- **WHEN** `skillsmgr add code-review -a invalid`
- **THEN** 输出 "Unknown agent: 'invalid'. Available agents: claude-code, codex, ..."
- **AND** exit(1)
