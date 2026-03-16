## MODIFIED Requirements

### Requirement: GitHub API 下载流程 - installFromGitHubUrl()

通用 GitHub URL 处理, 返回 boolean 表示是否成功:

1. 调用 `githubService.parseGitHubUrl()` 解析 URL
2. 解析失败 → 返回 false (会回退到 git clone)

**特定 skill URL (有 path)**:
- 从 path 提取 skill 名称 (最后一段)
- 直接下载该 skill, 不提示选择
- 返回 true

**仓库 URL (无 path)**:
1. 依次在 `['skills', '.', 'src/skills']` 路径下搜索 skill 目录
2. 对每个路径调用 `listSkills()`, 有结果就停止搜索
3. 有 skill 时正常流程 (提示选择, 下载, 安装 commands)
4. **没有子目录 skill 时, 检查根目录 SKILL.md**:
   - 通过 `raw.githubusercontent.com/{owner}/{repo}/{branch}/SKILL.md` 获取根目录 SKILL.md
   - 如果存在 (HTTP 200): 解析 frontmatter 获取 name 和 description, name 为空时 fallback 为 repo 名
   - 将整个仓库根目录内容下载到 `{targetBase}/{skillName}/`
   - 直接安装, 不提示用户选择 (单 skill 仓库)
   - 同时检查并安装 commands
   - 保存 source 元数据
   - 返回 true
5. 根目录也没有 SKILL.md 时, 尝试 commands, 都没有 → 返回 false

#### Scenario: Root SKILL.md detected after subdirectory search fails
- **WHEN** 仓库 URL 安装时, `listSkills()` 对所有路径都未找到子目录 skill, 但根目录存在 SKILL.md
- **THEN** 系统获取根目录 SKILL.md, 解析 frontmatter, 将仓库内容下载到 `{targetBase}/{skillName}/`, 返回 true

#### Scenario: Root SKILL.md not found either
- **WHEN** 仓库既无子目录 skill, 根目录也无 SKILL.md
- **THEN** 行为不变: 尝试 commands, 都没有则返回 false

#### Scenario: Root SKILL.md with commands in same repo
- **WHEN** 仓库根目录有 SKILL.md, 同时有 commands/ 目录
- **THEN** 安装根目录 skill 后, 同时自动安装 commands

### Requirement: Git Clone 回退 - installViaGitClone()

当 GitHub API 不可用或返回 false 时使用 git clone:

1. 克隆仓库到目标目录
2. 扫描子目录查找包含 SKILL.md 的目录
3. **如果未找到子目录 skill, 检查克隆目录根的 SKILL.md**:
   - 使用 `fileExists(join(repoPath, 'SKILL.md'))` 检查
   - 如果存在: 解析 frontmatter 获取 name (fallback 为仓库名)
   - 创建 `{repoPath}/{skillName}/` 子目录
   - 将根目录下所有非 `.git` 文件和目录移入该子目录
   - 删除 `.git` 目录 (不再需要, 已安装完成)
   - 作为单 skill 安装, 不提示选择
4. 同时统计 commands 数量
5. 无 skill 且无 command → `process.exit(1)`

#### Scenario: Git clone detects root SKILL.md
- **WHEN** GitHub API 失败后 git clone 仓库, 克隆目录根有 SKILL.md 但无子目录 skill
- **THEN** 系统将文件重组到 `{repoPath}/{skillName}/` 子目录, 直接安装

#### Scenario: Git clone root skill with no frontmatter name
- **WHEN** 根目录 SKILL.md 无 frontmatter name 字段
- **THEN** 使用仓库名作为 skill name

### Requirement: 更新流程支持根目录 skill 仓库

`updateSource()` 中更新 skills 时:

1. 扫描本地已安装的 skill 目录
2. 检测远程 skill 目录位置 (现有逻辑: 尝试 `skills/`, `.`, `src/skills/`)
3. **如果远程无子目录 skill, 额外检查根目录 SKILL.md**:
   - 获取 `raw.githubusercontent.com/{owner}/{repo}/{branch}/SKILL.md`
   - 如果存在 (HTTP 200), 标记该仓库为根目录 skill 仓库
   - 对本地 skill 使用根路径 `SKILL.md` 进行内容对比 (而非 `{skillsBasePath}/{skillName}/SKILL.md`)
   - 内容不同时, 删除本地 skill 目录, 重新下载整个仓库根到该目录
4. 如果远程也没有根目录 SKILL.md, 对本地 skill 显示 "not found in remote"

#### Scenario: Update root-skill repo with changed content
- **WHEN** 更新已安装的根目录 skill 仓库, 远程 SKILL.md 内容已变更
- **THEN** 系统删除本地 skill 目录, 重新下载整个仓库根目录内容到该目录, 显示 "updated"

#### Scenario: Update root-skill repo with no changes
- **WHEN** 更新已安装的根目录 skill 仓库, 远程 SKILL.md 内容未变更
- **THEN** 显示 "up to date", 不做任何修改

#### Scenario: Update detects root-skill pattern
- **WHEN** 本地有 skill "deep-research" 安装于 `community/repo/deep-research/`, 远程仓库无 `skills/`, `.`, `src/skills/` 下的子目录, 但根目录有 SKILL.md
- **THEN** 系统使用根目录路径 `SKILL.md` (而非 `skills/deep-research/SKILL.md`) 进行远程比对

## ADDED Requirements

### Requirement: GitHubService 支持检查根目录文件

`GitHubService` SHALL 提供方法检查仓库根目录是否存在指定文件, 用于根目录 SKILL.md 检测.

#### Scenario: Check root file exists
- **WHEN** 调用检查方法且仓库根目录存在 SKILL.md
- **THEN** 返回文件内容

#### Scenario: Check root file not exists
- **WHEN** 调用检查方法且仓库根目录不存在 SKILL.md
- **THEN** 返回 null 或 undefined
