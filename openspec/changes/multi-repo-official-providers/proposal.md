## Why

当前 official providers 每个 key 只能绑定一个 GitHub 仓库, 但实际场景中同一公司/组织会在多个仓库中发布 skills (如 vercel-labs 有 agent-skills 和 agent-browser 两个仓库).  用户需要统一管理同一组织下所有 official skills, 并通过别名简化安装命令, 同时确保同一 official owner 下的新仓库自动获得 official 分类.

## What Changes

- **BREAKING** `OfficialProvider` 数据模型从单 `repo: string` 改为 `repos: OfficialProviderRepo[]` 数组, 支持每个 provider 绑定多个仓库
- **BREAKING** official skills 落盘路径从 `official/{providerKey}/{skillName}/` 改为 `official/{providerKey}/{repoName}/{skillName}/`, 与 community 三层结构对齐
- **BREAKING** sources.json 中 official source key 从 `official/{providerKey}` 改为 `official/{providerKey}/{repoName}`, 每个 repo 独立记录
- 新增 `aliases` 字段, 支持 `skillsmgr install vercel` 解析为 `vercel-labs`
- `findOfficialProvider` 从 owner+repo 精确匹配改为 owner 级别匹配, 返回 `OfficialMatch` 结构体, 包含 `providerKey` 和 `exactRepoMatch` 标志
- `installFromOfficial` 遍历 provider 的所有 repos, 按 repo 分组展示供用户选择
- 任何已注册 official owner 下的未知仓库 (如 `vercel-labs/new-repo`) 安装后归类为 official 而非 community

## Capabilities

### New Capabilities

- `multi-repo-provider`: 单个 official provider 支持多个 GitHub 仓库, 合并展示和安装
- `provider-alias`: official provider 别名映射, 支持简写安装
- `owner-level-official`: 基于 GitHub owner 的 official 自动认定, 已注册 owner 下所有仓库均为 official

### Modified Capabilities

- `official-registry`: OfficialProvider 数据结构变更 (repo→repos, +aliases), findOfficialProvider 返回值和匹配逻辑变更, 落盘路径和 source key 增加 repo 层
- `source-management`: official 安装路径从二层改为三层, source key 格式变更, installFromOfficial 支持多 repo 遍历
- `skill-grouping`: official skills 的 source 字符串从 `official/{providerKey}` 变为 `official/{providerKey}/{repoName}`, 影响 list 和 promptSkills 的分组展示

## Impact

- `src/constants.ts`: OfficialProvider interface, OFFICIAL_PROVIDERS 数据, findOfficialProvider 函数
- `src/commands/install.ts`: installFromOfficial (多 repo 遍历), installFromGitHubUrl (路径变更), saveGitCloneSource (路径变更), executeInstall (别名解析)
- `src/services/github.ts`: getTargetDir 路径增加 repo 层
- `src/services/skills.ts`: official 遍历从两层改为三层
- `src/services/sources.ts`: source key 格式变更
- `src/commands/list.ts`: 自动适配 (groupId 从 `anthropic` 变为 `anthropic/skills`)
- `src/commands/update.ts`: 基本不变, 每个 repo 有独立 sourceKey 和目录
- 不做旧数据迁移, 已安装用户需 reinstall
