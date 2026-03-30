## Why

`install` 命令的逆操作不存在.  当前 `remove` 命令仅从项目中移除已部署的 skill, 但无法从中央仓库 (`~/.skills-manager/`) 清理 skill 文件和 `sources.json` 记录.  用户无法卸载不再需要的 skills, 导致磁盘空间浪费和列表膨胀.

## What Changes

- 新增 `uninstall` CLI 命令, 从中央仓库删除已安装的 skills
- 支持三种粒度:
  - Provider 级别: `skillsmgr uninstall anthropic` 删除该 provider 下所有 skills
  - Community source 级别: `skillsmgr uninstall owner/repo` 删除该 repo 下所有 skills
  - Skill 名称级别: `skillsmgr uninstall skill-name` 按名称搜索并删除单个 skill
- 删除前列出将被删除的 skills 并警告 symlink 部署可能失效
- 交互式确认, `--force` 跳过
- 删除文件后清理 `sources.json` (source 下无 skill 时移除 source 记录)
- 统一处理 official, community, custom 三种来源

## Capabilities

### New Capabilities
- `uninstall`: 从中央仓库删除已安装的 skills, 支持多种粒度(provider/source/skill), 交互确认, 清理 sources.json

### Modified Capabilities

## Impact

- 新增 `src/commands/uninstall.ts` 命令文件
- `src/index.ts` 注册新命令
- `SourcesService` 已有 `removeSource()` 方法可直接复用
- `SkillsService` 已有 `getAllSkills()` / `findSkillsByName()` 可复用
- 无破坏性变更, 纯新增功能
