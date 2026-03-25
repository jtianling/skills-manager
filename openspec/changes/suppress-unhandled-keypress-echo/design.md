## Context

`interactiveCheckbox` 使用 Node.js `readline` 模块来监听 keypress 事件.  当前创建 readline interface 时传入了 `output: process.stdout`, 导致 readline 在 JS 层面对输入字符进行回显.  虽然 `setRawMode(true)` 关闭了操作系统层面的回显, 但 readline 自身的回显机制独立于此.

当用户按下未被 `handleKeypress` 处理的按键时, 字符直接输出到终端, 破坏了 TUI 界面.

## Goals / Non-Goals

**Goals:**
- 从根源消除 readline 的字符回显, 使任何未处理按键都不产生可见输出

**Non-Goals:**
- 不重构 keypress 处理逻辑的整体架构
- 不更换 readline 为其他 keypress 库

## Decisions

### Decision 1: 使用 NullWritable 替代 process.stdout

将 `readline.createInterface` 的 `output` 替换为一个不输出任何内容的 Writable stream.

```typescript
import { Writable } from 'stream';

const nullOutput = new Writable({ write(_chunk, _encoding, callback) { callback(); } });

const rl = readline.createInterface({
  input: process.stdin,
  output: nullOutput,
});
```

**替代方案考虑**:
- 方案B `terminal: false`: 可能影响 `readline.emitKeypressEvents` 对 raw mode 的检测
- 方案C 不传 rl 给 `emitKeypressEvents`: 文档未明确保证此用法的稳定性

方案A 最安全, 不改变 readline 的内部行为, 只切断输出通道.

## Risks / Trade-offs

- [风险] NullWritable 引入额外对象 → 影响极小, 每次调用只创建一个轻量 stream 实例
- [风险] readline 内部依赖 output 的其他功能 → 我们只用 readline 来 emit keypress events, 不使用 prompt/question 等功能, 无影响
