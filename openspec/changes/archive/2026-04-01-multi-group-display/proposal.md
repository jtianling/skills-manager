## Why

交互式 UI (`buildSourceGroupedChoices` / `buildVirtualGroupChoices`) 对每个 skill 只分配到一个虚拟 group 显示 (first-match-wins).  当同一 skill 属于多个 group 时, 只在 JSON key 顺序最靠前的 group 下出现, 其余 group 看不到该 skill.  同时, 非 custom skill 被移入虚拟 group 后, 从原始 source 分组中消失.  这导致用户通过 `group add` 正确添加了 skill 到 group, 但交互式界面完全看不到.

## What Changes

- `buildSourceGroupedChoices`: skill 同时保留在原始 source 分组 + 出现在所有归属的虚拟 group 下
- `buildVirtualGroupChoices`: skill 出现在所有归属的虚拟 group 下
- `interactiveCheckbox`: 同一 skill key 在多处出现时, 交互联动 (toggle 一处, 同 key 全部跟着变), 返回值去重
- 空 group (groups.json 中存在但无对应已安装 skill) 仍然显示 header

## Capabilities

### New Capabilities

- `multi-group-display`: 交互式 UI 支持 skill 同时出现在多个虚拟 group 和原始 source 分组, 按 skill key 联动 toggle

### Modified Capabilities

- `virtual-group-choices`: 移除 first-match-wins 语义, 改为多 group 同时显示; 非 custom skill 不再从原始 source 分组中移除; 空 group 仍显示 header

## Impact

- `src/utils/prompts.ts`: `buildSourceGroupedChoices`, `buildVirtualGroupChoices` 核心逻辑变更
- `src/utils/interactive-select.ts`: `interactiveCheckbox` 增加同 value 联动
- `src/utils/prompts.test.ts`: 相关测试更新
- 所有调用这两个 builder 的命令 (add, deploy, remove, uninstall) 自动受益, 无需改动
