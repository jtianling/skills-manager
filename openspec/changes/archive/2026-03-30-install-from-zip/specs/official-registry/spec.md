## MODIFIED Requirements

### Requirement: Official provider 安装入口
`install` 命令 SHALL 仅通过 `owner/repo` 或完整 URL 方式安装 official provider 的 skill, 不再支持 provider shorthand.

#### Scenario: 通过 owner/repo 安装 official skill
- **WHEN** 用户执行 `skillsmgr install anthropics/skills`
- **THEN** 系统检测 owner 匹配 official provider
- **THEN** 按 official 路径安装到 `~/.skills-manager/official/{providerKey}/{repoName}/`

#### Scenario: 裸词不再匹配 official provider
- **WHEN** 用户执行 `skillsmgr install anthropic`
- **THEN** 系统将其解析为本地目录 `./anthropic`
- **THEN** 如果目录不存在, 报错退出

## REMOVED Requirements

### Requirement: Official provider shorthand 安装
**Reason**: 裸词统一解析为本地目录, 消除歧义. pre-1.0 阶段无需向后兼容.
**Migration**: 使用 `owner/repo` 格式, 例如 `anthropics/skills`, `openai/codex-skills`.
