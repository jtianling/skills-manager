## MODIFIED Requirements

### Requirement: 默认交互选择 agent

所有带参数的流程 (skill name / provider-repo / URL) SHALL 先进入 agent 选择, 再进入 skill 选择.  当 agent 已通过标志确定时跳过 agent 选择, 当 skill 已通过标志确定时跳过 skill 选择.

#### Scenario: 无 -a 无 -s 先 agent 后 skill
- **WHEN** 用户执行 `skillsmgr add owner/repo` (未指定 `-a`, `-s`, `--all`, `--same-agents`)
- **THEN** 先显示 agent 选择 UI
- **AND** 用户选择 agent 后, 再显示 skill 选择 UI

#### Scenario: 有 -a 跳过 agent 选择
- **WHEN** 用户执行 `skillsmgr add owner/repo -a claude-code`
- **THEN** 跳过 agent 选择, 直接显示 skill 选择 UI

#### Scenario: 有 -s 跳过 skill 选择
- **WHEN** 用户执行 `skillsmgr add owner/repo -s my-skill`
- **THEN** 跳过 skill 选择, 直接显示 agent 选择 UI

#### Scenario: -a 加 -s 完全跳过交互
- **WHEN** 用户执行 `skillsmgr add owner/repo -a claude-code -s my-skill`
- **THEN** 完全跳过交互, 直接部署
