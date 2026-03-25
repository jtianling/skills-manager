## 1. 修复 readline 回显

- [x] 1.1 在 `src/utils/interactive-select.ts` 中导入 `Writable` from `stream`
- [x] 1.2 创建 NullWritable stream, 替换 `readline.createInterface` 的 `output: process.stdout` 为 `output: nullOutput`

## 2. 补全未识别按键的 fallthrough 防护

- [x] 2.1 在 `handleKeypress` 函数末尾添加显式 `return`, 确保所有未匹配路径都静默退出

## 3. 验证

- [x] 3.1 手动测试: 在 `skillsmgr init` 的 skill 选择界面按 a, x, z 等未识别按键, 确认无字符回显
