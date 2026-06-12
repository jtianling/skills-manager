## 1. 引用存储与校验 (groups.ts)

- [x] 1.1 在 `src/types.ts` 给 `VirtualGroupEntry.members` 加注释说明可含 `group:<name>` 引用项; 定义 `GROUP_REF_PREFIX = 'group:'` 常量 (或放 constants.ts)
- [x] 1.2 在 `GroupsService.addSkill` 开头拒绝以 `group:` 开头的 skillKey, 抛出明确错误 (引导用户用引用操作)
- [x] 1.3 新增 `addGroupRef(target, src)`: 校验 src !== target (否则抛 "Cannot reference a group from itself."), 不可变写入 `group:<src>` 到 target.members; 已存在则返回 false (幂等); target 不存在时自动创建虚拟 group; target 为 local-batch/collection 时报错
- [x] 1.4 新增 `removeGroupRef(target, src)`: 不可变移除 `group:<src>`; 不存在则返回 false
- [x] 1.5 单测覆盖 1.2–1.4 (含自引用、幂等、自动创建、物理 group 报错)

## 2. getGroupMembers 递归展开 (groups.ts)

- [x] 2.1 重构 `getGroupMembers`: 逻辑 group 遍历 members, `group:<x>` 项递归展开, 直接 key 收集; 用内部 helper 携带 visited 集合防环
- [x] 2.2 展开结果去重并保留首次出现顺序; 悬空引用 (getGroup 返回 null) 静默跳过; 保持函数无副作用、不打印
- [x] 2.3 被引用 group 按 kind 正确展开: virtual 递归 / local-batch 扫物理目录 / collection 读 members
- [x] 2.4 单测: 单层展开+顺序、动态跟随、多层嵌套、环安全终止、多路径去重、悬空跳过、引用物理 group

## 3. CLI: group add/remove --group (group.ts + index.ts)

- [x] 3.1 在 `index.ts` 给 group add / group remove 子命令注册 `--group <name>` option, identifier 参数改为可选 (positional 与 --group 互斥)
- [x] 3.2 group add action: 有 `--group` 时走 `addGroupRef` 分支 (含 src 存在性检查→不存在则警告/报错、自引用防护、幂等提示); 无则维持现有 positional 流程不变
- [x] 3.3 group remove action: 有 `--group` 时走 `removeGroupRef` 分支 (含不存在引用的友好提示); 无则维持现有 positional 流程
- [x] 3.4 参数互斥校验: 同时提供 positional identifier 和 `--group` 时报错提示二选一
- [x] 3.5 单测覆盖 add/remove 的 `--group` 分支与互斥校验

## 4. group list 引用标注 (group.ts)

- [x] 4.1 `executeGroupList(name)` 渲染成员时, 对 `group:<x>` 引用项单独标注 (如 `→ group: x`); 引用的 group 不存在时标注 `(dangling)`
- [x] 4.2 单测验证引用项与悬空引用的标注输出

## 5. 回归与验收

- [x] 5.1 回归 `add --group <name>` (batch-add-by-group)、`deploy`、`group update`、`sources` 的 group 成员展开, 确认透传递归展开正确
- [x] 5.2 `pnpm test` 全绿; 必要时补 e2e 覆盖 `group add vercel-develop --group develop` → `add --group vercel-develop` 端到端动态跟随
- [x] 5.3 `pnpm run build` 通过; 手验需求场景: 建 vercel-develop 引用 develop + 2 个 vercel skill, 改 develop 后 vercel-develop 自动反映
- [x] 5.4 `openspec validate group-references --strict` 通过
