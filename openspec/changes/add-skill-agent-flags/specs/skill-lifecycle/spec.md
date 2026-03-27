## MODIFIED Requirements

### Requirement: Skill addition via add

`add` 命令 SHALL 只查找和部署 skill, 不再 fallback 到 command.

#### Scenario: add only searches skills
- **WHEN** 用户执行 `add <name>`
- **THEN** 只在 SkillsService 中查找匹配, 不查找 CommandsService

#### Scenario: add name not found
- **WHEN** name 不匹配任何可用 skill
- **THEN** 输出 "'name' not found" 并 exit(1)

### Requirement: remove 命令从必填参数改为可选

remove 命令的 positional arg SHALL 从 `<name>` (必填) 改为 `[name]` (可选). 支持通过 `-s/--skill` 指定多个 skill, 也支持 `-a/--agent` 指定目标 agent.

#### Scenario: remove 使用 positional arg (向后兼容)
- **WHEN** 用户执行 `remove my-skill`
- **THEN** 移除 `my-skill`, 行为不变

#### Scenario: remove 使用 --skill 批量移除
- **WHEN** 用户执行 `remove -s skill1 -s skill2`
- **THEN** 移除 `skill1` 和 `skill2`

#### Scenario: remove 混合使用 positional 和 --skill
- **WHEN** 用户执行 `remove my-skill -s other-skill`
- **THEN** 移除 `my-skill` 和 `other-skill`

#### Scenario: remove 指定 --agent
- **WHEN** 用户执行 `remove my-skill -a claude-code`
- **THEN** 仅从 claude-code 移除 `my-skill`

#### Scenario: remove 无任何参数
- **WHEN** 用户执行 `remove` (无 positional arg, 无 --skill)
- **THEN** 输出错误提示并 exit(1)

#### Scenario: remove name not found
- **WHEN** name 不匹配任何已部署 skill
- **THEN** 输出 "'name' not found in deployed skills"
