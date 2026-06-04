## Purpose
TBD - update after review.

## Requirements

### Requirement: 根 SKILL.md 与子目录 skill 共存时发现所有子目录 skill
当 repo 根目录存在 SKILL.md, 且子目录中也存在带 SKILL.md 的目录时, `collectGitCloneSkills` SHALL 返回所有子目录 skill, 不将根作为单个 skill 返回.

#### Scenario: flat multi-skill repo
- **WHEN** repo 结构为: 根有 SKILL.md, `ship/SKILL.md`, `qa/SKILL.md`, `browse/SKILL.md` 均存在
- **THEN** 返回的 skill 列表包含 `ship`, `qa`, `browse`, 不包含根 SKILL.md 对应的 skill

#### Scenario: 仅有根 SKILL.md 的 repo
- **WHEN** repo 根目录有 SKILL.md, 无任何子目录包含 SKILL.md
- **THEN** 返回根作为唯一 skill(与当前行为一致)

### Requirement: 深层嵌套 skill 可被发现
`collectGitCloneSkills` 在 fallback 扫描时 SHALL 使用 depth 3, 覆盖 `subdir/skills/skill-name/SKILL.md` 等结构.

#### Scenario: depth-3 嵌套结构
- **WHEN** repo 无 manifest 和 standard paths, 根有 SKILL.md, `openclaw/skills/my-skill/SKILL.md` 存在
- **THEN** 返回的 skill 列表包含 `my-skill`

#### Scenario: depth-1 子目录 skill 与 depth-3 嵌套 skill 共存
- **WHEN** repo 有 `qa/SKILL.md`(depth 1)和 `openclaw/skills/deep-skill/SKILL.md`(depth 3)
- **THEN** 返回的 skill 列表同时包含 `qa` 和 `deep-skill`

### Requirement: manifest 和 standard paths 优先级不变
已有的 manifest/standard-paths 发现逻辑 SHALL 不受影响. 仅在 manifest 和 standard paths 均未发现 skill 时, 新的 fallback 逻辑才生效.

#### Scenario: standard paths 存在时不扫描根子目录
- **WHEN** repo 有 `skills/standard-skill/SKILL.md` 且根下有 `root-skill/SKILL.md`
- **THEN** 仅返回 `standard-skill`, 不返回 `root-skill`(与当前行为一致)
