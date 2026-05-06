## ADDED Requirements

### Requirement: Git 来源 update 走 git clone, 不使用 GitHub HTTP API

`SourceUpdater.updateSource` 对 `installMethod === 'git'` 的 source SHALL 通过 `git clone --depth 1` 拉取整个仓库到临时目录, 然后基于本地文件系统扫描和文件对比完成更新.  系统 SHALL NOT 调用任何 GitHub HTTP API (`api.github.com/...`) 或 raw.githubusercontent.com 来探测分支、列举 skill、对比 SKILL.md 或下载文件.

clone+scan 过程 SHALL 复用 `services/repo-clone.ts` 提供的 `cloneRepoToTemp` 和 `collectSkillsFromClone`, 与 install 流程和 `BundleManager.sync` 共享同一份发现规则 — 三条路径下"什么算 skill"的判定结果 SHALL 一致.

每次 update 调用 SHALL 在 try/finally 中清理临时目录, 无论成功还是抛错.

#### Scenario: Git source update 不发起任何 GitHub API 请求
- **GIVEN** 已安装 community/obra/superpowers (`installMethod: 'git'`), 本地有若干 skill
- **WHEN** 用户执行 `skillsmgr update superpowers`
- **THEN** 系统 SHALL 通过 `git clone --depth 1 https://github.com/obra/superpowers <tempDir>` 拉取仓库
- **THEN** 系统 SHALL NOT 发起对 `api.github.com` 或 `raw.githubusercontent.com` 的 HTTP 请求
- **THEN** SKILL.md 内容比对 SHALL 通过读 `<tempDir>/<skillPath>/SKILL.md` 完成

#### Scenario: 已安装 skill 内容未变更
- **WHEN** 已安装 skill `<localTarget>/<skillName>/SKILL.md` 与 clone 中对应位置 SKILL.md 字节相同
- **THEN** 系统 SHALL 输出 "✓ <skillName>: up to date"
- **THEN** 该 skill 目录 SHALL NOT 被删除或重新拷贝

#### Scenario: 已安装 skill 内容有变化
- **WHEN** 已安装 skill `<localTarget>/<skillName>/SKILL.md` 与 clone 中对应位置 SKILL.md 字节不同
- **THEN** 系统 SHALL 删除 `<localTarget>/<skillName>/`
- **THEN** 系统 SHALL 从 clone 中 `copyDir(<clonedSkillPath>, <localTarget>/<skillName>)` 重新拷贝整个 skill 目录
- **THEN** 系统 SHALL 输出 "↑ <skillName>: updated"

#### Scenario: 远端已删除已安装 skill
- **WHEN** 已安装 skill 名 `<skillName>` 不在 clone 扫描结果中 (远端已删除)
- **THEN** 系统 SHALL 输出 "⚠ <skillName>: not found in remote"
- **THEN** 该 skill 目录 SHALL NOT 被删除 (与 BundleManager 默认 keep 行为一致)

#### Scenario: clone 失败时清理临时目录并报错
- **WHEN** `git clone` 命令失败 (网络异常、仓库不存在等)
- **THEN** 系统 SHALL 清理任何已创建的临时目录
- **THEN** 系统 SHALL 把错误向上抛出, update 命令以非 0 退出
- **THEN** 已安装的本地 skill 目录 SHALL 保持不变 (无任何删除/拷贝)

#### Scenario: scan 异常时仍清理临时目录
- **WHEN** clone 成功但 `collectSkillsFromClone` 抛出异常
- **THEN** 系统 SHALL 在 finally 块中调用 cleanup 删除临时目录, `$TMPDIR` 不留垃圾

#### Scenario: SourceUpdater 与 BundleManager / install 共享 skill 发现规则
- **GIVEN** 同一个仓库 (例如 garrytan/gstack)
- **WHEN** 通过 `install`、`update <skill>` 和 `update <bundle>` 三条路径分别处理该仓库
- **THEN** 三条路径扫描出的 skill 名集合 SHALL 完全一致 (差异仅来自 `selectedSkillNames` 等过滤参数, 不来自发现规则本身)

### Requirement: GitHubService 退化为 URL 解析工具

`GitHubService` SHALL 不再提供任何会发起 HTTP 请求的方法.  在该 capability 范围内 (即整个项目代码), `GitHubService` SHALL 只暴露纯字符串/路径工具:

- `parseGitHubUrl(url)`: URL 解析, 返回 `{ owner, repo, branch?, path? }` 或 null
- `getTargetDir(owner, repo, skillName, isCustom?)`: 计算目标安装目录

下列方法 SHALL 被移除, 不再存在于代码中:

- `getDefaultBranch`, `listSkills`, `listSkillsWithFallbackPaths`, `findRootSkillsByTree`
- `fetchRootFile`, `downloadSkill`, `downloadRepoRoot`
- 内部辅助 `downloadDirectory`, `downloadFile`, `getHeaders`, default-branch 缓存 Map

#### Scenario: GitHubService 不含 HTTP 调用
- **WHEN** 检视 `src/services/github.ts`
- **THEN** 文件中 SHALL NOT 出现 `fetch(`, `api.github.com`, `raw.githubusercontent.com`, `process.env.GITHUB_TOKEN` 等字面量
- **THEN** 类只包含 `parseGitHubUrl`, `getTargetDir` 这两个公开方法 (`isSpecificSkillUrl` 在 `GitService` 中, 不在 `GitHubService`)

#### Scenario: 已删除方法不再被任何代码引用
- **WHEN** 在 `src/` 下 grep `getDefaultBranch|listSkillsWithFallbackPaths|findRootSkillsByTree|fetchRootFile|downloadSkill|downloadRepoRoot`
- **THEN** 除测试文件中清理痕迹外, src 代码 SHALL 没有任何匹配

## REMOVED Requirements

### Requirement: GitHubService 支持检查根目录文件

**Reason**: 该方法 (`fetchRootFile`) 是为旧 update 流程"远程无子目录 skill 时检查根 SKILL.md"设计的.  迁移到 git clone 后, clone 已经把根 SKILL.md 拉到本地, 直接走文件系统扫描即可, 不再需要 HTTP 检查接口.

**Migration**: 不需要外部迁移.  内部代码删掉对 `fetchRootFile` 的调用即可.  `collectSkillsFromClone` 已经覆盖"根目录 SKILL.md = 单 skill 仓库"和"根目录 SKILL.md + 子目录多 skill"两种形态.
