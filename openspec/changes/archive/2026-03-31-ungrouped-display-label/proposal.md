## Why

custom 分类下未分组的 skill 在交互界面(init, install 等)中直接平铺显示, 缺少 group-header 层级, 与 official/community 中有分组的 skill 视觉结构不一致.  用户需要额外的认知成本来区分分组和未分组的 skill.  添加一个虚拟的 `(ungrouped)` 分组标签可以统一视觉层次.

## What Changes

- 在交互选择界面(init, add 等)中, 为 custom 分类下未分组的 skill 自动生成 `(ungrouped)` 虚拟 group-header
- 在 `list` 命令的文字输出中同步添加 `(ungrouped)` 分组标签
- `(ungrouped)` 虚拟组始终排在 custom 分类中真实分组的后面
- 纯显示层改动, 不修改 `groups.json` 或任何数据模型

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `skill-grouping`: 为 custom 下未分组 skill 添加 `(ungrouped)` 虚拟显示分组, 排序置于真实分组之后

## Impact

- `src/utils/prompts.ts` — `buildSkillChoices()` 函数, 为无 subGroup 的 custom skill 补充虚拟 subGroup
- `src/commands/list.ts` — 文字输出的分组渲染逻辑
- 不影响 `groups.json`, 不影响 install/uninstall 流程, 不影响数据模型
