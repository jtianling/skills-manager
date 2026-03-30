## MODIFIED Requirements

### Requirement: Overwrite confirmation for existing skill
install 命令 SHALL 使用 `findInstalledCustomSkill(skillName)` 检测 skill 是否已安装, 替代直接检查目标目录路径是否存在.  当 skill 已安装时提示 overwrite 确认.  `findInstalledCustomSkill` SHALL 支持两层查找: 先查 `custom/{name}/SKILL.md`, 再扫描 `custom/*/{name}/SKILL.md`.

#### Scenario: Existing skill with confirmation
- **WHEN** 用户执行 `skillsmgr install ./abc` 且 `findInstalledCustomSkill("abc")` 返回非 null
- **THEN** 系统使用查找到的路径作为 targetDir, 提示 "Skill 'abc' already exists. Overwrite?"

#### Scenario: User declines overwrite
- **WHEN** user declines the overwrite confirmation
- **THEN** the system outputs "Cancelled." and exits normally (code 0)

#### Scenario: skill 在子目录中被找到
- **WHEN** 用户执行 `skillsmgr install ./abc`, 且 `custom/abc/SKILL.md` 不存在, 但 `custom/openspec/abc/SKILL.md` 存在
- **THEN** `findInstalledCustomSkill("abc")` SHALL 返回 `{ key: "custom/abc", path: "...custom/openspec/abc" }`

## ADDED Requirements

### Requirement: getCustomSkillDir 支持可选 subdirectory
`getCustomSkillDir` SHALL 接受可选的 `subdirectory` 参数.  有 subdirectory 时返回 `custom/{subdirectory}/{skillName}/`, 无时返回 `custom/{skillName}/` (现有行为).

#### Scenario: 无 subdirectory
- **WHEN** 调用 `getCustomSkillDir("my-skill")`
- **THEN** 返回 `~/.skills-manager/custom/my-skill/`

#### Scenario: 有 subdirectory
- **WHEN** 调用 `getCustomSkillDir("openspec-explore", "openspec")`
- **THEN** 返回 `~/.skills-manager/custom/openspec/openspec-explore/`

### Requirement: SkillsService custom 两层扫描
`SkillsService.getSkillsFromSource` 对 custom 来源 SHALL 支持两层目录结构.  扫描 `custom/` 下每个子目录: 若子目录含 SKILL.md 则作为 skill 加载 (现有行为); 若子目录无 SKILL.md 则继续扫描其子目录找 SKILL.md.

#### Scenario: 一层 custom skill
- **WHEN** `~/.skills-manager/custom/my-skill/SKILL.md` 存在
- **THEN** 系统 SHALL 加载该 skill, source 为 `"custom"`

#### Scenario: 两层 custom skill (子目录分组)
- **WHEN** `~/.skills-manager/custom/openspec/openspec-explore/SKILL.md` 存在
- **AND** `~/.skills-manager/custom/openspec/SKILL.md` 不存在
- **THEN** 系统 SHALL 加载 openspec-explore, source 为 `"custom"`

#### Scenario: 混合结构
- **WHEN** `custom/` 下同时有 `my-skill/SKILL.md` (一层) 和 `openspec/openspec-explore/SKILL.md` (两层)
- **THEN** 系统 SHALL 同时发现两个 skills, 所有 skill 的 source 均为 `"custom"`
