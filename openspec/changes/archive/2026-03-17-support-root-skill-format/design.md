## Context

当前 install 命令通过两种方式安装 skill:
1. **GitHub API 路径**: `listSkills()` 枚举仓库中的子目录, 然后逐个检查是否包含 SKILL.md
2. **Git clone 路径**: 克隆仓库后用 `getDirectoriesInDir()` 扫描子目录, 检查每个目录是否有 SKILL.md

两种路径都假设 skill 以子目录形式存在于仓库中.  对于 "根目录 skill" 仓库 (如 `199-biotechnologies/claude-deep-research-skill`), SKILL.md 位于仓库根目录, 没有 skill 子目录, 导致两条路径都无法识别.

存储格式: `~/.skills-manager/{source}/{repo}/{skill-name}/SKILL.md`.  已安装的 skill 通过子目录结构被 `SkillsService` 发现.

## Goals / Non-Goals

**Goals:**
- 安装根目录 SKILL.md 的仓库时, 将整个仓库内容作为单个 skill 下载到正确的存储路径
- 安装后的目录结构与现有格式一致, 无需修改下游的 discovery/deploy/sync/remove 逻辑
- update 命令能够正确检测和更新根目录 skill 仓库

**Non-Goals:**
- 不修改 skill 发现逻辑 (`SkillsService`)
- 不修改部署/同步/移除逻辑
- 不支持一个仓库中同时存在根目录 skill 和子目录 skill 的混合模式
- 不支持根目录同时存在 SKILL.md 和 commands/ 的情况 (此类仓库应按标准格式组织)

## Decisions

### 1. 根目录 SKILL.md 检测时机: 在现有子目录搜索失败后

在现有搜索流程的最后, 当未找到子目录形式的 skill 且未找到 commands 时, 新增根目录 SKILL.md 检测.  这样不影响已有仓库的安装行为, 仅作为新的兜底逻辑.

**检测方式**: 通过 `raw.githubusercontent.com` 获取根目录 SKILL.md (GitHub API 路径); 通过 `fileExists()` 检查克隆目录根的 SKILL.md (git clone 路径).

**替代方案**: 在搜索流程最开始就检测根目录 SKILL.md, 优先于子目录搜索.  放弃原因: 某些仓库根目录可能同时有 SKILL.md 和 skills/ 子目录, 提前检测会导致行为变化.

### 2. 存储路径: 下载到 `{targetBase}/{skillName}/`

将根目录 skill 仓库的全部内容下载到 `{targetBase}/{skillName}/` 子目录中, 其中 `skillName` 优先取 SKILL.md frontmatter 中的 `name` 字段, fallback 为仓库名.  这样下游发现逻辑 (`SkillsService`) 无需修改.

**GitHub API 路径**: 使用 `downloadSkill(owner, repo, '', targetDir)` 下载根目录内容.  GitHub API 的 `/repos/{owner}/{repo}/contents/` (空路径) 会返回根目录列表.

**Git clone 路径**: 克隆后将非 `.git` 文件移动到 `{skillName}/` 子目录.

**替代方案**: 修改 `SkillsService` 发现逻辑以支持仓库根目录 SKILL.md.  放弃原因: 影响面大, 需要修改多处代码且可能引入边界问题.

### 3. 单 skill 仓库不需要用户选择提示

根目录 skill 仓库只有一个 skill, 无需像多 skill 仓库那样提示用户选择.  直接安装, 与安装特定 skill URL 的行为一致.

### 4. Update 通过远程检测确定 SKILL.md 位置

update 时, 如果现有的远程路径检测 (`listSkills` 搜索 `skills/`, `.`, `src/skills/`) 未找到匹配, 额外检查根目录 SKILL.md 是否存在.  若存在, 使用根路径构建远程 URL.  不需要在 sources.json 中存储额外元数据.

### 5. GitHub API 下载根目录内容时使用空字符串路径

`GitHubService.downloadSkill()` 传入空字符串 `''` 作为 `skillPath`.  `downloadDirectory()` 构建的 URL `...contents/` 会正确返回仓库根目录列表.  GitHub API 自动排除 `.git` 目录, 不需要额外过滤.

## Risks / Trade-offs

- [大型仓库下载]: 根目录 skill 仓库可能包含大量非必要文件 (README, CI 配置等), 都会被下载.  → 可接受, 这些文件体积小, 且部分可能被 SKILL.md 引用.
- [GitHub API 限额]: 额外的根目录 SKILL.md 检测请求.  → 影响极小, 仅在无子目录 skill 时触发一次额外请求.
- [Git clone 路径的文件移动]: 需要将克隆的文件移动到子目录中.  → 需要处理好文件系统操作的错误情况, 避免部分移动导致的不一致状态.
