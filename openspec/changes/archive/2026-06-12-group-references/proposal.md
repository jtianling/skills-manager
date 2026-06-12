## Why

虚拟 group 目前只能持有扁平的 skill key 列表, 无法表达"包含另一个 group".  用户想基于现有 `develop` group 派生 `vercel-develop` (= develop 的全部成员 + 2 个 vercel skill), 且 develop 之后增删 skill 时 vercel-develop 能自动跟随.  现有的 `group add <target> <group-name>` 是一次性快照复制, 不满足"动态跟随"需求.

## What Changes

- 虚拟 group 的 `members` 新增一种成员类型: **group 引用** (动态), 与直接 skill key 混合存放.
- `getGroupMembers()` 递归展开 group 引用, 集中处理环检测、悬空引用、去重.  所有调用方 (add / deploy / sources / update / list) 自动受益.
- `group add` / `group remove` 新增 `--group <name>` 选项表达"添加 / 移除一个动态 group 引用" (满足命令对称性硬规则).
- **保留** 现有 positional `group add <target> <group-name>` 的一次性快照复制语义不变; `--group` flag 是新的动态引用语义, 二者并存且语义清晰区分.
- `group list <name>` 在成员列表中标注 group 引用 (区别于直接 skill).
- groups.json 仍为 version 2.0, group 引用以特殊前缀标记 (`group:<name>`) 混入 `members`, 无需 schema 版本升级, 向后兼容旧文件.

## Capabilities

### New Capabilities
- `group-references`: 虚拟 group 引用其它 group 的能力 — 引用的存储表示、`getGroupMembers` 递归展开 (环检测 / 悬空引用 / 去重)、`group add|remove --group` 的对称 CLI、`group list` 的引用标注、被引用 group 的 kind 约束.

### Modified Capabilities
- `virtual-group`: `getGroupMembers` 由"直接返回 members"改为"递归展开 group 引用后返回扁平 skill key 列表"; `members` 格式扩展为允许 `group:<name>` 引用项; `addSkill` / `removeSkill` 增加对引用项的校验 (skill key 不得以 `group:` 开头).

## Impact

- 代码: `src/services/groups.ts` (getGroupMembers 递归展开、addGroupRef/removeGroupRef、校验), `src/commands/group.ts` (add/remove 的 `--group` 选项与对称处理、list 标注), `src/types.ts` (引用项类型注释).
- 数据: `~/.skills-manager/groups.json` 的虚拟 group `members` 可能含 `group:<name>` 项; 旧文件无该项, 完全兼容.
- 间接受益且需回归: `add --group` (batch-add-by-group)、`deploy`、`group update` (逻辑 group 遍历 member)、`sources` 的 group 成员展开.
- 无外部 API / 依赖变更.
