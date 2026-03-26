## MODIFIED Requirements

### Requirement: promptSkills 二级分组构建
`promptSkills` SHALL 解析 `skill.source` 构建 category (group) 和 groupId (subGroup) 的二级分组数据.

#### Scenario: official skill 解析为 provider/repo 分组
- **WHEN** skill.source 为 "official/vercel-labs/agent-skills"
- **THEN** choice.group 为 "official", choice.subGroup 为 "vercel-labs/agent-skills"

#### Scenario: community skill 解析为 owner/repo 分组
- **WHEN** skill.source 为 "community/obra/superpowers"
- **THEN** choice.group 为 "community", choice.subGroup 为 "obra/superpowers"

#### Scenario: 有分组的 custom skill 解析为 groupName 分组
- **WHEN** skill.source 为 "custom/my-tools"
- **THEN** choice.group 为 "custom", choice.subGroup 为 "my-tools"

#### Scenario: 无分组的 custom skill 平铺显示
- **WHEN** skill.source 为 "custom"
- **THEN** choice.group 为 "custom", choice.subGroup 为 undefined, 在 custom 分类下平铺显示

### Requirement: list 命令二级缩进输出
`list` 命令的 listAvailable SHALL 在 category separator 下按 subGroup 分组显示, 子项缩进.

#### Scenario: list 显示 official 二级分组 (多 repo)
- **WHEN** 用户运行 `skillsmgr list`, 且有 vercel-labs 来源的 skills
- **THEN** 输出包含 `── official ──`, 其下 `  vercel-labs/agent-skills (N)` 和 `  vercel-labs/agent-browser (M)`, 各自下方列出 skills

#### Scenario: list 显示 official 二级分组 (单 repo)
- **WHEN** 用户运行 `skillsmgr list`, 且有 official/anthropic/skills 来源的 skill
- **THEN** 输出包含 `── official ──`, 其下 `  anthropic/skills (N)`, 其下 `    skill-name`

#### Scenario: list 显示无分组 custom skill
- **WHEN** 用户运行 `skillsmgr list`, 且有 source 为 "custom" 的 skill (无分组)
- **THEN** 在 `── custom ──` 下直接显示 `  skill-name`, 不显示 group-header

### Requirement: SkillsService official 遍历

`SkillsService.getSkillsFromSource` 对 official 来源 SHALL 使用三层遍历:

`official/{providerKey}/{repoName}/{skillName}/`

与 community 的 `community/{owner}/{repo}/{skillName}/` 结构一致.

#### Scenario: official 三层遍历
- **WHEN** 扫描 `~/.skills-manager/official/` 目录
- **THEN** 系统 SHALL 遍历 providerKey 层 → repoName 层 → skillName 层, source 字符串为 `"official/{providerKey}/{repoName}"`

#### Scenario: official source 字符串格式
- **WHEN** 加载 `official/vercel-labs/agent-skills/deploy/` 下的 skill
- **THEN** skill.source SHALL 为 `"official/vercel-labs/agent-skills"`
