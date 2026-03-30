## ADDED Requirements

### Requirement: 通过 URL 卸载
系统 SHALL 支持通过 Git URL 格式(HTTPS/SSH)执行卸载.  系统 SHALL 从 URL 中提取 owner/repo, 然后按已有的 owner/repo 卸载流程执行.

#### Scenario: 通过 HTTPS URL 卸载
- **WHEN** 用户执行 `skillsmgr uninstall https://github.com/openai/skills`
- **THEN** 系统提取 `openai/skills` 作为 owner/repo
- **THEN** 行为与 `skillsmgr uninstall openai/skills` 一致

#### Scenario: 通过 GitLab HTTPS URL 卸载
- **WHEN** 用户执行 `skillsmgr uninstall https://gitlab.com/foo/bar`
- **THEN** 系统提取 `foo/bar` 作为 owner/repo
- **THEN** 行为与 `skillsmgr uninstall foo/bar` 一致

#### Scenario: 通过 SSH URL 卸载
- **WHEN** 用户执行 `skillsmgr uninstall git@github.com:openai/skills.git`
- **THEN** 系统提取 `openai/skills` 作为 owner/repo
- **THEN** 行为与 `skillsmgr uninstall openai/skills` 一致

#### Scenario: 无法解析的 URL
- **WHEN** 用户执行 `skillsmgr uninstall https://example.com/`
- **THEN** 系统报错 skill not found(降级为按 skill name 查找, 自然失败)
