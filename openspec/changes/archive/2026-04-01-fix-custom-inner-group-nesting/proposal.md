## Why

`getSourceInnerGroup()` 对所有 `custom` 开头的 source 一律返回 `undefined`, 导致 `custom/openspec` 等有子路径的 custom skill 在虚拟组内无法生成 inner-group-header.  用户将 openspec 组的 skill 添加到 develop 组后, community skill 按 `mattpocock/skills`、`obra/superpowers` 嵌套显示, 但 custom/openspec skill 平铺在 develop 组下, 显示不一致.

## What Changes

- `getSourceInnerGroup` 去掉 `custom` 前缀排除, 让 `custom/openspec` 等有子路径的 source 返回 `"openspec"` 作为 innerGroup
- `buildVirtualGroupChoices` 和 `buildSourceGroupedChoices` 生成 choice 时, 当计算出的 `innerGroup` 与当前 `subGroup` (虚拟组名) 相同时跳过, 避免同名冗余嵌套
- 效果: develop 组内 openspec skill 嵌套显示; openspec 组自身仍平铺

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `inner-group-nesting`: custom 子路径 source 也参与 innerGroup 嵌套; 新增 innerGroup === subGroup 同名跳过逻辑
- `virtual-group-choices`: buildVirtualGroupChoices 和 buildSourceGroupedChoices 的 innerGroup 生成逻辑变更

## Impact

- `src/utils/prompts.ts`: `getSourceInnerGroup` 函数修改, `buildVirtualGroupChoices` 和 `buildSourceGroupedChoices` 的 toChoice 增加同名跳过
- `src/utils/inner-group-choices.test.ts`: 更新 custom innerGroup 相关测试
- `src/utils/prompts.test.ts`: 更新 innerGroup 测试
