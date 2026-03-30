## Context

`install` 通过 `detectSourceType()` 识别 URL 并路由到 `installViaGitClone()`.  但 `uninstall` 和 `remove` 命令没有 URL 识别能力:

- `uninstall`: identifier 匹配 `owner/repo` 正则则走 `uninstallSource()`, 否则走 `uninstallByName()`. URL 不匹配正则, 被当作 skill name 查找, 失败.
- `remove`: 通过 `detectArgFormat()` 判断, URL 返回 `'install-source'`, 被当作 plain skill name, 失败.

已有工具函数:
- `detectSourceType()` (`src/utils/source-detection.ts`): 能识别 URL, 但只分类不提取 owner/repo
- `detectArgFormat()` (`src/utils/repo-lookup.ts`): 对 URL 返回 `'install-source'`, 不可用

## Goals / Non-Goals

**Goals:**
- `uninstall` 和 `remove` 接受 Git URL(HTTPS/SSH), 自动提取 owner/repo, 路由到已有逻辑
- 支持 GitHub, GitLab 及其他标准 Git 托管平台的 URL
- 处理常见变体: 末尾斜杠, `.git` 后缀

**Non-Goals:**
- 不改变 `install` 命令的行为
- 不支持带深层路径的 URL(如 `https://github.com/owner/repo/tree/main/subdir`)
- 不支持非标准 Git URL 格式

## Decisions

### Decision 1: 新增 `extractOwnerRepo()` 共享函数

在 `src/utils/source-detection.ts` 中新增:

```typescript
export function extractOwnerRepo(input: string): string | null
```

逻辑:
1. 如果已匹配 `OWNER_REPO_PATTERN` → 直接去掉末尾斜杠返回
2. HTTPS URL → 解析 URL pathname, 取前两段作为 owner/repo
3. SSH URL (`git@host:owner/repo.git`) → 用正则提取 owner/repo
4. 去掉 `.git` 后缀
5. 无法提取 → 返回 null

**Rationale**: 放在 `source-detection.ts` 因为它是 source 格式识别的统一入口, 与 `detectSourceType()` 同层. 返回 `string | null` 而非抛异常, 让调用方决定如何处理失败.

### Decision 2: 修改 `detectArgFormat()` 使 URL 返回 `'owner-repo'`

当前 `detectArgFormat()` 对 URL 返回 `'install-source'`.  修改为: 如果 `extractOwnerRepo()` 能从输入中提取 owner/repo, 则返回 `'owner-repo'`.

这样 `remove` 命令无需改动自身逻辑, `detectArgFormat()` 自然将 URL 路由到 `removeByOwnerRepo()`.

### Decision 3: `uninstall` 命令在判断分支中增加 URL 处理

`executeUninstall()` 中, 在 `owner/repo` 正则匹配前, 先尝试 `extractOwnerRepo()`.  如果成功提取, 走 `uninstallSource()`.  这比修改正则更清晰, 也能复用共享函数.

### Decision 4: `remove` 命令通过 `detectArgFormat()` 间接支持

`remove` 的 `executeRemove()` 已经通过 `detectArgFormat()` 分流. 只要 Decision 2 生效, URL 会被正确识别为 `'owner-repo'`, 但需要在传给 `removeByOwnerRepo()` 前将 URL 转换为 owner/repo 字符串. 在分流处增加 `extractOwnerRepo()` 转换.

## Risks / Trade-offs

- **非标准 URL 提取失败** → 返回 null, 降级为当前行为(报 skill not found), 不会引入新的 breaking.
- **URL 提取出的 owner/repo 在本地不存在** → 已有逻辑会报 "not found in central repository", 无需额外处理.
