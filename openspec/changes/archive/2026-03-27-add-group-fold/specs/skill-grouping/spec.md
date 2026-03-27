## MODIFIED Requirements

### Requirement: group-header 三态显示
group-header SHALL 根据其子项选中状态显示三态图标, 且在图标前显示折叠/展开指示器.

#### Scenario: 所有子项选中显示全选
- **WHEN** group-header 下所有 choice 子项均被选中
- **THEN** group-header 显示 `◉` (绿色)

#### Scenario: 部分子项选中显示部分选
- **WHEN** group-header 下部分 choice 子项被选中
- **THEN** group-header 显示 `◐` (黄色)

#### Scenario: 无子项选中显示未选
- **WHEN** group-header 下无 choice 子项被选中
- **THEN** group-header 显示 `◯`

#### Scenario: 折叠状态下三态图标正确
- **WHEN** group-header 处于折叠状态, 部分子项被选中
- **THEN** group-header 仍显示正确的三态图标 (`◐` 黄色), 不受折叠影响

### Requirement: group-header 缩进显示
group-header 下的子项 SHALL 缩进一级显示.  折叠时子项不显示.

#### Scenario: 子项相对于 group-header 缩进
- **WHEN** 显示有 subGroup 的 choices, 且 group-header 展开
- **THEN** group-header 以标准缩进显示, 其子项 (choice) 额外缩进两个空格

#### Scenario: 折叠时子项不显示
- **WHEN** group-header 处于折叠状态
- **THEN** 其子项不出现在 displayItems 中

### Requirement: 搜索模式下 group-header 过滤
搜索模式下, 无匹配子项的 group-header SHALL 被隐藏.  搜索模式 SHALL 忽略折叠状态.

#### Scenario: 搜索过滤后 group-header 隐藏
- **WHEN** 搜索关键词导致某 group-header 下所有子项被过滤掉
- **THEN** 该 group-header 不显示

#### Scenario: 搜索过滤后 group-header 三态正确
- **WHEN** 搜索关键词过滤后某 group-header 仍有可见子项
- **THEN** group-header 正常显示, 三态基于所有子项 (含不可见) 的选中状态计算

#### Scenario: 搜索模式忽略折叠
- **WHEN** 某 group-header 处于折叠状态, 进入搜索模式
- **THEN** 搜索结果中该组的匹配子项正常显示, 不受折叠状态影响
