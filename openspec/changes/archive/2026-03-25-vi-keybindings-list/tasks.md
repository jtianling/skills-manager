## 1. 行号显示

- [x] 1.1 在 interactiveCheckbox 中计算 choice 行号映射 (choiceIndex → lineNumber), separator 跳过
- [x] 1.2 修改渲染逻辑, 在每个 choice 行前添加右对齐行号, separator 行添加空格填充
- [x] 1.3 搜索过滤后重新计算行号 (从 1 开始编号)

## 2. 状态管理

- [x] 2.1 添加 numberBuffer (string) 状态, 用于数字+G 跳转的数字输入缓冲
- [x] 2.2 添加 lastKeyWasG (boolean) 状态, 用于 gg 双击检测

## 3. 快捷键实现

- [x] 3.1 实现 G (Shift+G) 键: 无数字缓冲时跳到末尾, 有数字缓冲时跳到指定行号
- [x] 3.2 实现 gg 键: 连续两次 g 跳到列表开头
- [x] 3.3 实现数字键 0-9: 非搜索模式下追加到 numberBuffer
- [x] 3.4 实现 q 键: 非搜索模式下退出程序 (与 Ctrl+C 一致)
- [x] 3.5 确保所有新快捷键在搜索模式下不生效 (字符作为搜索输入)
- [x] 3.6 确保非识别按键处理时清空 numberBuffer 和重置 lastKeyWasG

## 4. 底部指引更新

- [x] 4.1 更新非搜索模式 (enableSearch) 底部指引: 添加 gg/G jump 和 q quit
- [x] 4.2 更新非搜索模式 (非 enableSearch) 底部指引: 添加 gg/G jump 和 q quit

## 5. 验证

- [x] 5.1 手动测试 init 命令的 skill 列表: 行号显示, 分组 separator 行号跳过, gg/G/数字+G/q 各快捷键
- [x] 5.2 手动测试 install 命令的 skill 列表: 无分组场景下行号和快捷键
- [x] 5.3 手动测试搜索模式: 过滤后行号重编, 搜索模式下新快捷键不生效
