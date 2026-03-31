## Context

当前 `buildSkillChoices()` 通过 `parseSource()` 解析 skill.source, 提取 category 和 groupId.  custom skill 的 source 为 `"custom"`, 解析后 groupId 为 undefined, 因此在交互界面中不生成 group-header, 直接平铺在 `── custom ──` separator 下.

official/community 的 skill 有 groupId(如 `anthropic/skills`), 会自动生成可折叠的 group-header.  这导致 custom 未分组 skill 与其他类别的视觉层级不一致.

## Goals / Non-Goals

**Goals:**

- 为 custom 分类下无 groupId 的 skill 在显示时自动补充 `(ungrouped)` 作为虚拟 subGroup
- `(ungrouped)` 组排在 custom 分类中真实分组的后面
- 交互界面和 list 文字输出保持一致

**Non-Goals:**

- 不修改 `groups.json` 或任何持久化数据模型
- 不改变 official/community 类别的显示逻辑
- 不影响 install/uninstall 等写操作的流程

## Decisions

### D1: 纯显示层注入虚拟 subGroup

在 `buildSkillChoices()` 中, 当 `category === 'custom'` 且 `groupId === undefined` 时, 将 subGroup 设为 `'(ungrouped)'`.

**替代方案**: 在 `groups.json` 中维护一个真实的 ungrouped 组 → 拒绝, 因为语义矛盾且需维护额外状态.

### D2: 排序 — `(ungrouped)` 置于末尾

在 `buildSkillChoices()` 中对 custom 分类的 source entries 排序: 有真实 groupId 的排前面, `source === 'custom'`(即无 groupId 的)排后面.

实现方式: 对 `Object.entries(grouped)` 按 source 排序, custom 无 groupId 的 entry 排在同 category 的最后.

**替代方案**: 在 `buildDisplayItems()` 中排序 → 可行但不如在数据源头排序简洁.

### D3: list 命令同步处理

`listAvailable()` 中将 ungrouped skills 包裹在 `(ungrouped)` 分组标签下输出, 排在同 category 的真实分组之后.

## Risks / Trade-offs

- [视觉噪音] 如果 custom 下所有 skill 都未分组, 会出现一个看起来冗余的 `(ungrouped)` header → 可接受, 保持一致性优先.  且 group-header 可折叠, 反而方便整理.
- [命名] `(ungrouped)` 带括号可能在搜索时被忽略 → 搜索匹配的是子项 name, 不匹配 group-header 文本, 无影响.
