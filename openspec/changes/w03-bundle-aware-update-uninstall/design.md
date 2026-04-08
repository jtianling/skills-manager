# Design: w03-bundle-aware-update-uninstall

## Context

w01 让 update / uninstall 通过 SourceResolver 接受所有单 skill 范围的 input 形式.
w02 让 sources.json 持有 bundle 元数据 (type, url, selectionMode, members).
但 **还没有任何代码在读 bundle**, 也没有"group 同步"的语义实现.  用户最初发现的 bug `update ./spec-tdd` 仍然会返回 `batch-unsupported`.

w03 是把"数据"变成"行为"的一步.  核心任务:
1. 让 SourceResolver 识别本地 batch 路径时返回 `kind: 'bundle'` 而不是 `batch-unsupported`
2. 实现 BundleManager 的 sync 和 remove 操作
3. update / uninstall 命令消费 bundle kind

用户还同意了 group 同步语义: **源里新增的 skill 在 selectionMode=all 时自动装, 在 subset 时跳过**.  没明确说的是"源里删除的 skill 怎么办" — 主 session 讨论时我倾向默认 warn-keep + `--sync` flag 走 sync-remove, 用户没反对, 这里按此实现.

## Goals / Non-Goals

**Goals:**
- `update ./spec-tdd` 从报错变成 sync 整个 batch
- `uninstall ./spec-tdd` 批量删除整个 bundle
- 源里新增 skill 的自动安装语义 (selectionMode=all)
- 源里删除 skill 的 warn-keep 默认 / `--sync` 硬删除
- git 源的 bundle sync 也跟着打通 (不只 local-batch)
- update 输出折叠 up-to-date 降噪
- 保持 w01 的所有对称性成果

**Non-Goals:**
- registry 包的 bundle (w02 就没建, 不涉及)
- zip 源的 update (仍然是 manual reinstall, 但 uninstall 可以走 bundle 批量删)
- `skillsmgr bundle list` / `bundle show` 等显式 bundle 管理命令 — 留给未来 change
- selectionMode 的运行时切换 — 留给未来 change

## Decisions

### D1. SourceResolver 返回 `kind: 'bundle'`

w01 里 ResolvedTarget 定义了 4 个 kind: `'source' | 'skill' | 'batch-unsupported' | 'not-found'`.  w03 新增 `'bundle'`, 并**移除** `'batch-unsupported'` (因为现在支持了).

```ts
interface ResolvedTarget {
  kind: 'source' | 'skill' | 'bundle' | 'not-found';
  sourceKeys: SourceKey[];
  skills?: SkillInfo[];
  bundleId?: string;            // kind === 'bundle' 时设置
  requestedVersion?: string;    // registry @version
  reason?: string;
  originalInput: string;
}
```

**移除 batch-unsupported 对 w01 的影响**: w01 的单元测试里明确测过 batch-unsupported 返回, 那些测试需要更新为 `kind: 'bundle'`.  不算 BREAKING (w01 还没发布到生产的用户手里 — 如果已发布, 那就要加迁移期说明).

**何时返回 bundle**: resolver 在处理以下 input 时查 `sourcesService.findBundleByUrl`:
- 本地路径 (归一化为绝对路径后查)
- git owner/repo (翻译后查 git bundle)
- URL (归一化后查 git bundle)
- zip 路径 (查 zip bundle)

查到 bundle → `kind: 'bundle'` + bundleId + members (复制到 sourceKeys).
查不到 bundle → 按 w01 原逻辑 (单 source 匹配 / not-found).

### D2. BundleManager 的 sync 流程

