## Context

当前 official 仅支持 `anthropics/skills`, 硬编码在 `install.ts`, `github.ts`, `git.ts` 多处.  Community 安装使用 repo name 作为本地目录, 导致不同 owner 同名仓库冲突且丢失来源信息.

各 official 仓库结构差异大:
- `anthropics/skills`: `skills/{skill}/SKILL.md`
- `openai/skills`: `skills/.curated/{skill}/SKILL.md` (隐藏子目录作为 group)
- `microsoft/skills`: `.github/skills/{skill}/SKILL.md` (非常规路径)
- `vercel-labs/agent-skills`: `skills/{skill}/SKILL.md` (标准)

## Goals / Non-Goals

**Goals:**
- 支持多个 official 提供者, 通过 registry 配置
- 每个 official 提供者支持快捷名安装 (如 `skillsmgr install openai`)
- `owner/repo` 格式和完整 URL 自动识别 official 提供者
- community 目录使用 `{owner}/{repo}` 避免冲突
- 适配不同仓库的 skills 目录位置

**Non-Goals:**
- 不支持运行时动态添加 official 提供者 (通过配置文件等)
- 不做 official 提供者的自动发现
- 不改变 custom 的目录结构

## Decisions

### 1. Registry 数据结构

```typescript
interface OfficialProvider {
  owner: string;
  repo: string;
  skillsPath?: string;
}

const OFFICIAL_PROVIDERS: Record<string, OfficialProvider> = {
  'anthropic':   { owner: 'anthropics',    repo: 'skills' },
  'openai':      { owner: 'openai',        repo: 'skills' },
  'microsoft':   { owner: 'microsoft',     repo: 'skills', skillsPath: '.github/skills' },
  'vercel-labs': { owner: 'vercel-labs',    repo: 'agent-skills' },
};
```

**key** = 快捷名 = 本地 `official/{key}/` 目录名.

**理由**: 硬编码足够, 因为 official 列表变更极少, 且每个提供者可能需要特殊的 `skillsPath`. 外部配置增加复杂度但无实际收益.

**替代方案**: 配置文件 (YAML/JSON) — 过度设计, 新增 provider 频率极低, 直接改代码发版更可控.

### 2. 统一 installFromAnthropic → installFromOfficial

当前 `installFromAnthropic()` 是专用函数, 重构为通用的 `installFromOfficial(providerKey)`:

```
installFromOfficial(providerKey: string)
  → 从 OFFICIAL_PROVIDERS[providerKey] 获取 owner, repo, skillsPath
  → skillsPath 有值时直接用, 否则走默认扫描逻辑 ['skills', '.', 'src/skills']
  → 安装到 official/{providerKey}/
  → source key = official/{providerKey}
```

**理由**: 消除 anthropic 专用逻辑, 所有 official 走同一代码路径, 减少维护成本.

### 3. 输入解析流程变更

```
用户输入
  ↓
Step 1: 查 OFFICIAL_PROVIDERS[input]
  匹配 → installFromOfficial(input)
  ↓ 不匹配
Step 2: owner/repo 简写? 解析为 GitHub URL
  ↓ 是
Step 2.5: 反查 registry — 遍历 OFFICIAL_PROVIDERS, 匹配 owner+repo
  匹配 → installFromOfficial(matchedKey)
  ↓ 不匹配
Step 3: GitHub URL? → installFromGitHubUrl()
  ↓ 否
Step 4: git clone 回退
```

**反查逻辑**: 新增 `findOfficialProvider(owner, repo)` 函数, 返回匹配的 provider key 或 null.

### 4. Community 目录结构: `{owner}/{repo}`

```
变更前: community/{repo}/{skill}/
变更后: community/{owner}/{repo}/{skill}/
```

source key 同步变更: `community/{owner}/{repo}`

**理由**: GitHub 上 owner/repo 组合全局唯一, 彻底消除冲突. repo name 对用户有辨识度 (如 "superpowers"), owner name 提供来源信息.

### 5. skillsPath 处理策略

- `skillsPath` 未指定: 使用现有扫描逻辑 `['skills', '.', 'src/skills']`
- `skillsPath` 已指定: 跳过扫描, 直接使用指定路径调用 `listSkills()`

这只影响 `installFromOfficial` 和 `installFromGitHubUrl` 中的 skills 搜索逻辑. git clone 回退路径也需要适配.

### 6. 移除 ANTHROPIC_SKILLS_REPO 常量

`constants.ts` 中的 `ANTHROPIC_SKILLS_REPO` 不再需要, URL 可以从 registry 动态生成: `https://github.com/${provider.owner}/${provider.repo}`.

## Risks / Trade-offs

**BREAKING: community 目录结构变更** → 已安装的 community skills 路径会失效.
- 迁移策略: 不做自动迁移. 用户重新 install 即可. README/CHANGELOG 中说明.
- 理由: community skills 数量少, 重装成本低, 自动迁移复杂度不值得.

**BREAKING: source key 格式变更** → sources.json 中旧的 community key 无法匹配.
- 迁移策略: 同上, 重新 install 会覆盖.

**Microsoft 仓库的 symlink 结构** → 当前 installer 不跟随 symlink, 但 `.github/skills/` 下的真实 skill 可以正常下载.
- 风险: 如果 Microsoft 未来改变结构, 需要更新 registry 的 `skillsPath`.
- 缓解: 这也是 registry 存在的价值 — 集中管理适配.

## Open Questions

(无)
