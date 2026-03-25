## Why

当前 interactive-select 列表仅支持 j/k 和方向键导航, 对于熟悉 vi 操作习惯的用户, 缺少行号显示和快速跳转能力, 在长列表中定位效率低.  添加 vi 风格的扩展快捷键能显著提升导航体验.

## What Changes

- 列表每行前面添加行号显示(从 1 开始)
- 支持 `gg` 快捷键跳转到列表开头
- 支持 `G` (Shift+G) 快捷键跳转到列表末尾
- 支持数字 + `G` 快捷键直接跳转到指定行号(如 `5G` 跳到第 5 行)
- 支持 `q` 键直接退出程序
- 非 interactive-select 识别的按键一律忽略, 不产生任何副作用

## Capabilities

### New Capabilities

### Modified Capabilities
- `cli-interaction`: interactive-select 组件新增行号显示, vi 风格跳转快捷键(gg/G/数字+G/q), 以及未识别按键忽略行为

## Impact

- 受影响代码: `src/utils/interactive-select.ts` 的渲染逻辑和按键处理逻辑
- 行号显示会略微增加每行宽度, 需要调整渲染布局
- 数字+G 需要维护一个数字输入缓冲区状态
- 不影响 API, 依赖或外部系统
