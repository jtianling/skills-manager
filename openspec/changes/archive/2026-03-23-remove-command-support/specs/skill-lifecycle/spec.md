## MODIFIED Requirements

### Requirement: Skill deployment via init

将 skill 从 `~/.skills-manager/` 部署到项目的工具目录.

`init` 命令 SHALL 只处理 skill 部署, 不再提示或部署 command.

增量部署分四类处理:
- `toRemove`: 之前部署过, 不在新选择中, 且 `source !== 'unknown'` 的 → `deployer.removeSkill()`
- `toKeep`: 之前部署过且仍在新选择中的 → 不做任何操作
- `toAdd`: 新选择中新增的 → `deployer.deploySkill()`
- `unmanaged`: `source === 'unknown'` 的 → 不做任何操作, 输出 `~ name (unmanaged)` 标记

#### Scenario: init no longer prompts for commands
- **WHEN** 用户执行 `init` 命令
- **THEN** 只显示工具选择和 skill 选择, 不显示 command 选择提示

#### Scenario: init deploys only skills
- **WHEN** 用户在 init 中选择了 skills 和工具
- **THEN** 只有 skill 被部署到工具目录, 不部署 command

### Requirement: Skill removal via remove

`remove` 命令 SHALL 只在 skills 中查找和移除目标, 不再检查 commands.

#### Scenario: remove only checks skills
- **WHEN** 用户执行 `remove <name>`
- **THEN** 只在已部署 skills 中查找匹配项, 不检查 commands 目录

#### Scenario: remove name not found
- **WHEN** name 不匹配任何已部署 skill
- **THEN** 输出 "'name' not found in any configured tool"

### Requirement: Skill addition via add

`add` 命令 SHALL 只查找和部署 skill, 不再 fallback 到 command.

#### Scenario: add only searches skills
- **WHEN** 用户执行 `add <name>`
- **THEN** 只在 SkillsService 中查找匹配, 不查找 CommandsService

#### Scenario: add name not found
- **WHEN** name 不匹配任何可用 skill
- **THEN** 输出 "'name' not found" 并 exit(1)

### Requirement: Skill sync verification

`sync` 命令 SHALL 只检查已部署的 skills, 不再检查 commands.

#### Scenario: sync only verifies skills
- **WHEN** 用户执行 `sync` 命令
- **THEN** 只扫描和验证 skill 部署状态, 不扫描 commands 目录

### Requirement: Skill update from remote

`update` 命令 SHALL 只更新 skills, 不再更新 commands.  SHALL 保留对 `commands` 目录名的跳过逻辑以防残留目录误识别.

#### Scenario: update only updates skills
- **WHEN** 用户执行 `update` 命令
- **THEN** 只比较和更新本地已安装的 skill, 不处理 commands

#### Scenario: update skips residual commands directory
- **WHEN** `~/.skills-manager/official/anthropic/` 下存在残留的 `commands/` 目录
- **THEN** 该目录被跳过, 不报错

### Requirement: Preconditions

所有需要 skill 的命令 SHALL 检查可用 skill 而非 "skill 或 command".

#### Scenario: init precondition check
- **WHEN** 无可用 skill 时执行 `init`
- **THEN** 输出 "No skills found. Run: skillsmgr install anthropic" 并 exit(1)

#### Scenario: add precondition check
- **WHEN** name 不匹配任何 skill 时执行 `add`
- **THEN** 输出 "'name' not found" 并 exit(1)
