## Context

`src/commands/list.ts` 的 `listAvailable` 自带一套按 `skill.source` 路径分组的 body 渲染: 解析 `category/groupId`, custom 子目录 (`custom/openspec`) 成为物理子组, 其余平铺.  它完全不读 `groups.json`, 所以 `kind: "virtual"` 的 group (如 `develop`) 在 `list` 里隐形.

交互式选择流程 (`src/utils/prompts.ts` 的 `buildSourceGroupedChoices`) 另有一套分组实现, 已支持虚拟 group 子组 + 物理子目录 innerGroup 嵌套.  两套实现并存是本 bug 的根因.

现有 spec `skill-grouping` 的 "list 命令二级缩进输出" requirement 声称 custom 平铺 skill 显示在 `(ungrouped)` 标签下, 但 `list.ts` 实际是直接平铺、无该标题 (spec/impl drift, 用户真实输出也无此标题).

## Goals / Non-Goals

**Goals:**
- `list` 输出把 `kind: "virtual"` 的 group 作为子标题展示, 成员缩进, 并从平铺列表移出
- 满足: 多 group 各列一次 (①)、跨 category 在各自 category 内成组 (②)、物理子组在前虚拟子组在后 (③)
- 无虚拟 group 时输出与变更前完全一致

**Non-Goals:**
- 不重写 `list.ts` 去复用 `buildSourceGroupedChoices` (避免引入交互专用产物与 ordering/json 连锁变更)
- 不改 `list --json` 输出 (虚拟 group 归属暂不进 json; `collections` 字段语义不变)
- 不改 `renderName` 的 `← collection` 标注, 不为虚拟 group 成员加标注
- 不改末尾 `── collections ──` 块 (collection kind 不在范围)
- 不引入 `(ungrouped)` 标题 (维持现状直接平铺)

## Decisions

### D1: 在 `list.ts` 内 targeted 增量, 不复用 `buildSourceGroupedChoices`
复用方案会把 `list` 强行对齐交互结构: 带来 `(empty)` 占位、`__empty_` value 过滤、custom 子组按字母混排 (违背 ③ 物理在前) 以及 `--json` / 现有测试的连锁改动.  本变更只需在 `listAvailable` 加一层虚拟 group 归属, 物理子组与排序行为原样保留.  两套实现都读同一份 `groups.json`, 渲染面 (文本树 vs 交互勾选) 本就不同, 可接受.

### D2: 只纳入 `kind: "virtual"`
经 `GroupsService.getGroupKind(name) === 'virtual'` 过滤.  `local-batch` (物理 group) 的成员 source 为 `custom/{name}`, 已通过 source-path 物理子组呈现, 无需再走虚拟分组; `collection` 不在范围.

### D3: 渲染顺序与计数
每个 category 内: 物理子组 (按名升序) → 虚拟 group 子组 (按名升序) → 平铺 skill.  category 头计数 `(N skills)` 为该 category 内**去重**的 skill 数 (不因多列而膨胀); 子组 `(N)` 为该子组下实际呈现的成员数 (多个子组间可重叠).

### D4: 成员归属与平铺移除
构建 `skillKey → virtualGroupNames[]` 映射 (skillKey = `${source}/${name}`).  渲染某 category 时: 凡 skillKey 命中至少一个虚拟 group 的 skill, 在每个所属虚拟 group 子组下各列一次, 且从该 category 的平铺桶移除.  物理子组成员不受影响 (一个 skill 可同时在物理子组与虚拟 group 子组下出现, 符合 ①).

### D5: 悬空成员
虚拟 group 成员若指向未安装的 skill (skillKey 在 `getAllSkills()` 中无对应), 在 `list` 中不渲染该成员, 子组计数只算已解析成员.  与现有命令对悬空引用 "跳过" 的处理一致.

### D6: 修正 spec drift
MODIFIED requirement 顺手把 `(ungrouped)` 标签描述改为实际行为 (平铺直接列, 无标题), 使 spec 与 impl + 用户预期一致.

## Risks / Trade-offs

- **两套分组逻辑继续并存**: 未根治根因 (理想是统一 `list` 与交互的分组引擎).  权衡: 本次按最小变更与用户明确的 ③ 排序诉求, 统一留作后续单独重构.
- **子组计数可重叠**: 多 group 成员在多个子组各计一次, 子组数之和可能 > category 去重数; 通过 category 头用去重数说明, 视觉上可接受.
- **跨 category 虚拟 group (②)**: 当前用户数据 (`develop` 全 custom) 不触发该路径, 实现需保证通用性但缺真实数据覆盖; 用构造测试覆盖.
