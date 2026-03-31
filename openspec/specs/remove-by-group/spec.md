# Remove by Group

remove 命令的 --group 支持, 交互列表分组显示, 以及移除后的 group 引用清理.

## Requirements

### Requirement: remove --group 批量移除
`remove --group <name>` SHALL 从 `groups.json` 中查找指定 group 的 skill 引用, 筛选出已部署的 skill, 展示交互列表供用户选择后批量移除.

#### Scenario: 按组批量移除已部署 skills
- **WHEN** groups.json 中 `dev` group 包含 3 个 skill key, 其中 2 个已部署到当前项目
- **AND** 用户执行 `skillsmgr remove --group dev`
- **THEN** 展示包含这 2 个已部署 skill 的选择列表
- **AND** 用户选择后移除选中的 skill

#### Scenario: 组不存在
- **WHEN** 用户执行 `skillsmgr remove --group nonexistent`
- **AND** groups.json 中不存在 `nonexistent` group
- **THEN** 输出 "Group 'nonexistent' not found."
- **AND** 以退出码 1 退出

#### Scenario: 组内无已部署 skill
- **WHEN** groups.json 中 `dev` group 有 skill 引用但均未部署到当前项目
- **AND** 用户执行 `skillsmgr remove --group dev`
- **THEN** 输出 "No deployed skills found in group 'dev'."
- **AND** 以退出码 1 退出

#### Scenario: --group 与 --all 组合
- **WHEN** 用户执行 `skillsmgr remove --group dev --all`
- **THEN** 不弹出交互列表, 直接移除 dev 组内所有已部署 skill

#### Scenario: --group 与 -y 组合
- **WHEN** 用户执行 `skillsmgr remove --group dev -y`
- **THEN** 行为等同于 `--group dev --all`

#### Scenario: --group 与 -g 组合
- **WHEN** 用户执行 `skillsmgr remove --group dev -g`
- **THEN** 从全局 agent 目录中移除 dev 组内 skill

#### Scenario: --group 与 skill 名参数互斥
- **WHEN** 用户执行 `skillsmgr remove some-skill --group dev`
- **THEN** 输出错误信息 "Cannot use --group with skill name argument."
- **AND** 以退出码 1 退出

### Requirement: remove 交互列表按虚拟 group 分组
`remove` 的默认交互模式 (无参数) SHALL 按虚拟 group 分组显示已部署 skill.  使用 `interactiveCheckbox` 的 `subGroup` 机制实现可折叠和批量选中.

#### Scenario: 按虚拟 group 分组显示
- **WHEN** 用户执行 `skillsmgr remove` (无参数)
- **AND** 已部署 skill 分属 `jt-tools` 和 `openspec` 两个虚拟 group
- **THEN** 交互列表按 group 分段显示, 每个 group 有可折叠的 header
- **AND** 未入组的 skill 显示在 `(ungrouped)` 分组下

#### Scenario: 无虚拟 group 时扁平显示
- **WHEN** 用户执行 `skillsmgr remove` (无参数)
- **AND** `groups.json` 为空或不存在
- **THEN** 所有已部署 skill 直接扁平显示, 无 subGroup header

#### Scenario: group header 批量选中
- **WHEN** 用户在 group header 上按 Space
- **THEN** 该 group 下所有 skill 被批量选中或取消 (复用 interactiveCheckbox 现有行为)

#### Scenario: 多 group 归属时 skill 只出现一次
- **WHEN** 一个 skill 同时属于 `jt-tools` 和 `openspec` 两个 group
- **THEN** 该 skill 只在第一个匹配的 group 下显示一次

### Requirement: remove 后清理 group 引用
`remove` 命令移除 skill 后 SHALL 调用 `GroupsService.removeSkillFromAll()` 清理 `groups.json` 中的引用.

#### Scenario: 移除后清理 group 引用
- **WHEN** 用户通过 `remove` 移除了 skill `jt-codex`
- **AND** `jt-codex` 的 skill key 为 `custom/jt-codex`
- **AND** `custom/jt-codex` 存在于 `jt-tools` group 中
- **THEN** `groups.json` 中 `jt-tools` group 不再包含 `custom/jt-codex`

#### Scenario: 全局移除后也清理引用
- **WHEN** 用户通过 `remove -g` 全局移除了 skill
- **THEN** 同样清理 `groups.json` 中对应的引用

#### Scenario: skill 无 group 引用时不报错
- **WHEN** 用户移除的 skill 不在任何 group 中
- **THEN** 清理操作静默通过, 不报错
