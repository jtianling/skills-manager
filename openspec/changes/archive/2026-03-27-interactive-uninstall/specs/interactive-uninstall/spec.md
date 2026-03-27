## ADDED Requirements

### Requirement: 无参数时进入交互式卸载模式

`skillsmgr uninstall` 无参数执行时, 系统 SHALL 进入交互式卸载模式.  交互模式 SHALL 使用 `interactiveCheckbox` 展示中央仓库 (`~/.skills-manager/`) 中所有已安装 skill 的分组列表, 用户多选后批量卸载.

#### Scenario: 无参数进入交互模式
- **WHEN** 用户执行 `skillsmgr uninstall` (不带任何参数)
- **THEN** 系统进入交互式卸载模式, 展示已安装 skill 的分组选择列表

#### Scenario: 有参数走原逻辑
- **WHEN** 用户执行 `skillsmgr uninstall anthropic` (带参数)
- **THEN** 系统按现有逻辑执行, 不进入交互模式

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

删除 SHALL 逐个移除选中 skill 的目录.  每次删除后, 若 skill 的父目录 (provider/repo 级别) 变为空目录, SHALL 一并清除直到 source 根目录 (`official/`, `community/`, `custom/`).  同时 SHALL 清理 sources.json 中对应的条目.

#### Scenario: 删除单个 skill 后父目录仍有其他 skill
- **WHEN** 用户选择卸载 official/anthropic 下的 commit, 而 code-review 仍在
- **THEN** 仅删除 commit 目录, anthropic 目录保留

#### Scenario: 删除 provider 下所有 skill 后清理空目录
- **WHEN** 用户选择卸载 official/anthropic 下的所有 skill
- **THEN** 所有 skill 目录被删除后, anthropic 空目录被清除

#### Scenario: 清理 sources.json
- **WHEN** 删除操作导致某个 source 条目下不再有任何 skill
- **THEN** 该条目从 sources.json 中移除

### Requirement: 删除完成后输出结果

每个 skill 删除成功后 SHALL 输出确认信息.

#### Scenario: 删除输出
- **WHEN** 3 个 skill 被成功删除
- **THEN** 每个 skill 输出 "Removed: {skill-name}" 并在最后输出 "Uninstalled {n} skills."
