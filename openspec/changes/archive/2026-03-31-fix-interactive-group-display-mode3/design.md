## Context

当前交互式列表和 `list` 命令中, 未分组的 skill 被赋予 `subGroup: '(ungrouped)'` 标签, 在 `interactive-select.ts` 中渲染为一个带 group-header 的折叠组.  这在视觉上不自然 — `(ungrouped)` 是系统生成的分类标签, 不是用户创建的分组.

参考 GitHub Issues milestone 视图的 "模式 3": 有 milestone 的 issue 带 section header, 没有的直接平铺在末尾, 不加标签.

涉及三个 choice builder 函数和 `list` 命令:
- `buildVirtualGroupChoices` (prompts.ts:192) — 用于 add, remove 的 owner/repo 交互
- `buildSourceGroupedChoices` (prompts.ts:260) — 用于 deploy, uninstall, remove 的全局交互
- `buildSkillChoices` (prompts.ts:104) — 旧 legacy 函数
- `listAvailable` (list.ts:17) — 控制台输出

## Goals / Non-Goals

**Goals:**
- 去除所有 `'(ungrouped)'` 标签, 未分组 skills 的 `subGroup` 为 `undefined`
- 未分组 skills 在交互列表中平铺显示 (无 group-header), 排在命名 group 之后
- `list` 命令中 custom 分类的未分组 skills 与其他分类的未分组 skills 显示方式一致 (无 `(ungrouped)` 标题)
- 更新所有相关测试

**Non-Goals:**
- 不改变 `interactive-select.ts` 的渲染逻辑 (它已正确处理 `subGroup: undefined` 的 choice 为平铺)
- 不改变 group-header 折叠/展开行为
- 不改变 `groups.json` 存储格式

## Decisions

### 1. 未分组 skills 设 `subGroup: undefined`

在 `buildVirtualGroupChoices` 和 `buildSourceGroupedChoices` 中, 将未分组 skills 的 `subGroup` 从 `'(ungrouped)'` 改为 `undefined`.  `interactive-select.ts` 的 `buildDisplayItems` 已经能处理 `subGroup === undefined` 的 choice — 它们不会产生 group-header, 直接作为 `type: 'choice'` 的 DisplayItem 渲染.

替代方案: 在渲染层过滤 `'(ungrouped)'` 标签 → 不好, 污染渲染逻辑, 应在数据构建层解决.

### 2. `list` 命令统一 custom 分类显示

当前 custom 分类有 `(ungrouped)` 标题和额外缩进, 而 official/community 分类的无 groupId skills 直接输出.  统一为: 所有分类的无 groupId skills 都不输出 `(ungrouped)` 标题, 直接缩进一层.

### 3. `buildSkillChoices` 同步修改

虽然是 legacy 函数, 但仍在使用中.  同步去除 `'(ungrouped)'` 赋值, 保持一致性.

## Risks / Trade-offs

- **用户习惯变化**: 之前依赖 `(ungrouped)` 标签来识别未分组 skill 的用户, 需要适应新的视觉方式.  风险低 — `(ungrouped)` 本身就是不自然的标签.  → 缩进差异足够区分.
- **测试更新量**: 多个测试用例期望 `'(ungrouped)'` 值, 需要全部更新.  → 简单的字符串替换, 风险低.
