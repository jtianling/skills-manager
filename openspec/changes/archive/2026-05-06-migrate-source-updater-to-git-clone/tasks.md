## 1. SourceUpdater 迁移到 git clone

- [x] 1.1 在 `SourceUpdater` 构造函数加入 `cloneRepo` 和 `scanSkills` 可选参数, 默认指向 `cloneRepoToTemp` / `collectSkillsFromClone` 的薄包装 (返回 `{name, path}`)
- [x] 1.2 重写 `updateSource` 中 git 分支: clone 仓库 → scan → 对每个本地已安装 skill 找 clone 内对应路径 → 比对 SKILL.md → 不同则 `removeDir + copyDir` → 在 finally 里 cleanup
- [x] 1.3 保留现有非 git 分支不动: `local-copy`, `zip`, `registry`, `parseGitHubUrl 返回 null` 的处理
- [x] 1.4 保留现有契约: 跳过 `commands` 目录, `selectedSkillNames` 过滤, `updateTimestamp` 写入, `warnScriptFiles`
- [x] 1.5 已安装 skill 不在 clone 扫描结果中时, 输出 "⚠ <name>: not found in remote" (与原行为一致)

## 2. 测试改造

- [x] 2.1 重写 `src/services/source-updater.test.ts` 中所有 git 路径用例, 通过构造函数注入假 `cloneRepo` / `scanSkills`, 不再 mock `GitHubService` 的 API 方法
- [x] 2.2 新增用例: `cloneRepo` 抛错时不删除任何本地 skill 目录, 错误向上抛
- [x] 2.3 新增用例: `scanSkills` 抛错时仍调用 cleanup
- [x] 2.4 新增用例: SKILL.md 字节相同时不重新拷贝
- [x] 2.5 新增用例: SKILL.md 不同时按 copyDir 完整复制 skill 目录 (验证非 SKILL.md 文件也被刷新)
- [x] 2.6 新增用例: 远端已删除的本地 skill 输出 "not found in remote", 不删本地
- [x] 2.7 更新 `src/commands/update.test.ts`: 把现有 `vi.mock('../services/repo-clone.js')` 的 mock 实现扩展, 让 source-updater 走的场景也能命中
- [x] 2.8 检查 `src/services/group-manager.test.ts`: 确认其测试不依赖被删除的 `GitHubService` 方法; 如果依赖, 改为注入或 mock `services/repo-clone.js`

## 3. 清理 GitHubService

- [x] 3.1 删除 `GitHubService` 中 `getDefaultBranch`, `listSkills`, `listSkillsWithFallbackPaths`, `findRootSkillsByTree`, `fetchRootFile`, `downloadSkill`, `downloadRepoRoot`, `downloadDirectory`, `downloadFile`, `getHeaders` 及 `defaultBranchCache`
- [x] 3.2 验证 `parseGitHubUrl`, `getTargetDir` 两个方法在 `GitHubService` 上保留, 调用方不变 (`isSpecificSkillUrl` 在 `GitService`, 不在本次范围)
- [x] 3.3 删除 `src/services/github.test.ts` 中已移除方法对应的 case (主要是 `listSkillsWithFallbackPaths` 三组测试)
- [x] 3.4 全代码 grep 确认: `src/` 下不再有 `getDefaultBranch|listSkillsWithFallbackPaths|findRootSkillsByTree|fetchRootFile|downloadSkill|downloadRepoRoot|api.github.com|raw.githubusercontent` 的引用 (除去 spec 文档/注释)

## 4. 验证

- [x] 4.1 `pnpm exec tsc --noEmit` 无新增 error (允许保留预先已存在的、与本变更无关的 error)
- [x] 4.2 `pnpm test` 全部通过
- [x] 4.3 `pnpm run build` 成功
- [x] 4.4 手动跑一次真实 update 验证: `node dist/index.js update <某个已装的 git source>`, 观察日志中无任何 GitHub API 失败、能在限额耗尽状态下正常工作

## 5. Spec 同步 (跟着 archive 流程)

- [x] 5.1 `openspec/specs/source-management/spec.md` 中 "局限性" 第 1 条把"通过 GitHub API"改为"通过 git clone"
- [x] 5.2 `openspec/specs/source-management/spec.md` 中 "GitHub Service 详解 (仅用于 update 流程)" 整段精简为只描述 `parseGitHubUrl` / `getTargetDir` / `isSpecificSkillUrl` (或者并入"Git Service 详解"段)
- [x] 5.3 "更新流程" 节中描述远程探测的步骤 (4 / 5 / 7) 改写为"基于 clone 后本地文件系统的扫描和对比"
