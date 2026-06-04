# Official Registry

## Purpose
Official 提供者注册表: 定义, 查询, 安装官方 skill 提供者.

## Requirements

### Requirement: OfficialProvider 数据结构

系统 SHALL 定义 `OfficialProvider` 接口, 包含以下字段:
- `owner`: string -- GitHub 组织/用户名
- `repos`: OfficialProviderRepo[] -- 该 provider 下的 GitHub 仓库列表
- `aliases`: string[] (可选) -- 该 provider 的别名列表

`OfficialProviderRepo` 接口:
- `repo`: string -- GitHub 仓库名
- `skillsPath`: string (可选) -- skills 目录在仓库中的路径

#### Scenario: Provider 有自定义 skillsPath
- **WHEN** `OfficialProviderRepo` 定义了 `skillsPath` (如 `.github/skills`)
- **THEN** 安装时 SHALL 直接使用该路径搜索 skills, 跳过默认扫描逻辑

#### Scenario: Provider 无 skillsPath
- **WHEN** `OfficialProviderRepo` 未定义 `skillsPath`
- **THEN** 安装时 SHALL 使用默认扫描逻辑 (`['skills', '.', 'src/skills']`)

#### Scenario: Provider 有多个 repo
- **WHEN** vercel-labs 定义了 `repos: [{ repo: 'agent-skills' }, { repo: 'agent-browser' }]`
- **THEN** `skillsmgr install vercel-labs` SHALL 从两个 repo 拉取技能

#### Scenario: Provider 有别名
- **WHEN** vercel-labs 定义了 `aliases: ['vercel']`
- **THEN** `skillsmgr install vercel` SHALL 等同于 `skillsmgr install vercel-labs`

### Requirement: OFFICIAL_PROVIDERS 注册表

系统 SHALL 在 `constants.ts` 中维护 `OFFICIAL_PROVIDERS: Record<string, OfficialProvider>`, key 为提供者快捷名, 初始列表:

| 快捷名 | owner | repos | aliases |
|--------|-------|-------|---------|
| anthropic | anthropics | [{ repo: 'skills' }] | -- |
| openai | openai | [{ repo: 'skills' }] | -- |
| microsoft | microsoft | [{ repo: 'skills', skillsPath: '.github/skills' }] | -- |
| vercel-labs | vercel-labs | [{ repo: 'agent-skills' }, { repo: 'agent-browser' }] | ['vercel'] |

#### Scenario: Registry 包含所有初始提供者
- **WHEN** 系统启动
- **THEN** `OFFICIAL_PROVIDERS` SHALL 包含 anthropic, openai, microsoft, vercel-labs 四个条目

#### Scenario: vercel-labs 有多个 repo 和别名
- **WHEN** 查看 vercel-labs 条目
- **THEN** SHALL 有两个 repo (agent-skills, agent-browser) 和一个别名 (vercel)

### Requirement: 快捷名安装

用户 SHALL 能通过提供者快捷名直接安装 official skills, 如 `skillsmgr install openai`.

系统 SHALL 将快捷名与 `OFFICIAL_PROVIDERS` 的 key 精确匹配, 匹配成功则调用 official 安装流程.

#### Scenario: 使用快捷名安装 official skills
- **WHEN** 用户执行 `skillsmgr install openai`
- **THEN** 系统 SHALL 从 `OFFICIAL_PROVIDERS['openai']` 获取配置, 遍历其 repos, 安装到 `~/.skills-manager/official/openai/{repoName}/{skillName}/`

#### Scenario: 使用 microsoft 快捷名安装
- **WHEN** 用户执行 `skillsmgr install microsoft`
- **THEN** 系统 SHALL 遍历 microsoft 的 repos, 对有 `skillsPath='.github/skills'` 的 repo 直接使用该路径搜索

#### Scenario: 快捷名不匹配时检查别名
- **WHEN** 用户执行 `skillsmgr install vercel`, `OFFICIAL_PROVIDERS['vercel']` 不存在
- **THEN** 系统 SHALL 检查所有 provider 的 aliases, 找到 vercel-labs 的别名匹配, 等同于 `skillsmgr install vercel-labs`

#### Scenario: 快捷名和别名都不匹配
- **WHEN** 用户执行 `skillsmgr install unknown-provider`
- **THEN** 系统 SHALL 不将其视为 official, 继续后续解析逻辑

### Requirement: owner/repo 自动识别 official

当用户使用 `owner/repo` 格式或完整 GitHub URL 时, 系统 SHALL 通过 `findOfficialProvider` 判断是否为 official.

匹配逻辑: 遍历 registry, 只要 `provider.owner === owner` 即匹配, 返回 `OfficialMatch`.

#### Scenario: owner/repo 精确匹配 official (已注册 repo)
- **WHEN** 用户执行 `skillsmgr install anthropics/skills`
- **THEN** 系统 SHALL 识别为 official (owner 匹配 anthropic, repo 在 repos 列表中), exactRepoMatch=true

#### Scenario: owner/repo 匹配 official (未注册 repo)
- **WHEN** 用户执行 `skillsmgr install vercel-labs/new-repo`
- **THEN** 系统 SHALL 识别为 official (owner 匹配 vercel-labs), exactRepoMatch=false, 安装到 `official/vercel-labs/new-repo/`

#### Scenario: 完整 URL 匹配 official
- **WHEN** 用户执行 `skillsmgr install https://github.com/openai/skills`
- **THEN** 系统 SHALL 识别为 official, 安装到 `official/openai/skills/`

#### Scenario: owner/repo 不匹配 official
- **WHEN** 用户执行 `skillsmgr install obra/superpowers`
- **THEN** 系统 SHALL 不识别为 official, 安装为 community

### Requirement: 统一 official 安装函数

`installFromOfficial(providerKey: string)` SHALL 遍历 provider 的所有 repos, 从每个 repo 拉取技能列表:

1. 从 `OFFICIAL_PROVIDERS[providerKey]` 获取 provider 配置
2. 遍历 `repos[]`, 对每个 repo:
   - 如有 `skillsPath`, 直接使用该路径列出 skills
   - 如无 `skillsPath`, 使用默认扫描逻辑
3. 按 repo 分组展示技能选择列表
4. 安装到 `~/.skills-manager/official/{providerKey}/{repoName}/{skillName}/`
5. 每个有安装 skill 的 repo 独立写入 sources.json, key 为 `official/{providerKey}/{repoName}`

`installFromOfficial` 还 SHALL 支持可选的 `targetRepo` 参数, 当用户通过 `owner/repo` 简写安装已注册 repo 时, 仅安装该 repo.

#### Scenario: installFromOfficial 多 repo 遍历
- **WHEN** 调用 `installFromOfficial('vercel-labs')` 无 targetRepo
- **THEN** 系统 SHALL 遍历所有 repos, 合并技能列表展示

#### Scenario: installFromOfficial 指定单 repo
- **WHEN** 调用 `installFromOfficial('vercel-labs', 'agent-skills')`
- **THEN** 系统 SHALL 只从 agent-skills 拉取技能

#### Scenario: installFromOfficial 保存 source 元数据
- **WHEN** official 安装完成, 从 agent-skills 安装了 2 个 skill
- **THEN** 系统 SHALL 保存 source, key 为 `official/vercel-labs/agent-skills`, URL 为 `https://github.com/vercel-labs/agent-skills`
