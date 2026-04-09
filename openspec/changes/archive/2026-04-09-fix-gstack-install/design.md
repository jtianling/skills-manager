## Context

`copyDir` 遍历目录时只区分 directory 和 "其他", 对 symlink/socket/FIFO 等一律调用 `copyFileSync`, macOS 的 `copyfile(3)` 对 symlink-to-directory 返回 ENOTSUP.

`collectGitCloneSkills` 的发现优先级为: manifest → standard paths → root SKILL.md → scanForSkills(depth 1). 根 SKILL.md 存在时短路返回, 不继续扫描子目录. gstack 等 "flat multi-skill repo" 模式(根目录有 SKILL.md + 子目录各有独立 SKILL.md)无法正确发现.

## Goals / Non-Goals

**Goals:**
- `copyDir` 正确保留 symlink, 安全跳过非常规文件
- flat multi-skill repo(根 SKILL.md + 子目录 skill)正确发现所有 skill
- 嵌套结构(如 `openclaw/skills/*/SKILL.md`)可被发现

**Non-Goals:**
- 不改变 manifest/standard-paths 优先级逻辑
- 不处理跨 repo 的 symlink(保留相对路径 symlink 即可)
- 不改变 `installRepoWithSelection` 的选择/复制流程

## Decisions

### D1: symlink 复制策略 — 保留原始 symlink

用 `symlinkSync(readlinkSync(src), dest)` 保留 symlink 的相对路径指向. 替代方案: 解析 symlink 后复制目标内容 — 会导致重复数据且丢失 symlink 语义.

对 `isFile()` 和 `isDirectory()` 和 `isSymbolicLink()` 都为 false 的条目(socket, FIFO, device 等)静默跳过.

### D2: flat multi-skill repo 发现策略 — 根 SKILL.md 存在时仍扫描子目录

修改 `collectGitCloneSkills` 中 `skills.length === 0` 分支:
- 先扫描子目录 (`scanForSkills(repoPath, 3)`)
- 若子目录发现了 skill → 返回子目录 skill 列表, 不包含根
- 若子目录无 skill → 退回当前行为, 根作为单个 skill

不将根 SKILL.md 作为独立 skill 加入列表, 因为其 path 是 repoPath 整个目录, 复制时会包含非 skill 文件(.git, bin, lib 等). 根 SKILL.md 在这种 pattern 下视为 repo 描述/元数据.

### D3: 扫描深度 1 → 3

`scanForSkills` 深度从 1 提升到 3, 覆盖 `openclaw/skills/gstack-openclaw-*/SKILL.md` 这类嵌套结构. 深度 3 足够且不会过度递归(超过 3 层的 skill 组织方式在实际 repo 中极少见).

## Risks / Trade-offs

- [深度提升导致误识别] → `scanForSkills` 只对有 SKILL.md 的目录标记为 skill, 无 SKILL.md 的目录不会被误识别
- [根 SKILL.md 被忽略] → 仅在子目录有 skill 时忽略根. 单 skill repo(只有根 SKILL.md, 无子目录 skill)行为不变
- [symlink 目标不存在] → 保留 broken symlink, 与 git clone 行为一致, 不额外处理
