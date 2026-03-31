## ADDED Requirements

### Requirement: promptSkills 支持虚拟组分组
`promptSkills` SHALL 接受可选的 `groupsData` 参数, 传入时使用 `buildVirtualGroupChoices` 按虚拟 group 分组显示 skill 列表.

#### Scenario: 传入 groupsData 时按虚拟组分组
- **WHEN** 调用 `promptSkills` 时传入包含 `develop` group 的 `groupsData`
- **THEN** 交互列表中属于 `develop` 的 skill 显示在 `develop` 分组下

#### Scenario: 未传入 groupsData 时保持原有行为
- **WHEN** 调用 `promptSkills` 时不传入 `groupsData`
- **THEN** 使用 `buildSkillChoices` 按 source 路径分组, 行为不变

#### Scenario: 已部署 skill 标记 [deployed] 和 checked
- **WHEN** 传入 `groupsData` 且某 skill 已部署
- **THEN** 该 skill 的 choice 包含 `suffix: "[deployed]"` 和 `checked: true`

### Requirement: promptSkillsToUninstall 支持虚拟组分组
`promptSkillsToUninstall` SHALL 接受可选的 `groupsData` 参数, 传入时使用 `buildVirtualGroupChoices` 按虚拟 group 分组显示 skill 列表.

#### Scenario: 传入 groupsData 时按虚拟组分组
- **WHEN** 调用 `promptSkillsToUninstall` 时传入包含 `develop` group 的 `groupsData`
- **THEN** 交互列表中属于 `develop` 的 skill 显示在 `develop` 分组下

#### Scenario: 未传入 groupsData 时保持原有行为
- **WHEN** 调用 `promptSkillsToUninstall` 时不传入 `groupsData`
- **THEN** 使用 `buildSkillChoices` 按 source 路径分组, 行为不变

### Requirement: loadGroupsData 公共函数
`loadGroupsData` SHALL 从 `GroupsService` 读取所有 group 并返回 `VirtualGroupsData` 格式, 从 `prompts.ts` 导出供多个命令复用.

#### Scenario: 正常加载
- **WHEN** `groups.json` 包含 `develop` 和 `openspec` 两个 group
- **THEN** 返回 `{ develop: [...], openspec: [...] }`

### Requirement: add 交互式使用虚拟组
`executeAdd` 的无参交互路径 (调用 `executeDeploy`) 和 repo skill 选择路径 SHALL 传入 `groupsData` 给 `promptSkills`.

#### Scenario: skillsmgr add 交互式显示虚拟组
- **WHEN** 用户运行 `skillsmgr add` (无参) 且 `groups.json` 包含 `develop` group
- **THEN** skill 选择界面按虚拟 group 分组显示

### Requirement: uninstall 交互式使用虚拟组
`interactiveUninstall` SHALL 传入 `groupsData` 给 `promptSkillsToUninstall`.

#### Scenario: skillsmgr uninstall 交互式显示虚拟组
- **WHEN** 用户运行 `skillsmgr uninstall` (无参) 且 `groups.json` 包含 `develop` group
- **THEN** skill 选择界面按虚拟 group 分组显示
