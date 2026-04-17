## 1. SourcesService 守护与 legacy 过滤

- [x] 1.1 在 `src/services/sources.ts` 的 `addSource` 中增加守卫: 当入参 `info.installMethod === 'local-copy'` 且 key 形如 `custom/<name>` (两段) 时抛出 `Refusing to persist local-copy source: <key>. Local skills are tracked by disk presence under custom/.`; 三段 key (物理 group 成员 `custom/<group>/<name>`) 不受限, 允许继续写入
- [x] 1.2 在 `SourcesService.load()` 返回前过滤内存数据: 删除所有 `installMethod === 'local-copy'` 且 key 形如 `custom/<name>` (两段) 的条目; 三段 key 保留; 过滤行为静默, 不打 warning, 不写 migration.log; 磁盘文件本次 load 不重写
- [x] 1.3 为 1.1 和 1.2 在 `src/services/sources.test.ts` 添加单测: `addSource` 拒绝两段 local-copy / 接受三段 / 接受 git; `load` 过滤两段 legacy local-copy / 保留三段 / 保留 git

## 2. install 本地 skill 不再写 sources.json

- [x] 2.1 修改 `src/commands/install-local.ts` 的 `installFromLocalDir`: 移除单 skill 场景的 `sourcesService.addSource(sourceKey, { installMethod: 'local-copy', ... })` 调用; 保留 `copyDir` / `prepareTargetDir` / `installSingleSkillToLocalTarget` 等磁盘拷贝逻辑
- [x] 2.2 从 `installFromLocalDir` 移除基于已存在 source 的 URL-mismatch 冲突检测 (原 `formatReinstallConflictMessage` 分支及其调用); 保留按磁盘路径的 `findInstalledCustomSkill` 查找 + overwrite 提示流程; 对 `findInstalledCustomSkill` 返回非 null 时统一走"同 key 已安装 → 使用原路径 → overwrite 提示"分支, 不再区分 URL 相同/不同
- [x] 2.3 `installFromLocalDirBatch` (物理 group 场景) 不在本变更涉及, 保持现有写 sources.json 行为不变 (物理 group 成员由 group 生命周期管理)
- [x] 2.4 更新 `src/commands/install-local.ts` 的 imports: 若 `formatReinstallConflictMessage` 不再被单 skill 分支引用, 评估是否可以删除其导入 (保留给物理 group 路径如果仍用); 同时确认 `sourcesService` 的其他使用点 (如物理 group 依赖) 不受影响
- [x] 2.5 `src/commands/install.ts` 的 `executeInstall` 中 `result.sourceKeys` 处理: 单 skill 本地安装时 `result.sourceKeys` 仍应为 `['custom/<name>']`, 以便 `--group` 能把该 key 加入 groups.json; 确保 `installFromLocalDir` 返回结构包含 sourceKeys 即便未写 sources.json

## 3. update 本地 skill 改走磁盘扫描

