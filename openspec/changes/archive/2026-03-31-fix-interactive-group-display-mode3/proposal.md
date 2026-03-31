## Why

交互式列表和 `list` 命令中, 未分组的 skill 显示为 `(ungrouped)` 标签, 不自然且视觉噪音大.  参考 GitHub Issues milestone 视图的模式: 有分组的 skills 带 section header + 缩进, 无分组的 skills 直接平铺在末尾, 不加任何标签, 通过缩进差异自然区分.

## What Changes

- **交互式选择列表** (`buildVirtualGroupChoices`, `buildSourceGroupedChoices`): 未分组 skills 的 `subGroup` 设为 `undefined` 而非 `'(ungrouped)'`, 使它们平铺显示无 group-header
- **`list` 命令**: custom 分类下未分组 skills 不再输出 `(ungrouped)` 标题, 直接缩进一层显示(与其他分类的无 groupId skills 一致)
- **涉及命令**: install, uninstall, add, remove, deploy 的交互式选择模式

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `virtual-group-choices`: 去除 `'(ungrouped)'` 标签, 改为平铺显示

## Impact

- `src/utils/prompts.ts`: `buildVirtualGroupChoices`, `buildSourceGroupedChoices` 中去除 `'(ungrouped)'` 赋值
- `src/commands/list.ts`: `listAvailable` 中 custom 分类的 ungrouped 显示逻辑简化
- `src/utils/prompts.test.ts`: 更新期望值从 `'(ungrouped)'` 改为 `undefined`
- `src/utils/interactive-select.test.ts`: 如有相关用例需更新
