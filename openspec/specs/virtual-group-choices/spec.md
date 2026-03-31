# Virtual Group Choices

通用 helper: 按虚拟 group 构建交互选择列表.

## Requirements

### Requirement: buildVirtualGroupChoices 通用 helper
`buildVirtualGroupChoices` SHALL 接受已部署 skill 列表和 `groups.json` 数据, 返回按虚拟 group 分组的 `SelectChoice[]`.

#### Scenario: 按虚拟 group 构建 choices
- **WHEN** 传入 5 个 skill, 其中 3 个属于 `jt-tools` group, 2 个属于 `openspec` group
- **THEN** 返回的 choices 中, 前 3 个 skill 的 `subGroup` 为 `jt-tools`, 后 2 个为 `openspec`

#### Scenario: 未入组 skill 归入 (ungrouped)
- **WHEN** 传入的 skill 不属于任何虚拟 group
- **THEN** 该 skill 的 `subGroup` 为 `(ungrouped)`

#### Scenario: (ungrouped) 排在最后
- **WHEN** 同时有属于 group 和未属于 group 的 skill
- **THEN** `(ungrouped)` 分组排在所有命名 group 之后

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
