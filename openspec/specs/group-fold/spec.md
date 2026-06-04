# Group Fold

## Purpose
interactiveCheckbox 的 group-header 折叠/展开功能, 包含快捷键操作, 折叠状态管理, 以及与搜索/选中/行号等功能的交互.

## Requirements

### Requirement: group-header 折叠/展开状态
interactiveCheckbox SHALL 支持 group-header 和 inner-group-header 的折叠/展开状态.  折叠的 header 隐藏其所有子项, 展开的 header 显示所有子项.

#### Scenario: 折叠状态隐藏子项
- **WHEN** 一个 group-header 处于折叠状态
- **THEN** 该 group-header 的所有子项 choice 不显示在列表中, group-header 自身仍然显示

#### Scenario: 展开状态显示子项
- **WHEN** 一个 group-header 处于展开状态
- **THEN** 该 group-header 的所有子项 choice 正常显示在列表中

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

#### Scenario: 光标在展开的 group-header 上按 ←
- **WHEN** 光标在一个展开的 group-header 上, 用户按 `←` 键
- **THEN** 该 group-header 变为折叠状态, 其子项从列表中隐藏

#### Scenario: 光标在已折叠的 group-header 上按 h
- **WHEN** 光标在一个已折叠的 group-header 上, 用户按 `h` 键
- **THEN** 无变化, group-header 保持折叠状态

#### Scenario: 光标在 choice 上按 h
- **WHEN** 光标在一个 choice 项上, 用户按 `h` 键
- **THEN** 无操作

### Requirement: l/→ 键展开当前组
在非搜索模式下, `l` 键和 `→` 键 SHALL 展开光标所在的 header.

#### Scenario: 光标在折叠的 inner-group-header 上按 l
- **WHEN** 光标在折叠的 `anthropic/skills` inner-group-header 上, 按 `l`
- **THEN** `anthropic/skills` 展开, 其 choice 显示

#### Scenario: 光标在折叠的 group-header 上按 l
- **WHEN** 光标在折叠的 `python` group-header 上, 按 `l`
- **THEN** `python` 展开, 其下 inner-group-header 和直接 choice 显示 (内层 header 保持各自折叠状态)

#### Scenario: 光标在折叠的 group-header 上按 →
- **WHEN** 光标在一个折叠的 group-header 上, 用户按 `→` 键
- **THEN** 该 group-header 变为展开状态, 其子项显示在列表中

#### Scenario: 光标在已展开的 group-header 上按 l
- **WHEN** 光标在一个已展开的 group-header 上, 用户按 `l` 键
- **THEN** 无变化, group-header 保持展开状态

#### Scenario: 光标在 choice 上按 l
- **WHEN** 光标在一个 choice 项上, 用户按 `l` 键
- **THEN** 无操作

### Requirement: c 键全局 toggle
在非搜索模式下, `c` 键 SHALL 全局切换所有 header (group-header 和 inner-group-header) 的折叠状态.

#### Scenario: 有展开的组时按 c 全部折叠
- **WHEN** 至少一个 header (任意层级) 处于展开状态, 按 `c`
- **THEN** 所有 group-header 和 inner-group-header 变为折叠状态

#### Scenario: 全部折叠时按 c 全部展开
- **WHEN** 所有 header 均处于折叠状态, 按 `c`
- **THEN** 所有 group-header 和 inner-group-header 变为展开状态

### Requirement: 折叠后光标重定位
当 group-header 折叠导致当前 cursor 指向的 choice 被隐藏时, cursor SHALL 自动重定位.

#### Scenario: 全局折叠后光标在被隐藏的子项上
- **WHEN** 用户按 `c` 全部折叠, 且当前 cursor 在某 group-header 的子项 choice 上
- **THEN** cursor 移到最近的可聚焦项 (group-header 或其他可见 choice)

#### Scenario: 单组折叠后光标保持在 group-header
- **WHEN** 用户在 group-header 上按 `h` 折叠
- **THEN** cursor 保持在该 group-header 上

### Requirement: 折叠与 space 选中正交
折叠状态 SHALL 不影响 space 键的批量选中行为.

#### Scenario: 折叠的 group-header 上按 space 批量切换
- **WHEN** 光标在折叠的 group-header 上, 用户按 space
- **THEN** 该 group-header 的所有子项选中状态被批量切换 (与展开时行为一致)

### Requirement: 搜索模式忽略折叠
搜索模式下 SHALL 忽略折叠状态, 显示所有匹配项.

#### Scenario: 搜索模式下折叠的组中的 skill 可被搜索到
- **WHEN** 某 group-header 处于折叠状态, 用户进入搜索模式并输入匹配该组内 skill 名称的关键词
- **THEN** 匹配的 skill 正常显示在搜索结果中

#### Scenario: 退出搜索后恢复折叠状态
- **WHEN** 用户退出搜索模式 (按 Esc 或清空搜索词)
- **THEN** 之前的折叠状态恢复, 折叠的组重新隐藏子项

### Requirement: 折叠后行号重新计算
折叠隐藏的 focusable 项 SHALL 不分配行号.

#### Scenario: 外层折叠后行号跳过内层
- **WHEN** `python` group-header 折叠, 其下有 inner-group-header (行号 2) 和 2 个 choice (行号 3, 4)
- **THEN** 被隐藏的 inner-group-header 和 choice 不分配行号, 后续可见项行号连续

#### Scenario: 内层折叠后行号跳过内层 choice
- **WHEN** `anthropic/skills` inner-group-header 折叠, 其下 2 个 choice 隐藏
- **THEN** 后续可见项行号连续, 不因隐藏的 choice 产生间断

### Requirement: 帮助栏折叠提示
帮助栏 SHALL 包含折叠相关快捷键提示.

#### Scenario: 非搜索模式帮助栏包含折叠提示
- **WHEN** interactiveCheckbox 在非搜索模式下渲染
- **THEN** 帮助栏包含 `c fold` 或类似的折叠操作提示
