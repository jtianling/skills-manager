## Context

当前 `interactive-select` 支持 2 层嵌套: `group` (separator 纯装饰) → `subGroup` (group-header 可交互).  虚拟组内的非 custom skill 用 `getSourceSuffix()` 在 suffix 中标注来源, 如 `(anthropic/skills)`.  group-header 不分配行号, 无法用 `nG` 跳转.

## Goals / Non-Goals

**Goals:**
- 虚拟组内按 owner/repo 嵌套显示 inner group header, 替代 source suffix
- inner group header 支持折叠/展开和批量选择
- 外层折叠时内层全部隐藏
- group-header (含 inner) 分配行号

**Non-Goals:**
- 不支持 3 层以上嵌套 (当前只需 2 层 header)
- 不改变 `group list` CLI 输出格式 (只改交互式 UI)
- 不改变 separator 的行为

## Decisions

### Decision 1: SelectChoice 新增 `innerGroup` 字段

在 `SelectChoice` 接口新增可选 `innerGroup?: string` 字段.  当 choice 同时有 `subGroup` 和 `innerGroup` 时, 表示在 subGroup 内部的 inner group 下.

**替代方案**: 用复合 `subGroup` 路径 (如 `python/anthropic/skills`) 表示嵌套.  否决原因: 需要约定分隔符, 且 `subGroup` 已被大量代码使用, 语义会混乱.

### Decision 2: DisplayItem 新增 `inner-group-header` type

新增 `type: 'inner-group-header'`, 与 `group-header` 区分.  两者都是可交互的 (focusable), 但渲染缩进不同.

- `group-header`: 在 separator 下缩进 1 级
- `inner-group-header`: 在 group-header 下缩进 2 级
- choice under inner-group: 缩进 3 级
- choice directly under group-header (custom skill): 缩进 2 级

**替代方案**: 给 `group-header` 加 `level` 字段.  否决原因: 折叠逻辑需要区分内外层 header 的父子关系, 独立 type 更清晰.

### Decision 3: 折叠关系 — 外层管理内层

`buildDisplayItems` 中:
- 外层 `subGroup` 折叠时, 跳过该 subGroup 下的所有 choice 和 inner-group-header
- 内层 `innerGroup` 折叠时, 只跳过该 innerGroup 下的 choice

collapsed set 需要区分两层: `collapsed` 存外层 subGroup 名, `innerCollapsed` 存 `${subGroup}/${innerGroup}` 复合 key.

### Decision 4: 行号分配给所有 focusable 项

当前 `choiceCount` 只统计 `type === 'choice'`.  改为统计所有 focusable 项 (`choice` + `group-header` + `inner-group-header`).  `jumpToLineNumber` 也相应调整, 跳转到第 n 个 focusable 项.

`separator` 仍不分配行号 — 它不可交互.

### Decision 5: prompts.ts 用 innerGroup 替代 source suffix

`buildVirtualGroupChoices` 和 `buildSourceGroupedChoices` 中:
- 虚拟组内非 custom skill 不再设置 source suffix
- 改为按 `getSourceSuffix(source)` 的值 (去掉括号) 作为 `innerGroup`
- custom skill 在虚拟组内不设 `innerGroup`, 直接平铺在 group-header 下

`getSourceSuffix` 函数保留给 `group list` CLI 输出使用, 不删除.

## Risks / Trade-offs

- [缩进层级增加] 3 层嵌套在窄终端下可能显示拥挤 → 实际场景中 inner group 名 (如 `anthropic/skills`) 不长, 可接受
- [行号变化] group-header 开始占用行号, 可见 choice 的行号会整体偏移 → 用户需要适应, 但跳转体验更一致
- [collapsed 状态管理复杂度] 两层 collapsed set → 用复合 key 区分, 逻辑清晰
