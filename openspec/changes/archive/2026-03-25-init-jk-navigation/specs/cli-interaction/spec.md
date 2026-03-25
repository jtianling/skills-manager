## MODIFIED Requirements

### Requirement: Skill 选择 (interactiveCheckbox)

类型: 自定义 readline 实现
触发: `init` 命令的 skill 选择, `install` 命令的 skill 选择

**核心参数**:
- `pageSize`: 可视区域大小, 默认 15
- `searchThreshold`: 超过此数量启用搜索, 默认 20

**分组显示**:
- choices 按 `group` 字段分组
- 组标题格式: `── {group} ──` (黄色)
- 组标题只在 group 值变化时插入

**搜索功能**:
- 当 choices 数量 > searchThreshold (20) 时, 搜索功能可用
- 搜索栏: `🔍 Search: {query}│ ({filtered}/{total} skills)`
- 搜索为实时过滤, 大小写不敏感, 匹配 choice.name
- 可输入字符: `[a-zA-Z0-9\-_.]` (不含空格, 空格用于选择)
- Backspace 删除搜索字符
- 搜索时 Ctrl+A 仅切换已过滤的选项
- **搜索模式**: 按 "/" 键进入搜索模式, 按 Escape 或再次按 "/" 退出搜索模式
- **非搜索模式下**: 字母输入不触发搜索, 仅在搜索模式下输入字符才过滤列表
- **搜索模式退出**: Escape 退出搜索模式但保留当前搜索文本和过滤结果; Backspace 在搜索文本为空时退出搜索模式
- **enableSearch 为 false 时**: "/" 键无效果

**键盘操作**:
| 键 | 非搜索模式 | 搜索模式 |
|----|-----------|---------|
| ↑ / ↓ | 移动光标, 跳过组标题 (separator) | 移动光标, 跳过组标题 |
| j / k | 向下/向上移动光标 (与 ↓/↑ 行为一致) | 作为搜索字符输入 |
| / | 进入搜索模式 (仅 enableSearch 时) | 退出搜索模式 |
| Space | 切换当前项的选中状态 | 切换当前项的选中状态 |
| Ctrl+A | 全选/全取消 | 全选/全取消 (仅操作过滤结果) |
| Enter | 确认选择 | 确认选择 |
| Ctrl+C | 取消并退出 | 取消并退出 |
| Escape | 无效果 | 退出搜索模式 (保留搜索文本) |
| Backspace | 无效果 | 删除搜索文本最后一个字符; 文本为空时退出搜索模式 |
| 字母/数字 | 忽略 (不触发搜索) | 追加到搜索文本 |

**搜索栏视觉状态**:
- 搜索模式激活: 搜索栏正常亮度显示
- 非搜索模式 (有搜索文本): 搜索栏变灰 (dim) 显示
- 无搜索文本且非搜索模式: 搜索栏变灰

**底部指引文本**:
- enableSearch 且非搜索模式: `(j/k or ↑↓ move, / search, space select, ctrl+a toggle all, enter confirm)`
- enableSearch 且搜索模式: `(↑↓ move, esc exit search, space select, ctrl+a toggle filtered, enter confirm)`
- 非 enableSearch: `(j/k or ↑↓ move, space select, ctrl+a toggle all, enter confirm)`

**选中状态显示**:
- 选中: `◉` (绿色)
- 未选中: `◯`
- 光标所在: `❯` (青色) 前缀, 名称高亮 (青色)
- 后缀: `[deployed]` (黄色, 如果有 suffix)

**描述显示**:
- 仅在光标所在项显示 description
- 自动换行, 宽度为终端宽度 - 6 (fallback 74)
- 描述文字灰色, 缩进 4 空格

**滚动**:
- 可视区域由 pageSize 控制
- 光标超出可视区域时自动滚动
- 上方有更多内容时显示 "↑ more above" (灰色)
- 下方有更多内容时显示 "↓ more below" (灰色)

**确认后输出**:
- 0 个选中: `? {message} None selected` (灰色)
- 1-3 个选中: `? {message} name1, name2, name3` (青色)
- 超过 3 个: `? {message} N skills selected` (青色)
- 确认后清除整个选择 UI

**init 命令中 Skill 选择**:
- 已部署的 skill 默认选中 (`checked: true`) 且标记 `[deployed]`
- 按 source 分组

**install 命令中的选择**:
- 无分组 (没有 group 字段)
- 无 `[deployed]` 标记
- 无默认选中

#### Scenario: j 键向下移动光标
- **WHEN** 用户在非搜索模式下按 j 键
- **THEN** 光标向下移动到下一个 choice (跳过 separator), 与按 ↓ 键行为一致

#### Scenario: k 键向上移动光标
- **WHEN** 用户在非搜索模式下按 k 键
- **THEN** 光标向上移动到上一个 choice (跳过 separator), 与按 ↑ 键行为一致

#### Scenario: j 键在底部不动
- **WHEN** 光标在最后一个 choice 时按 j 键
- **THEN** 光标不移动

#### Scenario: k 键在顶部不动
- **WHEN** 光标在第一个 choice 时按 k 键
- **THEN** 光标不移动

#### Scenario: "/" 键进入搜索模式
- **WHEN** enableSearch 为 true 且用户在非搜索模式下按 "/" 键
- **THEN** 进入搜索模式, 搜索栏变为正常亮度, 后续字母输入追加到搜索文本

#### Scenario: "/" 键在搜索不启用时无效果
- **WHEN** enableSearch 为 false 且用户按 "/" 键
- **THEN** 无任何效果

#### Scenario: Escape 退出搜索模式
- **WHEN** 用户在搜索模式下按 Escape 键
- **THEN** 退出搜索模式, 搜索文本和过滤结果保留, 搜索栏变灰

#### Scenario: "/" 退出搜索模式
- **WHEN** 用户在搜索模式下按 "/" 键
- **THEN** 退出搜索模式, 搜索文本和过滤结果保留

#### Scenario: 搜索模式下 j/k 作为搜索字符
- **WHEN** 用户在搜索模式下按 j 或 k 键
- **THEN** 字符追加到搜索文本, 不触发导航

#### Scenario: 搜索模式下方向键仍可导航
- **WHEN** 用户在搜索模式下按 ↑ 或 ↓ 键
- **THEN** 光标正常移动, 与非搜索模式下方向键行为一致

#### Scenario: 非搜索模式下字母键不触发搜索
- **WHEN** enableSearch 为 true 且用户在非搜索模式下按字母键 (非 j/k)
- **THEN** 无任何效果, 不进入搜索模式也不追加到搜索文本

#### Scenario: Backspace 空搜索文本退出搜索模式
- **WHEN** 用户在搜索模式下且搜索文本为空时按 Backspace
- **THEN** 退出搜索模式

#### Scenario: 底部指引显示正确按键
- **WHEN** enableSearch 为 true 且非搜索模式
- **THEN** 底部显示 `(j/k or ↑↓ move, / search, space select, ctrl+a toggle all, enter confirm)`

#### Scenario: 搜索模式底部指引
- **WHEN** 用户处于搜索模式
- **THEN** 底部显示 `(↑↓ move, esc exit search, space select, ctrl+a toggle filtered, enter confirm)`
