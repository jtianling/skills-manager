## ADDED Requirements

### Requirement: 按 skill name 查找已安装的 custom skill
系统 SHALL 提供 `findInstalledCustomSkill(skillName)` 函数, 在 `~/.skills-manager/custom/` 目录中按 skill name 查找已安装的 skill.  查找 SHALL 支持直接子目录 (`custom/{name}/`) 和 group 子目录 (`custom/{group}/{name}/`) 两层结构.

#### Scenario: 直接子目录匹配
- **WHEN** `~/.skills-manager/custom/jt-release/SKILL.md` 存在
- **THEN** `findInstalledCustomSkill("jt-release")` SHALL 返回 `{ key: "custom/jt-release", path: "~/.skills-manager/custom/jt-release" }`

#### Scenario: group 子目录匹配
- **WHEN** `~/.skills-manager/custom/my-group/jt-codex/SKILL.md` 存在
- **THEN** `findInstalledCustomSkill("jt-codex")` SHALL 返回 `{ key: "custom/my-group/jt-codex", path: "~/.skills-manager/custom/my-group/jt-codex" }`

#### Scenario: 未找到
- **WHEN** `~/.skills-manager/custom/` 下不存在名为 `unknown-skill` 的 skill 目录
- **THEN** `findInstalledCustomSkill("unknown-skill")` SHALL 返回 `null`

#### Scenario: 优先直接子目录
- **WHEN** `custom/foo/SKILL.md` 和 `custom/group-a/foo/SKILL.md` 同时存在
- **THEN** `findInstalledCustomSkill("foo")` SHALL 返回直接子目录 (`custom/foo`) 的结果

### Requirement: group 目录与 skill 目录区分
查找时 SHALL 通过 SKILL.md 的存在性区分: 子目录含 SKILL.md 则为 skill 目录, 不含则视为 group 目录并扫描其下一层.

#### Scenario: group 目录识别
- **WHEN** `~/.skills-manager/custom/my-group/` 存在但不含 SKILL.md
- **THEN** 系统 SHALL 将 `my-group` 视为 group 目录, 扫描 `my-group/*/SKILL.md`

#### Scenario: skill 目录不深入扫描
- **WHEN** `~/.skills-manager/custom/openspec/SKILL.md` 存在
- **THEN** 系统 SHALL 将 `openspec` 视为 skill 目录, 不扫描其子目录
