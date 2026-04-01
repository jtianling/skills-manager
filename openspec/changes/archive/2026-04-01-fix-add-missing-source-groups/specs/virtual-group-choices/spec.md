## MODIFIED Requirements

### Requirement: add 交互式使用虚拟组
`promptSkillsFromRepo` SHALL 使用 `buildSourceGroupedChoices` 构建 choices, 同时保留 source 层级分组(official/community/custom + owner/repo)和虚拟组分组.  已部署 skill SHALL 设置 `locked: true` 和 `suffix: '[deployed]'`.

#### Scenario: 有虚拟组时保留 owner/repo 分组
- **WHEN** 用户运行 `skillsmgr add` (无参), `groups.json` 包含 `openspec` group, 且存在 official skills (如 `anthropic/skills`)
- **THEN** 交互列表中 official skills 按 owner/repo 分组显示(如 `anthropic/skills` sub-group), 同时虚拟组 `openspec` 正常显示

#### Scenario: 无虚拟组时 owner/repo 分组仍正常
- **WHEN** 用户运行 `skillsmgr add` (无参), `groups.json` 为空或不存在
- **THEN** 交互列表中 skills 按 source 分类和 owner/repo 分组显示

#### Scenario: 已部署 skill 锁定不可取消
- **WHEN** 用户运行 `skillsmgr add`, 某 skill 已部署
- **THEN** 该 skill 显示 `checked: true`, `locked: true`, `suffix: '[deployed]'`

#### Scenario: skillsmgr add 交互式显示虚拟组
- **WHEN** 用户运行 `skillsmgr add` (无参) 且 `groups.json` 包含 `develop` group
- **THEN** skill 选择界面按虚拟 group 分组显示
