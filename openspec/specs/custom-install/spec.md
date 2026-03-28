# Custom Install

从当前工作目录安装本地 skill 到 `~/.skills-manager/custom/` 目录.

## Requirements

### Requirement: Install local skill to custom directory
The system SHALL provide a `custom-install` command that copies a skill directory from the current working directory into `~/.skills-manager/custom/<name>/`, or into `~/.skills-manager/custom/<group>/<name>/` when `--group` is specified.

#### Scenario: Successful install from CWD
- **WHEN** user runs `skillsmgr custom-install abc` and `./abc/SKILL.md` exists
- **THEN** the system copies the `./abc/` directory to `~/.skills-manager/custom/abc/` and outputs a success message

#### Scenario: Skill directory not found
- **WHEN** user runs `skillsmgr custom-install abc` and `./abc/` does not exist or `./abc/SKILL.md` does not exist
- **THEN** the system exits with code 1 and outputs an error message indicating the skill was not found in the current directory

#### Scenario: Install with --group option
- **WHEN** user runs `skillsmgr custom-install abc --group my-tools` and `./abc/SKILL.md` exists
- **THEN** the system copies `./abc/` to `~/.skills-manager/custom/my-tools/abc/` and outputs a success message

#### Scenario: Install with -g short option
- **WHEN** user runs `skillsmgr custom-install abc -g my-tools`
- **THEN** behavior is identical to `--group my-tools`

### Requirement: Overwrite confirmation for existing skill
install 命令 SHALL 使用 `findInstalledCustomSkill(skillName)` 检测 skill 是否已安装, 替代直接检查目标目录路径是否存在.  当 skill 已安装时提示 overwrite 确认.

#### Scenario: Existing skill with confirmation
- **WHEN** 用户执行 `skillsmgr install ./abc` 且 `findInstalledCustomSkill("abc")` 返回非 null
- **THEN** 系统使用查找到的路径作为 targetDir, 提示 "Skill 'abc' already exists. Overwrite?"

#### Scenario: User declines overwrite
- **WHEN** user declines the overwrite confirmation
- **THEN** the system outputs "Cancelled." and exits normally (code 0)

#### Scenario: Existing skill in group with confirmation
- **WHEN** user runs `skillsmgr custom-install abc --group my-tools` and `~/.skills-manager/custom/my-tools/abc/` already exists
- **THEN** the system prompts "Skill 'abc' already exists in group 'my-tools'. Overwrite?" and proceeds only if the user confirms

#### Scenario: 同名 skill 在不同 group 下已存在
- **WHEN** 用户执行 `skillsmgr install ./foo --group new-group`
- **WHEN** `findInstalledCustomSkill("foo")` 返回 `custom/old-group/foo`
- **THEN** 系统 SHALL 提示 "Skill 'foo' already installed at custom/old-group/foo. Remove it first or use a different name."
- **THEN** 系统 SHALL NOT 允许同名 skill 安装到不同 group

### Requirement: Force flag skips confirmation
The system SHALL accept `-f` / `--force` flag to skip the overwrite confirmation prompt.

#### Scenario: Force overwrite
- **WHEN** user runs `skillsmgr custom-install -f abc` and `~/.skills-manager/custom/abc/` already exists
- **THEN** the system overwrites the existing skill without prompting

#### Scenario: Force overwrite in group
- **WHEN** user runs `skillsmgr custom-install -f abc --group my-tools` and `~/.skills-manager/custom/my-tools/abc/` already exists
- **THEN** the system overwrites without prompting

### Requirement: Setup prerequisite check
The system SHALL verify `~/.skills-manager/` exists before executing.

#### Scenario: Skills manager not set up
- **WHEN** user runs `skillsmgr custom-install abc` and `~/.skills-manager/` does not exist
- **THEN** the system exits with code 1 and outputs "Run: skillsmgr setup"
