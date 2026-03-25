## Why

`init` 命令的交互列表(agent 目标选择, skills 列表选择)目前仅支持方向键导航, 不支持 vim 风格的 j/k 上下移动.  同时搜索功能在有大量选项时自动激活, 任意字母输入即触发搜索, 与导航操作容易冲突.  需要改为 j/k 导航 + "/" 前缀触发搜索, 提供更符合开发者习惯的交互体验.

## What Changes

- 交互列表组件新增 j/k 键支持: j = 向下移动, k = 向上移动(与方向键行为一致)
- 搜索模式改为 "/" 键触发: 按 "/" 进入搜索模式, 之后输入字符才开始过滤列表
- 搜索模式下按 Escape 或再次按 "/" 退出搜索模式, 恢复普通导航
- 搜索模式下 j/k 作为搜索字符输入, 不触发导航

## Capabilities

### New Capabilities

(无新 capability, 变更在已有 capability 范围内)

### Modified Capabilities

- `cli-interaction`: 键盘操作规范变更 - 新增 j/k 导航, 搜索触发方式从直接输入改为 "/" 前缀模式

## Impact

- `src/utils/interactive-select.ts`: 键盘事件处理逻辑修改
- `openspec/specs/cli-interaction/spec.md`: 键盘操作规范更新
