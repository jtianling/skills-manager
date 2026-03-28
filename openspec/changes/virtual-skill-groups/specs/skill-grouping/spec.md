## MODIFIED Requirements

### Requirement: promptSkills 二级分组构建
`promptSkills` SHALL 解析 `skill.source` 构建 category (group) 和 groupId (subGroup) 的二级分组数据.  custom skill 不再有 subGroup 分组.

#### Scenario: official skill 解析为 provider/repo 分组
- **WHEN** skill.source 为 "official/vercel-labs/agent-skills"
- **THEN** choice.group 为 "official", choice.subGroup 为 "vercel-labs/agent-skills"

#### Scenario: community skill 解析为 owner/repo 分组
- **WHEN** skill.source 为 "community/obra/superpowers"
- **THEN** choice.group 为 "community", choice.subGroup 为 "obra/superpowers"

#### Scenario: custom skill 平铺显示
- **WHEN** skill.source 为 "custom"
- **THEN** choice.group 为 "custom", choice.subGroup 为 undefined, 在 custom 分类下平铺显示

### Requirement: list 命令二级缩进输出
`list` 命令的 listAvailable SHALL 在 category separator 下按 subGroup 分组显示, 子项缩进.  custom skill 全部平铺, 不再有 subGroup.

#### Scenario: list 显示 official 二级分组
- **WHEN** 用户运行 `skillsmgr list`, 且有 vercel-labs 来源的 skills
- **THEN** 输出包含 `── official ──`, 其下 `  vercel-labs/agent-skills (N)`, 各自下方列出 skills

#### Scenario: list 显示 custom skill 平铺
- **WHEN** 用户运行 `skillsmgr list`, 且有 custom skill
- **THEN** 在 `── custom ──` 下直接显示 `  skill-name`, 不显示 group-header
