## Why

`add owner/repo --skill <name>` 在 repo 已部分安装到中央仓库时, 会错误地短路返回 "All skills from this source are already deployed.", 完全忽略 `--skill` 参数.  根因是 `handleRepoSkillSelection` 的 `allDeployed` 检查只看本地已安装的 skill 是否全部已部署, 不考虑用户请求的 skill 是否在本地存在.

## What Changes

- `handleOwnerRepo()` 在本地 repo 存在时, 增加检查: 如果 `--skill` 指定的 skill 不在本地 `repoSkills` 中, 回退到远程安装流程 (`handleRemoteInstallAndDeploy`)
- `handleRepoSkillSelection()` 的 `allDeployed` 短路检查改为: 有 `--skill` 时只检查指定的 skill 是否已部署, 而非检查全部本地 skill

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `smart-add`: 修复 `--skill` 指定的 skill 不在本地中央仓库时被错误短路的行为, 补充缺失的 scenario

## Impact

- 文件: `src/commands/add.ts` — `handleOwnerRepo()` 和 `handleRepoSkillSelection()` 函数
- 现有行为: 不指定 `--skill` 时的默认流程不受影响
- 测试: 需要新增测试覆盖 "repo 已部分安装 + --skill 指定未安装 skill" 的场景
