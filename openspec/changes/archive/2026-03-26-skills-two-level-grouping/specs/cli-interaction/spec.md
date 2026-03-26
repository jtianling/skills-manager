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
- choices 可选携带 `subGroup` 字段, 同一 subGroup 的 choices 在分组标题下额外聚合
- `subGroup` 值变化时插入 group-header 行, 格式: `{subGroup} ({childCount})`
- group-header 可聚焦、可选择, 但不出现在返回值中
- 无 `subGroup` 字段时行为与变更前一致

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
- **搜索过滤与 group-header**: 无匹配子项的 group-header 隐藏, 有匹配子项的 group-header 正常显示

**搜索栏视觉状态**:
- 搜索模式激活: 搜索栏正常亮度显示
- 非搜索模式 (有搜索文本): 搜索栏变灰 (dim) 显示
- 无搜索文本且非搜索模式: 搜索栏变灰

**行号显示**:
- 每个 choice 项前显示行号, 从 1 开始连续编号
- separator 和 group-header 不分配行号, 对应位置空格填充
- 行号右对齐, 宽度 = 总 choice 数的位数
- 搜索过滤后行号重新从 1 编号
- 格式: `{lineNumber} {prefix} {checkbox} {name}{suffix}`

**键盘操作**:
| 键 | 非搜索模式 | 搜索模式 |
|----|-----------|---------|
| ↑ / ↓ | 移动光标, 跳过 separator (不跳过 group-header) | 移动光标, 跳过 separator (不跳过 group-header) |
| j / k | 向下/向上移动光标 (与 ↓/↑ 行为一致) | 作为搜索字符输入 |
| G (Shift+G) | 跳转到末尾 (无数字缓冲) 或跳转到指定行 (有数字缓冲) | 作为搜索字符输入 |
| gg | 跳转到列表开头 | 作为搜索字符输入 |
| 数字 0-9 | 追加到数字缓冲 (用于数字+G 跳转) | 作为搜索字符输入 |
| q | 退出程序 (与 Ctrl+C 一致) | 作为搜索字符输入 |
| / | 进入搜索模式 (仅 enableSearch 时) | 退出搜索模式 |
| Space | 切换当前项的选中状态; 若光标在 group-header 上, 批量切换所有子项 | 切换当前项的选中状态; 若光标在 group-header 上, 批量切换所有子项 |
| Ctrl+A | 全选/全取消 | 全选/全取消 (仅操作过滤结果) |
| Enter | 确认选择 | 确认选择 |
| Ctrl+C | 取消并退出 | 取消并退出 |
| Escape | 无效果 | 退出搜索模式 (保留搜索文本) |
| Backspace | 无效果 | 删除搜索文本最后一个字符; 文本为空时退出搜索模式 |
| 字母/数字 (其他) | 忽略 (不触发搜索) | 追加到搜索文本 |

**底部指引文本**:
- enableSearch 且非搜索模式: `(j/k or ↑↓ move, gg/G jump, / search, space select, ctrl+a all, q quit, enter confirm)`
- enableSearch 且搜索模式: `(↑↓ move, esc exit search, space select, ctrl+a toggle filtered, enter confirm)`
- 非 enableSearch: `(j/k or ↑↓ move, gg/G jump, space select, ctrl+a all, q quit, enter confirm)`

**选中状态显示**:
- 选中: `◉` (绿色)
- 未选中: `◯`
- 部分选中 (仅 group-header): `◐` (黄色)
- 光标所在: `❯` (青色) 前缀, 名称高亮 (青色)
- 后缀: `[deployed]` (黄色, 如果有 suffix)

**描述显示**:
- 仅在光标所在项显示 description (group-header 无 description)
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
- 按 source 分组, 并按 subGroup 显示 group-header

**install 命令中的选择**:
- 无分组 (没有 group 字段)
- 无 `[deployed]` 标记
- 无默认选中

#### Scenario: group-header 在 separator 下显示
- **WHEN** choices 包含 subGroup 字段, 且同一 group 下有多个不同 subGroup
- **THEN** 每个 subGroup 的第一个 choice 前插入 group-header 行, group-header 显示在 separator 之后

#### Scenario: Space 键在 group-header 上批量切换
- **WHEN** 光标在 group-header 上, 用户按 Space
- **THEN** 该 group-header 下所有子项的选中状态批量切换 (partial/none → all, all → none)

#### Scenario: 光标可停在 group-header 上
- **WHEN** 用户按 ↑ 或 ↓ 键, 且下一项为 group-header
- **THEN** 光标停在 group-header 上 (不跳过)

#### Scenario: 无 subGroup 时无 group-header
- **WHEN** 所有 choices 均无 subGroup 字段
- **THEN** 不显示任何 group-header, 行为与变更前一致
