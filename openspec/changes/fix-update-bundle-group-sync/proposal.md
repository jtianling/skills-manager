## Why

`install ./tdd-spec` 会自动创建同名虚拟 group 并把所有 skill 加入.  但 `update ./tdd-spec` 发现源目录新增 skill 并自动安装时, 只写入 `sources.json` 和 bundle members, **不同步写入同名 group**, 导致 group 视图和实际 bundle 内容脱节 (用户已观察到: 物理 14 个 / sources 14 个 / group 11 个, 缺 3 个新增 skill).

## What Changes

- `BundleManager.applyAdded` 在 local-batch 分支新增 skill 后, SHALL 调用 `groupsService.addSkill(groupName, sourceKey)`, 其中 `groupName` 为 `basename(bundle.url)`
- `BundleManager.applyRemoved` 在 local-batch 分支的 group 清理已通过 `removeSkillFromAll` 处理, 保持现状 (本次只修补缺失的 addSkill 对称)
- 自动 group 只在**存在**时才同步: 若用户已通过 `group delete` 删除了同名 group, update 不强制重建 (不越权)
- 一次性回填脚本 / 启动自动修复: 检测到 local-batch bundle 的 members 与同名 group 缺项时, 提示用户运行 `skillsmgr group sync <name>` 或在 `update` 流程末尾自动提示 (本次选择在 update 末尾输出一行信息, 不自动改数据)

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `local-update`: 新增需求 "bundle update 同步同名自动 group", 规定 local-batch bundle update 时新增 skill SHALL 追加到 `basename(bundle.url)` 命名的虚拟 group (若该 group 存在); 被 `--sync` 移除的 skill 继续沿用现有 `removeSkillFromAll` 清理

## Impact

- `src/services/bundle-manager.ts`: `applyAdded` 在 local-batch 分支新增 group 同步逻辑; 可选新增一个私有 `getAutoGroupName(bundle)` helper
- `src/services/bundle-manager.test.ts`: 新增测试覆盖 "update 新增 skill 自动进同名 group" 和 "group 不存在时不重建" 两个 scenario
- 用户的 `~/.skills-manager/groups.json`: 首次升级后, 已有的缺项不会自动回填; 下一次 update 才会把新增 skill 加入 group.  旧缺项由用户手动 `group add <name> <skill>` 或等待数据自愈 (本 change 不提供迁移脚本, 见 design.md Risks)
- 不影响: git bundle, registry, zip, single local-copy skill 的 group 行为 (它们初次 install 也不自动建 group, 除非用户显式 `--group`)
