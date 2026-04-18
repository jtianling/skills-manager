## 1. Manifest 服务层

- [x] 1.1 新增 `src/services/deployment-manifest.ts`, 导出 `DeploymentManifest` 接口和 `DeploymentManifestService` 类
- [x] 1.2 实现 `readManifest(projectRoot)`: 读 `skillsmgr-deploy.json`, 返回 `DeploymentManifest | null`; 非法 JSON 抛错
- [x] 1.3 实现 `writeManifest(projectRoot, manifest)`: 原子写入 (tmp file + rename) 到项目根 `skillsmgr-deploy.json`
- [x] 1.4 实现 `resolveExpectedSkills(manifest, groupsService, skillsService)`: 展开 followGroups + pinnedSkills, 返回 `Set<skillKey>`, 对不存在的 group / skill 收集 warnings
- [x] 1.5 实现 `mergeForDeploy(prev, incoming)`: `pinnedSkills` 覆盖, `followGroups` union, `mode` / `deployedAt` 取 incoming

## 2. Deploy 命令集成

- [x] 2.1 在 `src/commands/deploy.ts` 增加 `--follow-group <name>` 选项 (可重复, 使用 `collect`)
- [x] 2.2 在 `executeDeploy` 开始时 validate 所有 `--follow-group` 指定的 group 在 `groupsService.listGroups()` 中存在, 否则 fail-fast 报错
- [x] 2.3 在构造交互 prompt 的 `allSkills` 前, 过滤掉所有属于 followGroups 的 skill (由 follow 接管, 不再显示)
- [x] 2.4 部署流程结束后, 调用 `DeploymentManifestService.writeManifest`, 合并 `prev manifest + 本次 follow + 本次 pinned`
- [x] 2.5 `deploy -g` 全局分支保持不写 manifest (直接 return, 不触达 writeManifest)

## 3. Deploy --refresh 模式

- [x] 3.1 在 `deploy.ts` 增加 `--refresh` 选项; 与 `--follow-group` / `--all` / `-y` 互斥: 若 refresh, 忽略其它交互相关选项
- [x] 3.2 `executeDeploy` 入口检查 `options.refresh`, 分派到新函数 `executeDeployRefresh`
- [x] 3.3 `executeDeployRefresh`:
  - 读 manifest, 不存在则报错退出
  - 调用 `resolveExpectedSkills` 算 expected
  - 使用 `DeploymentScanner` 拿 current
  - 计算 to_add / to_remove (排除 unmanaged)
  - 按 `manifest.mode` 执行; 更新 deployedAt 后 `writeManifest`
  - 输出 `Refreshed: +N ·M (kept) -K` 摘要
- [x] 3.4 Refresh 过程中的 warning (group 不存在 / pinned skill 不存在) 输出到 stderr, 不影响成功与否

## 4. Update 提示集成

- [x] 4.1 在 `executeUpdateWithOptions` 的 bundle 分支 (update.ts 中调用 `bundleManager.sync` 处) 检查返回的 `BundleSyncResult`
- [x] 4.2 若 `result.added + result.removedHard + result.removedKept > 0`, 在 `printBundleUpdateSummary` 输出后追加一行提示
- [x] 4.3 提示文案硬编码, 本 change 不枚举项目路径

## 5. 测试

- [x] 5.1 `src/services/deployment-manifest.test.ts`:
  - 5.1.1 read/write 往返 ok
  - 5.1.2 非法 JSON 抛错
  - 5.1.3 `resolveExpectedSkills` 正常展开 follow + pinned 并去重
  - 5.1.4 `resolveExpectedSkills` group 不存在时 warn 并跳过
  - 5.1.5 `resolveExpectedSkills` pinned skill 不存在时 warn 并跳过
  - 5.1.6 `mergeForDeploy` pinned 覆盖, follow union
- [x] 5.2 `src/commands/deploy.test.ts` 新增:
  - 5.2.1 `--follow-group` 合法 group: 交互跳过 tdd-spec 的 skill 不显示, 写入 followGroups
  - 5.2.2 `--follow-group` 非法 group: fail-fast
  - 5.2.3 首次 deploy 无 manifest: 创建并写入 pinned
  - 5.2.4 二次 deploy 覆盖 pinned
  - 5.2.5 二次 deploy union follow
  - 5.2.6 `--refresh` 无 manifest: 报错退出
  - 5.2.7 `--refresh` 正常对齐 (to_add + to_remove 各有)
  - 5.2.8 `--refresh` follow group 被删: warn, 其它 follow 仍处理
  - 5.2.9 `--refresh` pinned skill 被 uninstall: warn, 其它 pinned 仍处理
  - 5.2.10 `--refresh` unmanaged skill 不被 remove
  - 5.2.11 `-g` 全局 deploy 不写 manifest
- [x] 5.3 `src/commands/update.test.ts`:
  - 5.3.1 bundle 有变化时输出提示
  - 5.3.2 纯 up-to-date 不输出提示
- [x] 5.4 运行 `pnpm test` 全量回归通过

## 6. CLI 帮助与文档

- [x] 6.1 在 `deployCommand` 的 `.option` 注释里清晰描述 `--follow-group` 和 `--refresh`
- [x] 6.2 在 README.md (若存在相关章节) 或项目首页描述中新增 "Follow vs Pinned" 小节 (1 段话); 本 change 不强制, 可推迟
- [x] 6.3 确认 `skillsmgr deploy --help` 输出正确

## 7. 归档准备

- [x] 7.1 手工验证: 在测试项目执行完整流程
  - `skillsmgr deploy --follow-group tdd-spec -y` → manifest 正确
  - 源目录新增 skill → `skillsmgr update ./tdd-spec` → 提示出现
  - `skillsmgr deploy --refresh` → 新 skill 被补齐
  - 取消 follow (手动编辑 manifest 或后续 change 加 `--unfollow-group`) → refresh 后移除
- [x] 7.2 commit 信息 `feat: add project deployment manifest with follow/pinned semantics and refresh`
- [x] 7.3 `openspec verify add-deployment-manifest` 通过
