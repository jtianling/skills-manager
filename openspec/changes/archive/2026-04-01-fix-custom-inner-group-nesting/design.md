## Context

`getSourceInnerGroup` 对所有 `custom` 开头的 source 返回 `undefined`, 最初是因为 custom skill 全部平铺在 `custom/` 下, 没有子路径.  但用户通过批量安装 (`install dir/`) 创建了 `custom/openspec` 等有子路径的 custom skill.  这些 skill 在虚拟组内无法按 source 嵌套显示, 与 community/official skill 的行为不一致.

## Goals / Non-Goals

**Goals:**
- `custom/openspec` 等有子路径的 custom source 在虚拟组内生成 innerGroup 嵌套
- 当 innerGroup 与 subGroup (虚拟组名) 相同时自动跳过, 避免冗余嵌套
- 平铺 custom source (无子路径) 行为不变

**Non-Goals:**
- 不改变 `getSourceSuffix` 的行为 (仍排除 custom)
- 不改变 `group list` CLI 的显示格式
- 不改变 source 分类逻辑 (`parseSource`)

## Decisions

### Decision 1: getSourceInnerGroup 去掉 custom 排除

移除 `if (source.startsWith('custom')) return undefined;`.  对于 `custom` (无子路径), `parts.length < 2` 仍返回 `undefined`, 行为不变.  对于 `custom/openspec`, 返回 `"openspec"`.

**替代方案**: 只排除 `source === 'custom'` (精确匹配).  效果相同但更冗余, 因为 `parts.length < 2` 已经覆盖了这个 case.

### Decision 2: innerGroup === subGroup 时跳过

在 `buildVirtualGroupChoices` 和 `buildSourceGroupedChoices` 的 `toChoice` 中, 当计算出的 `innerGroup` 等于当前 `subGroup` 时, 将 `innerGroup` 设为 `undefined`.

场景:
- develop 组内 `custom/openspec` skill: `subGroup="develop"`, `innerGroup="openspec"` → 不同 → 保留嵌套
- openspec 组内 `custom/openspec` skill: `subGroup="openspec"`, `innerGroup="openspec"` → 相同 → 跳过 → 平铺

**替代方案**: 在 `buildDisplayItems` 层做同名合并.  否决: 关注点分离, choice 数据层解决比 display 层更干净.

## Risks / Trade-offs

- [边界 case] 如果用户创建名为 `anthropic/skills` 的虚拟组并放入 `official/anthropic/skills` 的 skill, 同名跳过会使 official skill 在该组内平铺而非嵌套 → 这是合理行为, 组名本身就描述了来源
