# Interactive Flow Order

add/remove 命令的交互流程顺序定义: agent 选择先于 skill 选择, 以及 `-y/--yes` 智能推断标志.

## Requirements

### Requirement: 交互顺序为 agent 先于 skill

`add` 和 `remove` 命令的默认交互流程 SHALL 为先启动 agent 选择, 再进入 skill 选择.  当某一选择已通过标志确定时, 跳过对应交互步骤.

#### Scenario: 默认交互顺序 -- 先 agent 后 skill
- **WHEN** 用户执行 `skillsmgr add owner/repo` (无 `-a`, 无 `-s`, 无 `--all`)
- **THEN** 先显示 "Select target agents:" 交互界面
- **AND** 用户选择 agent 后, 再显示 skill 选择交互界面

#### Scenario: 指定 -a 跳过 agent 选择, 直接进入 skill 选择
- **WHEN** 用户执行 `skillsmgr add owner/repo -a claude-code`
- **THEN** 跳过 agent 选择, 直接显示 skill 选择交互界面

#### Scenario: 指定 --same-agents 跳过 agent 选择, 直接进入 skill 选择
- **WHEN** 用户执行 `skillsmgr add owner/repo --same-agents`
- **THEN** 跳过 agent 选择, 直接显示 skill 选择交互界面

#### Scenario: 指定 -s 跳过 skill 选择, 直接进入 agent 选择
- **WHEN** 用户执行 `skillsmgr add owner/repo -s my-skill`
- **THEN** 跳过 skill 选择, 直接显示 agent 选择交互界面

#### Scenario: 指定 --all 跳过 skill 选择, 直接进入 agent 选择
- **WHEN** 用户执行 `skillsmgr add owner/repo --all`
- **THEN** 跳过 skill 选择, 直接显示 agent 选择交互界面

#### Scenario: 同时指定 agent 和 skill 无交互
- **WHEN** 用户执行 `skillsmgr add owner/repo -a claude-code -s my-skill`
- **THEN** 完全跳过所有交互, 直接执行部署操作

#### Scenario: -a 加 --all 无交互
- **WHEN** 用户执行 `skillsmgr add owner/repo -a claude-code --all`
- **THEN** 完全跳过所有交互, 直接执行部署操作

#### Scenario: --same-agents 加 --all 无交互
- **WHEN** 用户执行 `skillsmgr add owner/repo --same-agents --all`
- **THEN** 完全跳过所有交互, 直接执行部署操作

#### Scenario: --same-agents 加 -s 无交互
- **WHEN** 用户执行 `skillsmgr add owner/repo --same-agents -s my-skill`
- **THEN** 完全跳过所有交互, 直接执行部署操作

### Requirement: remove 命令遵循相同交互顺序

`remove` 命令 SHALL 遵循与 `add` 相同的交互顺序规则: 先 agent 选择, 再 skill 选择.

#### Scenario: remove 默认交互顺序 -- 先 agent 后 skill
- **WHEN** 用户执行 `skillsmgr remove owner/repo` (无 `-a`, 无 `-s`, 无 `--all`)
- **THEN** 先显示 agent 选择交互界面, 再显示 skill 选择交互界面

#### Scenario: remove 指定 -a 跳过 agent 选择
- **WHEN** 用户执行 `skillsmgr remove owner/repo -a claude-code`
- **THEN** 跳过 agent 选择, 直接显示 skill 选择交互界面

#### Scenario: remove 指定 -s 跳过 skill 选择
- **WHEN** 用户执行 `skillsmgr remove owner/repo -s my-skill`
- **THEN** 跳过 skill 选择, 直接显示 agent 选择交互界面

#### Scenario: remove 同时指定 agent 和 skill 无交互
- **WHEN** 用户执行 `skillsmgr remove owner/repo -a claude-code -s my-skill`
- **THEN** 完全跳过所有交互, 直接执行移除操作

### Requirement: -y 标志智能推断

`-y`/`--yes` 标志 SHALL 智能推断缺失的参数, 尽可能跳过交互:
- 用户未指定 `-a` 且未指定 `--same-agents` 时, `-y` 等效 `--same-agents`
- 用户未指定 `--all` 且未指定 `-s` 时, `-y` 对单个 owner/repo 等效 `--all`
- 两者可同时生效

#### Scenario: -y 省略 -a 等效 --same-agents
- **WHEN** 用户执行 `skillsmgr add owner/repo --all -y`
- **AND** 项目已配置 agents
- **THEN** `-y` 推断为 `--same-agents`, 跳过 agent 选择, 使用已配置 agents

#### Scenario: -y 省略 --all 等效 --all
- **WHEN** 用户执行 `skillsmgr add owner/repo -a claude-code -y`
- **THEN** `-y` 推断为 `--all`, 跳过 skill 选择, 选择所有 skills

#### Scenario: -y 同时省略 -a 和 --all
- **WHEN** 用户执行 `skillsmgr add owner/repo -y`
- **AND** 项目已配置 agents
- **THEN** `-y` 同时推断为 `--same-agents` + `--all`, 完全跳过交互

#### Scenario: -y 已有 -a 不覆盖
- **WHEN** 用户执行 `skillsmgr add owner/repo -a claude-code -y`
- **THEN** `-y` 不影响 agent 选择(已由 `-a` 确定), 仅推断 `--all`

#### Scenario: -y 已有 --same-agents 不覆盖
- **WHEN** 用户执行 `skillsmgr add owner/repo --same-agents -y`
- **THEN** `-y` 不影响 agent 选择(已由 `--same-agents` 确定), 仅推断 `--all`

#### Scenario: -y 已有 -s 不覆盖
- **WHEN** 用户执行 `skillsmgr add owner/repo -s my-skill -y`
- **THEN** `-y` 不影响 skill 选择(已由 `-s` 确定), 仅推断 `--same-agents`

#### Scenario: -y 已有 --all 不覆盖
- **WHEN** 用户执行 `skillsmgr add owner/repo --all -y`
- **THEN** `-y` 不影响 skill 选择(已由 `--all` 确定), 仅推断 `--same-agents`

#### Scenario: -y 无已配置 agents 时报错
- **WHEN** 用户执行 `skillsmgr add owner/repo -y`
- **AND** 项目无已配置 agents
- **THEN** 输出与 `--same-agents` 相同的错误信息
- **AND** 以退出码 1 退出

#### Scenario: remove -y 同样智能推断
- **WHEN** 用户执行 `skillsmgr remove owner/repo -y`
- **AND** 项目已配置 agents
- **THEN** `-y` 推断为 `--same-agents` + `--all`, 完全跳过交互
