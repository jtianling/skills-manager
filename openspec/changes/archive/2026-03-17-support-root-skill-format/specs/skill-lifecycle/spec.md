## ADDED Requirements

### Requirement: Root-level SKILL.md recognition

当仓库根目录存在 SKILL.md 且仓库内不存在子目录形式的 skill 时, 系统 SHALL 将整个仓库视为单个 skill.  安装后的存储结构 SHALL 为 `~/.skills-manager/{source}/{repo}/{skill-name}/SKILL.md`, 其中 `skill-name` 优先取 SKILL.md frontmatter 中的 `name` 字段, 无 name 时 fallback 为仓库名.

#### Scenario: Root SKILL.md repo installed via GitHub API
- **WHEN** 用户执行 `install https://github.com/owner/repo` 且仓库内无子目录 skill, 但根目录存在 SKILL.md (frontmatter name 为 "deep-research")
- **THEN** 系统将整个仓库内容下载到 `~/.skills-manager/community/repo/deep-research/`, 该目录包含 SKILL.md 及仓库中所有其他文件和目录

#### Scenario: Root SKILL.md repo installed via git clone
- **WHEN** GitHub API 不可用, 回退到 git clone 安装, 仓库根目录存在 SKILL.md (frontmatter name 为 "deep-research")
- **THEN** 克隆完成后, 系统将非 `.git` 文件移入 `{repoPath}/deep-research/` 子目录, 最终结构与 GitHub API 安装一致

#### Scenario: Root SKILL.md without name in frontmatter
- **WHEN** 根目录 SKILL.md 的 frontmatter 中没有 name 字段
- **THEN** skill name 使用仓库名作为 fallback

#### Scenario: Root SKILL.md with --custom option
- **WHEN** 用户使用 `--custom` 选项安装根目录 skill 仓库
- **THEN** 系统将 skill 存储到 `~/.skills-manager/custom/repo/{skill-name}/`

#### Scenario: Repo has both subdirectory skills and root SKILL.md
- **WHEN** 仓库同时包含子目录形式的 skill (如 `skills/code-review/SKILL.md`) 和根目录 SKILL.md
- **THEN** 系统 SHALL 优先识别子目录 skill, 忽略根目录 SKILL.md (现有行为不变)

### Requirement: Single-skill repo skips selection prompt

根目录 skill 仓库只有一个 skill, 系统 SHALL 直接安装, 不提示用户选择.

#### Scenario: Root skill repo does not prompt selection
- **WHEN** 用户安装根目录 skill 仓库且未使用 `--all` 选项
- **THEN** 系统直接安装该 skill, 不显示选择提示 (因为只有一个 skill)
