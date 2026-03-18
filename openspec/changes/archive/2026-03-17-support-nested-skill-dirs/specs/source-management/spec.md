## MODIFIED Requirements

### Requirement: GitHub API 下载流程 (优先路径)

#### installFromGitHubUrl()

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
6. 有 skill 时 (子目录形式):
   - 逐个获取 SKILL.md 描述, **没有 SKILL.md 的目录 SHALL 作为分组目录处理**: 再调用一次 `listSkills()` 获取其子目录, 对每个子目录检查 SKILL.md. 发现的 skill 使用其完整路径 (如 `skills/research-en/research`) 作为 path, 但 name 仅为最后一段目录名.
   - 分组目录探测限制为一层 — 不做无限递归
   - 过滤后无 skill → 再次尝试 commands, 没有 → 返回 false
   - 提示选择 (除非 `--all`), 单个 skill 时直接安装不提示
   - 用户不选择任何 skill 时输出 "No skills selected" 并返回 true (视为成功, 不回退到 git clone)
   - 下载选中的 skill + 自动安装 commands
7. 确定 source key:
   - anthropics/skills → `"official/anthropic"`
   - `--custom` → `"custom/{repo}"`
   - 默认 → `"community/{repo}"`
8. 返回 true

#### Scenario: 扁平仓库结构正常识别
- **WHEN** 仓库 `skills/` 下的子目录都直接包含 SKILL.md (如 `skills/code-review/SKILL.md`)
- **THEN** 行为不变, 每个子目录被识别为 skill

#### Scenario: 分组嵌套结构识别
- **WHEN** 仓库 `skills/` 下的子目录不包含 SKILL.md, 但其子目录包含 SKILL.md (如 `skills/research-en/research/SKILL.md`)
- **THEN** 系统 SHALL 将分组目录展开, 识别嵌套的 skill, skill name 为最内层目录名 (如 `research`)

#### Scenario: 混合结构 — 扁平和嵌套共存
- **WHEN** 仓库 `skills/` 下部分子目录直接有 SKILL.md, 部分子目录为分组目录
- **THEN** 系统 SHALL 同时识别两种结构中的 skill

#### Scenario: 分组目录无 skill
- **WHEN** 仓库 `skills/` 下的子目录无 SKILL.md, 且其子目录也无 SKILL.md
- **THEN** 该子目录被忽略, 不作为 skill 或分组处理

#### Scenario: Root SKILL.md detected after subdirectory search fails
- **WHEN** 仓库 URL 安装时, `listSkills()` 对所有路径都未找到子目录 skill, 但根目录存在 SKILL.md
- **THEN** 系统获取根目录 SKILL.md, 解析 frontmatter, 将仓库内容下载到 `{targetBase}/{skillName}/`, 返回 true

#### Scenario: Root SKILL.md not found either
- **WHEN** 仓库既无子目录 skill, 根目录也无 SKILL.md
- **THEN** 行为不变: 尝试 commands, 都没有则返回 false

#### Scenario: Root SKILL.md with commands in same repo
- **WHEN** 仓库根目录有 SKILL.md, 同时有 commands/ 目录
- **THEN** 安装根目录 skill 后, 同时自动安装 commands

### Requirement: Git Clone 回退

#### installViaGitClone() - 仓库 URL

当 GitHub API 不可用或返回 false 时使用 git clone:

1. 克隆仓库到目标目录
2. **检查 `skills/` 子目录**: 对所有仓库 (不限于 anthropic), 如果 `{repoPath}/skills/` 存在, 则将 skillsRoot 设为该目录
3. 递归扫描子目录查找包含 SKILL.md 的目录, 最大深度为 2 层:
   - 如果子目录包含 SKILL.md → 识别为 skill
   - 如果子目录不包含 SKILL.md 且深度未超限 → 继续扫描其子目录
4. **发现嵌套 skill 后, 将其移动到 `{repoPath}/{skill-name}/` 扁平路径** (如果 skill 不在 repoPath 直接子目录下). 移动完成后清理空的分组目录.
5. **如果未找到子目录 skill, 检查克隆目录根的 SKILL.md**:
   - 使用 `fileExists(join(repoPath, 'SKILL.md'))` 检查
   - 如果存在: 解析 frontmatter 获取 name (fallback 为仓库名)
   - 创建 `{repoPath}/{skillName}/` 子目录
   - 将根目录下所有非 `.git` 文件和目录移入该子目录
   - 删除 `.git` 目录 (不再需要, 已安装完成)
   - 作为单 skill 安装, 不提示选择
6. 同时统计 commands 数量
7. 无 skill 且无 command → `process.exit(1)`
8. 有 skill 且非 `--all` → 提示选择 (单个 skill 时直接安装不提示)
9. **未选中的 skill 被物理删除** (`removeDir(skill.path)`)
10. 用户不选择任何 skill 时, **整个仓库目录被删除** (`removeDir(repoPath)`)
11. 保存 source 元数据

#### Scenario: Git clone 扁平仓库不受影响
- **WHEN** git clone 仓库, 根目录或 skills/ 下的子目录直接包含 SKILL.md
- **THEN** 行为不变, 正常识别和安装

#### Scenario: Git clone 识别 skills/ 子目录
- **WHEN** git clone 非 anthropic 仓库, 仓库根目录有 `skills/` 子目录
- **THEN** 系统 SHALL 在 `skills/` 下搜索 skill, 而非仅在仓库根目录

#### Scenario: Git clone 识别嵌套 skill 并扁平化
- **WHEN** git clone 仓库, `skills/research-en/research/SKILL.md` 存在
- **THEN** 系统 SHALL 识别 `research` 为 skill, 安装后存储为 `{repoPath}/research/` (扁平化)

#### Scenario: Git clone detects root SKILL.md
- **WHEN** GitHub API 失败后 git clone 仓库, 克隆目录根有 SKILL.md 但无子目录 skill
- **THEN** 系统将文件重组到 `{repoPath}/{skillName}/` 子目录, 直接安装

#### Scenario: Git clone root skill with no frontmatter name
- **WHEN** 根目录 SKILL.md 无 frontmatter name 字段
- **THEN** 使用仓库名作为 skill name
