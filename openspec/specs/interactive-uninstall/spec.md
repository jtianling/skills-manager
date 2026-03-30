# Interactive Uninstall

`skillsmgr uninstall` 无参数时的交互式批量卸载模式.

## Requirements

### Requirement: 无参数时进入交互式卸载模式

`skillsmgr uninstall` 无参数执行时, 系统 SHALL 进入交互式卸载模式.  交互模式 SHALL 使用 `interactiveCheckbox` 展示中央仓库 (`~/.skills-manager/`) 中所有已安装 skill 的分组列表, 用户多选后批量卸载.

#### Scenario: 无参数进入交互模式
- **WHEN** 用户执行 `skillsmgr uninstall` (不带任何参数)
- **THEN** 系统进入交互式卸载模式, 展示已安装 skill 的分组选择列表

### Requirement: 有参数走原逻辑

`skillsmgr uninstall` 有参数时, 系统 SHALL 按以下逻辑路由: `owner/repo` 格式进入 scoped 交互模式, 其他裸词按 skill name 查找.  不再有 provider shorthand 分支.

#### Scenario: 有参数 owner/repo 走 scoped 交互
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills`
- **THEN** 进入 scoped 交互模式, 展示该 source 下的 skills

#### Scenario: 有参数裸词走 skill name 查找
- **WHEN** 用户执行 `skillsmgr uninstall commit`
- **THEN** 按 skill name 查找并卸载, 不走 provider 分支

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

### Requirement: 交互列表使用与 init 一致的分组逻辑

交互式卸载列表 SHALL 使用与 `init` 命令 skill 选择完全一致的分组结构: 按 `parseSource()` 解析 skill.source, group 为 category (official/community/custom), subGroup 为 groupId (provider 名或 owner/repo).

#### Scenario: 分组结构与 init 一致
- **WHEN** 中央仓库有 official/anthropic 下的 commit 和 code-review, 以及 community/owner/repo 下的 my-skill
- **THEN** 列表显示: official 分组下 anthropic group-header 包含 commit 和 code-review; community 分组下 owner/repo group-header 包含 my-skill

### Requirement: 默认全部不勾选

交互式卸载列表中所有 skill SHALL 默认不勾选 (`checked: false`).

#### Scenario: 全部不勾选
- **WHEN** 交互列表展示后
- **THEN** 所有 skill 项均为未勾选状态

### Requirement: 无后缀标记

交互式卸载列表中的 skill SHALL 不带任何 suffix (无 `[deployed]` 等标记).

#### Scenario: 无后缀
- **WHEN** 交互列表展示后
- **THEN** 所有 skill 项均无后缀文字

### Requirement: 中央仓库为空时提示退出

当 `getAllSkills()` 返回空数组时, 系统 SHALL 输出提示信息并退出, 不展示交互列表.

#### Scenario: 无已安装 skill
- **WHEN** 用户执行 `skillsmgr uninstall` 且中央仓库无任何已安装 skill
- **THEN** 系统输出 "No installed skills found." 并退出

### Requirement: 未选择任何 skill 时退出

当用户在交互列表中未勾选任何 skill 就按 Enter 确认时, 系统 SHALL 输出提示并退出, 不执行任何删除操作.

#### Scenario: 未选择直接确认
- **WHEN** 用户在交互列表中未勾选任何项, 直接按 Enter
- **THEN** 系统输出 "No skills selected." 并退出

### Requirement: 选择后确认再执行删除

用户选择 skill 后, 系统 SHALL 列出将要卸载的 skill 名称, 显示 symlink 破坏警告, 并要求用户确认.  确认后执行删除, 拒绝则退出.

#### Scenario: 确认后执行删除
- **WHEN** 用户选择了 3 个 skill 并按 Enter, 然后在确认提示中输入 y
- **THEN** 系统列出 3 个 skill 名称, 显示警告, 然后逐个删除

#### Scenario: 拒绝则退出
- **WHEN** 用户选择了 skill 并按 Enter, 然后在确认提示中输入 n
- **THEN** 系统不执行任何删除操作, 直接退出

### Requirement: 逐个删除 skill 目录并清理空父目录

删除 SHALL 逐个移除选中 skill 的目录.  每次删除后, 若 skill 的父目录 (provider/repo 级别) 变为空目录, SHALL 一并清除直到 source 根目录 (`official/`, `community/`, `custom/`).  同时 SHALL 清理 sources.json 中对应的条目, 以及 groups.json 中所有引用该 skill 的条目.

#### Scenario: 删除单个 skill 后父目录仍有其他 skill
- **WHEN** 用户选择卸载 official/anthropic 下的 commit, 而 code-review 仍在
- **THEN** 仅删除 commit 目录, anthropic 目录保留

#### Scenario: 删除 provider 下所有 skill 后清理空目录
- **WHEN** 用户选择卸载 official/anthropic 下的所有 skill
- **THEN** 所有 skill 目录被删除后, anthropic 空目录被清除

#### Scenario: 清理 sources.json
- **WHEN** 删除操作导致某个 source 条目下不再有任何 skill
- **THEN** 该条目从 sources.json 中移除

#### Scenario: 清理 groups.json 引用
- **WHEN** 卸载 skill `official/anthropic/skills/commit`, 且该 skill 存在于 python 和 rust 两个 group 中
- **THEN** 系统 SHALL 调用 `GroupsService.removeSkillFromAll("official/anthropic/skills/commit")`, 从两个 group 中移除引用

### Requirement: 删除完成后输出结果

每个 skill 删除成功后 SHALL 输出确认信息.

#### Scenario: 删除输出
- **WHEN** 3 个 skill 被成功删除
- **THEN** 每个 skill 输出 "Removed: {skill-name}" 并在最后输出 "Uninstalled {n} skills."
