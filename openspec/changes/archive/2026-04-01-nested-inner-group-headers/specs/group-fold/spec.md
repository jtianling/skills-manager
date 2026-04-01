## MODIFIED Requirements

### Requirement: group-header 折叠/展开状态
interactiveCheckbox SHALL 支持 group-header 和 inner-group-header 的折叠/展开状态.  折叠的 header 隐藏其所有子项, 展开的 header 显示所有子项.

#### Scenario: 外层折叠隐藏内层 header 和 choice
- **WHEN** group-header `python` 折叠
- **THEN** `python` 下的所有 inner-group-header 和 choice 全部隐藏, 只保留 `python` group-header 自身

#### Scenario: 内层折叠只隐藏内层 choice
- **WHEN** inner-group-header `anthropic/skills` 折叠 (外层 `python` 展开)
- **THEN** `anthropic/skills` 下的 choice 隐藏, `anthropic/skills` inner-group-header 自身和 `python` 下的其他 choice / inner-group-header 仍显示

#### Scenario: 外层展开恢复内层显示
- **WHEN** `python` 从折叠恢复为展开, 且内层 `anthropic/skills` 之前是折叠的
- **THEN** `anthropic/skills` inner-group-header 显示 (保持折叠状态), 其 choice 仍隐藏

#### Scenario: 默认全部展开
- **WHEN** interactiveCheckbox 首次渲染
- **THEN** 所有 group-header 和 inner-group-header 处于展开状态

### Requirement: 折叠图标显示
group-header 和 inner-group-header SHALL 显示折叠/展开图标.

#### Scenario: 外层折叠显示 ▶
- **WHEN** group-header 处于折叠状态
- **THEN** 显示 `▶` 图标

#### Scenario: 外层展开显示 ▼
- **WHEN** group-header 处于展开状态
- **THEN** 显示 `▼` 图标

#### Scenario: 内层折叠显示 ▶
- **WHEN** inner-group-header 处于折叠状态
- **THEN** 显示 `▶` 图标

#### Scenario: 内层展开显示 ▼
- **WHEN** inner-group-header 处于展开状态
- **THEN** 显示 `▼` 图标

### Requirement: h/← 键折叠当前组
在非搜索模式下, `h` 键和 `←` 键 SHALL 折叠光标所在的 header (group-header 或 inner-group-header).

#### Scenario: 光标在展开的 inner-group-header 上按 h
- **WHEN** 光标在展开的 `anthropic/skills` inner-group-header 上, 按 `h`
- **THEN** `anthropic/skills` 折叠, 其 choice 隐藏

#### Scenario: 光标在展开的 group-header 上按 h
- **WHEN** 光标在展开的 `python` group-header 上, 按 `h`
- **THEN** `python` 折叠, 其下所有 inner-group-header 和 choice 隐藏

### Requirement: l/→ 键展开当前组
在非搜索模式下, `l` 键和 `→` 键 SHALL 展开光标所在的 header.

#### Scenario: 光标在折叠的 inner-group-header 上按 l
- **WHEN** 光标在折叠的 `anthropic/skills` inner-group-header 上, 按 `l`
- **THEN** `anthropic/skills` 展开, 其 choice 显示

#### Scenario: 光标在折叠的 group-header 上按 l
- **WHEN** 光标在折叠的 `python` group-header 上, 按 `l`
- **THEN** `python` 展开, 其下 inner-group-header 和直接 choice 显示 (内层 header 保持各自折叠状态)

### Requirement: c 键全局 toggle
在非搜索模式下, `c` 键 SHALL 全局切换所有 header (group-header 和 inner-group-header) 的折叠状态.

#### Scenario: 有展开的组时按 c 全部折叠
- **WHEN** 至少一个 header (任意层级) 处于展开状态, 按 `c`
- **THEN** 所有 group-header 和 inner-group-header 变为折叠状态

#### Scenario: 全部折叠时按 c 全部展开
- **WHEN** 所有 header 均处于折叠状态, 按 `c`
- **THEN** 所有 group-header 和 inner-group-header 变为展开状态

### Requirement: 折叠后行号重新计算
折叠隐藏的 focusable 项 SHALL 不分配行号.

#### Scenario: 外层折叠后行号跳过内层
- **WHEN** `python` group-header 折叠, 其下有 inner-group-header (行号 2) 和 2 个 choice (行号 3, 4)
- **THEN** 被隐藏的 inner-group-header 和 choice 不分配行号, 后续可见项行号连续

#### Scenario: 内层折叠后行号跳过内层 choice
- **WHEN** `anthropic/skills` inner-group-header 折叠, 其下 2 个 choice 隐藏
- **THEN** 后续可见项行号连续, 不因隐藏的 choice 产生间断
