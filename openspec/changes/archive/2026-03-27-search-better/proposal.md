## Why

interactiveCheckbox 搜索模式下, Enter 键直接确认选择并退出整个选择器, 与用户 "确认搜索结果" 的心理预期不符.  用户输入搜索词后按 Enter, 期望的是锁定过滤结果并继续选择, 而非提交.  同时 Esc 退出搜索但保留过滤, 缺少 "取消搜索并恢复完整列表" 的操作.

## What Changes

- 搜索模式下 Enter 改为退出搜索模式并保留过滤结果, 不再直接确认选择
- Esc 退出搜索模式时清除过滤, 恢复完整列表 (但保留 searchQuery 文本, 再次按 `/` 可见之前的输入)
- 需要将 "searchQuery 文本" 与 "是否激活过滤" 解耦为独立状态

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `cli-interaction`: 搜索模式下 Enter 和 Esc 的行为变更, 新增 isFiltered 状态与 searchQuery 解耦

## Impact

- 文件: `src/utils/interactive-select.ts` — 核心按键处理和渲染逻辑
- 测试: `src/utils/interactive-select.test.ts` — 搜索模式相关测试用例需更新
- Spec: `openspec/specs/cli-interaction/spec.md` — 搜索模式按键行为描述需同步更新
