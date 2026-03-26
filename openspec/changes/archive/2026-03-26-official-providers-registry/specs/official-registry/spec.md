## ADDED Requirements

### Requirement: OfficialProvider 数据结构

系统 SHALL 定义 `OfficialProvider` 接口, 包含以下字段:
- `owner`: string — GitHub 组织/用户名
- `repo`: string — GitHub 仓库名
- `skillsPath`: string (可选) — skills 目录在仓库中的路径

#### Scenario: Provider 有自定义 skillsPath
- **WHEN** `OfficialProvider` 定义了 `skillsPath` (如 `.github/skills`)
- **THEN** 安装时 SHALL 直接使用该路径搜索 skills, 跳过默认扫描逻辑

#### Scenario: Provider 无 skillsPath
- **WHEN** `OfficialProvider` 未定义 `skillsPath`
- **THEN** 安装时 SHALL 使用默认扫描逻辑 (`['skills', '.', 'src/skills']`)

### Requirement: OFFICIAL_PROVIDERS 注册表

系统 SHALL 在 `constants.ts` 中维护 `OFFICIAL_PROVIDERS: Record<string, OfficialProvider>`, key 为提供者快捷名, 初始列表:

| 快捷名 | owner | repo | skillsPath |
|--------|-------|------|------------|
| anthropic | anthropics | skills | — |
| openai | openai | skills | — |
| microsoft | microsoft | skills | .github/skills |
| vercel-labs | vercel-labs | agent-skills | — |

#### Scenario: Registry 包含所有初始提供者
- **WHEN** 系统启动
- **THEN** `OFFICIAL_PROVIDERS` SHALL 包含 anthropic, openai, microsoft, vercel-labs 四个条目

### Requirement: 快捷名安装

用户 SHALL 能通过提供者快捷名直接安装 official skills, 如 `skillsmgr install openai`.

系统 SHALL 将快捷名与 `OFFICIAL_PROVIDERS` 的 key 精确匹配, 匹配成功则调用 official 安装流程.

#### Scenario: 使用快捷名安装 official skills
- **WHEN** 用户执行 `skillsmgr install openai`
- **THEN** 系统 SHALL 从 `OFFICIAL_PROVIDERS['openai']` 获取 `owner=openai, repo=skills`, 从 `https://github.com/openai/skills` 下载 skills 到 `~/.skills-manager/official/openai/`

#### Scenario: 使用 microsoft 快捷名安装
- **WHEN** 用户执行 `skillsmgr install microsoft`
- **THEN** 系统 SHALL 使用 `skillsPath='.github/skills'` 直接在该路径下搜索 skills, 安装到 `~/.skills-manager/official/microsoft/`

#### Scenario: 快捷名不匹配
- **WHEN** 用户执行 `skillsmgr install unknown-provider`
- **THEN** 系统 SHALL 不将其视为 official 快捷名, 继续后续解析逻辑 (owner/repo 简写, URL 等)

### Requirement: owner/repo 自动识别 official

当用户使用 `owner/repo` 格式或完整 GitHub URL 时, 系统 SHALL 反查 `OFFICIAL_PROVIDERS` 判断是否为 official 仓库.

反查逻辑: 遍历 registry, 比较 `provider.owner === owner && provider.repo === repo`.

#### Scenario: owner/repo 匹配 official
- **WHEN** 用户执行 `skillsmgr install anthropics/skills`
- **THEN** 系统 SHALL 识别为 official (匹配 anthropic 条目), 安装到 `official/anthropic/`

#### Scenario: 完整 URL 匹配 official
- **WHEN** 用户执行 `skillsmgr install https://github.com/openai/skills`
- **THEN** 系统 SHALL 识别为 official (匹配 openai 条目), 安装到 `official/openai/`

#### Scenario: owner/repo 不匹配 official
- **WHEN** 用户执行 `skillsmgr install obra/superpowers`
- **THEN** 系统 SHALL 不识别为 official, 安装为 community

### Requirement: 统一 official 安装函数

系统 SHALL 将现有的 `installFromAnthropic()` 重构为通用的 `installFromOfficial(providerKey: string)`, 所有 official 提供者走同一代码路径.

该函数 SHALL:
1. 从 `OFFICIAL_PROVIDERS[providerKey]` 获取 `owner`, `repo`, `skillsPath`
2. 如有 `skillsPath`, 直接使用该路径列出 skills
3. 如无 `skillsPath`, 使用默认扫描逻辑
4. 安装到 `~/.skills-manager/official/{providerKey}/`
5. source key 为 `official/{providerKey}`

#### Scenario: installFromOfficial 使用自定义 skillsPath
- **WHEN** 调用 `installFromOfficial('microsoft')`
- **THEN** 系统 SHALL 直接调用 `listSkills('microsoft', 'skills', '.github/skills')`, 不扫描其他路径

#### Scenario: installFromOfficial 使用默认扫描
- **WHEN** 调用 `installFromOfficial('anthropic')`
- **THEN** 系统 SHALL 依次尝试 `['skills', '.', 'src/skills']` 搜索 skills

#### Scenario: installFromOfficial 保存 source 元数据
- **WHEN** official 安装完成
- **THEN** 系统 SHALL 保存 source, key 为 `official/{providerKey}`, URL 为 `https://github.com/{owner}/{repo}`

### Requirement: 移除硬编码 anthropic 逻辑

系统 SHALL 移除以下硬编码:
- `constants.ts` 中的 `ANTHROPIC_SKILLS_REPO` 常量
- `install.ts` 中 `source === 'anthropic'` 的特殊分支
- `github.ts` 和 `git.ts` 中 `owner === 'anthropics' && repo === 'skills'` 的判断

所有 official 判断 SHALL 通过 registry 查询完成.

#### Scenario: 无硬编码 anthropic 判断
- **WHEN** 代码中需要判断是否为 official
- **THEN** SHALL 调用 `findOfficialProvider(owner, repo)` 或查询 `OFFICIAL_PROVIDERS[key]`, 不出现 'anthropics' 或 'anthropic' 字面量 (registry 数据定义除外)
