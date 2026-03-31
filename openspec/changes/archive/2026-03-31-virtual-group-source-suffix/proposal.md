## Why

虚拟 group 可以包含来自不同 source 的 skills (official, community, custom), 但目前交互式列表中:
- `buildVirtualGroupChoices` 不显示非 custom skill 的来源
- `buildSourceGroupedChoices` 只在 custom 分类下应用虚拟 group, 非 custom skill 即使在 group 中也不会出现在虚拟 group 下

用户在虚拟 group 中看到 `commit` 时无法判断它来自 `anthropic/skills` 还是 `bob/tools`.  用 suffix 标注来源, 保持平铺结构, 不引入三级嵌套.

## What Changes

- `buildVirtualGroupChoices`: 非 custom skill 在虚拟 group 中显示时, suffix 附加来源信息如 `(anthropic/skills)`
- `buildSourceGroupedChoices`: 属于虚拟 group 的非 custom skill 从 source 分类移入虚拟 group 显示, 带来源 suffix.  避免同一 skill 在列表中出现两次
- `group list <name>`: 显示时标注 skill 来源
- suffix 与已有的功能性 suffix (如 `[deployed]`) 共存

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `virtual-group-choices`: 扩展 `buildVirtualGroupChoices` 和 `buildSourceGroupedChoices`, 为虚拟 group 中的非 custom skill 显示来源 suffix

## Impact

- `src/utils/prompts.ts`: `buildVirtualGroupChoices`, `buildSourceGroupedChoices` 的 `toChoice` 逻辑, suffix 合并策略
- `src/commands/group.ts`: `executeGroupList` 显示格式变更
- `src/utils/prompts.test.ts`: 新增/更新测试用例
- 涉及命令: add, remove, deploy, uninstall 的交互式模式, group list
