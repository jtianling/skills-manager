## Context

`interactiveCheckbox` 组件 (`src/utils/interactive-select.ts`) 是一个自定义 readline 实现的交互列表, 用于 `init` 和 `install` 命令中的多选.  当前导航仅支持方向键, 搜索在选项 >20 时自动激活, 任意字母输入即触发过滤.  这导致: (1) vim 用户无法用习惯的 j/k 导航; (2) 搜索与导航字符冲突, 无法在搜索启用时用字母键做其他操作.

## Goals / Non-Goals

**Goals:**
- j/k 键映射为 下/上 导航, 与方向键行为一致
- 搜索改为 "/" 键触发的模式切换: 按 "/" 进入搜索模式, Escape 退出搜索模式
- 搜索模式下字母输入搜索文本, 非搜索模式下 j/k 用于导航
- 底部指引文本更新以反映新按键

**Non-Goals:**
- 不改变 inquirer list 提示 (promptMode, promptSyncAction 等) 的行为
- 不增加其他 vim 快捷键 (如 gg, G, Ctrl+D 等)
- 不改变搜索过滤逻辑本身 (仍为大小写不敏感 name 匹配)

## Decisions

### 1. 搜索模式状态机

引入 `isSearchMode: boolean` 状态变量:
- 初始值 `false`
- 按 "/" 切换为 `true`, 显示搜索栏光标激活状态
- 按 Escape 切换为 `false`, 保留当前搜索文本和过滤结果
- 按 Enter 时: 无论搜索模式状态, 都确认选择

**替代方案**: 用 "/" 进入, 再次 "/" 退出.  不采用, 因为 "/" 可能是搜索文本的一部分, 且 Escape 是更自然的"退出模式"键.

### 2. j/k 导航映射

在 `handleKeypress` 中:
- 非搜索模式: `j` → `findNextChoice()`, `k` → `findPrevChoice()`, 与 down/up 逻辑完全相同
- 搜索模式: `j`/`k` 作为搜索字符输入 (现有行为)

**替代方案**: j/k 始终导航, 搜索模式也不例外.  不采用, 因为搜索时可能需要输入包含 j/k 的关键词.

### 3. 搜索模式下的键盘分流

搜索模式 (`isSearchMode === true`):
- 字母/数字/特殊字符 → 追加到 searchQuery
- Backspace → 删除 searchQuery 最后一个字符, 若 searchQuery 为空则退出搜索模式
- Escape → 退出搜索模式 (保留 searchQuery)
- ↑/↓ → 导航 (搜索模式下仍可用方向键导航)
- Space → 选择 (不变)
- "/" → 退出搜索模式 (作为备用退出方式)

非搜索模式 (`isSearchMode === false`):
- j/k → 导航
- ↑/↓ → 导航 (不变)
- "/" → 进入搜索模式 (仅在 enableSearch 时)
- 其他字母 → 忽略 (不再自动触发搜索)
- Space, Enter, Ctrl+A, Ctrl+C → 不变

### 4. 搜索栏视觉反馈

搜索模式激活时, 搜索栏显示闪烁光标效果 (已有的 `│` 字符变为正常亮度):
- 搜索模式: `🔍 Search: {query}│`
- 非搜索模式: `🔍 Search: {query}` (无光标) 或 `🔍 /{query}` (显示 "/" 前缀以提示)

采用: 搜索模式时搜索栏正常显示, 非搜索模式时搜索栏变灰 (dim), 以示区分.

## Risks / Trade-offs

- **[习惯差异]** 部分用户可能期望搜索模式下 j/k 仍导航 → 保留方向键在搜索模式下可用, 满足此需求
- **[Backspace 空搜索退出]** 搜索文本为空时 Backspace 退出搜索模式可能意外 → 行为符合多数编辑器惯例 (如 vim `/` 搜索), 可接受
- **[enableSearch=false 时的 "/" 键]** 选项 ≤20 时搜索不启用, "/" 键无效果 → 一致性: 不启用搜索就不响应 "/", 避免困惑