```
sync(bundleId, options):
  1. bundle = sourcesService.getBundle(bundleId)
  2. 按 bundle.type 走不同扫描路径:
     - local-batch: listLocalBatchSkills(bundle.url) → string[]
     - git: listGitSkills(bundle.url) → string[] (调 github API)
     - zip: throw "zip bundle update not supported, reinstall required"
  3. 当前源 skill set S_now
     当前 bundle.members (从 source key 提取 skill 名) S_known
     diff:
       added = S_now - S_known
       existing = S_now ∩ S_known
       removed = S_known - S_now
  4. 对 existing 中每个 skill: 复用 w01 的单 source update 流程 (内容 diff + 重拷贝)
  5. 对 added 中每个 skill:
     - 若 bundle.selectionMode === 'all': 复用 install 子流程安装该 skill, 加入 bundle.members
     - 若 bundle.selectionMode === 'subset': 跳过, info 输出 "+ {name}: new in source (skipped, subset mode)"
  6. 对 removed 中每个 skill:
     - 默认 (warn-keep): 保留本地, warn "- {name}: removed from source (kept locally)"
     - options.sync === true (sync-remove): 删除本地, members 移除, output "- {name}: removed"
  7. 更新 bundle.members (只在 added 合并或 removed 真删时) 和 bundle.updatedAt
  8. 返回统计: { updated, upToDate, added, addedSkipped, removedKept, removedHard, failed }
```

**为什么 subset 模式下新增要"跳过 + 提示"而不是"静默跳过"**:
用户当初 install 时只选了子集, 可能后来忘了. 看到提示 "+ X: new in source (skipped, subset mode)" 能让用户知道有新 skill 可装, 想装就跑一次 `install` 重新选.

### D3. removed 成员的默认行为: warn-keep + --sync flag

**备选**:
- (a) 直接删除, 无 flag — 破坏性太强, 用户手动往 install 目录里加的文件也会被清掉
- (b) 提示 y/n, 交互式删 — 打断自动化场景
- (c) warn-keep 默认, `--sync` flag 选项 — 本方案

**理由**:
- 对齐 git 的哲学: `git pull` 不删除 untracked 文件, 要 `git clean -fd` 显式确认
- update 通常是自动化的, 破坏性操作需要显式 opt-in
- warn-keep 模式下, 用户能看到漂移, 决定什么时候 sync
- `--sync` 是明确的意图声明 ("我要状态严格等于源"), 符合最小意外

**removed skill 的本地状态**: warn-keep 模式下, 被 warn 的 skill 保留在 `~/.skills-manager/` 但**从 bundle.members 里保留**. 如果下次 update 时它又回到源里 (比如用户 git revert 了), 直接 in existing 分支继续更新, 无副作用.

### D4. update 输出折叠

默认行为:
```
Updating local-batch:/Users/foo/spec-tdd
  ↑ st-apply: updated
  + st-new: new in source (installed)
  - st-gone: removed from source (kept locally, use --sync to remove)
  ✓ 17 skills up to date

Done! 1 updated, 1 added, 1 removed (kept), 17 up to date
```

`-v` / `--verbose` 全展开:
```
Updating local-batch:/Users/foo/spec-tdd
  ↑ st-apply: updated
  + st-new: new in source (installed)
  - st-gone: removed from source (kept locally)
  ✓ st-archive: up to date
  ✓ st-continue: up to date
  ... (17 lines)

Done! 1 updated, 1 added, 1 removed (kept), 17 up to date
```

**理由**: 19 个子 skill 全部 up-to-date 时, 刷屏没价值.  折叠计数保留信号, 过滤噪音.

### D5. uninstall 的 bundle remove 是全量

`uninstall ./spec-tdd` 收到 `kind: 'bundle'` → `bundleManager.remove(bundleId)`:
1. 对 `bundle.members` 每个 source key 调用现有 `removeSkills` 逻辑
2. 清理 sources.json 的 source 条目
3. 清理 groups.json 里的引用
4. 删除 bundle 条目本身
5. 调用 `cleanEmptyParents` 清空目录

**不提供"只删 bundle 里一部分"**: 如果用户要删单个 skill, 用 `uninstall <skill-name>` 或 `uninstall owner/repo:skill`, 这在 w01 就支持.  bundle uninstall 就是"整批删".

