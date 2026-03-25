## 1. 搜索模式状态机

- [x] 1.1 在 `interactiveCheckbox` 中添加 `isSearchMode` 状态变量, 初始值 `false`
- [x] 1.2 实现 "/" 键处理: enableSearch 为 true 时切换搜索模式开/关
- [x] 1.3 实现 Escape 键处理: 搜索模式下退出搜索模式, 保留搜索文本
- [x] 1.4 实现 Backspace 在搜索文本为空时退出搜索模式

## 2. j/k 导航

- [x] 2.1 非搜索模式下 j 键调用 `findNextChoice()` + 滚动调整 (与 down 逻辑一致)
- [x] 2.2 非搜索模式下 k 键调用 `findPrevChoice()` + 滚动调整 (与 up 逻辑一致)

## 3. 键盘事件分流重构

- [x] 3.1 重构 `handleKeypress`: 将搜索字符输入限制在 `isSearchMode === true` 时才生效
- [x] 3.2 非搜索模式下忽略字母/数字键 (不自动触发搜索)
- [x] 3.3 搜索模式下 j/k 作为搜索字符输入, 不触发导航

## 4. 视觉反馈

- [x] 4.1 搜索栏根据 `isSearchMode` 切换显示: 激活时正常亮度, 未激活时 dim
- [x] 4.2 更新底部指引文本: enableSearch 非搜索模式显示 `(j/k or ↑↓ move, / search, ...)`; 搜索模式显示 `(↑↓ move, esc exit search, ...)`; 非 enableSearch 显示 `(j/k or ↑↓ move, ...)`

## 5. Spec 同步

- [x] 5.1 更新 `openspec/specs/cli-interaction/spec.md` 中的键盘操作表和测试用例
