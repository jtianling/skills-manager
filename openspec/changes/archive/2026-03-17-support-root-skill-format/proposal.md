## Why

部分社区 skill 仓库将 SKILL.md 直接放在仓库根目录 (如 `199-biotechnologies/claude-deep-research-skill`), 代表整个仓库就是一个 skill.  当前 install 命令只能识别仓库内有子目录结构的 skill (每个子目录包含 SKILL.md), 无法安装这种 "根目录 skill" 仓库, 导致安装失败并报 "No skills or commands found".

## What Changes

- install 命令在 GitHub API 路径和 git clone 路径中增加对根目录 SKILL.md 的检测: 当仓库内未发现子目录形式的 skill 时, 检查根目录是否存在 SKILL.md, 若存在则将整个仓库视为单个 skill
- 根目录 skill 的 name 优先从 SKILL.md frontmatter 的 name 字段获取, fallback 为仓库名
- 存储结构: 将整个仓库内容下载/克隆到 `~/.skills-manager/{source}/{repo}/{skill-name}/` 目录下, 保持与现有约定一致
- update 命令同样需要支持对根目录 skill 仓库的检测和更新

## Capabilities

### New Capabilities

(无新增独立能力)

### Modified Capabilities

- `skill-lifecycle`: 增加根目录 SKILL.md 仓库的识别和安装流程, 扩展 skill 发现逻辑
- `source-management`: update 流程需要支持根目录 skill 仓库的检测和更新

## Impact

- `src/commands/install.ts`: `installFromGitHubUrl()` 和 `installViaGitClone()` 需要增加根目录 SKILL.md 检测逻辑
- `src/services/github.ts`: `GitHubService` 可能需要新增检查根目录文件的方法
- `src/commands/update.ts`: update 逻辑需要适配根目录 skill 结构
- 不影响已安装 skill 的部署、同步、移除等下游操作, 因为存储后的目录结构与现有格式一致
