## ADDED Requirements

### Requirement: owner/repo 参数时进入 scoped 交互模式

`skillsmgr uninstall owner/repo` 执行时, 系统 SHALL 定位该 source 目录 (依次查找 `official/{owner}/{repo}` 和 `community/{owner}/{repo}`), 扫描其下所有 skill, 然后进入交互式 checkbox 让用户选择卸载哪些.

#### Scenario: owner/repo 进入 scoped 交互
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills`, 且 `official/anthropics/skills` 下有 commit, code-review, simplify 三个 skill
- **THEN** 系统展示交互式 checkbox 列出这 3 个 skill, 用户选择后确认再执行删除

#### Scenario: owner/repo 优先查找 official 再 community
- **WHEN** 用户执行 `skillsmgr uninstall foo/bar`
- **THEN** 系统先查找 `official/foo/bar`, 不存在时查找 `community/foo/bar`

#### Scenario: owner/repo 不存在时报错
- **WHEN** 用户执行 `skillsmgr uninstall unknown/repo`, 且 official 和 community 下均无该目录
- **THEN** 系统输出错误信息并退出

### Requirement: --all 跳过交互直接批量删除

`uninstall owner/repo --all` 执行时, 系统 SHALL 跳过交互式 checkbox, 直接删除该 source 下所有 skills (即原行为).

#### Scenario: --all 跳过交互
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills --all`
- **THEN** 系统不展示 checkbox, 列出所有 skill 后直接走确认流程

#### Scenario: --all 配合 --force 完全非交互
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills --all -f`
- **THEN** 系统不展示 checkbox 也不确认, 直接删除所有 skills

### Requirement: 单个 skill 时跳过 checkbox

当 scoped 范围内仅有 1 个 skill 时, 系统 SHALL 跳过 checkbox, 直接走确认删除流程.

#### Scenario: 单 skill 跳过 checkbox
- **WHEN** 用户执行 `skillsmgr uninstall owner/repo`, 且该 source 下只有 1 个 skill
- **THEN** 系统跳过 checkbox, 直接显示该 skill 并要求确认

### Requirement: scoped 交互使用 promptSkillsToUninstall

scoped 交互模式 SHALL 复用 `promptSkillsToUninstall()` 展示 skill 选择列表, 传入的 skills 仅为该 source scope 内的 skills.

#### Scenario: scoped 列表只显示该 source 的 skills
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills`, 中央仓库还有 community 下的其他 skills
- **THEN** checkbox 仅列出 anthropics/skills 下的 skills, 不显示其他 source 的 skills

## MODIFIED Requirements

### Requirement: 有参数走原逻辑

`skillsmgr uninstall` 有参数时, 系统 SHALL 按以下逻辑路由: `owner/repo` 格式进入 scoped 交互模式, 其他裸词按 skill name 查找.  不再有 provider shorthand 分支.

#### Scenario: 有参数 owner/repo 走 scoped 交互
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills`
- **THEN** 进入 scoped 交互模式, 展示该 source 下的 skills

#### Scenario: 有参数裸词走 skill name 查找
- **WHEN** 用户执行 `skillsmgr uninstall commit`
- **THEN** 按 skill name 查找并卸载, 不走 provider 分支

## REMOVED Requirements

### Requirement: 有参数执行直接卸载
**Reason**: 移除 provider shorthand 分支, `owner/repo` 改为 scoped 交互模式而非直接卸载
**Migration**: 原 `uninstall anthropic` 改用 `uninstall anthropics/skills --all`; 原 `uninstall owner/repo` 现在默认交互, 加 `--all` 恢复原行为
