## Why

`update` 流程对 git 来源仍走 GitHub HTTP API (`SourceUpdater.updateSource`), 受 60 req/h 未授权限额约束.  在批量更新或更新大型仓库时容易耗尽限额, 导致更新静默失败或返回不完整的列表 — 后续的 `--sync` 拿不完整列表当权威数据, 会误删本地已安装 skill (已发生过线上事故).

`install` 和 `BundleManager.sync` 已经统一走 git clone, 只剩 `SourceUpdater` 这条路径仍依赖 API.  补完后整个 codebase 与 GitHub HTTP API 解耦, 不再有限额风险.

## What Changes

- **BREAKING (内部行为)**: `SourceUpdater.updateSource` 对 git 类型的 source 改用 git clone + 文件系统扫描, 不再调 `GitHubService.getDefaultBranch / listSkillsWithFallbackPaths / fetchRootFile / downloadSkill / downloadRepoRoot`, 也不再 `fetch(raw.githubusercontent.com)`
- 复用 `services/repo-clone.ts` 里的 `cloneRepoToTemp` 和 `collectSkillsFromClone` (与 install / BundleManager 同一 clone+scan 路径)
- 已安装 skill 的 SKILL.md 内容比对改为对比本地 clone 内的文件, 不再走网络
- 删除 `GitHubService` 中只服务于 update 流程的 API 方法: `listSkills` / `listSkillsWithFallbackPaths` / `findRootSkillsByTree` / `getDefaultBranch` / `fetchRootFile` / `downloadSkill` / `downloadRepoRoot` / `downloadDirectory` / `downloadFile`.  保留 `parseGitHubUrl`, `getTargetDir` (纯字符串/路径工具)
- `GroupManager.updateVirtualGroup` 转发给 `SourceUpdater.updateSource`, 自动获得新行为, 无需单独改造
- 更新 spec `source-management` 的 "更新流程" 和 "GitHub Service 详解" 章节, 移除"通过 GitHub API 检查远程变更"的描述, 改为统一基于 git clone

## Capabilities

### New Capabilities

(无新增 capability)

### Modified Capabilities

- `source-management`: 更新流程 (Update Flow) 不再依赖 GitHub HTTP API, 改为 git clone + 本地扫描.  GitHubService 退化为只暴露 URL 解析工具

## Impact

- 代码: `src/services/source-updater.ts` (重写 updateSource 的 git 分支), `src/services/github.ts` (删除 API 方法, 保留 URL 解析), `src/services/group-manager.ts` (无需改动, 通过 SourceUpdater 自动受益)
- 测试: `src/services/source-updater.test.ts` (重写 git 路径相关 case), `src/services/github.test.ts` (删除已移除方法的 case), `src/commands/update.test.ts` (更新 mock — 用 vi.mock 注入假 clone), `src/services/group-manager.test.ts` (检查 mock 是否依赖被删除的方法)
- 行为: 单 skill update 和"全量 update"不再受限额影响.  耗时略增 (clone 比单文件 fetch 慢), 但 `git clone --depth 1` 对中小仓库是可接受的
- 依赖: 系统需要 `git` 可执行 (CLI 已经依赖, 无新依赖)
- spec: `source-management` 现有 "GitHub Service 详解 (仅用于 update 流程)" 章节将被精简或移除, "更新流程 / 局限性" 中"通过 GitHub API"语句改为"通过 git clone"
