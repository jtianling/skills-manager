# Skill Grouping

interactiveCheckbox 的 group-header 三态显示、批量切换, 以及 promptSkills/list 的二级分组.

## Requirements

### Requirement: group-header 项类型
interactiveCheckbox SHALL 支持 `group-header` 类型的 DisplayItem, 它是可聚焦、可选择的分组标题行.  group-header 不出现在最终返回的 `string[]` 值中.

#### Scenario: group-header 显示在子项之前
- **WHEN** choices 中连续多个 choice 拥有相同 `subGroup` 值
- **THEN** 在第一个同 subGroup 的 choice 之前显示一个 group-header 行, 格式为 `{subGroup} ({childCount})`

#### Scenario: group-header 不参与返回值
- **WHEN** 用户确认选择, 且有 group-header 被聚焦或其子项被选中
- **THEN** 返回的 `string[]` 仅包含 choice 的 value, 不包含 group-header

### Requirement: group-header 三态显示
group-header SHALL 根据其子项选中状态显示三态图标.

#### Scenario: 所有子项选中显示全选
- **WHEN** group-header 下所有 choice 子项均被选中
- **THEN** group-header 显示 `◉` (绿色)

#### Scenario: 部分子项选中显示部分选
- **WHEN** group-header 下部分 choice 子项被选中
- **THEN** group-header 显示 `◐` (黄色)

#### Scenario: 无子项选中显示未选
- **WHEN** group-header 下无 choice 子项被选中
- **THEN** group-header 显示 `◯`

### Requirement: group-header 批量切换
Space 键在 group-header 上 SHALL 批量切换所有子项的选中状态.

#### Scenario: 从部分选中切换到全选
- **WHEN** 光标在 group-header 上, 部分子项选中, 用户按 Space
- **THEN** group-header 下所有子项变为选中

#### Scenario: 从未选中切换到全选
- **WHEN** 光标在 group-header 上, 无子项选中, 用户按 Space
- **THEN** group-header 下所有子项变为选中

#### Scenario: 从全选切换到全不选
- **WHEN** 光标在 group-header 上, 所有子项选中, 用户按 Space
- **THEN** group-header 下所有子项变为未选中

### Requirement: group-header 可聚焦
光标导航 SHALL 能聚焦到 group-header, 但跳过 separator.

#### Scenario: 上下键可聚焦 group-header
- **WHEN** 用户按 ↑ 或 ↓ 键移动光标
- **THEN** 光标可以停留在 group-header 上, 与 choice 一样

#### Scenario: 上下键跳过 separator
- **WHEN** 用户按 ↑ 或 ↓ 键移动光标, 下一项为 separator
- **THEN** 光标跳过 separator, 停留在 separator 之后的 group-header 或 choice 上

### Requirement: group-header 缩进显示
group-header 下的子项 SHALL 缩进一级显示.

#### Scenario: 子项相对于 group-header 缩进
- **WHEN** 显示有 subGroup 的 choices
- **THEN** group-header 以标准缩进显示, 其子项 (choice) 额外缩进两个空格

### Requirement: group-header 行号处理
group-header SHALL 不分配行号, 与 separator 行为一致.

#### Scenario: group-header 不占用行号
- **WHEN** 显示列表包含 group-header
- **THEN** group-header 对应位置空格填充, 行号连续分配给 choice 项

### Requirement: 搜索模式下 group-header 过滤
搜索模式下, 无匹配子项的 group-header SHALL 被隐藏.

#### Scenario: 搜索过滤后 group-header 隐藏
- **WHEN** 搜索关键词导致某 group-header 下所有子项被过滤掉
- **THEN** 该 group-header 不显示

#### Scenario: 搜索过滤后 group-header 三态正确
- **WHEN** 搜索关键词过滤后某 group-header 仍有可见子项
- **THEN** group-header 正常显示, 三态基于所有子项 (含不可见) 的选中状态计算

### Requirement: Ctrl+A 与 group-header 兼容
Ctrl+A SHALL 操作所有 choice, group-header 三态自动刷新.

#### Scenario: Ctrl+A 全选后 group-header 变为全选
- **WHEN** 用户按 Ctrl+A 全选
- **THEN** 所有 choice 被选中, 所有 group-header 显示 `◉`

#### Scenario: Ctrl+A 全取消后 group-header 变为未选
- **WHEN** 用户按 Ctrl+A 全取消
- **THEN** 所有 choice 被取消, 所有 group-header 显示 `◯`

### Requirement: 无 subGroup 时向后兼容
当 choices 中没有 `subGroup` 字段时, interactiveCheckbox SHALL 行为与变更前完全一致.

#### Scenario: 无 subGroup 的 choices 正常工作
- **WHEN** 所有 choices 均无 subGroup 字段
- **THEN** 不生成任何 group-header, 显示和行为与现有实现一致

### Requirement: promptSkills 二级分组构建
`promptSkills` SHALL 解析 `skill.source` 构建 category (group) 和 groupId (subGroup) 的二级分组数据.

#### Scenario: official skill 解析为 provider 分组
- **WHEN** skill.source 为 "official/anthropic"
- **THEN** choice.group 为 "official", choice.subGroup 为 "anthropic"

#### Scenario: community skill 解析为 owner/repo 分组
- **WHEN** skill.source 为 "community/obra/superpowers"
- **THEN** choice.group 为 "community", choice.subGroup 为 "obra/superpowers"

#### Scenario: 有分组的 custom skill 解析为 groupName 分组
- **WHEN** skill.source 为 "custom/my-tools"
- **THEN** choice.group 为 "custom", choice.subGroup 为 "my-tools"

#### Scenario: 无分组的 custom skill 平铺显示
- **WHEN** skill.source 为 "custom"
- **THEN** choice.group 为 "custom", choice.subGroup 为 undefined, 在 custom 分类下平铺显示 (不归属任何 group-header)

### Requirement: list 命令二级缩进输出
`list` 命令的 listAvailable SHALL 在 category separator 下按 subGroup 分组显示, 子项缩进.

#### Scenario: list 显示 official 二级分组
- **WHEN** 用户运行 `skillsmgr list`, 且有 official/anthropic 来源的 skill
- **THEN** 输出格式包含 category 行 `── official ──`, 其下 provider 行 `  anthropic (N)`, 其下 skill 行 `    skill-name`

#### Scenario: list 显示无分组 custom skill
- **WHEN** 用户运行 `skillsmgr list`, 且有 source 为 "custom" 的 skill (无分组)
- **THEN** 在 `── custom ──` 下直接显示 `  skill-name`, 不显示 group-header
