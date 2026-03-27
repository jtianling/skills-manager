## 1. 状态解耦

- [x] 1.1 在 interactiveCheckbox 中新增 `isFiltered` 状态变量, 初始值 false
- [x] 1.2 修改 `buildDisplayItems` 调用, 传入 `isFiltered ? searchQuery : ''` 替代直接传 `searchQuery`
- [x] 1.3 修改 `updateSearch` 函数, 输入字符时同时设置 `isFiltered = true`

## 2. Enter 键行为

- [x] 2.1 修改 Enter 键处理: 搜索模式下退出搜索 (isSearchMode = false) 而非 resolve, 保留 isFiltered
- [x] 2.2 确保非搜索模式下 Enter 行为不变 (resolve 退出选择器)

## 3. Esc 键行为

- [x] 3.1 修改 Esc 键处理: 退出搜索模式时设置 `isFiltered = false`, 保留 searchQuery 文本
- [x] 3.2 修改 Backspace 空文本退出: 同时设置 `isFiltered = false`

## 4. 底部指引更新

- [x] 4.1 更新搜索模式底部指引文本为 `(↑↓ move, enter accept, esc cancel search, space select, ctrl+a toggle filtered)`

## 5. 测试

- [x] 5.1 更新 Esc 退出搜索测试: 验证保留 searchQuery 但清除过滤
- [x] 5.2 新增 Enter 退出搜索测试: 验证保留 searchQuery 和过滤, 不触发 resolve
- [x] 5.3 新增 Enter 退出搜索后再 Enter 确认测试: 验证两步操作流程
- [x] 5.4 新增 Esc 退出后再 "/" 进入测试: 验证 searchQuery 保留
- [x] 5.5 新增 Backspace 空文本退出清除过滤测试
