## 1. 数据模型与类型

- [x] 1.1 在 `src/types.ts` 新增 `GroupKind = 'virtual' | 'local-batch'`, `GroupEntry` 联合类型 (virtual/local-batch 两种), `GroupsDataV2 = { version: '2.0', groups: Record<string, GroupEntry> }`
- [x] 1.2 在 `src/types.ts` 新增 `SourcesDataV3 = { version: '3.0', sources, bundles }`, 升级 `SourcesData` 类型 union
- [x] 1.3 在 `src/services/source-resolver.ts` 的 `ResolvedTarget` 增加 `kind: 'group'` 形态, 含 `groupName, groupKind, groupUrl?, members`

## 2. SourcesService V2→V3 迁移

- [x] 2.1 编写 `migrateV2ToV3` 函数, 把 `bundles` 中 `type === 'local-batch'` 的 entry 移出, 调用 `groupsService.migrateLocalBatchToPhysicalGroup` 写入 groups.json
- [x] 2.2 在 `SourcesService.load` 中检测 `version`, 调用迁移并 atomic 写入 backup `sources.json.v2.backup`
- [x] 2.3 添加 `addBundle` 防御断言: `type === 'local-batch'` 时抛错
- [x] 2.4 单元测试: V2→V3 迁移、已是 V3 不重复迁移、atomic 失败回滚、backup 文件正确写出

## 3. GroupsService V1→V2 迁移与 schema 升级

- [x] 3.1 在 `src/services/groups.ts` 升级 `GroupsData` 类型为 V2 结构
- [x] 3.2 编写 `migrateV1ToV2` 函数, 把每个 `name: string[]` entry 升级为 `{ kind: 'virtual', members }`, 包入 `{ version, groups }`
- [x] 3.3 在 `GroupsService.load` 中检测顶层结构, 调用迁移并 atomic 写入 backup `groups.json.v1.backup`
- [x] 3.4 实现 `migrateLocalBatchToPhysicalGroup(name, bundle)`: 检查冲突, 撞名 virtual 则按 `<name>-legacy[-N]` 重命名, 写 stderr + `migration.log`
- [x] 3.5 新增方法: `getGroupKind`, `getGroupMembers` (物理 group 实时扫物理目录), `createLocalBatchGroup`, `deletePhysicalGroup`, `updatePhysicalGroupTimestamp`
- [x] 3.6 `createGroup` 增加撞名物理 group 的检查并报错
- [x] 3.7 `addSkill` / `removeSkill` 在物理 group 上抛错, `removeSkillFromAll` 仅作用于虚拟 group
- [x] 3.8 单元测试覆盖所有新方法 + 迁移路径 + 命名冲突 + `<name>-legacy` 递增

## 4. SourceResolver 扩展

- [x] 4.1 在 `resolveBareword` 中前置 group 查找: 优先匹配物理或逻辑 group 名, 命中返回 `kind: 'group'` target
- [x] 4.2 在 bareword 命中 group 且同名 skill 也存在时打印 disambiguation 提示
- [x] 4.3 在 `resolveOwnerRepo` 中 owner === 'custom' 时先检查同名 group 命中, 命中返回 group target
- [x] 4.4 修改 `resolveLocalPath` 命中 local-batch 时返回 `group` target (groupKind='local-batch'), 替代旧的 `bundle` target
- [x] 4.5 单元测试: 各形态 input → group target 解析、优先级、disambiguation

## 5. GroupManager service (新)

- [x] 5.1 创建 `src/services/group-manager.ts`, 实现 `GroupManager` 类, 注入 `SourcesService`, `GroupsService`, `GitHubService` 等依赖
- [x] 5.2 实现 `installLocalBatch(absolutePath, options)`: 冲突检测 (物理同 url / 物理不同 url / 虚拟同名), 创建物理 group entry, 安装子 skill 到 `custom/<name>/`, 写 sources entries
- [x] 5.3 实现 `uninstallPhysicalGroup(name, options)`: 物理目录扫描 + sources keys 收集 + 用户确认 + 删整目录 + 清 sources + 清逻辑 group 引用 + 删 group entry
- [x] 5.4 实现 `updatePhysicalGroup(name, options)`: 源目录扫描 + diff (existing/added/orphaned) + 应用变更, 默认 sync, `--keep-local` opt-out
- [x] 5.5 实现 `updateVirtualGroup(name, options)`: 遍历 members, 对每个 member 按 source type 分发到现有 update 路径, 处理悬空引用
- [x] 5.6 实现 `renamePhysicalGroup(oldName, newName)`: 冲突检查, 物理目录改名, sources keys 改名, groups entry 改名, 逻辑 group 引用同步更新, 全部 atomic
- [x] 5.7 单元测试覆盖所有方法, 包括改名场景、孤儿处理、冲突报错

## 6. uninstall 命令重写

