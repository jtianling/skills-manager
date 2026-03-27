## 1. buildDisplayItems 扩展

- [x] 1.1 扩展 `buildDisplayItems` 函数签名, 增加 `collapsed: Set<string>` 参数
- [x] 1.2 实现折叠逻辑: 当 group-header 的 subGroupName 在 collapsed set 中时, 跳过其子项 choice 的添加
- [x] 1.3 确保 group-header 自身始终添加到 displayItems (无论折叠与否)
- [x] 1.4 确保 choiceCount (行号) 只计算可见的 choice 项

## 2. 折叠状态管理与渲染

- [x] 2.1 在 interactiveCheckbox 中添加 `collapsed: Set<string>` 状态
- [x] 2.2 修改 render 中 group-header 的渲染, 在三态图标前添加折叠图标 (`▶` 折叠 / `▼` 展开)
- [x] 2.3 搜索模式下调用 buildDisplayItems 时传空 `new Set()` 忽略折叠

## 3. 快捷键实现

- [x] 3.1 实现 `h` 键和 `left` 键: 光标在 group-header 上时折叠该组, 重建 displayItems 并 render
- [x] 3.2 实现 `l` 键和 `right` 键: 光标在 group-header 上时展开该组, 重建 displayItems 并 render
- [x] 3.3 实现 `c` 键: 全局 toggle 折叠/展开 — 有任意 group 展开则全部折叠, 否则全部展开
- [x] 3.4 全局折叠后光标重定位: 如果当前 cursor 指向被隐藏的 choice, 移到最近的可聚焦项

## 4. 帮助栏更新

- [x] 4.1 非搜索模式帮助栏增加 `h/l fold, c fold all` 提示
- [x] 4.2 确保搜索模式帮助栏不包含折叠相关提示

## 5. 单元测试

- [x] 5.1 测试 buildDisplayItems 传入 collapsed set 时正确跳过子项
- [x] 5.2 测试 buildDisplayItems 折叠时 group-header 仍存在且 childIndices 正确
- [x] 5.3 测试 getGroupState 在折叠状态下仍基于全部子项计算

## 6. E2E 测试

- [x] 6.1 E2E 测试: 使用 tmux 验证 h/l 键折叠/展开行为 (纯 UI 操作)
- [x] 6.2 E2E 测试: 使用 tmux 验证 c 键全局 toggle 行为
- [x] 6.3 E2E 测试: 验证折叠状态下 space 选中仍然生效
- [x] 6.4 E2E 测试: 验证搜索模式忽略折叠状态
