# Multi-Repo Provider

## Purpose
单个 official provider 支持多个 GitHub 仓库, 合并展示和安装.

## Requirements

### Requirement: OfficialProviderRepo 数据结构

系统 SHALL 定义 `OfficialProviderRepo` 接口, 包含以下字段:
- `repo`: string -- GitHub 仓库名
- `skillsPath`: string (可选) -- skills 目录在仓库中的路径

`OfficialProvider` 的 `repos` 字段 SHALL 为 `OfficialProviderRepo[]` 数组.

#### Scenario: Provider 有多个 repo
- **WHEN** `OfficialProvider` 定义了多个 repo (如 vercel-labs 有 agent-skills 和 agent-browser)
- **THEN** `repos` 数组 SHALL 包含所有已注册仓库的配置

#### Scenario: 每个 repo 可有独立 skillsPath
- **WHEN** provider 的某个 repo 定义了 `skillsPath` (如 `.github/skills`)
- **THEN** 安装该 repo 时 SHALL 使用该 repo 专属的 `skillsPath`

### Requirement: 多 repo 合并安装

`installFromOfficial(providerKey)` SHALL 遍历 provider 的所有 `repos[]`, 从每个 repo 拉取技能列表, 按 repo 分组合并展示.

#### Scenario: 安装多 repo provider
- **WHEN** 用户执行 `skillsmgr install vercel-labs`, vercel-labs 有 agent-skills 和 agent-browser 两个 repo
- **THEN** 系统 SHALL 从两个 repo 分别拉取技能, 合并为一个选择列表, 按 repo 分组展示

#### Scenario: 按 repo 分组展示
- **WHEN** 合并技能列表展示给用户选择
- **THEN** 每个 repo 作为一个 subGroup, 用户可通过 group-header 按 repo 整组选择

#### Scenario: 单 repo provider 行为不变
- **WHEN** provider 只有一个 repo (如 anthropic 只有 skills)
- **THEN** 行为与多 repo 时一致, 只是 subGroup 只有一个

#### Scenario: 某个 repo 拉取失败
- **WHEN** 多 repo 遍历中某个 repo 的安装失败
- **THEN** 系统 SHALL 输出警告, 继续处理其余 repo; 如果所有 repo 都失败则报错退出

### Requirement: 多 repo 落盘路径

多 repo 安装时每个 skill 的落盘路径 SHALL 包含 repo 层:

`official/{providerKey}/{repoName}/{skillName}/`

#### Scenario: 不同 repo 的 skill 落盘隔离
- **WHEN** 从 vercel-labs/agent-skills 安装 skill "deploy", 从 vercel-labs/agent-browser 安装 skill "browser"
- **THEN** deploy 安装到 `official/vercel-labs/agent-skills/deploy/`, browser 安装到 `official/vercel-labs/agent-browser/browser/`

#### Scenario: 同名 skill 不冲突
- **WHEN** 两个 repo 都有名为 "utils" 的 skill
- **THEN** 分别安装到 `official/{providerKey}/{repo1}/utils/` 和 `official/{providerKey}/{repo2}/utils/`, 不冲突

### Requirement: 多 repo source 元数据

每个 repo SHALL 在 sources.json 中独立记录, source key 包含 repo 名.

#### Scenario: 多 repo 的 source key 独立
- **WHEN** 安装 vercel-labs 的 agent-skills 和 agent-browser
- **THEN** sources.json 中 SHALL 有两个独立条目: `"official/vercel-labs/agent-skills"` 和 `"official/vercel-labs/agent-browser"`, 各自记录自己的 URL 和时间戳

#### Scenario: 只安装部分 repo 的 skill
- **WHEN** 用户在选择界面只选了 agent-skills 的 skill, agent-browser 的 skill 全未选
- **THEN** sources.json 中只记录 `"official/vercel-labs/agent-skills"`, 不记录 agent-browser
