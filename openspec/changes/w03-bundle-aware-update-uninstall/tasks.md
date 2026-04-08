# Tasks: w03-bundle-aware-update-uninstall

## 1. 共享 helper 抽取

- [x] 1.1 在 `src/commands/install-utils.ts` 新增 `installSingleSkillToLocalTarget(sourcePath, targetDir, options)`: 从本地路径单个拷贝到目标, 含 findScriptFiles / warnScriptFiles
- [x] 1.2 在 `src/services/github.ts` 或新建 helper, 抽取 "list git skills via fallback paths" 逻辑 (复用 update.ts:171-184)
- [x] 1.3 更新 `installFromLocalDirBatch` / `installFromLocalDir` 使用新 helper (重构验证)

## 2. BundleManager 骨架

- [x] 2.1 新建 `src/services/bundle-manager.ts`, 定义 `BundleManager` 类
- [x] 2.2 构造函数依赖注入: `SourcesService`, `GitHubService`, 文件系统工具
- [x] 2.3 定义 `BundleSyncResult`, `BundleRemoveResult`, `BundleSyncOptions` interface
- [x] 2.4 定义公开方法签名: `sync(bundleId, options)`, `remove(bundleId)`

## 3. BundleManager sync 扫描

- [x] 3.1 实现 `scanCurrentSourceSkills(bundle)`: 按 bundle.type 分发到 local-batch / git / zip 扫描
- [x] 3.2 local-batch 扫描复用 `scanSkillDirectories(bundle.url, 1)`
- [x] 3.3 git 扫描复用 Task 1.2 的 helper
- [x] 3.4 zip 扫描返回空列表 (sync 时不支持)
- [x] 3.5 单元测试: local-batch 目录扫描, git API mock, 路径不存在错误

## 4. BundleManager sync diff

- [x] 4.1 实现 `computeDiff(currentSkills, bundleMembers)`: 返回 `{added, existing, removed}`
- [x] 4.2 member 提取 skill 名: 从 source key 取最后一段
- [x] 4.3 单元测试: 完整 diff, 空 diff, 全 added, 全 removed

## 5. BundleManager sync 应用变化

- [x] 5.1 实现 `applyExisting(bundle, skill)`: 比对 SKILL.md 内容, 不同则重拷贝, 累计 updated/upToDate
- [x] 5.2 实现 `applyAdded(bundle, skill)`:
  - all 模式: 调用 Task 1.1 / 1.2 helper 安装新 skill, addSource, 更新 bundle.members
  - subset 模式: 输出提示并跳过
- [x] 5.3 实现 `applyRemoved(bundle, skill, options)`:
  - 默认: 输出 warn, 累计 removedKept
  - options.sync: 删除本地, removeSource, groupsService.removeSkillFromAll, 从 bundle.members 移除
- [x] 5.4 统一收集结果到 `BundleSyncResult`, 单 skill 失败捕获到 failed

## 6. BundleManager sync 收尾

- [x] 6.1 sync 结束后调用 `updateBundleTimestamp(bundleId)`
- [x] 6.2 有 member 变化时调用 `updateBundleMembers(bundleId, newMembers)`
- [x] 6.3 输出统计摘要

## 7. BundleManager remove 实现

- [x] 7.1 实现 `remove(bundleId)`: 获取 bundle, 遍历 members
- [x] 7.2 对每个 member: removeDir, removeSource, groupsService.removeSkillFromAll
- [x] 7.3 成员目录已不存在时跳过 (非致命)
- [x] 7.4 清理 `cleanEmptyParents` 父目录
- [x] 7.5 调用 `removeBundle(bundleId)` 删 bundle 条目
- [x] 7.6 返回 `BundleRemoveResult { removed: count }`

## 8. BundleManager 单元测试

- [x] 8.1 `src/services/bundle-manager.test.ts`: sync 基本 happy path (local-batch, 全 existing)
- [x] 8.2 sync 测试: added all 模式自动装
- [x] 8.3 sync 测试: added subset 模式跳过
- [x] 8.4 sync 测试: removed warn-keep 默认
- [x] 8.5 sync 测试: removed --sync 硬删
- [x] 8.6 sync 测试: git bundle 的 listSkills 路径探测
- [x] 8.7 sync 测试: 单 skill 失败不影响整批
- [x] 8.8 sync 测试: bundle 源路径不存在报错
- [x] 8.9 sync 测试: zip bundle 返回空结果 + 提示
- [x] 8.10 remove 测试: 全量删除 + bundle 条目清理
- [x] 8.11 remove 测试: 成员目录已被手动删除不报错

