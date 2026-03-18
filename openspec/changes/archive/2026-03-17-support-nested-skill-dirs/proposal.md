## Why

部分 GitHub 仓库将 skills 组织为分组结构 (如 `skills/{group}/{skill-name}/SKILL.md`), 而非扁平结构 (如 `skills/{skill-name}/SKILL.md`).  当前代码只查找一层子目录, 导致这类仓库的 GitHub API 安装和 git clone 安装都报 "No skills or commands found".  例如 `Weizhena/Deep-Research-skills` 仓库的结构为 `skills/research-en/research/SKILL.md`.

## What Changes

- GitHub API 路径: `listSkills()` 返回的子目录如果没有 SKILL.md, 递归检查其子目录是否包含 skill
- Git clone 路径: 非 anthropic 仓库也检查 `skills/` 子目录; 扫描逻辑支持多层嵌套目录查找 SKILL.md
- 两条路径统一行为: 无论 API 还是 clone, 对相同仓库结构产生相同的安装结果

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `source-management`: install 命令的 skill 发现逻辑变更 — 支持嵌套目录结构中的 SKILL.md 查找

## Impact

- `src/commands/install.ts`: GitHub API 路径和 git clone 路径的 skill 扫描逻辑
- `src/services/github.ts`: `listSkills()` 可能需要支持递归或返回更深层级的结果
- 不涉及部署、同步等下游逻辑 — 安装后的存储结构不变
