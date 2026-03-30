# URL to Owner/Repo

从 Git URL 中提取 owner/repo 标识符的工具函数.

## Requirements

### Requirement: 从 Git URL 提取 owner/repo
系统 SHALL 提供 `extractOwnerRepo(input)` 函数, 从各种 Git URL 格式中提取 `owner/repo` 标识符.  如果输入已是 `owner/repo` 格式则直接返回.  无法提取时返回 null.

#### Scenario: HTTPS URL (GitHub)
- **WHEN** 输入为 `https://github.com/openai/skills`
- **THEN** 返回 `openai/skills`

#### Scenario: HTTPS URL (GitLab)
- **WHEN** 输入为 `https://gitlab.com/foo/bar`
- **THEN** 返回 `foo/bar`

#### Scenario: HTTPS URL 末尾斜杠
- **WHEN** 输入为 `https://github.com/openai/skills/`
- **THEN** 返回 `openai/skills`

#### Scenario: HTTPS URL 带 .git 后缀
- **WHEN** 输入为 `https://github.com/openai/skills.git`
- **THEN** 返回 `openai/skills`

#### Scenario: SSH URL
- **WHEN** 输入为 `git@github.com:openai/skills.git`
- **THEN** 返回 `openai/skills`

#### Scenario: SSH URL 无 .git 后缀
- **WHEN** 输入为 `git@gitlab.com:foo/bar`
- **THEN** 返回 `foo/bar`

#### Scenario: 已是 owner/repo 格式
- **WHEN** 输入为 `openai/skills`
- **THEN** 返回 `openai/skills`

#### Scenario: owner/repo 末尾斜杠
- **WHEN** 输入为 `openai/skills/`
- **THEN** 返回 `openai/skills`

#### Scenario: 普通 skill 名称
- **WHEN** 输入为 `commit`
- **THEN** 返回 null

#### Scenario: 无法提取的 URL
- **WHEN** 输入为 `https://example.com/`(路径不足两段)
- **THEN** 返回 null
