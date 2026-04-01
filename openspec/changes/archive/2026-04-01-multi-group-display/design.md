## Context

交互式 skill 选择列表由两个 builder 函数构建:
- `buildSourceGroupedChoices`: deploy/add/remove/uninstall 的主选择列表, 按 source 分类 (official/community/custom), 虚拟 group 的 skill 从 source 分类移入 custom 分区
- `buildVirtualGroupChoices`: `add --group` 的 repo skill 选择列表, 纯虚拟 group 分组

两者都用 `Map<string, string>` 的 `skillToGroup` 做 first-match-wins 映射, 导致同一 skill 只能在一个 group 下显示.

`interactiveCheckbox` 以 `Set<number>` (choice index) 管理选中状态, 每个 choice 独立, 无 value 联动机制.

## Goals / Non-Goals

**Goals:**
- skill 同时出现在所有归属虚拟 group + 保留原始 source 分组位置
- 同一 skill key 的所有 choice 副本联动 toggle
- 空 group (groups.json 中存在但无已安装 skill 匹配) 仍显示 group header
- 联动粒度为 skill key (source/name), 非 skill name

**Non-Goals:**
- 不改变 groups.json 存储格式
- 不改变 `GroupsService` 接口
- 不改变命令调用流程 (add/deploy/remove/uninstall 的调用方式不变)

## Decisions

### D1: skillToGroup 改为 Map<string, string[]>

**选择**: `skillToGroup: Map<string, string[]>` — 每个 skill key 映射到所有归属的 group 名数组.

**替代方案**: 遍历 groupsData 时为每个 group 独立匹配 skill → 复杂度更高, 多次遍历.

**理由**: 一次遍历建 map, 后续分配时读数组, 改动最小.

### D2: 非 custom skill 同时保留在 source 分组

**选择**: `buildSourceGroupedChoices` 中, 有虚拟 group 的非 custom skill 不再从 `byCategory` 中删除, 同时克隆到每个 vg 的渲染列表.

**当前行为**: `if (vg && category !== 'custom')` → 移入 `movedToVirtualGroup`, 从 source 分类消失.
**新行为**: 删除 `movedToVirtualGroup` 逻辑, skill 始终留在 `byCategory`. 在 custom 分区渲染时, 从 `skillToGroups` 查找所有 group, 为每个 group 生成一份 clone choice.

### D3: interactiveCheckbox value 联动

**选择**: 在 toggle 时, 查找所有与当前 choice 相同 `value` 的 indices, 批量 add/delete `selected` set.

实现: 启动时建一个 `valueToIndices: Map<string, number[]>`, toggle 时查此 map 做批量操作.

resolve 时对 `Array.from(selected).map(i => choices[i].value)` 做 `[...new Set(...)]` 去重.

**替代方案**: 只在 builder 侧去重, 每个 skill 只出现一次 → 不满足多 group 显示需求.

**理由**: 联动在 UI 层处理, builder 只管生成 choices, 职责清晰.

### D4: 空 group 显示 header

**选择**: `buildSourceGroupedChoices` 在构建 choices 时, 遍历 `groupsData` 的所有 group name, 即使无匹配 skill 也生成一个空 subGroup 占位 (通过插入一个 dummy separator 或直接让 group-header 渲染).

实现: 在 custom 分区, 对 `groupsData` 中每个 group 确保 `grouped.set(gn, grouped.get(gn) ?? [])`, 这样空 group 也进入渲染循环, `interactiveCheckbox` 的 group-header 自然显示.

### D5: group-header toggle 只影响直属 children

group-header 的 toggle (space 键) 已有按 `childIndices` 批量操作的逻辑. 多 group 场景下:
- toggle group A 的 header → 只操作 group A 下的 childIndices
- 但联动机制会自动同步到其他 group 下的相同 skill 副本
- 效果: toggle group A 的 header, 其他 group 下的同 skill 副本也跟着变

这是自然行为, 无需额外处理.

## Risks / Trade-offs

**[列表变长]** → 同一 skill 出现 N 次, 列表行数增加.  通过折叠 (h/l/c 快捷键) 缓解, 已有机制无需新增.

**[ctrl+a 全选语义]** → ctrl+a toggle all 在多副本场景下: 选中所有 index, resolve 去重, 结果正确.  无风险.

**[group-header 中 childCount 显示]** → 一个 group 下可能包含同一 skill 的多个副本? 不会 — 每个 group 下每个 skill 只出现一次, 副本在不同 group 之间. childCount 正确.
