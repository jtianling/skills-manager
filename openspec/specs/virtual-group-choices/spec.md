# Virtual Group Choices

通用 helper: 按虚拟 group 构建交互选择列表.

## Requirements

### Requirement: buildVirtualGroupChoices 通用 helper
`buildVirtualGroupChoices` SHALL 接受已部署 skill 列表和 `groups.json` 数据, 返回按虚拟 group 分组的 `SelectChoice[]`.

#### Scenario: 按虚拟 group 构建 choices
- **WHEN** 传入 5 个 skill, 其中 3 个属于 `jt-tools` group, 2 个属于 `openspec` group
- **THEN** 返回的 choices 中, 前 3 个 skill 的 `subGroup` 为 `jt-tools`, 后 2 个为 `openspec`

#### Scenario: 未入组 skill 平铺显示
- **WHEN** 传入的 skill 不属于任何虚拟 group
- **THEN** 该 skill 的 `subGroup` 为 `undefined` (无 group-header, 平铺显示)

#### Scenario: 未入组 skill 排在最后
- **WHEN** 同时有属于 group 和未属于 group 的 skill
- **THEN** 未入组 skill 排在所有命名 group 之后, `subGroup` 为 `undefined`

#### Scenario: 无虚拟 group 时不生成 subGroup
- **WHEN** `groups.json` 为空或不存在, 所有 skill 都未入组
- **THEN** 返回的 choices 不设置 `subGroup` 字段, 等效于扁平列表

#### Scenario: 多 group 归属时归入第一个匹配
- **WHEN** skill `jt-codex` 同时属于 `jt-tools` 和 `dev` 两个 group
- **THEN** `jt-codex` 的 `subGroup` 为 `jt-tools` (按 group 名字母序第一个)

#### Scenario: group 名字母排序
- **WHEN** 存在 `openspec` 和 `jt-tools` 两个 group
- **THEN** `jt-tools` 排在 `openspec` 之前 (按字母升序)

### Requirement: buildVirtualGroupChoices 支持自定义选项
`buildVirtualGroupChoices` SHALL 支持通过选项参数自定义 suffix 和 locked 状态.

#### Scenario: 自定义 suffix
- **WHEN** 调用时传入 `suffix` 回调, 对某 skill 返回 `[deployed]`
- **THEN** 该 skill 的 choice 包含 `suffix: "[deployed]"`

#### Scenario: 自定义 locked
- **WHEN** 调用时传入 `locked` 回调, 对某 skill 返回 `true`
- **THEN** 该 skill 的 choice 包含 `locked: true`

### Requirement: 来源 suffix 标注
虚拟 group 中的非 custom skill SHALL 在 suffix 中显示来源信息, 格式为 `(owner/repo)`.

#### Scenario: official skill 显示来源 suffix
- **WHEN** 虚拟 group `my-tools` 包含 `official/anthropic/skills/commit`
- **THEN** 该 skill 的 suffix 包含 `(anthropic/skills)`

#### Scenario: community skill 显示来源 suffix
- **WHEN** 虚拟 group `my-tools` 包含 `community/bob/cool-tools/linter`
- **THEN** 该 skill 的 suffix 包含 `(bob/cool-tools)`

#### Scenario: custom skill 不显示来源 suffix
- **WHEN** 虚拟 group `my-tools` 包含 `custom/my-linter`
- **THEN** 该 skill 不附加来源 suffix

#### Scenario: 来源 suffix 与功能 suffix 共存
- **WHEN** 虚拟 group 中的 official skill `commit` 同时通过 `getSuffix` 返回 `[deployed]`
- **THEN** 该 skill 的 suffix 为 `(anthropic/skills) [deployed]` (来源在前, 功能在后)

### Requirement: buildSourceGroupedChoices 虚拟 group 跨 source 支持
`buildSourceGroupedChoices` SHALL 将属于虚拟 group 的非 custom skill 从其 source 分类移入 custom 分类的虚拟 group 下显示, 带来源 suffix.

#### Scenario: official skill 移入虚拟 group
- **WHEN** `official/anthropic/skills/commit` 属于虚拟 group `my-tools`, 同时 `official/anthropic/skills/review` 不属于任何 group
- **THEN** `commit` 出现在 custom 分类的 `my-tools` 虚拟 group 下, 带 suffix `(anthropic/skills)`.  `review` 仍在 official 分类的 `anthropic/skills` sub-group 下

#### Scenario: 非 custom skill 不在 source 分类重复出现
- **WHEN** `official/anthropic/skills/commit` 属于虚拟 group `my-tools`
- **THEN** `commit` 不出现在 official 分类的 `anthropic/skills` sub-group 下

#### Scenario: source 分类下 sub-group 清空时隐藏
- **WHEN** `anthropic/skills` 下所有 skill 都属于虚拟 group
- **THEN** official 分类下不再显示 `anthropic/skills` sub-group

#### Scenario: 无虚拟 group 时行为不变
- **WHEN** `groupsData` 为空
- **THEN** 所有 skill 按 source 分类显示, 行为与当前一致

### Requirement: group list 来源显示
`group list <name>` SHALL 以友好格式显示 skill 列表, 非 custom skill 标注来源.

#### Scenario: 混合来源的 group 列表
- **WHEN** group `my-tools` 包含 `official/anthropic/skills/commit`, `custom/my-linter`, `community/bob/tools/debugger`
- **THEN** 输出:
  ```
  my-tools:
    commit        (anthropic/skills)
    my-linter
    debugger      (bob/tools)
  ```

#### Scenario: 纯 custom skill 的 group 列表
- **WHEN** group `local` 只包含 `custom/tool-a`, `custom/tool-b`
- **THEN** 输出无来源标注:
  ```
  local:
    tool-a
    tool-b
  ```

### Requirement: promptSkills 支持虚拟组分组
`promptSkills` SHALL 接受可选的 `groupsData` 参数, 传入时使用 `buildSourceGroupedChoices` 按虚拟 group 分组显示 skill 列表.

#### Scenario: 传入 groupsData 时按虚拟组分组
- **WHEN** 调用 `promptSkills` 时传入包含 `develop` group 的 `groupsData`
- **THEN** 交互列表中属于 `develop` 的 skill 显示在 `develop` 分组下

#### Scenario: 未传入 groupsData 时保持原有行为
- **WHEN** 调用 `promptSkills` 时不传入 `groupsData`
- **THEN** 使用 `buildSourceGroupedChoices` 按 source 路径分组, 行为不变

#### Scenario: 已部署 skill 标记 [deployed] 和 checked
- **WHEN** 传入 `groupsData` 且某 skill 已部署
- **THEN** 该 skill 的 choice 包含 `suffix: "[deployed]"` 和 `checked: true`

### Requirement: promptSkillsToUninstall 支持虚拟组分组
`promptSkillsToUninstall` SHALL 接受可选的 `groupsData` 参数, 传入时使用 `buildSourceGroupedChoices` 按虚拟 group 分组显示 skill 列表.

#### Scenario: 传入 groupsData 时按虚拟组分组
- **WHEN** 调用 `promptSkillsToUninstall` 时传入包含 `develop` group 的 `groupsData`
- **THEN** 交互列表中属于 `develop` 的 skill 显示在 `develop` 分组下

#### Scenario: 未传入 groupsData 时保持原有行为
- **WHEN** 调用 `promptSkillsToUninstall` 时不传入 `groupsData`
- **THEN** 使用 `buildSourceGroupedChoices` 按 source 路径分组, 行为不变

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