**交互确认**: 保留现有 `confirmUninstall` 流程, 列出要删的 skill 名, 用户确认后执行.  `--force` / `--yes` 跳过确认行为不变.

### D6. BundleManager 如何调用 install 子流程 (新增成员)

selectionMode=all 且源里多了新 skill 时, 需要"安装这一个 skill".  对 local-batch:
- skill 路径: `bundle.url + '/' + skillName`
- 目标路径: `custom/{dirName}/{skillName}` (参考 `getCustomSkillDir` 第二参数)
- 复用 `copyDir` + `findScriptFiles` + `warnScriptFiles`
- 写 source 条目 `custom/{dirName}/{skillName}`

对 git bundle:
- 调 `githubService.downloadSkill(owner, repo, remotePath, targetDir)`
- 写 source 条目 `community/{owner}/{repo}/{skillName}` 或 `official/{providerKey}/{repo}/{skillName}`

**实现策略**: 把 install 子流程里"安装单个 skill (已知路径 + 目标)"的部分抽出一个共享函数, BundleManager 和 install 命令都调.  避免代码重复.

新增共享 helper: `src/commands/install-utils.ts` 增加 `installSingleSkillToTarget(sourceSkill, targetDir, options)`.

### D7. skills 扫描逻辑的复用

w02 的 install-local.ts 已经有 `scanSkillDirectories`, BundleManager 的 `listLocalBatchSkills` 应该复用它, 不另写.

git 的 skills 列表现有 `githubService.listSkills(owner, repo, skillsPath)`, update.ts 里已经有"尝试几个常见路径"的逻辑 (update.ts:171-184), 把这段抽成共享函数 `listGitBundleSkills(bundle)`.

### D8. 失败策略: 单 skill 失败不影响整批

update bundle 时, 某个子 skill 下载失败 (网络抖动) 不应该中断整批.  BundleManager.sync 收集每个子操作的结果, 累计 failed 计数, 最后一起报告.  退出码: 有 failed → 非零.

### D9. 迁移旧的 batch-unsupported 错误消息

w01 里 update/uninstall 碰到 batch 路径时输出的引导消息:
```
Batch directory update not yet supported. Update individual skills: ...
```

w03 实现后这条消息永远不会触发 (因为 resolver 返回 bundle 而不是 batch-unsupported).  把 `batch-unsupported` kind 从 ResolvedTarget 里删掉, 代码里的对应分支也删.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| `sync --sync` 误删用户手动加的子目录 | 只删 `bundle.members` 里记录的 source key 对应的目录, 不扫整个 bundle 物理目录.  用户手动 `mkdir custom/spec-tdd/my-thing` 因为没进 members, 不会被 touch |
| git bundle sync 需要扫 remote, 慢 | 复用 updateSource 现有的路径探测逻辑, 不引入额外 API call |
| BundleManager 依赖 install 子流程, 代码耦合 | D6 把共享部分抽 helper; BundleManager 只调 helper 不直接调 install.ts |
| 并发 update 同一 bundle (两个终端同时跑) | sources.json 没有文件锁, 现有代码就有这个风险, 不在本 change 解决 |
| selectionMode=subset 的用户永远不知道有新 skill | `+ name: new in source (skipped, subset mode)` 提示可见; 文档说明可用 `skillsmgr install <url>` 重选 |
| `--sync` 误操作 | 文档说明语义; 命令帮助里标注"destructive"; 保留 `--force` 跳过确认但 `--sync` 本身的确认独立 (要不要 confirmation?) |
| 本地 batch 源目录移动或改名后, url 不再匹配 | bundle url 在 install 时固定, 移动后 sync 会报 "path not found"; 用户需要 uninstall + reinstall; 文档提醒 |
| w01 的 `batch-unsupported` 被移除是"隐式 BREAKING" | w01 和 w03 如果分两次发布, 中间期用户看到的仍然是 batch-unsupported; w01 → w03 间隔尽量短; 文档说明 |