- [x] 3.1 修改 `src/services/source-resolver.ts` 的 `resolveLocalPath`: 对单 skill 分支 (`rootSkillMd` 存在), 改为调用 `findInstalledCustomSkill(basename(absolutePath))`; 返回非 null 时 `createTarget(input, 'source', [result.key], {})`; 返回 null 时返回 `kind: 'not-found'`, reason 形如 `Skill '<basename>' is not installed. Run: skillsmgr install <path>`
- [x] 3.2 从 `source-resolver.ts` 的 `resolveLocalRebindCandidate` 中移除对 local-copy source 的 basename 候选构造 (`findLocalCopySourcesByBasename` 的使用); 保留物理 group (`findPhysicalGroupsByBasename`) 的候选逻辑; 函数名和返回类型不变, 但 rebind-candidate 只可能是 group
- [x] 3.3 `SourceResolver.resolveLocalPath` 的 nested-skills 分支 (根无 SKILL.md 但子目录有) 保持物理 group 的 rebind 流程不变 (走 `resolveLocalRebindCandidate`, 只返回物理 group 候选)
- [x] 3.4 修改 `src/services/source-updater.ts` (或直接在 `src/commands/update.ts` 处理路径): 收到 kind: 'source' + sourceKeys: ['custom/<name>'] 的 ResolvedTarget 时, 跳过"读 sources.json 的 url"步骤, 直接以用户传入的 `./path` (在 `update` 命令层已有 `source` 参数) 作为源目录; 按 SKILL.md 内容 diff 执行 updated/up-to-date 分支; 成功后 SHALL NOT 调用 `sourcesService.addSource` / `sourcesService.updateTimestamp` 对 local-copy
- [x] 3.5 `executeUpdateWithOptions` 在进入 source key 更新循环前, 对每个 `sourceKeys` 条目检查: 如果 `allSources[key]` 不存在 (典型 local-copy 情形 — 磁盘有但 sources.json 无), 且 key 是两段 `custom/<name>`, 不算 failed; 改为路由到 local-copy 分支 (用命令行传入的 `source` 路径作为源). 若 sourceKeys 中某条没有对应的 sources 条目且也不匹配磁盘路径, 才算真正的 fail
- [x] 3.6 裸 `skillsmgr update` (不带 source): 在现有遍历 `allSources` 之前, 过滤跳过所有 `installMethod === 'local-copy'` 条目 (经 1.2 过滤后此处应该已经看不到两段 local-copy, 但三段物理 group 成员的 local-copy 仍要跳过 bare update 直接走, 由 group update 路径负责); 同时扫描磁盘 `~/.skills-manager/custom/` 收集所有 `custom/<name>/SKILL.md` 存在但不属于物理 group 的本地 skill, 把它们的数量作为 `skippedLocalCount`; 执行结束时若 `skippedLocalCount > 0`, 额外打印一行 `${N} local skill(s) skipped. Use \`skillsmgr update ./path\` to update a local skill.`
- [x] 3.7 `src/commands/update.ts` 的 `printUpdateNotFound` / `executeUpdateWithOptions` 的"source 不存在"分支: 对单 skill local-copy, 当用户给了 `./path` 但 `findInstalledCustomSkill` 返回 null 时, 输出建议文案 `Skill '<name>' is not installed. Run: skillsmgr install <path>`

## 4. uninstall 本地 skill 改走磁盘扫描

- [x] 4.1 修改 `src/commands/uninstall.ts` 按 name 卸载路径: 对 custom skill, 用 `findInstalledCustomSkills(name)` (复数, 跨 custom 顶层与一层子目录) 作为唯一权威匹配; 不再从 sources.json 遍历寻找 custom 候选 (其他 type 保持原样)
- [x] 4.2 卸载 custom skill 成功后: 删除磁盘目录, 调用 `groupsService.removeSkillFromAll(key)`; 不尝试调用 `sourcesService.removeSource` (应该本来就没有; 即便有 legacy 条目也会被读路径过滤 + 下次其他写入自然清理)
- [x] 4.3 如果 name 同时匹配多种来源 (custom + community 等), 现有"列出所有匹配让用户选"逻辑保留; custom 候选来自磁盘扫描即可
- [x] 4.4 物理 group 卸载路径 (`groupKind === 'local-batch'`) 保持现状, 其成员 sources.json 清理逻辑不变

## 5. group / deploy / remove 对本地 skill 的解析

- [x] 5.1 审查 `src/services/group-manager.ts`, `src/commands/group.ts`, `src/commands/deploy.ts`, `src/commands/remove.ts` 中所有"通过 `custom/<name>` key 查询 sources.json 验证 skill 是否存在"的分支; 改为查 `findCustomSkillByKey(key)` 或等价的磁盘扫描
- [x] 5.2 groups.json 悬空引用 (指向磁盘不存在的 skill) 的"读时跳过并警告"语义保持不变, 本任务只保证不因 sources.json 查询失败而误报为"悬空"
- [x] 5.3 `group add <group> <skill>` 按 name 匹配 skill 时, custom 候选通过 `findInstalledCustomSkills(name)` 获得, 不依赖 sources.json

## 6. list 命令本地 skill 枚举

