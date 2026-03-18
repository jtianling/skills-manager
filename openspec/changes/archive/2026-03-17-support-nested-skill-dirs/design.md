## Context

当前 install 命令在两条路径 (GitHub API / git clone) 上扫描 skill 时, 只查找一层子目录:

- **GitHub API 路径**: `listSkills(path)` 返回 `path/` 下的子目录, 然后直接尝试 `{subdir}/SKILL.md`. 如果仓库结构为 `skills/{group}/{skill}/SKILL.md`, 则 `{group}/SKILL.md` 不存在, 所有 skill 被过滤掉.
- **Git clone 路径**: `getDirectoriesInDir(skillsRoot)` 只扫描一层. 且对非 anthropic 仓库不检查 `skills/` 子目录.

触发场景: `Weizhena/Deep-Research-skills` 仓库结构为 `skills/research-en/research/SKILL.md`, 两层嵌套导致安装失败.

## Goals / Non-Goals

**Goals:**

- GitHub API 路径和 git clone 路径都能发现嵌套在分组目录中的 skill
- 安装后的本地存储结构保持扁平: `~/.skills-manager/community/{repo}/{skill-name}/` (不保留分组层级)
- 对已有的扁平仓库结构无影响 (向后兼容)

**Non-Goals:**

- 不修改部署、同步、更新等下游逻辑
- 不支持无限深度递归 — 限制为最多 2 层子目录 (即 `skills/{group}/{skill}/SKILL.md`)
- 不改变 anthropic 专用路径的行为

## Decisions

### 1. GitHub API 路径: 对没有 SKILL.md 的子目录递归一层

当前逻辑: `listSkills()` 返回子目录列表 → 逐个检查 `{subdir}/SKILL.md`.

改为: 如果 `{subdir}/SKILL.md` 不存在, 再调用一次 `listSkills()` 获取 `{subdir}/` 的子目录, 检查每个子子目录的 SKILL.md.

```
skills/research-en/  → 无 SKILL.md → 展开为 [research, research-deep, ...]
  skills/research-en/research/SKILL.md  → ✓ 识别为 skill
```

这样每个分组目录最多多一次 API 调用. 不做通用递归, 只加一层.

**替代方案**: 使用 Git Tree API 一次性获取整棵目录树. 被否决 — 对大仓库返回数据量大, 且改动范围更大.

### 2. Git clone 路径: 统一检查 skills/ 子目录 + 递归扫描

两处修改:

a) 对所有仓库 (不只 anthropic) 检查 `skills/` 子目录:
```typescript
const skillsSubdir = join(repoPath, 'skills');
if (fileExists(skillsSubdir)) {
  skillsRoot = skillsSubdir;
}
```

b) 扫描函数从单层改为递归查找 SKILL.md, 但限制深度为 2:
```
scanForSkills(dir, maxDepth=2):
  for each subdir in dir:
    if subdir/SKILL.md exists → 收集为 skill
    else if depth > 0 → scanForSkills(subdir, maxDepth-1)
```

### 3. 安装存储结构保持扁平

无论嵌套多深, 安装后的本地路径都是 `{targetBase}/{skill-name}/`. 不保留分组目录结构.

对于 GitHub API 路径, `downloadSkill()` 已经是按 skill 名称存储, 不受影响.
对于 git clone 路径, 扫描到嵌套 skill 后使用其实际路径, 用户选择后移除未选中的, 保留的 skill 目录即为最终结构. 但需要将嵌套的 skill 移到 `{repoPath}/{skill-name}/` 扁平位置, 并清理空的分组目录.

## Risks / Trade-offs

- [额外 API 调用] → 每个分组目录多一次 contents API 请求. 对于无 token 的 60 req/hour 限制, 如果仓库分组很多可能触发 rate limit. → 缓解: 这是安装时一次性操作, 且大多数仓库分组数量有限.
- [Git clone 扁平化移动] → 需要将嵌套 skill 移到上层目录, 存在文件名冲突风险 (不同分组中有同名 skill). → 缓解: 同名 skill 冲突在 SkillsService 层已有处理, 安装时跳过同名即可.