## Migration Plan

1. **阶段 1: BundleManager 骨架 + 单元测试**
   - 新建 `src/services/bundle-manager.ts` 和 `.test.ts`
   - 实现 sync / remove 方法, mock sourcesService 和 fs
   - 覆盖 local-batch 和 git 两种 bundle type
   - 覆盖 all / subset selectionMode
   - 覆盖 warn-keep / sync-remove

2. **阶段 2: SourceResolver 扩展**
   - 修改 `src/services/source-resolver.ts`
   - ResolvedTarget 加 `'bundle'` kind
   - local-path / owner-repo / url 分支在返回前查 findBundleByUrl
   - 移除 `'batch-unsupported'` kind 和相关代码
   - 更新测试

3. **阶段 3: update 命令迁移**
   - `src/commands/update.ts` 处理 `kind: 'bundle'` → 调 BundleManager.sync
   - 添加 `-v/--verbose`, `--sync` flag
   - 默认输出折叠实现
   - 测试: local-batch bundle update, git bundle update, subset mode, removed skills

4. **阶段 4: uninstall 命令迁移**
   - `src/commands/uninstall.ts` 处理 `kind: 'bundle'` → 调 BundleManager.remove
   - 保留 confirmUninstall 流程
   - 测试: local-batch bundle uninstall, git bundle uninstall

5. **阶段 5: 回归和 e2e**
   - 全套单元测试通过
   - 手动 e2e: install ./spec-tdd → 在源目录加一个新 skill → update ./spec-tdd → 验证自动装; 删一个源 skill → update → 验证 warn-keep; `--sync` 验证硬删
   - git bundle 回归: `update anthropics/skills` 和 `uninstall anthropics/skills` 走 bundle 路径

**回退**: 每个阶段独立 commit, 有问题可单独回退.  最坏情况回退到 w02 状态, 用户还能继续用 w01 的单 skill 对称性 + w02 的 bundle 元数据 (但没 sync 语义).

## Open Questions

1. **`--sync` 要不要单独的交互确认?**
   `--sync` 意味着"从源里删了的 skill 一并删除本地", 这是破坏性的.  建议: 默认显示要删的 skill 列表 + 要用户输 y 确认; `--force` 跳过.  和现有 uninstall 的确认流程一致.

2. **git bundle sync 时的 "skills path" 探测**
   update.ts 现有代码探测 `skills`, `.`, `src/skills` 三个路径找 remote skill 根.  w03 是否把这个信息固化到 bundle 元数据里 (`bundle.skillsPath: 'skills'`)?
   - 好处: 避免每次 sync 都探测
   - 坏处: 源仓库改了目录结构要手动 reinstall
   - 决定: 本 change 不加这个字段, 继续探测; 留给未来优化

3. **zip bundle 的 sync 行为**
   zip 源"manual reinstall"已经是现状.  update zip bundle 还是报这个信息, 不做任何事.  但 uninstall zip bundle 应该能用 bundle 批量删.  本 change 明确这两种: update → no-op + 提示, uninstall → 批量删.

4. **bundle.members 在 update 中被 mutate, 线程安全?**
   Node 单线程, 同一进程内没并发问题.  跨进程 (用户同时跑两个 update) 会有写冲突.  不在本 change 解决, 和现有 sources.json 的并发问题一样.

5. **update 命令的退出码语义**
   - 全部成功: 0
   - 有 failed: 1
   - warn-keep 的 removed 算不算失败?  不算 (只是提示).
   - sync-remove 的 removed 算成功.

6. **subset → all 的漂移**
   用户 install 时选 subset, 用了一阵子后来源目录里又多了几个他本来也想要的 skill.  在本 change 中, 他只能看到 warn 提示, 然后手动 `install` 重选.  未来可考虑 `skillsmgr bundle set-mode <bundleId> all` 切换.
