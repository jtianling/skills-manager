## Why

虚拟组内来自不同 owner/repo 的 skill 当前用 suffix `(anthropic/skills)` 标注来源, 信息密度低且无法按 source 批量操作.  同时 group-header 作为可交互元素 (focus/space/fold) 却没有行号, 导致无法用 `nG` 快速跳转.

## What Changes

- 虚拟组内的非 custom skill 按 owner/repo 嵌套为 inner group header (可折叠, 可批量选), 替代 source suffix
- 外层 group-header 折叠时, 内层 header 和 choice 全部隐藏
- inner group-header 独立支持折叠/展开
- group-header (含 inner) 分配行号, 仅 separator (`── custom ──`) 不分配
- `interactive-select` 支持 3 层嵌套: separator → group-header → inner-group-header → choice

## Capabilities

### New Capabilities

- `inner-group-nesting`: 虚拟组内按 owner/repo 嵌套显示, 3 层嵌套交互支持, group-header 行号

### Modified Capabilities

- `virtual-group-choices`: 来源 suffix 替换为 innerGroup 嵌套分组
- `group-fold`: 外层折叠隐藏内层 header + choice, 内层独立折叠/展开

## Impact

- `src/utils/interactive-select.ts`: SelectChoice 新增 `innerGroup` 字段, buildDisplayItems 支持 3 层嵌套, 渲染逻辑增加缩进层级, 行号分配扩展到 group-header
- `src/utils/prompts.ts`: `buildVirtualGroupChoices` 和 `buildSourceGroupedChoices` 按 source 产出 `innerGroup` 替代 source suffix
- `src/utils/prompts.test.ts`: 更新 source suffix 测试为 innerGroup 测试
- `src/utils/interactive-select.test.ts` (如有): 更新折叠/行号相关测试