- [x] 6.1 修改 `src/commands/uninstall.ts`: 在 `executeUninstall` 中处理 `target.kind === 'group'` 分支, 按 groupKind 分发到 `groupManager.uninstallPhysicalGroup` 或报错 (虚拟 group)
- [x] 6.2 删除/废弃旧的 `bundleManager.remove` 对 local-batch 的代码路径 (git bundle 路径保留)
- [x] 6.3 保留现有按 provider/owner-repo/skill name 卸载逻辑不动
- [x] 6.4 错误信息更新 (含逻辑 group 提示用 `group delete`)
- [x] 6.5 测试: 用户原场景 (改名后 uninstall) 端到端零残留

## 7. update 命令重写

- [x] 7.1 修改 `src/commands/update.ts`: 在 `executeUpdateWithOptions` 中处理 `target.kind === 'group'` 分支, 按 groupKind 分发到 `groupManager.updatePhysicalGroup` 或 `groupManager.updateVirtualGroup`
- [x] 7.2 删除/废弃 `bundleManager.sync` 对 local-batch 的代码路径
- [x] 7.3 修改 rebind 路径: `maybeRebindTarget` 现在处理物理 group 的 rebind (更新 `groups.json[<name>].url` + sources `custom/<name>/*` 的 url)
- [x] 7.4 新增 `--keep-local` 选项, `--sync` 保留为 no-op 兼容标记
- [x] 7.5 测试: 改名场景 → 自动 add+remove, `--keep-local` 保留, rebind 物理 group, 逻辑 group 遍历

## 8. install 命令对接

- [x] 8.1 修改 `src/commands/install.ts` / `install-local.ts` 的批量分支: 内部调用 `groupManager.installLocalBatch`
- [x] 8.2 移除旧的 "install 时同时调 bundlesService.addBundle + groupsService.createGroup + addSkill" 复合调用
- [x] 8.3 `install --group <name>` 校验 `<name>` 不是物理 group, 撞名报错
- [x] 8.4 测试: install 场景, --group 撞名物理报错, --group 添加到逻辑

## 9. group 子命令扩展

- [x] 9.1 在 `src/commands/group.ts` 新增 `group install <path|url>` 子命令, 调用 `groupManager.installLocalBatch`
- [x] 9.2 新增 `group uninstall <name>` 子命令: 物理走 group manager, 虚拟报错提示用 `group delete`
- [x] 9.3 新增 `group update <name>` 子命令: 物理或虚拟分发到对应路径
- [x] 9.4 修改 `group rename` 子命令: 物理 group 走 `groupManager.renamePhysicalGroup`, 虚拟 group 复用 `GroupsService.renameGroup`
- [x] 9.5 修改 `group list` / `group create` / `group delete` 适配 V2 schema 与 kind 显示
- [x] 9.6 测试: 所有 group 子命令端到端

## 10. SourceResolver 与 BundleManager 清理

- [x] 10.1 `SourceResolver` 中删除 `bundle` 形态对 local-batch 的处理代码 (确认无残留引用)
- [x] 10.2 `BundleManager` 仅保留 git 路径, 添加断言阻止 local-batch 调用
- [x] 10.3 `findLocalBatchBundlesByBasename` 改为 `findPhysicalGroupsByBasename` (返回 group entry), 调用方更新
- [x] 10.4 sources.json 历史 `bundles[local-batch:...]` 在迁移后不应再出现, 增加运行时断言

## 11. CLI 输出与文档

- [x] 11.1 迁移日志格式化输出到 stderr, 同步写 `~/.skills-manager/migration.log`
- [x] 11.2 更新 README / docs 描述 group 一等公民概念, 物理 vs 逻辑, 命名禁同名
- [x] 11.3 在 `~/.skills-manager/custom/<name>/` 边界文档化 (物理 group 拥有目录, 用户不要手动放无关文件)
- [x] 11.4 错误文案一遍 review, 确保引导用户到正确命令 (rename/group delete/keep-local 等)

## 12. 端到端测试

- [x] 12.1 用户原场景复现: install ./tdd-spec → 改 skill 名 → uninstall tdd-spec → 验证物理目录、sources、groups 全部清零
- [x] 12.2 update 改名场景: install → 改 skill 名 → update → 验证旧 skill 删除, 新 skill 安装, sources 同步
- [x] 12.3 rename 场景: install → group rename → 验证物理目录改名 + sources keys 改名 + 逻辑 group 引用同步
- [x] 12.4 命名冲突场景: install 撞名虚拟 → 报错; group create 撞名物理 → 报错
- [x] 12.5 迁移场景 (从模拟 V2 数据): 含/不含命名冲突两种, 验证 `<name>-legacy` 重命名
- [x] 12.6 `--keep-local` 场景: update → 孤儿保留, sources entry 保留
- [x] 12.7 跨源逻辑 group: 含 git/local-copy/registry/悬空, update 全遍历正确

## 13. 回归测试与发布

- [x] 13.1 运行完整测试套件, 修复回归
- [ ] 13.2 手动测试: 既有用户的 sources.json + groups.json (V1/V2) 升级路径
- [ ] 13.3 检查 commit 信息描述破坏性变更和迁移说明
- [ ] 13.4 更新 changelog (在 release 流程中)
