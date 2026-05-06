## Context

`update` 流水线目前混用两条远端访问机制:

- `BundleManager.sync` (近期已迁移): 走 `git clone --depth 1` → 本地扫描 → `copyDir` → 清理临时目录, 依靠 `services/repo-clone.ts` 的 `cloneRepoToTemp` 和 `collectSkillsFromClone`
- `SourceUpdater.updateSource` (本次迁移目标): 仍调 `GitHubService` 的多个方法走 GitHub HTTP API + raw.githubusercontent.com.  这条路径在 `update` 全量、`update <skill-name>` 单 skill、`GroupManager.updateVirtualGroup` 三个入口被触发

`GitHubService` 当前仅有 `SourceUpdater` 一个真正的 API 调用者.  其它持有 `GitHubService` 实例的位置 (`BundleManager`, `SourceResolver`, `GroupManager`, `uninstall.ts`) 只用 `parseGitHubUrl()` 做字符串解析, 不打网络.

迁移完后, `GitHubService` 退化为 URL 解析 + 路径计算工具, 整个 codebase 不再访问 GitHub HTTP API.

## Goals / Non-Goals

**Goals:**

- `SourceUpdater.updateSource` 对 git 类型 source 完全走 git clone, 不再使用 HTTP API
- 与 `BundleManager` / install 路径共享同一份 clone+scan 实现 (来自 `services/repo-clone.ts`), 保证三条路径下 skill 发现行为一致
- 删掉 `GitHubService` 中只服务于 update 流程的 API 方法, 减少死代码
- 维持现有 update 行为契约 (按 SKILL.md 内容比对、selectedSkillNames 过滤、commands 目录跳过、updateTimestamp 写入等)
- 测试不依赖真实网络

**Non-Goals:**

- 不改 `local-copy` / `zip` / `registry` 三个 source 类型的更新流程, 这些不走 GitHub API
- 不改 source 匹配规则 (key 精确匹配 / `/source` 后缀 / repoName 等)
- 不引入并发 clone (按现有顺序更新)
- 不引入磁盘缓存 (每次 update 都重新 clone, 同 BundleManager)
- 不强制要求 git 可执行 — 系统已经依赖 git (install 路径已假定), 本次不重复声明

## Decisions

### 1. 复用 `services/repo-clone.ts` 而非独立 clone 实现

`BundleManager` 已经把 clone+scan 抽到了 `services/repo-clone.ts`.  `SourceUpdater` 直接复用 `cloneRepoToTemp` 和 `collectSkillsFromClone`, 不写第二份 clone 逻辑.

**Why:**

- skill 发现规则统一, 避免 install/bundle/source-update 看到的 skill 集合不一致
- 单一维护点: 未来要支持稀疏 checkout 或 cache, 改一处即可

**Alternative:** 在 `SourceUpdater` 里再写一份 clone+scan.  否决, 三份重复实现违反 DRY.

### 2. 通过构造函数注入 clone+scan 函数, 保留可测性

`SourceUpdater` 构造函数新增两个可选参数 `cloneRepo` 和 `scanSkills`, 默认指向 `cloneRepoToTemp` 和 `collectSkillsFromClone` 的薄包装.  测试可以注入假实现以避免真实 clone.

**Why:**

- 与 `BundleManager` 已有的注入模式对齐 (consistency)
- 测试不需要 vi.mock 整个模块, 直接构造 `new SourceUpdater(..., fakeClone, fakeScan)` 即可

**Alternative:** 用 vi.mock 在测试顶层 mock `services/repo-clone.js`.  仍然需要, 因为 `commands/update.ts` 直接 `new SourceUpdater()` 不通过依赖注入.  但服务层测试用注入更直观, 两种方式并存.

### 3. SKILL.md 内容比对改为读 clone 内文件, 不再 raw fetch

原代码先用 `fetch(raw.githubusercontent.com/.../SKILL.md)` 比内容, 不同才下载整个目录.  新代码: clone 已经把整仓拉下来了, 直接读 `<clonePath>/<skillPath>/SKILL.md` 比对, 不同则 `removeDir(targetDir) + copyDir`.