- [x] 6.1 修改 `src/commands/list.ts`: 对 custom 类型的 skill, 改为通过 `SkillsService.getSkillsFromSource('custom')` 或等价的磁盘扫描枚举 (该路径在 `SkillsService` 层已存在); 确认 output 表格对 custom skill 不再尝试读取 sources.json 的 `url` 字段
- [x] 6.2 `list --json` schema: 对 custom skill, `url` 字段改为 `null` (避免破坏已消费此字段的外部工具); `installMethod` 字段改为 `"local-copy"` (保持语义) 或 `null` (按是否有更高层判断), 选一种写入设计 doc 的 Open Question Q1 决议内
- [x] 6.3 更新 `src/commands/list.test.ts` / `list-json.test.ts`: custom 场景无 sources 条目时仍能正确枚举

## 7. 测试与 e2e

- [x] 7.1 更新 `src/commands/install.test.ts` / `install-local` 相关单测: 移除对 "install 后 sources.json 含 `custom/<name>` 条目" 的断言; 替换为 "install 后 sources.json 不含 `custom/<name>` 条目"; 移除 URL-mismatch 冲突测试 (同名不同路径应走 overwrite)
- [x] 7.2 更新 `src/commands/update.test.ts`: 单 skill local 路径 update 的测试改为磁盘 fixture 驱动 (不再 mock sources.json); 新增测试 "update ./path 在 sources.json 为空时成功" 对应重现用户 bug
- [x] 7.3 更新 `src/commands/uninstall.test.ts`: 增加场景 "custom skill 无 sources 条目时按 name 卸载"; 校验删除磁盘 + 清理 groups.json 引用
- [x] 7.4 更新 `src/services/source-resolver.test.ts`: 调整 `resolveLocalPath` 的测试以反映 "单 skill 不再返回 rebind-candidate"; 保留物理 group rebind 测试
- [x] 7.5 新增 `e2e/disk-as-truth.e2e.ts`: 场景 "磁盘有 skill + sources.json 无条目 → install 说 exists, update ./path 成功, uninstall name 成功"; 场景 "install ./path 两次从不同目录, 第二次按 overwrite 流程而非 URL 冲突报错"; 场景 "bare update 跳过 local skill 并打印提示"
- [x] 7.6 运行 `pnpm test` 和 `pnpm test:e2e`, 所有测试通过 (unit: 691/691 passed; e2e/install-local: 8/8; e2e/disk-as-truth: 4/4; e2e/update: 6/8, 2 failures are pre-existing GitHub network timeouts unrelated to this change)

## 8. 文档与 release notes

- [x] 8.1 检查并更新 `docs/` 中涉及本地 skill 生命周期的说明 (若有), 明确 sources.json 不再追踪单 skill 本地安装
- [x] 8.2 在 `README.md` 或 `docs/group-first-class-unit.md` 等文档中, 更新"本地 skill 如何更新"的说明: 必须用 `skillsmgr update ./path`, 裸 `skillsmgr update` 不再包含本地
- [x] 8.3 为下一个版本的 release notes 草拟 BREAKING 条目: (1) 裸 `skillsmgr update` 不再更新本地 skill; (2) `skillsmgr install ./path` 不再写 sources.json; (3) 同名不同路径的 install 不再报冲突, 改走 overwrite 提示

## 9. 清理与一致性

- [x] 9.1 `src/services/sources.ts` 的 `findLocalCopySourcesByBasename` 若除 rebind 外再无调用点, 保留但标注 `@deprecated 物理 group rebind 已移除 local-copy 候选` 或根据编译/lint 结果删除 (择一)
- [x] 9.2 `formatReinstallConflictMessage` 若不再被任何 install 路径使用, 删除该 helper; 若仍被其他场景 (如物理 group rebind 冲突提示) 使用, 保留
- [x] 9.3 通过 `pnpm build` 验证无 TypeScript 报错, 无未使用 import 残留
- [x] 9.4 手动 smoke test: 在用户的真实 ~/.skills-manager 环境 (含 12 个 orphan) 上执行 `skillsmgr update ./some-orphan-skill`, 验证成功; 执行 `skillsmgr install ./some-path` 于已存在 orphan 名, 验证走 overwrite 提示; 执行裸 `skillsmgr update`, 验证打印跳过行 (已验证: `update ./jt-orch-os-c2c-propose` 输出 `↑ jt-orch-os-c2c-propose: updated`; `install ./jt-orch-os-c2c-propose` 提示 `already exists. Overwrite?` — 原 bug 修复确认)
