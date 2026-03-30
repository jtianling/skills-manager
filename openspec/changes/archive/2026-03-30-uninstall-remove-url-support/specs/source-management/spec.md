## ADDED Requirements

### Requirement: remove 命令支持 URL 格式
`remove` 命令 SHALL 支持通过 Git URL 格式(HTTPS/SSH)移除已部署的 skills.  系统 SHALL 从 URL 中提取 owner/repo, 然后按已有的 owner/repo 移除流程执行.

#### Scenario: 通过 HTTPS URL 移除
- **WHEN** 用户执行 `skillsmgr remove https://github.com/openai/skills`
- **THEN** 系统提取 `openai/skills` 作为 owner/repo
- **THEN** 行为与 `skillsmgr remove openai/skills` 一致

#### Scenario: 通过 GitLab URL 移除
- **WHEN** 用户执行 `skillsmgr remove https://gitlab.com/foo/bar`
- **THEN** 系统提取 `foo/bar` 作为 owner/repo
- **THEN** 行为与 `skillsmgr remove foo/bar` 一致

#### Scenario: 通过 SSH URL 移除
- **WHEN** 用户执行 `skillsmgr remove git@github.com:openai/skills.git`
- **THEN** 系统提取 `openai/skills` 作为 owner/repo
- **THEN** 行为与 `skillsmgr remove openai/skills` 一致

### Requirement: detectArgFormat 识别 URL 中的 owner/repo
`detectArgFormat()` SHALL 对包含可提取 owner/repo 的 URL 输入返回 `'owner-repo'`, 而非 `'install-source'`.

#### Scenario: HTTPS URL 返回 owner-repo
- **WHEN** `detectArgFormat("https://github.com/openai/skills")` 被调用
- **THEN** 返回 `'owner-repo'`

#### Scenario: 无法提取的 URL 仍返回 install-source
- **WHEN** `detectArgFormat("https://example.com/")` 被调用
- **THEN** 返回 `'install-source'`
