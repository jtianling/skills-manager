## ADDED Requirements

### Requirement: OfficialMatch 返回结构

`findOfficialProvider` SHALL 返回 `OfficialMatch | null`, 其中:

```typescript
interface OfficialMatch {
  providerKey: string;
  exactRepoMatch: boolean;
}
```

- `providerKey`: 匹配到的 provider key
- `exactRepoMatch`: repo 是否在该 provider 的 `repos[]` 列表中

#### Scenario: owner 和 repo 都匹配
- **WHEN** 调用 `findOfficialProvider('vercel-labs', 'agent-skills')`, 且 vercel-labs provider 的 repos 包含 agent-skills
- **THEN** SHALL 返回 `{ providerKey: 'vercel-labs', exactRepoMatch: true }`

#### Scenario: 仅 owner 匹配
- **WHEN** 调用 `findOfficialProvider('vercel-labs', 'unknown-new-repo')`, 且 unknown-new-repo 不在 vercel-labs 的 repos 中
- **THEN** SHALL 返回 `{ providerKey: 'vercel-labs', exactRepoMatch: false }`

#### Scenario: owner 不匹配
- **WHEN** 调用 `findOfficialProvider('random-user', 'some-repo')`
- **THEN** SHALL 返回 `null`

### Requirement: owner 级别 official 认定

任何已注册 official owner 下的 GitHub 仓库, 无论是否在 `repos[]` 中, SHALL 被归类为 official.

#### Scenario: 未注册 repo 归类为 official
- **WHEN** 用户执行 `skillsmgr install vercel-labs/new-repo`, new-repo 不在 vercel-labs 的 repos 注册表中
- **THEN** 系统 SHALL 通过 GitHub URL 流程安装, 但归类为 official, 安装到 `official/vercel-labs/new-repo/{skillName}/`

#### Scenario: 未注册 repo 的 source key
- **WHEN** 安装 vercel-labs/new-repo (未注册)
- **THEN** source key SHALL 为 `"official/vercel-labs/new-repo"`, type 为 `"official"`

#### Scenario: 未注册 repo 不走 installFromOfficial
- **WHEN** findOfficialProvider 返回 `exactRepoMatch: false`
- **THEN** 系统 SHALL 不调用 `installFromOfficial`, 而是走 `installFromGitHubUrl` 或 `installViaGitClone` 流程, 仅在路径和分类上使用 official

### Requirement: owner/repo 简写 official 路由

当用户输入 `owner/repo` 简写格式时, 系统 SHALL 使用 `findOfficialProvider` 判断:
- `exactRepoMatch: true` → 调用 `installFromOfficial`, 仅安装该匹配的 repo
- `exactRepoMatch: false` → 转为 GitHub URL, 走 URL 流程但归类为 official
- `null` → 转为 GitHub URL, 走 community 流程

#### Scenario: 已注册 repo 的 owner/repo 简写
- **WHEN** 用户执行 `skillsmgr install vercel-labs/agent-skills`
- **THEN** findOfficialProvider 返回 exactRepoMatch=true, 系统 SHALL 调用 installFromOfficial 只安装 agent-skills 这一个 repo

#### Scenario: 未注册 repo 的 owner/repo 简写
- **WHEN** 用户执行 `skillsmgr install vercel-labs/new-repo`
- **THEN** findOfficialProvider 返回 exactRepoMatch=false, 系统 SHALL 转为 GitHub URL 安装, 归类为 official

#### Scenario: 非 official 的 owner/repo 简写
- **WHEN** 用户执行 `skillsmgr install random-user/some-repo`
- **THEN** findOfficialProvider 返回 null, 系统 SHALL 转为 GitHub URL, 安装为 community
