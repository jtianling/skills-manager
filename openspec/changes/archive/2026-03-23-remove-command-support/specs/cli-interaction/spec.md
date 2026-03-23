## MODIFIED Requirements

### Requirement: Command descriptions

所有 CLI 命令的 description SHALL 只提及 skills.

| 命令 | 新 description |
|------|---------------|
| install | "Download skills from a repository" |
| update | "Update installed skills to latest version" |
| list | "List available or deployed skills" |
| init | "Deploy skills to current project" |
| add | "Add a skill to the project" |
| remove | "Remove a skill from the project" |
| sync | "Sync and verify deployed skills" |

#### Scenario: CLI help shows skills-only descriptions
- **WHEN** 用户执行 `skillsmgr --help`
- **THEN** 所有命令描述只提及 skills, 不提及 commands

### Requirement: List output format

`list` 和 `list --deployed` SHALL 只显示 skills.

Available 模式输出:
```
Available in ~/.skills-manager/:

── official/anthropic (5 skills) ──
  code-review
  tdd
```

Deployed 模式输出:
```
Deployed in current project:

Claude Code skills (.claude/skills/):
  ◉ code-review      (link) ← official/anthropic
```

#### Scenario: list available shows only skills
- **WHEN** 执行 `list`
- **THEN** 只显示 skill 分组, 不显示 command 分组

#### Scenario: list deployed shows only skills
- **WHEN** 执行 `list --deployed`
- **THEN** 只显示各工具的 skill 部署状态, 不显示 commands 部分

#### Scenario: list empty state
- **WHEN** 没有可用 skill
- **THEN** 输出 "No skills found in ~/.skills-manager/"

#### Scenario: list deployed empty state
- **WHEN** 没有已部署 skill
- **THEN** 输出 "No skills deployed in current project."

### Requirement: Init output format

`init` 完成后的输出 SHALL 只统计 skills.

```
Done! Deployed 3 skills to 2 tools.
```

#### Scenario: init completion message
- **WHEN** init 部署完成
- **THEN** 输出 "Done! Deployed N skills to M tools.", 不再有 "and K commands" 部分

### Requirement: Error messages

所有错误消息 SHALL 只提及 skills.

#### Scenario: no content found error
- **WHEN** 安装的仓库中没有 skill
- **THEN** 错误消息为 "No skills found in repository", 不提及 commands

#### Scenario: no deployment found error
- **WHEN** 项目中没有已部署 skill
- **THEN** 消息为 "No skills deployed in current project."

#### Scenario: not found error
- **WHEN** add/remove 时找不到 name
- **THEN** 消息为 "'name' not found" 或类似, 不提及 "skill or command"

### Requirement: Precondition messages

前置条件检查消息 SHALL 只提及 skills.

#### Scenario: no available skills message
- **WHEN** init 时没有可用 skill
- **THEN** 输出 "No skills found. Run: skillsmgr install anthropic"

## REMOVED Requirements

### Requirement: promptCommands interactive prompt
**Reason**: 不再需要 command 选择提示
**Migration**: 无

### Requirement: Command display in list output
**Reason**: 不再显示 command 信息
**Migration**: 无

### Requirement: Command display in init output
**Reason**: init 不再处理 command
**Migration**: 无
