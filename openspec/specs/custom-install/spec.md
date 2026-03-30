# Custom Install

从当前工作目录安装本地 skill 到 `~/.skills-manager/custom/` 目录.

## Requirements

### Requirement: Overwrite confirmation for existing skill
install 命令 SHALL 使用 `findInstalledCustomSkill(skillName)` 检测 skill 是否已安装, 替代直接检查目标目录路径是否存在.  当 skill 已安装时提示 overwrite 确认.

#### Scenario: Existing skill with confirmation
- **WHEN** 用户执行 `skillsmgr install ./abc` 且 `findInstalledCustomSkill("abc")` 返回非 null
- **THEN** 系统使用查找到的路径作为 targetDir, 提示 "Skill 'abc' already exists. Overwrite?"

#### Scenario: User declines overwrite
- **WHEN** user declines the overwrite confirmation
- **THEN** the system outputs "Cancelled." and exits normally (code 0)

### Requirement: install --group 自动入组
`install` 命令 SHALL 接受 `--group <name>` 选项.  安装完成后, 系统 SHALL 自动将已安装 skill 的 source key 添加到指定虚拟 group 中.  group 不存在时自动创建.  安装目标路径不受 `--group` 影响 (始终按来源类型决定路径).

#### Scenario: install 本地 skill 并入组
- **WHEN** 用户执行 `skillsmgr install ./my-linter --group python`
- **THEN** skill 安装到 `custom/my-linter/` (不受 group 影响)
- **AND** `custom/my-linter` 被添加到 groups.json 的 python group

#### Scenario: install 远程 skill 并入组
- **WHEN** 用户执行 `skillsmgr install anthropic --group python`
- **THEN** skill 安装到 `official/anthropic/skills/` 下
- **AND** 每个安装的 skill key 被添加到 python group

#### Scenario: --group 指定的 group 不存在时自动创建
- **WHEN** 用户执行 `skillsmgr install ./my-linter --group new-group`, 且 new-group 不存在
- **THEN** 安装 skill, 自动创建 new-group, 并添加 skill 到该 group
