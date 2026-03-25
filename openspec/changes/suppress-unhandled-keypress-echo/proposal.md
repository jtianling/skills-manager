## Why

interactiveCheckbox 组件在非搜索模式下, 按下未识别的按键 (如 a, x, z 等) 会导致字符回显到终端, 显示在列表下方, 造成界面混乱.  根本原因是 `readline.createInterface` 配置了 `output: process.stdout`, readline 在 JS 层面进行字符回显.  这违反了 cli-interaction spec 中 "未识别按键忽略" 的需求 (397-402行).

## What Changes

- 修改 `readline.createInterface` 配置, 移除 `output: process.stdout`, 改用无输出的 Writable stream, 从根源上抑制 readline 的字符回显
- 确保 `handleKeypress` 函数对所有未识别按键路径都有明确的 return, 防止意外 fallthrough

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `cli-interaction`: 修复已有需求 "未识别按键忽略" 的实现, 不改变 spec 本身

## Impact

- 受影响文件: `src/utils/interactive-select.ts`
- 影响范围: `init` 和 `install` 命令中使用 interactiveCheckbox 的所有交互式选择界面
- 无 API 变更, 无依赖变更
