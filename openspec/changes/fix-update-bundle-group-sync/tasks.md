## 1. 修复 applyAdded 的 local-batch 分支

- [x] 1.1 在 `src/services/bundle-manager.ts` 增加私有 helper `getLocalBatchAutoGroupName(bundle)`, 返回 `basename(bundle.url)`, 与 install-directory-batch 的 `batchGroupName` 规则保持一致
- [x] 1.2 在 `applyAdded` 的 local-batch 分支 (大约 bundle-manager.ts:373-387) 新增 skill 并写入 sources 后, 同步调用: 若 `groupsService.getGroup(autoGroupName)` 存在, 则 `groupsService.addSkill(autoGroupName, sourceKey)`; 不存在则跳过, 不创建新 group
- [x] 1.3 `BundleManager` 构造函数已注入 `groupsService`, 无需新增依赖

## 2. 测试

- [x] 2.1 在 `src/services/bundle-manager.test.ts` 新增测试组 "sync() local-batch group sync":
  - 2.1.1 初始状态: bundle members 11 项, 同名 group 存在含 11 项, 源目录新增 1 项 → sync 后 group 有 12 项
  - 2.1.2 初始状态: bundle members 11 项, **同名 group 不存在** (被用户删除), 源目录新增 1 项 → sync 后 group 仍不存在, 不报错
  - 2.1.3 初始状态: 源目录一次新增 3 项, 同名 group 存在 → sync 后 group 追加这 3 项
  - 2.1.4 初始状态: bundle members 11 项, 同名 group 存在, 源目录无变更 → group 保持不变 (不走 addSkill)
  - 2.1.5 初始状态: `--sync` 模式, 源目录减少 1 项 → sync 后该 skill 从 group 和 sources 中移除 (现有行为, 回归测试)
- [x] 2.2 使用现有测试的 in-memory SourcesService / GroupsService mock 模式, 避免触碰真实 ~/.skills-manager
- [x] 2.3 运行 `pnpm test` 确认无回归

## 3. 文档与提示 (可选, 本次不做)

- [x] 3.1 (推迟) 在 `executeUpdateWithOptions` 的 bundle 分支末尾输出历史缺项提示 "Group 'X' is missing N skills from bundle members. Run `skillsmgr group add ...` to backfill." — 本次 change 不实现, 记录到 openspec 的 discuss 或下一 change
- [x] 3.2 (推迟) 提供 `skillsmgr group sync <bundle-name>` 一次性修复命令 — 本次不做, 价值低

## 4. 归档准备

- [x] 4.1 自检: 手动模拟用户场景 (在一个 tdd-spec 副本里增加一个 ts-test-new 子目录, 跑 update, 检查 groups.json 和 sources.json 都新增)
- [x] 4.2 commit 信息采用 `fix: sync new local-batch skills into same-name auto group on update` 格式
- [x] 4.3 运行 `openspec verify fix-update-bundle-group-sync` 通过
