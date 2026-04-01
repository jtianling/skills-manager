## ADDED Requirements

### Requirement: SelectChoice innerGroup 字段
`SelectChoice` 接口 SHALL 新增可选字段 `innerGroup?: string`, 表示 choice 在 subGroup 内部的嵌套分组.

#### Scenario: choice 同时有 subGroup 和 innerGroup
- **WHEN** choice 设置了 `subGroup: "python"` 和 `innerGroup: "anthropic/skills"`
- **THEN** 该 choice 属于 `python` 组下的 `anthropic/skills` 内嵌组

#### Scenario: choice 有 subGroup 无 innerGroup
- **WHEN** choice 设置了 `subGroup: "python"` 但无 `innerGroup`
- **THEN** 该 choice 直接平铺在 `python` 组下, 不嵌套

### Requirement: inner-group-header DisplayItem
`buildDisplayItems` SHALL 为具有 `innerGroup` 的 choice 生成 `type: 'inner-group-header'` 的 DisplayItem, 包含 `childIndices` 和 `innerGroupName`.

#### Scenario: 同一 subGroup + innerGroup 的 choice 生成一个 inner-group-header
- **WHEN** subGroup `python` 下有 2 个 choice 的 innerGroup 为 `anthropic/skills`
- **THEN** 生成一个 `inner-group-header` (innerGroupName 为 `anthropic/skills`), childIndices 包含这 2 个 choice 的索引

#### Scenario: 同一 subGroup 下多个不同 innerGroup
- **WHEN** subGroup `python` 下有 innerGroup `anthropic/skills` (2个) 和 `mattpocock/skills` (1个)
- **THEN** 生成 2 个 inner-group-header, 分别对应各自的 childIndices

#### Scenario: inner-group-header 是 focusable
- **WHEN** displayItems 中存在 `inner-group-header`
- **THEN** `isFocusable` 返回 true, 可被光标聚焦

### Requirement: 3 层嵌套渲染缩进
渲染 SHALL 按层级递增缩进.

#### Scenario: group-header 缩进
- **WHEN** 渲染 `group-header` (subGroup)
- **THEN** 缩进 1 级 (当前行为不变)

#### Scenario: inner-group-header 缩进
- **WHEN** 渲染 `inner-group-header`
- **THEN** 缩进 2 级 (在 group-header 基础上再缩进)

#### Scenario: inner group 下的 choice 缩进
- **WHEN** 渲染属于 innerGroup 的 choice
- **THEN** 缩进 3 级

#### Scenario: subGroup 下无 innerGroup 的 choice 缩进
- **WHEN** 渲染属于 subGroup 但无 innerGroup 的 choice (如 custom skill)
- **THEN** 缩进 2 级 (与 inner-group-header 同级)

### Requirement: inner-group-header 批量选择
inner-group-header 上按 space SHALL 批量切换其 childIndices 内所有 choice 的选中状态.

#### Scenario: space 全选 inner group
- **WHEN** 光标在 `anthropic/skills` inner-group-header 上, 其 2 个 child 均未选中, 按 space
- **THEN** 2 个 child 全部选中

#### Scenario: space 全取消 inner group
- **WHEN** 光标在 `anthropic/skills` inner-group-header 上, 其 2 个 child 均已选中, 按 space
- **THEN** 2 个 child 全部取消选中

#### Scenario: space 部分选中时全选
- **WHEN** 光标在 inner-group-header 上, 其 child 部分选中, 按 space
- **THEN** 所有 child 变为选中

#### Scenario: inner group 选择联动
- **WHEN** inner-group-header 上按 space 切换了 `commit` 的选中状态, 且 `commit` 在其他组也存在 (同 value)
- **THEN** 其他组的 `commit` 副本选中状态同步联动

### Requirement: outer group-header 批量选择包含 inner group
group-header 上按 space SHALL 批量切换所有直接 child 和 inner group 内的 child.

#### Scenario: 外层 space 全选包含内层
- **WHEN** 光标在 `python` group-header 上, 其下有 inner group `anthropic/skills` (2 个 child) 和 2 个直接 child, 均未选中, 按 space
- **THEN** 4 个 choice 全部选中

#### Scenario: 外层 space 全取消包含内层
- **WHEN** 光标在 `python` group-header 上, 4 个 choice 均已选中, 按 space
- **THEN** 4 个 choice 全部取消选中

### Requirement: outer group-header 选中状态图标
group-header 的 tristate 图标 SHALL 考虑 inner group 内的 child.

#### Scenario: 外层全选显示 ◉
- **WHEN** `python` 下所有 choice (含 inner group 内的) 均选中
- **THEN** `python` group-header 显示 `◉` (all)

#### Scenario: 外层部分选中显示 ◐
- **WHEN** `python` 下部分 choice 选中 (可能只选了 inner group 内的)
- **THEN** `python` group-header 显示 `◐` (partial)

### Requirement: 行号分配给 focusable 项
行号 SHALL 分配给所有 focusable 项 (choice, group-header, inner-group-header), separator 不分配.

#### Scenario: group-header 有行号
- **WHEN** 渲染 group-header
- **THEN** 该 group-header 显示行号, 可用 `nG` 跳转

#### Scenario: inner-group-header 有行号
- **WHEN** 渲染 inner-group-header
- **THEN** 该 inner-group-header 显示行号, 可用 `nG` 跳转

#### Scenario: separator 无行号
- **WHEN** 渲染 separator (`── custom ──`)
- **THEN** 不显示行号

#### Scenario: 行号连续递增
- **WHEN** 列表包含 separator, group-header, inner-group-header, choice
- **THEN** 行号从 1 开始, 跳过 separator, 对所有其他 focusable 项连续递增

#### Scenario: jumpToLineNumber 跳转到 focusable 项
- **WHEN** 用户输入 `2G`
- **THEN** 光标跳转到第 2 个 focusable 项 (可能是 group-header, inner-group-header 或 choice)
