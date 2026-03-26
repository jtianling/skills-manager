## Context

当前 `OfficialProvider` 数据模型将每个 provider key 绑定到单个 GitHub 仓库. 实际中同一组织 (如 vercel-labs) 在多个仓库中发布 skills. 用户需要:
1. `skillsmgr install vercel-labs` 时从多个 repo 合并技能列表
2. 通过别名 (如 `vercel`) 简化安装
3. 同一 official owner 下未注册的新仓库自动归类为 official

当前 official 落盘路径为两层 (`official/{providerKey}/{skillName}/`), 与 community 的三层 (`community/{owner}/{repo}/{skillName}/`) 不一致. 这次统一为三层.

## Goals / Non-Goals

**Goals:**
- 单个 provider 支持多个 repo, 合并展示和安装
- provider 级别别名映射
- owner 级别 official 认定 (owner 匹配即 official)
- official 落盘路径与 community 结构对齐 (三层)
- 最小化对 update/list 等现有命令的影响

**Non-Goals:**
- 旧数据自动迁移 (用户量少, reinstall 即可)
- `vercel/agent-browser` 这种明确 owner/repo 路径的别名解析
- 自动发现 owner 下所有仓库 (仍需手动注册或手动 install)

## Decisions

### 1. OfficialProvider 数据模型: repos 数组 + aliases

```typescript
interface OfficialProviderRepo {
  repo: string;
  skillsPath?: string;
}

interface OfficialProvider {
  owner: string;
  repos: OfficialProviderRepo[];
  aliases?: string[];
}
```

**Why**: 每个 repo 可能有不同的 `skillsPath`, 所以 repo 级别的配置需要保留. aliases 放在 provider 级别, 因为别名是 provider 的概念, 不是 repo 的.

**Alternatives considered**:
- 多个 provider key 指向同一 owner (如 `vercel-agent-skills`, `vercel-agent-browser`): 违背"一个 provider = 一个组织"的心智模型
- aliases 作为独立的全局映射表: 增加概念复杂度, 且别名语义上和 provider 绑定

### 2. findOfficialProvider 改为 owner 级别匹配

```typescript
interface OfficialMatch {
  providerKey: string;
  exactRepoMatch: boolean;
}

function findOfficialProvider(owner: string, repo: string): OfficialMatch | null
```

匹配逻辑: 遍历 registry, 只要 `provider.owner === owner` 就返回. `exactRepoMatch` 标记 repo 是否在 `repos[]` 中.

**Why**: 区分两种场景:
- `exactRepoMatch: true` → 走 installFromOfficial (已知 repo, 有 skillsPath 等配置)
- `exactRepoMatch: false` → 走 GitHub URL 流程, 但归类为 official (无特殊配置)

**Alternatives considered**:
- 两个独立函数 (`findByOwnerAndRepo`, `findByOwner`): 语义拆分更清晰, 但调用方代码更冗余
- 始终走 installFromOfficial: 未注册 repo 没有配置信息, 强行走这个路径需要额外处理

### 3. 落盘路径统一为三层

```
official/{providerKey}/{repoName}/{skillName}/
```

与 community 的 `community/{owner}/{repo}/{skillName}/` 完全对齐.

**Why**: 多 repo 共存必须有 repo 层隔离. 统一结构也简化了 SkillsService 的遍历逻辑 — official 和 community 可以共用同一遍历模式.

### 4. source key 每 repo 独立

```
official/vercel-labs/agent-skills
official/vercel-labs/agent-browser
```

而非之前的 `official/vercel-labs`.

**Why**: source key 直接映射到文件系统路径, 每个 repo 有独立的 URL, 独立的更新时间. update 命令按 sourceKey 更新, 独立 key 使 update 逻辑无需改动.

### 5. 别名解析仅在 provider key 入口

```typescript
function resolveProviderAlias(input: string): string | null
```

在 `executeInstall` 入口处, `OFFICIAL_PROVIDERS[source]` 查找前先做别名解析. 只处理单词输入 (如 `vercel`), 不处理 `owner/repo` 格式.

**Why**: 别名的目的是简化输入, 而 `vercel/agent-browser` 已经足够明确, 不需要别名. 限制作用域也避免意外的别名冲突.

### 6. installFromOfficial 多 repo 遍历

当用户 `skillsmgr install vercel-labs` 时:
1. 遍历 `provider.repos[]`, 对每个 repo 拉取技能列表
2. 按 repo 分组展示: 每个 repo 作为一个 subGroup
3. 用户可按 repo 整组选择 (利用已有的 group-header 三态切换)
4. 下载时落盘到 `official/{providerKey}/{repoName}/{skillName}/`
5. 每个 repo 独立写入 sources.json

## Risks / Trade-offs

- **[Breaking change]** 已安装用户的 official skills 路径不兼容 → 不做迁移, 项目早期用户量少, 文档说明 reinstall
- **[API rate limit]** 多 repo 遍历会增加 GitHub API 调用次数 → 各 repo 请求可并行化减少等待时间; 有 GITHUB_TOKEN 时限制大幅放宽
- **[repo 名冲突]** 同一 provider 下不同 repo 可能有同名 skill → 有 repo 层隔离, 文件系统不冲突; list 展示也按 repo 分组, 用户可区分
