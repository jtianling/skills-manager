## Context

`BundleManager.applyAdded()` (`src/services/bundle-manager.ts:368-408`) 在 local-batch 分支执行以下步骤:

1. `removeDir(targetDir)` + `installSingleSkillToLocalTarget(sourcePath, targetDir)` 物理复制
2. `sourcesService.addSource(sourceKey, { ... })` 写入 sources.json
3. 返回 sourceKey 供外层更新 bundle members

**缺失的第 4 步**: 同步写入 `groupsService.addSkill(groupName, sourceKey)`.

对比初次 install 路径 (`src/commands/install.ts:100-107`), install 在完成 `install-directory-batch` 的"批量安装自动创建虚拟 group"需求时, 显式调用了 `groupsService.addSkill` (按 `batchGroupName` = 源目录 basename).  update 时源目录新增的 skill 没走这一步, 造成两边数据不一致.

`applyRemoved` 的 local-batch 分支已正确调用 `this.groupsService.removeSkillFromAll(sourceKey)`, 反向操作是对称的.  唯一缺失的是正向的 `addSkill`.

## Goals / Non-Goals

**Goals:**
- local-batch bundle update 发现新 skill 并自动安装后, 同步写入同名 (basename) 虚拟 group
- 不越权: 若用户已通过 `group delete` 删掉同名 group, update 不重建
- 变更最小: 单个函数 (`applyAdded` local-batch 分支) 内加一次判空调用

**Non-Goals:**
- 不修改 git bundle / registry bundle 的 group 行为 (初次 install 它们也不自动建 group, 除非显式 `--group`)
- 不提供一次性迁移脚本来回填历史缺项 (已安装用户的 groups.json 缺项下次 update 自然修复; 如需立即修, 用户可 `skillsmgr group add tdd-spec ts-xxx`)
- 不改动 `applyRemoved` 的现有行为

## Decisions

### Decision 1: group 名取 `basename(bundle.url)`, 与 install 保持一致

初次 install 的 auto-group 名由 `batchGroupName` 驱动, 实际值为 `basename(normalizeLocalPath(skillDir))`.  update 时 bundle 已经记录 `bundle.url`, 对它取 `basename` 即可得到同一个名字.

替代方案: 在 bundle 元数据里显式存 `autoGroupName` 字段 → 要扩 schema, 对齐历史数据, 开销大.  basename 约定已经隐含在 install 行为里, 直接复用即可.

### Decision 2: group 不存在时不重建

user 可能 `group delete tdd-spec` 后继续用 bundle, 此时 update 强制重建 group 会违反用户意图.  行为:

```
if (this.groupsService.getGroup(autoGroupName)) {
  this.groupsService.addSkill(autoGroupName, sourceKey);
}
```

`GroupsService.addSkill` 本身是 "group 不存在时自动创建", 为避免意外重建, 本处需要先判定 group 是否存在再调用.

替代方案: 总是 `addSkill` (自动建) → 违反非越权原则.  选当前方案.

### Decision 3: `applyRemoved` 保持现状

`applyRemoved` 已通过 `removeSkillFromAll` 把 skill 从所有 group 中剔除, 覆盖了同名 auto-group.  不需要改动.

### Decision 4: 不提供迁移脚本, 但在 update 末尾输出提示

历史缺项不自动回填.  `executeUpdateWithOptions` 在 bundle 分支结束后可以加一行检测: 若 bundle 的 auto-group 存在且 members 数量 > group 引用数量, 输出一次性提示 "Group 'tdd-spec' is missing N skills from the bundle.  Run `skillsmgr group add tdd-spec ...` to backfill."  本次实现可选, 也可以延后.  在 tasks.md 里列为可选项.

替代方案 A: 提供一次性 `skillsmgr group sync <bundle>` 子命令 → 价值低, 增加表面积.  不做.
替代方案 B: 每次 update 自动回填 → 如果用户是主动把某 skill 从 group 中移除了, 下次 update 又被加回来, 非常违反直觉.  不做.

## Risks / Trade-offs

- **[风险]** 如果 group 名已被其他非 bundle 来源占用 (例如用户手动 `group create tdd-spec` 并加入其他 skill), update 会把新 skill 也加进去.  → 可接受, 因为初次 install 也是这个行为 (install-directory-batch 需求 "group 已存在时追加"), 保持对称.
- **[风险]** `GroupsService.getGroup` 返回 `undefined` 时 skip, 可能让用户困惑 "为什么 update 不把新 skill 加进 group" → mitigation: update 输出 "`+ skillName: new in source (installed)`" 之后, 若 skip 了 group 同步, 追加一行 "(group 'tdd-spec' not found, skipped group sync)".  tasks 中可选项.
- **[trade-off]** 历史缺项不自动回填.  用户观察到的 3 个缺项要等下次那 3 个 skill 本身有变动, 或手动执行 `skillsmgr group add` 才能补齐.  可接受, 因为只影响一次.

## Migration Plan

无破坏性变更, 直接 release.  用户升级后:
- 新的 update 行为生效, 后续新增 skill 正常进同名 group
- 历史缺项保持, 按需手动补齐 (提示文案指引)

## Open Questions

- 是否要在 `update` 完成时主动提示历史缺项?  → 倾向延后到下一个 change, 保持本次变更聚焦.
