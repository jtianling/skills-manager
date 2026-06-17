## Context

skillsmgr 所有远程 GitHub 仓库安装统一走 `git clone --depth 1` 到临时目录, 再扫描 SKILL.md 并复制选中的 skill (见 `source-management` spec). 下载逻辑集中在 `src/services/repo-clone.ts` 的 `cloneRepoToTemp(source) -> ClonedRepo { repoPath, cleanup }`, 经 `CloneFetcher` 抽象被 `source-updater.ts` (update) 与 `bundle-manager.ts` (bundle) 注入复用; `install-git.ts` 另有一份重复的 `cloneToTemp` 未走该抽象.

现状的三个痛点: (1) `git` 是隐式系统依赖, 缺失时裸崩 ENOENT; (2) git 来源不记 commit sha, `SourceInfo.version` 字段空置; (3) 强耦合 git 子进程.

GitHub codeload archive 端点不计入 REST API 60/小时限额, 且 302 重定向 URL 带回不可变 commit sha.

## Goals / Non-Goals

**Goals:**
- 公开 GitHub repo 安装不再依赖系统 git
- 安装/更新时捕获 commit sha 并写入 `SourceInfo.version`
- 下载链路具备生产级网络与解包安全防护
- 收敛重复的下载入口到单一 `CloneFetcher` 实现, install/update/bundle 三路一致

**Non-Goals:**
- 不支持 zip 归档 (GitHub archive 默认 tar.gz)
- 不清理 `git.ts` 的死代码 `GitService`
- 不引入"只下载子目录省流量"的服务端裁剪 (codeload 仍下整包)
- 私有 repo 不强制改造 (维持 git clone)

## Decisions

### D1: 混合方案 — 公开 codeload, 私有 fallback git clone
公开 repo 走 codeload (拿到自包含 + sha); 检测到私有 repo (codeload 返回 401/403/404) 时 fallback 回 `git clone`, 保住现有"靠本机 git 凭证零配置装私有 repo"的能力.

**备选**: (a) 全切 codeload + 引入 `GITHUB_TOKEN` — 砍掉私有 repo 零配置体验, 改造面更大; (b) 只改公开 repo, 私有维持现状两套并存. 选混合是因为它零能力丢失, 且 fallback 复用现有 git clone 实现.

**代价**: `git` 仍是私有 repo 的软依赖. fallback 前必须先探测 git 可用性 (如 `git --version`), 不可用时报友好错误而非 ENOENT.

### D2: node-tar 解包, 不手写
用 `node-tar` (纯 JS, 无原生编译) 解 tar, `gunzip` 用内置 `node:zlib`.

**备选**: 手写零依赖 tar 解析 (字节偏移). 拒绝原因: tar 有 v7/ustar/PAX/GNU longname 等变体, GitHub codeload 对长文件名用 PAX 扩展头, 手写解析器若只读 ustar 字段会在长路径上**静默丢文件或截断路径** — 对 skill 安装器是数据损坏. node-tar 久经考验且处理全部变体, 代价仅 +1 个成熟纯 JS 依赖.

### D3: 保持 ClonedRepo 接口 — 解包落临时目录
codeload 解包后**写入临时目录**, 维持 `cloneRepoToTemp` 返回 `ClonedRepo { repoPath, cleanup }` 不变, 下游 `collectSkillsFromClone` / `copyDir` 零改动.

**备选**: 全程内存 `Map<path, bytes>` 不落盘. 拒绝原因: 下游全部基于文件系统路径操作, 改成吃 Map 需重写扫描与复制, 违反最小变更; 且现状 git clone 本就落临时目录, 磁盘行为一致.

### D4: commit sha 从重定向 URL 抽取, fail-closed
跟随 302 后从 `response.url` 用正则 `codeload\.github\.com/.+/tar\.gz/([0-9a-f]{40})` 抠 sha, 经 `ClonedRepo.commitSha` 传到 `saveGitCloneSource` 写入 `SourceInfo.version`. 抠不到 sha 视为异常直接报错 (不接受无版本 pin 的归档). git clone fallback 路径的 sha 经 `git rev-parse HEAD` 获取 (best-effort).

### D5: 网络与解包安全防护
- **SSRF**: 跟随重定向后校验 `finalUrl` 落在 `https://codeload.github.com/`
- **https-only**: 拒绝非 https URL
- **超时**: connect 超时 + 每 chunk body idle 超时 (防 slowloris)
- **大小上限**: 边下边累计压缩字节, 超压缩态上限即中止 (不信 Content-Length); 解包侧另设解压态上限 (解压炸弹防护, 压缩比可达数十倍)
- **path traversal**: node-tar 默认拒绝逃逸路径, 解包目标限定在临时目录内

### D6: /tree/ 特定 skill URL 经 codeload 处理
`/tree/<branch>/<skillPath>` 形式的 URL: 解析出 owner/repo/branch/skillPath, 对 branch 取 archive, 解包后按 skillPath 前缀过滤. 这取代现状 spec 描述的 sparse-checkout 路径 (其实现 `GitService` 已是死代码, 现状可能已失效).

## Risks / Trade-offs

- **tar 格式兼容性** → 用 node-tar 兜底所有变体; 仍以"真实 codeload tarball 解包结果对拍 git clone 文件树"作为验证项
- **私有 repo 在无 git 环境装不了** → fallback 前探测 git, 给出明确的"私有 repo 需要 git 或配置凭证"提示, 不裸崩
- **codeload 二级限流** → 装 skill 属中低频, 实践无感; 非本次目标的高吞吐场景才需 token
- **解压炸弹** → 压缩态 + 解压态双侧大小上限
- **node-tar 供应链面 +1** → 选纯 JS、广泛使用的成熟库, 锁定版本

## Migration Plan

- 改动集中在下载层 (`cloneRepoToTemp`), 接口不变, 对调用方透明
- 公开 repo 走新路径, 私有 repo 自动 fallback 旧路径, 无破坏性变更
- 回滚: 还原 `cloneRepoToTemp` 实现即可, source 元数据的 `version` 字段为新增可空字段, 向后兼容

## Open Questions

- codeload 私有 repo 的精确状态码 (401 vs 404) 用于触发 fallback — 实现时以实测为准
- `git rev-parse` 在 `--depth 1` clone 上取 sha 的可靠性 (fallback 路径的 sha 为 best-effort, 取不到则 `version` 留空)
