## MODIFIED Requirements

### Requirement: promptSkills 二级分组构建
`promptSkills` SHALL 解析 `skill.source` 构建 category (group) 和 groupId (subGroup) 的二级分组数据.  custom 下无 groupId 的 skill SHALL 自动获得 `(ungrouped)` 虚拟 subGroup.

#### Scenario: official skill 解析为 provider/repo 分组
- **WHEN** skill.source 为 "official/vercel-labs/agent-skills"
- **THEN** choice.group 为 "official", choice.subGroup 为 "vercel-labs/agent-skills"

#### Scenario: community skill 解析为 owner/repo 分组
- **WHEN** skill.source 为 "community/obra/superpowers"
- **THEN** choice.group 为 "community", choice.subGroup 为 "obra/superpowers"

#### Scenario: custom 无 groupId 的 skill 获得虚拟分组
- **WHEN** skill.source 为 "custom"
- **THEN** choice.group 为 "custom", choice.subGroup 为 "(ungrouped)"

#### Scenario: custom 有 groupId 的 skill 保持原有分组
- **WHEN** skill.source 为 "custom/my-tools"
- **THEN** choice.group 为 "custom", choice.subGroup 为 "my-tools"

### Requirement: list 命令二级缩进输出
`list` 命令的 listAvailable SHALL 在 category separator 下按 subGroup 分组显示, 子项缩进.  custom 下无 groupId 的 skill SHALL 显示在 `(ungrouped)` 分组标签下.

#### Scenario: list 显示 official 二级分组
- **WHEN** 用户运行 `skillsmgr list`, 且有 vercel-labs 来源的 skills
- **THEN** 输出包含 `── official ──`, 其下 `  vercel-labs/agent-skills (N)`, 各自下方列出 skills

#### Scenario: list 显示 custom 未分组 skill 带 (ungrouped) 标签
- **WHEN** 用户运行 `skillsmgr list`, 且有未分组的 custom skill
- **THEN** 在 `── custom ──` 下显示 `  (ungrouped) (N)`, 其下方缩进列出 skill 名称

#### Scenario: list 中 (ungrouped) 排在真实分组之后
- **WHEN** 用户运行 `skillsmgr list`, custom 下同时有真实分组和未分组 skill
- **THEN** 真实分组(如 `my-tools`)先输出, `(ungrouped)` 最后输出

## ADDED Requirements

### Requirement: (ungrouped) 虚拟分组排序
在 custom 分类内, `(ungrouped)` 虚拟分组 SHALL 排在所有真实分组之后.  此规则同时适用于交互界面和 list 命令.

#### Scenario: 交互界面中 (ungrouped) 排在最后
- **WHEN** custom 分类下同时存在真实分组 `my-tools` 和未分组 skill
- **THEN** `my-tools` 的 group-header 先出现, `(ungrouped)` 的 group-header 后出现

#### Scenario: 仅有未分组 skill 时正常显示
- **WHEN** custom 分类下所有 skill 均无 groupId
- **THEN** 显示 `(ungrouped)` group-header, 包含所有 custom skill
