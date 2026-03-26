## MODIFIED Requirements

### Requirement: 来源分类 (安装目标路径表)

| 类型 | 存储路径 | 说明 |
|------|---------|------|
| official | `~/.skills-manager/official/{providerKey}/{repoName}/{skillName}/` | 官方 skill, 由 OFFICIAL_PROVIDERS registry 定义或 owner 匹配 |
| community | `~/.skills-manager/community/{owner}/{repo}/{skillName}/` | 社区仓库 |
| custom | `~/.skills-manager/custom/{name}/` | 本地自定义无分组 skill |
| custom (grouped) | `~/.skills-manager/custom/{groupName}/{name}/` | 本地自定义分组 skill |

#### Scenario: Official 安装路径 (已注册 repo)
- **WHEN** 安装 official 提供者 openai 的 skills repo
- **THEN** 安装到 `~/.skills-manager/official/openai/skills/{skill-name}/`

#### Scenario: Official 安装路径 (未注册 repo, owner 匹配)
- **WHEN** 安装 vercel-labs/new-repo (owner 匹配但 repo 未注册)
- **THEN** 安装到 `~/.skills-manager/official/vercel-labs/new-repo/{skill-name}/`

#### Scenario: Community 安装路径
- **WHEN** 安装 community 仓库 `obra/superpowers` 的 skills
- **THEN** 安装到 `~/.skills-manager/community/obra/superpowers/{skill-name}/`

### Requirement: Source Key 命名规则

key 格式:
- official: `"official/{providerKey}/{repoName}"` (如 `"official/openai/skills"`, `"official/vercel-labs/agent-skills"`)
- community: `"community/{owner}/{repo}"` (如 `"community/obra/superpowers"`)
- custom: `"custom/{repo}"` (不变)

#### Scenario: Official source key (已注册 repo)
- **WHEN** 安装 official provider 'openai' 的 skills repo
- **THEN** source key SHALL 为 `"official/openai/skills"`

#### Scenario: Official source key (未注册 repo)
- **WHEN** 安装 vercel-labs/new-repo (owner 匹配)
- **THEN** source key SHALL 为 `"official/vercel-labs/new-repo"`

#### Scenario: Community source key
- **WHEN** 安装 `obra/superpowers` 的 skills
- **THEN** source key SHALL 为 `"community/obra/superpowers"`

### Requirement: 安装目标路径

| 场景 | 路径 |
|------|------|
| official 快捷名 (多 repo) | `~/.skills-manager/official/{providerKey}/{repoName}/{skill-name}/` |
| official owner/repo (已注册) | `~/.skills-manager/official/{providerKey}/{repoName}/{skill-name}/` |
| official owner/repo (未注册, owner 匹配) | `~/.skills-manager/official/{providerKey}/{repoName}/{skill-name}/` |
| community GitHub 仓库 | `~/.skills-manager/community/{owner}/{repo}/{skill-name}/` |
| `--custom` 选项 | `~/.skills-manager/custom/{repo}/{skill-name}/` |

#### Scenario: getTargetDir for official (已注册)
- **WHEN** 调用 `getTargetDir` 且 owner/repo 匹配 official registry (exactRepoMatch=true)
- **THEN** 返回 `~/.skills-manager/official/{providerKey}/{repoName}/{skillName}`

#### Scenario: getTargetDir for official (未注册 repo)
- **WHEN** 调用 `getTargetDir` 且 owner 匹配 official (exactRepoMatch=false)
- **THEN** 返回 `~/.skills-manager/official/{providerKey}/{repoName}/{skillName}`

#### Scenario: getTargetDir for community
- **WHEN** 调用 `getTargetDir` 且 owner/repo 不匹配 official registry
- **THEN** 返回 `~/.skills-manager/community/{owner}/{repo}/{skillName}`

### Requirement: 输入解析

`install` 命令接受 `<source>` 参数, 按以下优先级解析:

1. **official 快捷名**: 查询 `OFFICIAL_PROVIDERS[source]`, 匹配则调用 `installFromOfficial(source)`
2. **别名**: 查询所有 provider 的 aliases, 匹配则调用 `installFromOfficial(resolvedKey)`
3. **`owner/repo` 简写** (如 `vercel-labs/agent-skills`):
   - 调用 `findOfficialProvider(owner, repo)`:
     - `exactRepoMatch: true` → 调用 `installFromOfficial(providerKey, repo)` 仅安装该 repo
     - `exactRepoMatch: false` → 转为 GitHub URL, 走 URL 流程但归类为 official
     - `null` → 转为 GitHub URL, 走 community 流程
4. **GitHub URL** (含 `github.com`): 解析 owner/repo, 用 `findOfficialProvider` 判断分类
5. **其他 URL**: 直接使用 git clone

#### Scenario: 别名安装
- **WHEN** 用户执行 `skillsmgr install vercel`
- **THEN** 解析别名为 vercel-labs, 调用 `installFromOfficial('vercel-labs')`

#### Scenario: owner/repo 简写, 已注册 repo
- **WHEN** 用户执行 `skillsmgr install vercel-labs/agent-skills`
- **THEN** findOfficialProvider 返回 exactRepoMatch=true, 调用 `installFromOfficial('vercel-labs', 'agent-skills')`

#### Scenario: owner/repo 简写, 未注册 repo
- **WHEN** 用户执行 `skillsmgr install vercel-labs/new-repo`
- **THEN** findOfficialProvider 返回 exactRepoMatch=false, 转为 GitHub URL, 安装到 `official/vercel-labs/new-repo/`
