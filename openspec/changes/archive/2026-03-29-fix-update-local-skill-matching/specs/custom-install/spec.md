## MODIFIED Requirements

### Requirement: Overwrite confirmation for existing skill
install 命令 SHALL 使用 `findInstalledCustomSkill(skillName)` 检测 skill 是否已安装, 替代直接检查目标目录路径是否存在.  当 skill 已安装时提示 overwrite 确认.

#### Scenario: Existing skill with confirmation
- **WHEN** 用户执行 `skillsmgr install ./abc` 且 `findInstalledCustomSkill("abc")` 返回非 null
- **THEN** 系统使用查找到的路径作为 targetDir, 提示 "Skill 'abc' already exists. Overwrite?"

#### Scenario: 同名 skill 在不同 group 下已存在
- **WHEN** 用户执行 `skillsmgr install ./foo --group new-group`
- **WHEN** `findInstalledCustomSkill("foo")` 返回 `custom/old-group/foo`
- **THEN** 系统 SHALL 提示 "Skill 'foo' already installed at custom/old-group/foo. Remove it first or use a different name."
- **THEN** 系统 SHALL NOT 允许同名 skill 安装到不同 group
