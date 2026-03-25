## Context

interactive-select 组件 (`src/utils/interactive-select.ts`) 是 skillsmgr 的核心列表交互组件, 当前支持 j/k 和方向键导航, 搜索过滤, 分组显示等功能.  用户希望扩展 vi 风格导航, 包括行号显示和快速跳转.

当前渲染格式为: `{prefix} {checkbox} {name}{suffix}`, 需要在前面插入行号.

当前按键处理在 readline keypress handler 中, 通过 key.name 和 key.sequence 判断, 非搜索模式下未识别的字母键已经被忽略.

## Goals / Non-Goals

**Goals:**
- 每行显示行号, 方便用户快速定位目标项
- 支持 gg/G/数字+G 跳转, 提升长列表导航效率
- 支持 q 键快速退出
- 未识别按键静默忽略, 不产生副作用

**Non-Goals:**
- 不实现完整的 vi 模式 (如 visual mode, yank 等)
- 不改变搜索模式下的行为 (搜索模式下数字/字母仍作为搜索字符)
- 不支持 hjl 等横向移动 (列表是单列的)
- 不改变现有 j/k/方向键/Space/Enter/Ctrl+A/Ctrl+C 的行为

## Decisions

### 行号显示方案

行号基于可见的 choice 项从 1 开始编号, separator (组标题) 不分配行号.  行号右对齐, 宽度取决于总条目数的位数 (如 1-9 为 1 位, 10-99 为 2 位).  行号紧跟一个空格后接原有的 prefix.

格式: `{lineNumber} {prefix} {checkbox} {name}{suffix}`

separator 行对应行号位置显示空格填充.

选择行号基于 choice 而非 displayItem 是因为: separator 不可选, 用户跳转的目标只会是可选条目.  这让 `5G` 的语义清晰: 跳到第 5 个可选项.

### 数字输入缓冲区

在非搜索模式下, 维护一个 `numberBuffer: string` 状态.  按数字键时追加到缓冲区.  按 G (Shift+G) 时:
- 如果 numberBuffer 非空: 解析为数字, 跳转到对应行号的 choice, 清空 buffer
- 如果 numberBuffer 为空: 跳转到最后一个 choice

按非数字非 G 的键时清空 numberBuffer (gg 除外).

### gg 双击检测

维护一个 `lastKeyWasG: boolean` 状态.  按 g (小写) 时:
- 如果 lastKeyWasG 为 true: 执行跳转到第一个 choice, 重置状态
- 如果 lastKeyWasG 为 false: 设置 lastKeyWasG = true, 等待下一次按键

按其他键时重置 lastKeyWasG 为 false.

注意: 不使用 `numberBuffer` 来处理 gg, 因为 g 不是数字.  两者独立管理.

### q 键退出

非搜索模式下按 q 键, 执行与 Ctrl+C 相同的退出流程: cleanup → 输出 "Cancelled." → process.exit(0).

### 搜索模式下的隔离

所有新增快捷键 (gg/G/数字+G/q) 仅在非搜索模式下生效.  搜索模式下数字和字母继续作为搜索字符输入, 保持现有行为不变.

### 行号在搜索过滤后的行为

搜索过滤后, 行号重新从 1 编号, 基于过滤后的 choice 列表.  这样 `5G` 始终跳到当前可见的第 5 项, 不会跳到不可见的项.

## Risks / Trade-offs

- [行号占用宽度] → 行号最多占 3-4 字符 (含空格), 对 80 列终端影响很小.  如果条目数超过 999 则占更多, 但实际场景极少.
- [numberBuffer 超时] → 不实现超时清除, 用户按数字后必须按 G 或其他键触发.  这与 vi 行为一致, 复杂度低.
- [gg 误触] → 用户快速按两次 g 才触发跳转到顶部, 单次 g 无效果.  搜索模式下 g 作为搜索字符, 不受影响.
