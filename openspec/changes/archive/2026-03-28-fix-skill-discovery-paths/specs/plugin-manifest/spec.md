## MODIFIED Requirements

### Requirement: 解析 plugin.json 单 plugin 目录

系统 SHALL 读取仓库根目录下 `.claude-plugin/plugin.json` 文件.  当 JSON 包含 `plugins` 数组字段时, SHALL 按 marketplace 格式解析 (与 `marketplace.json` 相同规则); 否则 SHALL 按简单格式解析顶层 `skills` 字段.  两种格式的结果 SHALL 合并去重.

#### Scenario: plugin.json 为 marketplace 格式

- **WHEN** 仓库根目录存在 `.claude-plugin/plugin.json`, 内容包含 `metadata.pluginRoot: "./.github/plugins"` 和 `plugins` 数组 (3 个 plugin, 每个 plugin 下有 `skills` 子目录)
- **THEN** 系统 SHALL 返回 3 个 skill 搜索路径, 每个对应一个 plugin 的 skills 目录, 加上各 plugin 目录下的 conventional `skills/` 路径 (去重后)

#### Scenario: plugin.json 为简单格式

- **WHEN** 仓库根目录存在 `.claude-plugin/plugin.json`, 内容包含 `skills: "./skills/"`, 不包含 `plugins` 字段
- **THEN** 系统 SHALL 返回包含 `basePath/skills/` 的搜索路径数组 (行为不变)

#### Scenario: plugin.json 同时有 plugins 数组和顶层 skills

- **WHEN** 仓库根目录存在 `.claude-plugin/plugin.json`, 内容同时包含顶层 `skills: "./skills/"` 和 `plugins` 数组
- **THEN** 系统 SHALL 返回两种格式解析结果的合并去重集合

#### Scenario: plugin.json 不存在

- **WHEN** 仓库根目录不存在 `.claude-plugin/plugin.json`
- **THEN** 系统 SHALL 返回空数组, 不抛出错误

### Requirement: 集成到 Git clone 安装流程

系统 SHALL 在 Git clone 安装流程的 skill 发现阶段, 扫描以下标准目录 (除了 plugin manifest 发现和根目录 SKILL.md 检查):

- `skills/`
- `.agents/skills/`
- `.claude/skills/`
- `.github/skills/`

所有来源的结果 SHALL 按 name 合并去重.

#### Scenario: 仓库有 .agents/skills 目录

- **WHEN** 仓库包含 `.agents/skills/my-skill/SKILL.md`
- **THEN** 系统 SHALL 发现并返回 `my-skill`

#### Scenario: 仓库同时有 manifest 和多个标准目录

- **WHEN** 仓库包含 `.claude-plugin/plugin.json` 声明了 plugin skills, 同时 `.agents/skills/` 和 `skills/` 下也有独立 skills
- **THEN** 系统 SHALL 返回所有来源的 skills, 按 name 去重

#### Scenario: 仓库无 manifest 且标准目录为空

- **WHEN** 仓库不包含任何 plugin manifest 文件, 标准目录均不存在或为空
- **THEN** 系统 SHALL 检查根目录 SKILL.md 作为最终 fallback

## ADDED Requirements

### Requirement: GitHub API 路径标准目录对齐

系统 SHALL 在 GitHub API 发现路径 (`listGitHubRepoSkills`) 中扫描与 git clone 路径相同的标准目录列表: `skills/`, `.agents/skills/`, `.claude/skills/`, `.github/skills/`.

#### Scenario: GitHub API 路径发现 .claude/skills 下的 skill

- **WHEN** 通过 GitHub API 安装仓库, 仓库的 `.claude/skills/` 目录下有 skill 子目录
- **THEN** 系统 SHALL 发现并列出这些 skills
