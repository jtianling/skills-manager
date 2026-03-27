## Context

interactiveCheckbox (`src/utils/interactive-select.ts`) 是自定义的 TUI 多选组件, 基于 Node.js readline + raw mode 实现.  当前 group-header 行可聚焦、可批量切换, 但子项始终全部展开.  当 skills 数量超过 30-40 个时, 列表过长, 滚动体验差.

现有数据流: `choices → buildDisplayItems(choices, searchQuery) → displayItems[] → render()`.  折叠状态需要嵌入这个流程.

## Goals / Non-Goals

**Goals:**
- 支持按组折叠/展开, 减少可见列表长度
- 提供直觉性快捷键: `h`/`←` 折叠, `l`/`→` 展开, `c` 全局 toggle
- 折叠状态与选中状态正交: 折叠的组仍可通过 space 批量操作
- 搜索模式忽略折叠, 确保所有 skills 可搜索

**Non-Goals:**
- 不支持嵌套折叠 (当前只有 subGroup 一层分组)
- 不支持记忆折叠状态 (每次打开列表都是默认全展开)
- 不修改 promptSkills 的数据构建逻辑

## Decisions

### 1. 折叠状态存储: `Set<string>` by subGroupName

用 `collapsed: Set<string>` 存储折叠的组名.  在 `buildDisplayItems` 中, 遇到 collapsed set 中的 group-header 时跳过其子项 choice.

**替代方案**: 在 DisplayItem 上加 `collapsed` 属性 → 拒绝, 因为 displayItems 每次搜索都重建, 状态会丢失.

### 2. 折叠集成到 buildDisplayItems

扩展 `buildDisplayItems(choices, searchQuery, collapsed)` 签名, 第三个参数 `collapsed: Set<string>`.  折叠的组: group-header 仍然加入 displayItems, 但子项不加入.  搜索模式下传空 `new Set()` 忽略折叠.

**替代方案**: 在 render 阶段过滤 → 拒绝, 因为 cursor/scroll 计算依赖 displayItems 长度, render 阶段过滤会导致 cursor 位置与实际可见项不匹配.

### 3. 折叠图标位置

group-header 当前渲染: `{padding} {prefix} {triIcon} {subGroupName} ({childCount})`.  在 triIcon 前添加折叠图标: `{padding} {prefix} {foldIcon} {triIcon} {subGroupName} ({childCount})`.  `▶` 折叠, `▼` 展开.

### 4. 快捷键方案: 单键操作

- `h` / `left`: 在 group-header 上折叠该组, 在 choice 上无操作
- `l` / `right`: 在 group-header 上展开该组, 在 choice 上无操作
- `c`: 全局 toggle — 任意组展开则全部折叠, 否则全部展开

这些键在非搜索模式下生效.  `h`/`l` 不与现有按键冲突 (当前 j/k 上下, g/G 跳转, / 搜索, q 退出, space 选中, ctrl+a 全选).

### 5. 折叠后光标行为

折叠时: 如果当前 cursor 指向被折叠的子项, 需要重新定位.  策略: 折叠后 rebuild displayItems, 然后将 cursor 移到对应的 group-header 位置.

展开时: cursor 保持在 group-header 不动.

## Risks / Trade-offs

- [折叠状态与 onToggle 回调] → onToggle 不受影响, 因为它操作 selected set (by choiceIndex), 与 displayItems 无关
- [折叠后行号不连续] → 可接受, 行号反映 choice 在过滤后列表中的位置; 折叠跳过的 choice 不分配行号. 与搜索过滤行为一致
- [测试复杂度] → 纯 UI 操作, 使用 E2E tmux 测试模拟键盘交互
