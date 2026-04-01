## MODIFIED Requirements

### Requirement: 来源 suffix 标注
虚拟 group 中的非 custom skill SHALL 通过 `innerGroup` 嵌套分组显示来源, 不再使用 suffix 标注.

#### Scenario: official skill 用 innerGroup 嵌套显示
- **WHEN** 虚拟 group `my-tools` 包含 `official/anthropic/skills/commit`
- **THEN** 该 skill 的 `innerGroup` 为 `anthropic/skills`, `suffix` 中不包含 `(anthropic/skills)`

#### Scenario: community skill 用 innerGroup 嵌套显示
- **WHEN** 虚拟 group `my-tools` 包含 `community/bob/cool-tools/linter`
- **THEN** 该 skill 的 `innerGroup` 为 `bob/cool-tools`, `suffix` 中不包含 `(bob/cool-tools)`

#### Scenario: custom skill 不嵌套
- **WHEN** 虚拟 group `my-tools` 包含 `custom/my-linter`
- **THEN** 该 skill 不设置 `innerGroup`, 直接平铺在 group-header 下

#### Scenario: 功能 suffix 保留
- **WHEN** 虚拟 group 中的 official skill `commit` 通过 `getSuffix` 返回 `[deployed]`
- **THEN** 该 skill 的 `suffix` 为 `[deployed]` (不再拼接来源 suffix)

#### Scenario: 始终嵌套, 即使只有一个 source
- **WHEN** 虚拟 group `python` 内的所有非 custom skill 都来自 `official/anthropic/skills`
- **THEN** 仍然生成 `innerGroup: "anthropic/skills"` 嵌套 header

### Requirement: buildSourceGroupedChoices 虚拟 group 跨 source 支持
`buildSourceGroupedChoices` SHALL 将属于虚拟 group 的 skill 同时保留在原始 source 分组和所有归属虚拟 group 下显示.  非 custom skill 不再从 source 分类中移除.

#### Scenario: official skill 同时出现在 source 分组和虚拟 group
- **WHEN** `official/anthropic/skills/commit` 属于虚拟 group `my-tools`
- **THEN** `commit` 同时出现在 official 分类的 `anthropic/skills` sub-group 下和 custom 分类的 `my-tools` 虚拟 group 下

#### Scenario: skill 属于多个虚拟 group 时全部显示
- **WHEN** `official/anthropic/skills/commit` 同时属于 `develop` 和 `openspec` 两个虚拟 group
- **THEN** `commit` 出现在 official 分类的 `anthropic/skills` sub-group 下, 以及 custom 分类的 `develop` 和 `openspec` 两个虚拟 group 下 (共 3 处)

#### Scenario: 非 custom skill 虚拟 group 副本用 innerGroup 嵌套
- **WHEN** `official/anthropic/skills/commit` 属于虚拟 group `my-tools`
- **THEN** `my-tools` 下的 `commit` 设置 `innerGroup: "anthropic/skills"`, official 分类下的 `commit` 不设置 `innerGroup`

#### Scenario: custom skill 属于多个虚拟 group
- **WHEN** `custom/my-linter` 同时属于 `develop` 和 `python` 两个虚拟 group
- **THEN** `my-linter` 在 custom 分类的 `develop` 和 `python` 两个虚拟 group 下各出现一次, 无 `innerGroup`

#### Scenario: 无虚拟 group 时行为不变
- **WHEN** `groupsData` 为空
- **THEN** 所有 skill 按 source 分类显示, 行为与当前一致

#### Scenario: 空 group 显示 header
- **WHEN** groups.json 中存在 `empty-group` 但无已安装 skill 匹配该 group 的 key
- **THEN** custom 分类下仍显示 `empty-group` 的 group header, 内容为空

#### Scenario: 所有虚拟 group 的 skill value 使用 skill key
- **WHEN** `buildSourceGroupedChoices` 为虚拟 group 下的 skill 生成 choice
- **THEN** 该 choice 的 `value` SHALL 与 source 分组中同一 skill 的 `value` 相同 (由调用方的 `getValue` 决定)

## REMOVED Requirements

### Requirement: 来源 suffix 标注 (旧版)
**Reason**: 替换为 innerGroup 嵌套分组, 不再使用 suffix 标注来源
**Migration**: 非 custom skill 在虚拟组内通过 `innerGroup` 字段实现来源分组显示
