## ADDED Requirements

### Requirement: 列表行号显示
interactiveCheckbox 组件 SHALL 在每个 choice 项前显示行号.  行号从 1 开始, 基于当前可见的 choice 列表顺序编号.  separator (组标题) 不分配行号, 对应位置显示空格填充.  行号右对齐, 宽度等于总 choice 数的位数.

显示格式: `{lineNumber} {prefix} {checkbox} {name}{suffix}`

#### Scenario: 基本行号显示
- **WHEN** interactiveCheckbox 显示 5 个 choice 项 (无 separator)
- **THEN** 每行前显示行号 1 到 5, 右对齐, 宽度 1 位

#### Scenario: 两位数行号右对齐
- **WHEN** interactiveCheckbox 显示 12 个 choice 项
- **THEN** 行号 1-9 前补空格, 显示为 ` 1` 到 ` 9`, 行号 10-12 显示为 `10` 到 `12`

#### Scenario: separator 不分配行号
- **WHEN** 列表包含 separator (组标题) 和 choice 项
- **THEN** separator 行的行号位置显示空格填充, choice 项行号连续不跳号

#### Scenario: 搜索过滤后行号重编
- **WHEN** 用户搜索过滤后显示 3 个结果
- **THEN** 行号重新从 1 到 3 编号, 不保留原始行号

### Requirement: G 键跳转到列表末尾
非搜索模式下, 按 G (Shift+G) 且无数字缓冲时, 光标 SHALL 跳转到列表最后一个 choice 项.

#### Scenario: G 跳到末尾
- **WHEN** 用户在非搜索模式下按 G (Shift+G), 且之前未输入数字
- **THEN** 光标跳转到最后一个 choice 项, 视口自动滚动以显示该项

#### Scenario: 搜索模式下 G 作为搜索字符
- **WHEN** 用户在搜索模式下按 G
- **THEN** 字符 "G" 追加到搜索文本, 不触发跳转

### Requirement: gg 跳转到列表开头
非搜索模式下, 连续按两次 g (小写) SHALL 使光标跳转到列表第一个 choice 项.

#### Scenario: gg 跳到开头
- **WHEN** 用户在非搜索模式下连续按两次 g
- **THEN** 光标跳转到第一个 choice 项, 视口自动滚动以显示该项

#### Scenario: 单次 g 无效果
- **WHEN** 用户在非搜索模式下按一次 g, 然后按其他非 g 键
- **THEN** 无跳转效果, g 的等待状态被重置

#### Scenario: 搜索模式下 g 作为搜索字符
- **WHEN** 用户在搜索模式下按 g
- **THEN** 字符 "g" 追加到搜索文本, 不触发 gg 逻辑

### Requirement: 数字+G 跳转到指定行
非搜索模式下, 用户输入数字后按 G (Shift+G) SHALL 使光标跳转到对应行号的 choice 项.

#### Scenario: 数字+G 跳到指定行
- **WHEN** 用户在非搜索模式下依次按 5 和 G
- **THEN** 光标跳转到行号为 5 的 choice 项, 视口自动滚动以显示该项

#### Scenario: 多位数字+G 跳转
- **WHEN** 用户在非搜索模式下依次按 1, 2 和 G
- **THEN** 光标跳转到行号为 12 的 choice 项

#### Scenario: 数字超出范围时跳到末尾
- **WHEN** 用户输入的数字大于总 choice 数 (如列表有 10 项, 输入 99G)
- **THEN** 光标跳转到最后一个 choice 项

#### Scenario: 数字 0 跳到开头
- **WHEN** 用户输入 0G
- **THEN** 光标跳转到第一个 choice 项

#### Scenario: 按数字后按非 G 键清空缓冲
- **WHEN** 用户按数字 5 后按 j 键
- **THEN** 数字缓冲被清空, j 键正常执行向下移动

#### Scenario: 搜索模式下数字作为搜索字符
- **WHEN** 用户在搜索模式下按数字键
- **THEN** 数字追加到搜索文本, 不进入数字缓冲

### Requirement: q 键退出程序
非搜索模式下, 按 q 键 SHALL 退出程序, 行为与 Ctrl+C 一致.

#### Scenario: q 键退出
- **WHEN** 用户在非搜索模式下按 q 键
- **THEN** 执行 cleanup, 输出 "Cancelled.", 以退出码 0 退出程序

#### Scenario: 搜索模式下 q 作为搜索字符
- **WHEN** 用户在搜索模式下按 q 键
- **THEN** 字符 "q" 追加到搜索文本, 不退出程序

### Requirement: 未识别按键忽略
非搜索模式下, 未被 interactiveCheckbox 识别的按键 SHALL 被静默忽略, 不产生任何效果或副作用.

#### Scenario: 未识别按键无效果
- **WHEN** 用户在非搜索模式下按未识别的键 (如 x, z, 等)
- **THEN** 无任何效果, 列表状态不变, 不触发渲染

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

**搜索栏视觉状态**:
- 搜索模式激活: 搜索栏正常亮度显示
- 非搜索模式 (有搜索文本): 搜索栏变灰 (dim) 显示
- 无搜索文本且非搜索模式: 搜索栏变灰

**行号显示**:
- 每个 choice 项前显示行号, 从 1 开始连续编号
- separator 不分配行号, 对应位置空格填充
- 行号右对齐, 宽度 = 总 choice 数的位数
- 搜索过滤后行号重新从 1 编号
- 格式: `{lineNumber} {prefix} {checkbox} {name}{suffix}`

**键盘操作**:
| 键 | 非搜索模式 | 搜索模式 |
|----|-----------|---------|
| ↑ / ↓ | 移动光标, 跳过组标题 (separator) | 移动光标, 跳过组标题 |
| j / k | 向下/向上移动光标 (与 ↓/↑ 行为一致) | 作为搜索字符输入 |
| G (Shift+G) | 跳转到末尾 (无数字缓冲) 或跳转到指定行 (有数字缓冲) | 作为搜索字符输入 |
| gg | 跳转到列表开头 | 作为搜索字符输入 |
| 数字 0-9 | 追加到数字缓冲 (用于数字+G 跳转) | 作为搜索字符输入 |
| q | 退出程序 (与 Ctrl+C 一致) | 作为搜索字符输入 |
| / | 进入搜索模式 (仅 enableSearch 时) | 退出搜索模式 |
| Space | 切换当前项的选中状态 | 切换当前项的选中状态 |
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
- **WHEN** enableSearch 为 true 且用户在非搜索模式下按未识别的字母键
- **THEN** 无任何效果, 不进入搜索模式也不追加到搜索文本

#### Scenario: Backspace 空搜索文本退出搜索模式
- **WHEN** 用户在搜索模式下且搜索文本为空时按 Backspace
- **THEN** 退出搜索模式

#### Scenario: 底部指引显示正确按键 (非搜索模式, enableSearch)
- **WHEN** enableSearch 为 true 且非搜索模式
- **THEN** 底部显示 `(j/k or ↑↓ move, gg/G jump, / search, space select, ctrl+a all, q quit, enter confirm)`

#### Scenario: 搜索模式底部指引
- **WHEN** 用户处于搜索模式
- **THEN** 底部显示 `(↑↓ move, esc exit search, space select, ctrl+a toggle filtered, enter confirm)`

#### Scenario: 底部指引显示正确按键 (非搜索模式, 非 enableSearch)
- **WHEN** enableSearch 为 false
- **THEN** 底部显示 `(j/k or ↑↓ move, gg/G jump, space select, ctrl+a all, q quit, enter confirm)`