## 9. SourceResolver 扩展 (依赖 w01)

- [x] 9.1 修改 `src/services/source-resolver.ts`: ResolvedTarget 新增 `'bundle'` kind 和 `bundleId` 字段
- [x] 9.2 **删除** `'batch-unsupported'` kind 和相关代码分支
- [x] 9.3 `resolveLocalPath`: 路径归一化后调用 `findBundleByUrl(absPath, 'local-batch')`, 命中返回 bundle kind
- [x] 9.4 `resolveOwnerRepo`: 走完 owner 翻译后, 先查 `findBundleByUrl('https://github.com/{owner}/{repo}', 'git')`
- [x] 9.5 `resolveUrl`: URL 归一化后查 git bundle
- [x] 9.6 bundle kind 的 sourceKeys 从 `bundle.members` 直接拷贝
- [x] 9.7 更新 SourceResolver 测试: 删除 batch-unsupported 相关 case, 新增 bundle 命中 case

## 10. update 命令集成

- [x] 10.1 修改 `src/commands/update.ts` 的 switch 分支: 删除 `batch-unsupported` 分支, 新增 `bundle` 分支
- [x] 10.2 bundle 分支调用 `bundleManager.sync(bundleId, { sync: options.sync, verbose: options.verbose })`
- [x] 10.3 添加 `--sync`, `-v/--verbose` CLI option 定义
- [x] 10.4 输出格式: 按 bundle-sync spec 中定义的 "Done!..." 统计行
- [x] 10.5 default (非 verbose) 模式下折叠 up-to-date 为单行 "{n} skills up to date"
- [x] 10.6 failed > 0 时 `process.exitCode = 1`

## 11. uninstall 命令集成

- [x] 11.1 修改 `src/commands/uninstall.ts` 的 switch 分支: 新增 `bundle` 分支
- [x] 11.2 bundle 分支先列出成员名 + symlink 警告, 走 `confirmUninstall`
- [x] 11.3 确认后调用 `bundleManager.remove(bundleId)`
- [x] 11.4 `--force` / `--yes` 行为保留 (跳过确认)
- [x] 11.5 owner/repo 走 bundle kind 时 (D5), 不再调用旧的 `uninstallSource`, 统一走 BundleManager

## 12. 更新现有测试

- [x] 12.1 `src/commands/update.test.ts`: 新增 bundle 路径测试 (local-batch 和 git), 删除 batch-unsupported 预期
- [x] 12.2 `src/commands/uninstall.test.ts`: 新增本地 batch uninstall 测试
- [x] 12.3 `src/services/source-resolver.test.ts`: 更新 batch kind 预期
- [x] 12.4 确保所有 w01 已有测试仍然通过

## 13. E2E 回归

- [x] 13.1 手动 e2e: `skillsmgr install ./spec-tdd --all`, 确认 bundle 写入
- [x] 13.2 在源目录新加一个 `st-e2e/SKILL.md`, `skillsmgr update ./spec-tdd`, 验证 st-e2e 被自动安装
- [x] 13.3 删除源目录里一个子 skill (如 `st-apply`), `skillsmgr update ./spec-tdd`, 验证 warn-keep
- [x] 13.4 `skillsmgr update ./spec-tdd --sync`, 验证 st-apply 被硬删除
- [x] 13.5 `skillsmgr uninstall ./spec-tdd --force`, 验证整个 bundle 被删, `~/.skills-manager/custom/spec-tdd/` 为空
- [x] 13.6 对 git bundle 重复 13.2-13.4: `skillsmgr update anthropics/skills`, 如有新 skill 则自动装 (前提 selectionMode=all)

## 14. 文档与 lint

- [x] 14.1 更新 README 的 update / uninstall 章节, 说明 bundle sync 语义, `--sync` / `-v` flag
- [x] 14.2 CHANGELOG 标注 `update ./batch-dir` 从报错变为 sync 行为
- [x] 14.3 运行 `pnpm build` 确认无错误
- [x] 14.4 运行 `pnpm test` 全部通过
- [x] 14.5 运行 `openspec validate w03-bundle-aware-update-uninstall --strict` 确认 spec 无效