**Why:**

- clone 已经把数据拉到本地, 再发独立的 raw 请求是浪费
- 比对本地文件比 HTTP fetch 快且不会失败

### 4. clone 一次, 处理所有已安装 skill

源仓库 clone 一次, 然后遍历 `localSkills` 和 clone 内的 skill 目录做对比/复制.  `BundleManager` 的实现也是这个套路.

**Why:**

- 一次 clone 替代 1 次 listSkills + N 次 raw SKILL.md fetch + N 次目录递归下载, 在 N>5 时显著更快
- `git clone --depth 1` 是单一原子操作, 失败语义清晰

### 5. `try { ... } finally { cleanup() }` 保证临时目录回收

跟 BundleManager 的实现一致: clone 之后立刻进 try, 无论成功失败 finally 都调 cleanup.

**Why:**

- `$TMPDIR` 不能留垃圾 (项目硬规则: "资源 helper 默认总有一天会异常退出")
- cleanup 重入幂等 (实现已经支持)

### 6. 删除 `GitHubService` 的 API 方法, 保留纯函数工具

迁移完后, 以下方法不再被任何 src 代码调用, 直接删除:

- `getDefaultBranch` (含其内部缓存 Map)
- `listSkills`, `listSkillsWithFallbackPaths`, `findRootSkillsByTree`
- `fetchRootFile`
- `downloadSkill`, `downloadRepoRoot`, `downloadDirectory`, `downloadFile`
- `getHeaders`

保留:

- `parseGitHubUrl` (字符串解析, 多处用)
- `getTargetDir` (路径计算, github.test.ts 在测)
- 注: `isSpecificSkillUrl` 不在 `GitHubService` 上 — 它在 `GitService` (git.ts), 不属于本次清理范围

**Why:**

- 死代码价值为零, 还会污染未来搜索结果
- 保留下来还可能被新代码不小心 import 再次引入限额问题

**Risk mitigation:** 删除前 grep 确认无 src 调用; 测试运行通过即证明 mock 也不依赖.

## Risks / Trade-offs

- [git clone 比单文件 fetch 慢, 大仓库 clone 几秒钟] → 可接受.  install 已经走 clone, 用户已经习惯;  且 `--depth 1` 浅克隆, 中小仓库通常 1-3s.  极少数巨型仓库 (>100MB) 体感延迟会增加, 但发生频率低
- [系统必须有 git 可执行] → 已是既有假设 (install 路径已依赖).  不引入新风险
- [移除 `GitHubService` 多个方法是 breaking 的内部变更] → 仅影响内部代码, CLI 用户接口不变.  下游若有自定义 import (理论上不存在) 会编译失败, TypeScript 会立刻提示
- [测试改造工作量] → `update.test.ts` 已经在 `BundleManager` 迁移时引入了对 `services/repo-clone.js` 的 vi.mock, 复用即可; `source-updater.test.ts` 需要重写 git 路径用例

## Migration Plan

1. 新增 `SourceUpdater` 的 clone-based git 分支, 注入 `cloneRepo` / `scanSkills` 默认指向 `repo-clone.ts`
2. `update.test.ts` 的 `vi.mock('../services/repo-clone.js')` 已经存在, 把 mock 的 `collectSkillsFromClone` 返回扩展到覆盖 source-updater 走的场景
3. `source-updater.test.ts` 重写 git 路径相关 case, 改用注入假 clone+scan
4. 删除 `GitHubService` 中已无引用的 API 方法
5. 删除 `github.test.ts` 中已删除方法对应的 case (`listSkillsWithFallbackPaths` 三个 case 全删)
6. `pnpm test` 全绿后视为完成

回滚: 单个 PR 的反向 commit 即可恢复 — 不修改 `sources.json` 等运行时数据格式, 没有数据迁移.

## Open Questions

无
