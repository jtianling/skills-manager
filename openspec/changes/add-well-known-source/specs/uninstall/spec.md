## MODIFIED Requirements

### Requirement: 通过 URL 卸载
系统 SHALL 支持通过 Git URL 格式(HTTPS/SSH)执行卸载.  系统 SHALL 从 URL 中提取 owner/repo, 然后按已有的 owner/repo 卸载流程执行.

系统 SHALL 额外支持通过 well-known 站点 URL 执行卸载: 当 URL 无法提取出 owner/repo 时, 系统 SHALL 按归一化 URL 在已安装 sources 中匹配 `well-known/{hostname}` 条目, 匹配成功即按该 source key 执行卸载流程; 匹配失败才降级为按 skill name 查找.

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

#### Scenario: 通过 well-known 站点 URL 卸载
- **GIVEN** 已从 `https://docs.stripe.com` 安装 skill
- **WHEN** 用户执行 `skillsmgr uninstall https://docs.stripe.com`
- **THEN** 系统 SHALL 匹配到已安装 source key `well-known/docs.stripe.com`
- **THEN** 行为与 `skillsmgr uninstall docs.stripe.com` 一致

#### Scenario: 无法解析的 URL
- **WHEN** 用户执行 `skillsmgr uninstall https://example.com/`
- **THEN** 系统在已安装 sources 中找不到 `well-known/example.com`
- **THEN** 系统报错 skill not found(降级为按 skill name 查找, 自然失败)
