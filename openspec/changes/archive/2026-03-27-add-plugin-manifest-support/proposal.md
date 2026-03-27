## Why

当前 skillsmgr 从 Git 仓库发现 skills 时, 只做简单的目录递归扫描(maxDepth=2~3).  这导致无法识别采用 plugin manifest 组织结构的仓库(如 `microsoft/skills`), 该仓库通过 `.claude-plugin/marketplace.json` 声明 7 个 plugin, 每个 plugin 下有各自的 `skills/` 目录, 总计 175 个 skills, 但 skillsmgr 只能找到顶层 `.github/skills/` 下的 9 个.  `npx skills` (vercel-labs/skills CLI) 已实现了 plugin manifest 发现机制, skillsmgr 需要对齐这个能力.

## What Changes

- 新增 plugin manifest 解析模块, 支持读取 `.claude-plugin/marketplace.json`(多 plugin 目录)和 `.claude-plugin/plugin.json`(单 plugin)
- 修改 Git clone 安装流程中的 skill 发现逻辑, 在递归扫描前先尝试通过 manifest 发现 skills
- manifest 声明的路径需要做安全校验(防止路径穿越)

## Capabilities

### New Capabilities
- `plugin-manifest`: 解析 `.claude-plugin/marketplace.json` 和 `.claude-plugin/plugin.json`, 从 plugin manifest 中发现 skill 目录路径

### Modified Capabilities

## Impact

- `src/commands/install-git.ts`: `collectGitCloneSkills` 和 `findRepoSkills` 需要集成 manifest 发现逻辑
- `src/commands/install-utils.ts`: `scanSkillDirectories` 可作为 manifest 发现后的扫描工具复用
- 新增模块: plugin manifest 解析服务
- 无 breaking changes, 纯增量功能
