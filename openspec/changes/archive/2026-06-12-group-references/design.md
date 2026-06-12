## Context

虚拟 group (`{ kind: 'virtual', members: string[] }`) 的 `members` 现在只能放扁平 skill key (如 `custom/foo`、`official/anthropic/skills/commit`).  `getGroupMembers(name)` 是所有命令 (add / deploy / sources / group update / group list) 取 group 成员的唯一入口.  现有 `group add <target> <group-name>` 把源 group 成员**一次性快照复制**进 target (`addGroupSkills` 经 `addSkill` 逐条写入), 复制后两个 group 各自独立.

用户需求是**动态继承**: `vercel-develop` 包含 `develop`, develop 增删 skill 时 vercel-develop 自动反映.  快照复制无法满足.

## Goals / Non-Goals

**Goals:**
- 虚拟 group 能持有对其它 group 的动态引用, 与直接 skill key 混合.
- `getGroupMembers` 递归展开引用, 集中处理环检测、悬空引用、去重, 让所有调用方透明受益.
- 新增 `group add|remove --group <name>` 对称 CLI, 满足命令对称性硬规则.
- 完全向后兼容: 旧 groups.json 不变, 不升 schema 版本.

**Non-Goals:**
- 不改现有 positional `group add <target> <group-name>` 的快照复制语义 (保留两条并存路径).
- 不给物理 (local-batch) / collection group 增加"持有引用"的能力 (它们的 members 由外部派生, 仍只能作为被引用方).
- 不做引用的可视化树状展开 UI (group list 仅平铺标注引用来源).

## Decisions

### 决策 1: 引用以 `group:<name>` 前缀标记混入 members, 不新增字段

`members` 仍是 `string[]`, 引用项写成 `"group:develop"`.  直接 skill key 与引用项共存于同一数组, 保持原有顺序.

- **为什么**: skill key 永远是 `<source>/<name>` 形式, source 取值为 `official|community|custom`, 不存在以 `group:` 开头的合法 skill key, 故前缀不会与真实 key 碰撞.  复用现有 `members` 数组与 `addSkill`/`removeSkill` 写入路径, 无需改 GroupsDataV2 schema、无需 V2→V3 迁移、旧文件零改动.
- **备选**: 新增独立字段 `references?: string[]`.  类型更干净, 但要改 V2 reader、所有 writer、迁移逻辑与多处 GroupEntry 构造, 改动面更大, 违反最小变更.  否决.
- **护栏**: `addSkill` SHALL 拒绝以 `group:` 开头的 skillKey (防止把引用误当 skill 写入); 引用的增删走独立的 `addGroupRef`/`removeGroupRef` (或 addSkill 接受带前缀值, 见 tasks).

### 决策 2: `getGroupMembers` 递归展开 + visited 集合

逻辑 group 取成员时, 顺序遍历 members: 直接 key 直接收集; `group:<x>` 项则递归 `getGroupMembers(x)` 并把结果就地展开.  用一个 visited 集合记录已展开的 group 名:

- 进入某 group 前若已在 visited 中 → 跳过 (天然防环 + 防重复展开同一引用).
- 结果对 skill key 去重, 保留首次出现顺序.
- 被引用 group 可为任意 kind: virtual (继续递归)、local-batch (扫物理目录)、collection (读 members).

- **为什么集中在这里**: 它是唯一展开点, 一处改全局受益 (add / deploy / sources / update / list), 不需要逐个命令改.
- **纯函数**: `getGroupMembers` 保持无副作用、不打印日志 (现状如此, 多处复用).  悬空引用 (`group:nonexistent`, getGroup 返回 null) 静默展开为空; 告警留给命令层 (list 标注、add --group 部署时已有 dangling 警告).

### 决策 3: `--group <name>` flag 表达动态引用, positional 仍是快照

`group add <target> --group <src>` 写入 `group:<src>` 引用项; `group remove <target> --group <src>` 移除该引用项.  positional `group add <target> <src-group>` 维持快照复制不变.

- **为什么**: 两种语义都有用 (快照 vs 动态), flag 与 positional 区分清晰, 向后兼容; 且这是与用户确认过的接口形态.
- **对称性**: add 与 remove 同步获得 `--group`, 满足项目命令对称性硬规则.
- **自引用防护**: `--group` 的 src == target 时报错 "Cannot reference a group from itself." (与现有 positional 的 "Cannot add a group to itself." 对齐).

## Risks / Trade-offs

- **`group:` 前缀与真实 skill key 碰撞** → source 命名空间固定为 official/community/custom, 且 `addSkill` 显式拒绝 `group:` 前缀, 双重防护.
- **引用成环导致无限递归** → visited 集合, 重复进入即跳过; 直接自引用在写入层拦截.
- **悬空引用让 group 静默变空** → getGroupMembers 静默跳过, 但 `group list` SHALL 标注 "(dangling)" 让用户可见; `add --group` 部署层沿用既有 dangling 警告.
- **快照与动态两条路径并存增加心智负担** → 在 `group add` help 与文档中明确区分; positional=copy, `--group`=reference.
- **深层/广引用的展开成本** → group 数量与深度都很小 (个位数), visited 去重已足够, 不做额外缓存.

## Migration Plan

- 无数据迁移.  旧 groups.json 不含 `group:` 项, 行为完全不变.
- 新行为仅在用户执行 `group add --group` 后产生 `group:<name>` 项.
- 回滚: 删除引用项 (或 `group remove --group`) 即恢复; 代码回滚不影响旧数据.

## Open Questions

- 无.  引用语义 (动态)、CLI 形态 (`--group`)、存储表示 (`group:` 前缀) 均已确认.
