## MODIFIED Requirements

### Requirement: 按 skill name 查找已安装的 custom skill
系统 SHALL 提供 `findInstalledCustomSkill(skillName)` 函数, 在 `~/.skills-manager/custom/` 目录中按 skill name 查找已安装的 skill.  查找 SHALL 只检查直接子目录 (`custom/{name}/`), 不再扫描 group 子目录.

#### Scenario: 直接子目录匹配
- **WHEN** `~/.skills-manager/custom/jt-release/SKILL.md` 存在
- **THEN** `findInstalledCustomSkill("jt-release")` SHALL 返回 `{ key: "custom/jt-release", path: "~/.skills-manager/custom/jt-release" }`

#### Scenario: 未找到
- **WHEN** `~/.skills-manager/custom/` 下不存在名为 `unknown-skill` 的直接子目录
- **THEN** `findInstalledCustomSkill("unknown-skill")` SHALL 返回 `null`

### Requirement: group 目录与 skill 目录区分
**此需求已废弃**. custom 目录下不再有 group 子目录概念, 所有一级子目录含 SKILL.md 即为 skill.

## REMOVED Requirements

### Requirement: group 目录与 skill 目录区分
**Reason**: 物理 group 目录废弃, custom 目录下只有 skill 目录.
**Migration**: 无需区分, 所有一级子目录按 SKILL.md 判断是否为 skill.
