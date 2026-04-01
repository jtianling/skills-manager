## MODIFIED Requirements

### Requirement: SelectChoice innerGroup 字段
`SelectChoice` 接口 SHALL 新增可选字段 `innerGroup?: string`, 表示 choice 在 subGroup 内部的嵌套分组.

#### Scenario: choice 同时有 subGroup 和 innerGroup
- **WHEN** choice 设置了 `subGroup: "python"` 和 `innerGroup: "anthropic/skills"`
- **THEN** 该 choice 属于 `python` 组下的 `anthropic/skills` 内嵌组

#### Scenario: choice 有 subGroup 无 innerGroup
- **WHEN** choice 设置了 `subGroup: "python"` 但无 `innerGroup`
- **THEN** 该 choice 直接平铺在 `python` 组下, 不嵌套

#### Scenario: custom 子路径 source 生成 innerGroup
- **WHEN** source 为 `custom/openspec` 的 skill 属于虚拟组 `develop`
- **THEN** 该 skill 的 `innerGroup` 为 `"openspec"`

#### Scenario: 平铺 custom source 不生成 innerGroup
- **WHEN** source 为 `custom` (无子路径) 的 skill 属于虚拟组 `develop`
- **THEN** 该 skill 不设置 `innerGroup`, 直接平铺在 group-header 下

#### Scenario: innerGroup 与 subGroup 同名时跳过
- **WHEN** source 为 `custom/openspec` 的 skill 属于虚拟组 `openspec`
- **THEN** 计算出的 innerGroup `"openspec"` 与 subGroup `"openspec"` 相同, SHALL 不设置 `innerGroup`, skill 直接平铺在 group-header 下
