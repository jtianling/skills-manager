## Context

`add owner/repo --skill <name>` 的 owner/repo 路由分两个分支:
1. 本地中央仓库有该 repo → `handleRepoSkillSelection()` 直接从本地 skill 列表选择部署
2. 本地无该 repo → `handleRemoteInstallAndDeploy()` 从远程克隆安装后部署

问题出在分支 1: 当 repo 已部分安装 (如只装了 skill-a, skill-b), 用户用 `--skill` 指定一个未安装的 skill-c 时, `handleRepoSkillSelection` 的 `allDeployed` 检查只看本地已安装 skill 是否全部已部署, 完全忽略 `--skill` 参数, 导致错误短路.

## Goals / Non-Goals

**Goals:**
- `--skill` 指定的 skill 不在本地时, 自动回退到远程安装流程
- `allDeployed` 短路检查在有 `--skill` 时只检查指定 skill 的部署状态

**Non-Goals:**
- 不改变无 `--skill` 时的默认流程
- 不改变远程安装流程 (`handleRemoteInstallAndDeploy`) 的内部逻辑

## Decisions

### Decision 1: 在 `handleOwnerRepo` 中增加 missing skill 检测

在进入 `handleRepoSkillSelection` 之前, 检查 `--skill` 指定的 skill 是否都在本地 `repoSkills` 中. 有缺失时回退到 `handleRemoteInstallAndDeploy`.

**为什么不在 `handleRepoSkillSelection` 内部处理**: `handleRepoSkillSelection` 只处理本地已有的 skill, 让它发起远程安装会破坏职责边界.  在路由层 (`handleOwnerRepo`) 决定走哪个分支更清晰.

**为什么不拆分 "安装缺失 + 部署本地已有"**: 增加复杂度且边界情况多 (如缺失 skill 安装失败时的回滚).  直接走 `handleRemoteInstallAndDeploy` 已经内置了完整的安装→部署流程, 且 `--skill` 参数会穿透到安装阶段只安装指定的 skill.

### Decision 2: `allDeployed` 检查尊重 `--skill` 参数

当 `--skill` 指定的 skill 都在本地且都已部署时, 应该提示 "Selected skills are already deployed." 而非 "All skills from this source are already deployed.".

实现方式: 有 `--skill` 时, 先过滤 `repoSkills` 到指定的 skill, 再执行 `allDeployed` 检查, 消息也改为更精确的表述.

## Risks / Trade-offs

- [风险] `handleRemoteInstallAndDeploy` 重新克隆时会覆盖本地已安装的 skill → 已有的安装逻辑会处理覆盖, 不会丢失数据
- [风险] `--skill` 指定的 skill 在远程也不存在 → 现有 `filterSkillsByFlag` 会在安装阶段报 "Skill 'xxx' not found." 并 exit(1), 行为合理
