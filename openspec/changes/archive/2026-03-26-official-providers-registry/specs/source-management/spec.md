## MODIFIED Requirements

### Requirement: 来源分类

管理 skill 的远程来源: 下载, 安装, 元数据追踪, 更新.

| 类型 | 存储路径 | 说明 |
|------|---------|------|
| official | `~/.skills-manager/official/{providerKey}/` | 官方 skill, 由 OFFICIAL_PROVIDERS registry 定义 |
| community | `~/.skills-manager/community/{owner}/{repo}/` | 社区仓库 |
| custom | `~/.skills-manager/custom/{name}/` | 本地自定义, 也可通过 `--custom` 从远程安装 |

official 提供者由 `OFFICIAL_PROVIDERS` registry 定义, 支持多个提供者.

#### Scenario: Official 安装路径
- **WHEN** 安装 official 提供者 (如 openai) 的 skills
- **THEN** 安装到 `~/.skills-manager/official/openai/{skill-name}/`

#### Scenario: Community 安装路径
- **WHEN** 安装 community 仓库 `obra/superpowers` 的 skills
- **THEN** 安装到 `~/.skills-manager/community/obra/superpowers/{skill-name}/`

#### Scenario: Custom 安装路径不变
- **WHEN** 使用 `--custom` 安装
- **THEN** 安装到 `~/.skills-manager/custom/{repo}/{skill-name}/`, 行为不变

### Requirement: Source Key 命名规则

key 格式:
- official: `"official/{providerKey}"` (如 `"official/openai"`)
- community: `"community/{owner}/{repo}"` (如 `"community/obra/superpowers"`)
- custom: `"custom/{repo}"` (不变)

#### Scenario: Official source key
- **WHEN** 安装 official provider 'microsoft' 的 skills
- **THEN** source key SHALL 为 `"official/microsoft"`

#### Scenario: Community source key
- **WHEN** 安装 `obra/superpowers` 的 skills
- **THEN** source key SHALL 为 `"community/obra/superpowers"`

### Requirement: 输入解析

`install` 命令接受 `<source>` 参数, 按以下优先级解析:

1. **official 快捷名**: 查询 `OFFICIAL_PROVIDERS[source]`, 匹配则调用 `installFromOfficial(source)`
2. **`owner/repo` 简写** (如 `Fission-AI/OpenSpec`):
   - 匹配规则: `!source.includes('://') && /^[^/]+\/[^/]+\/?$/.test(source)`
   - 转换为 `https://github.com/{owner}/{repo}`
   - 解析 owner/repo 后, 反查 `OFFICIAL_PROVIDERS` — 匹配则调用 `installFromOfficial(matchedKey)`
   - 不匹配则继续 GitHub URL 处理
3. **GitHub URL** (含 `github.com`): 解析 owner/repo, 反查 registry, 匹配则 official, 否则 community
4. **其他 URL**: 直接使用 git clone

#### Scenario: anthropic 关键字安装
- **WHEN** 用户执行 `skillsmgr install anthropic`
- **THEN** 匹配 `OFFICIAL_PROVIDERS['anthropic']`, 从 `anthropics/skills` 安装到 `official/anthropic/`

#### Scenario: owner/repo 简写识别为 official
- **WHEN** 用户执行 `skillsmgr install openai/skills`
- **THEN** 解析 owner=openai, repo=skills, 反查 registry 匹配 openai 条目, 安装到 `official/openai/`

#### Scenario: owner/repo 简写识别为 community
- **WHEN** 用户执行 `skillsmgr install obra/superpowers`
- **THEN** 解析 owner=obra, repo=superpowers, 反查 registry 无匹配, 安装到 `community/obra/superpowers/`

#### Scenario: GitHub URL 识别为 official
- **WHEN** 用户执行 `skillsmgr install https://github.com/vercel-labs/agent-skills`
- **THEN** 解析 owner=vercel-labs, repo=agent-skills, 反查 registry 匹配, 安装到 `official/vercel-labs/`

### Requirement: 安装目标路径

| 场景 | 路径 |
|------|------|
| official 快捷名 | `~/.skills-manager/official/{providerKey}/{skill-name}/` |
| official owner/repo 或 URL | `~/.skills-manager/official/{providerKey}/{skill-name}/` |
| community GitHub 仓库 | `~/.skills-manager/community/{owner}/{repo}/{skill-name}/` |
| `--custom` 选项 | `~/.skills-manager/custom/{repo}/{skill-name}/` |

#### Scenario: getTargetDir for official
- **WHEN** 调用 `getTargetDir` 且 owner/repo 匹配 official registry
- **THEN** 返回 `~/.skills-manager/official/{providerKey}/{skillName}`

#### Scenario: getTargetDir for community
- **WHEN** 调用 `getTargetDir` 且 owner/repo 不匹配 official registry
- **THEN** 返回 `~/.skills-manager/community/{owner}/{repo}/{skillName}`

### Requirement: SourceInfo 数据结构

存储在 `~/.skills-manager/sources.json`:

```json
{
  "version": "1.0",
  "sources": {
    "official/anthropic": {
      "url": "https://github.com/anthropics/skills",
      "type": "official",
      "repoName": "anthropic",
      "installedAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-02-01T15:30:00.000Z"
    },
    "community/obra/superpowers": {
      "url": "https://github.com/obra/superpowers",
      "type": "community",
      "repoName": "superpowers",
      "installedAt": "2025-03-01T10:00:00.000Z",
      "updatedAt": "2025-03-01T10:00:00.000Z"
    }
  }
}
```

#### Scenario: Community source 记录完整 owner/repo
- **WHEN** 安装 community 仓库 `obra/superpowers`
- **THEN** source key SHALL 为 `"community/obra/superpowers"`, url 为 `"https://github.com/obra/superpowers"`

### Requirement: Update 流程适配

更新流程中的 source 匹配逻辑 SHALL 适配新的 key 格式:

1. 精确匹配 key (如 `official/openai`, `community/obra/superpowers`)
2. key 以 `/{source}` 结尾 (如输入 `anthropic` 匹配 `official/anthropic`, 输入 `superpowers` 匹配 `community/obra/superpowers`)
3. `sourceInfo.repoName === source`

更新时确定本地目标目录 SHALL 使用与安装相同的路径规则.

#### Scenario: Update community source 匹配
- **WHEN** 用户执行 `skillsmgr update superpowers`
- **THEN** 系统 SHALL 匹配 key `community/obra/superpowers` (以 `/superpowers` 结尾)

#### Scenario: Update official source 匹配
- **WHEN** 用户执行 `skillsmgr update openai`
- **THEN** 系统 SHALL 匹配 key `official/openai` (以 `/openai` 结尾)

### Requirement: Git Clone 回退适配

git clone 回退路径中的目标目录和 source key SHALL 使用与 GitHub API 路径相同的规则:

- official (反查 registry 匹配): `official/{providerKey}/`
- community: `community/{owner}/{repo}/`
- custom: `custom/{repo}/`

#### Scenario: Git clone community 目录
- **WHEN** GitHub API 失败, 回退 git clone 安装 `obra/superpowers`
- **THEN** 克隆到 `~/.skills-manager/community/obra/superpowers/`

#### Scenario: Git clone official 目录
- **WHEN** GitHub API 失败, 回退 git clone 安装 `openai/skills`
- **THEN** 反查 registry 匹配 openai, 克隆到 `~/.skills-manager/official/openai/`
