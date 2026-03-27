## MODIFIED Requirements

### Requirement: 搜索模式进入与退出
按 "/" 键进入搜索模式, 按 Escape 或再次按 "/" 退出搜索模式.

- **搜索模式**: 按 "/" 键进入搜索模式, 按 Escape, Enter 或再次按 "/" 退出搜索模式
- **非搜索模式下**: 字母输入不触发搜索, 仅在搜索模式下输入字符才过滤列表
- **搜索模式退出 (Enter)**: Enter 退出搜索模式, 保留搜索文本和过滤结果
- **搜索模式退出 (Esc)**: Escape 退出搜索模式, 保留搜索文本但清除过滤, 恢复完整列表
- **搜索模式退出 (Backspace)**: Backspace 在搜索文本为空时退出搜索模式并清除过滤
- **enableSearch 为 false 时**: "/" 键无效果

#### Scenario: "/" 键进入搜索模式
- **WHEN** enableSearch 为 true 且用户在非搜索模式下按 "/" 键
- **THEN** 进入搜索模式, 搜索栏变为正常亮度, 后续字母输入追加到搜索文本

#### Scenario: "/" 键在搜索不启用时无效果
- **WHEN** enableSearch 为 false 且用户按 "/" 键
- **THEN** 无任何效果

#### Scenario: Escape 退出搜索模式并清除过滤
- **WHEN** 用户在搜索模式下按 Escape 键
- **THEN** 退出搜索模式, 搜索文本保留 (再次按 "/" 可见), 但过滤清除, 恢复显示完整列表, 搜索栏变灰

#### Scenario: Enter 退出搜索模式并保留过滤
- **WHEN** 用户在搜索模式下按 Enter 键
- **THEN** 退出搜索模式, 搜索文本和过滤结果均保留, 用户继续在过滤后的列表中选择

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
- **THEN** 退出搜索模式, 清除过滤, 恢复完整列表

#### Scenario: Esc 退出后再次进入搜索保留文本
- **WHEN** 用户在搜索模式下按 Esc 退出, 然后再按 "/" 进入搜索模式
- **THEN** 搜索栏显示之前的搜索文本, 用户可在此基础上修改

#### Scenario: Enter 退出后非搜索模式下 Enter 确认选择
- **WHEN** 用户在搜索模式下按 Enter 退出搜索, 然后在非搜索模式下再按 Enter
- **THEN** 确认当前选择并退出选择器, 返回选中项

### Requirement: 搜索过滤状态解耦
searchQuery 文本与过滤激活状态 SHALL 解耦为独立状态.  `isFiltered` 控制是否对列表应用过滤, `searchQuery` 仅存储文本.

#### Scenario: 输入搜索字符自动激活过滤
- **WHEN** 用户在搜索模式下输入字符
- **THEN** isFiltered 设为 true, 列表按 searchQuery 过滤

#### Scenario: Esc 退出搜索清除过滤但保留文本
- **WHEN** 用户在搜索模式下按 Esc
- **THEN** isFiltered 设为 false, 列表恢复完整显示, searchQuery 文本不变

#### Scenario: Enter 退出搜索保留过滤
- **WHEN** 用户在搜索模式下按 Enter
- **THEN** isFiltered 保持 true, 列表仍按 searchQuery 过滤

### Requirement: 搜索模式按键表
interactiveCheckbox 组件的按键行为 SHALL 遵循以下映射:

| 键 | 非搜索模式 | 搜索模式 |
|------|------------|----------|
| j / k | 向下/向上移动光标 | 作为搜索字符输入 |
| G (Shift+G) | 跳转到末尾或指定行 | 作为搜索字符输入 |
| gg | 跳转到列表开头 | 作为搜索字符输入 |
| 数字 0-9 | 追加到数字缓冲 | 作为搜索字符输入 |
| q | 退出程序 | 作为搜索字符输入 |
| / | 进入搜索模式 | 退出搜索模式 (保留过滤) |
| Space | 切换选中状态 | 切换选中状态 |
| Ctrl+A | 全选/全取消 | 全选/全取消 (仅操作过滤结果) |
| Enter | 确认选择 | 退出搜索模式 (保留过滤) |
| Ctrl+C | 取消并退出 | 取消并退出 |
| Escape | 无效果 | 退出搜索模式 (清除过滤, 保留文本) |
| Backspace | 无效果 | 删除搜索字符; 空时退出并清除过滤 |

#### Scenario: 搜索模式下 Enter 不直接确认选择
- **WHEN** 用户在搜索模式下按 Enter
- **THEN** 退出搜索模式, 不触发选择确认, 过滤结果保留

#### Scenario: 非搜索模式下 Enter 确认选择
- **WHEN** 用户在非搜索模式下按 Enter
- **THEN** 确认选择并退出选择器

### Requirement: 底部指引文本
底部指引 SHALL 根据当前模式和搜索状态显示对应的按键提示.

- enableSearch 且非搜索模式: `(j/k or ↑↓ move, gg/G jump, / search, space select, ctrl+a all, q quit, enter confirm)`
- enableSearch 且搜索模式: `(↑↓ move, enter accept, esc cancel search, space select, ctrl+a toggle filtered)`
- 非 enableSearch: `(j/k or ↑↓ move, gg/G jump, space select, ctrl+a all, q quit, enter confirm)`

#### Scenario: 底部指引显示正确按键 (非搜索模式, enableSearch)
- **WHEN** enableSearch 为 true 且非搜索模式
- **THEN** 底部显示 `(j/k or ↑↓ move, gg/G jump, / search, space select, ctrl+a all, q quit, enter confirm)`

#### Scenario: 搜索模式底部指引
- **WHEN** 用户处于搜索模式
- **THEN** 底部显示 `(↑↓ move, enter accept, esc cancel search, space select, ctrl+a toggle filtered)`

#### Scenario: 底部指引显示正确按键 (非搜索模式, 非 enableSearch)
- **WHEN** enableSearch 为 false
- **THEN** 底部显示 `(j/k or ↑↓ move, gg/G jump, space select, ctrl+a all, q quit, enter confirm)`

## MODIFIED Test Cases

### interactiveCheckbox

#### 搜索模式

- test_checkbox_escape_exitsSearchMode_clearsFilter: 搜索模式下 Escape 退出搜索模式, 保留搜索文本但清除过滤
- test_checkbox_enter_exitsSearchMode_keepsFilter: 搜索模式下 Enter 退出搜索模式, 保留搜索文本和过滤
- test_checkbox_enter_inSearchMode_doesNotConfirm: 搜索模式下 Enter 不触发选择确认
- test_checkbox_enter_afterSearchExit_confirmsSelection: 退出搜索模式后 Enter 确认选择
- test_checkbox_esc_thenSlash_showsPreviousQuery: Esc 退出后再 "/" 进入, 显示之前的搜索文本
- test_checkbox_backspace_emptySearch_clearsFilter: 空搜索文本 Backspace 退出并清除过滤
- test_checkbox_searchInput_activatesFilter: 搜索输入自动激活 isFiltered
