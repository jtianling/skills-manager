## MODIFIED Requirements

### Requirement: install --group 自动入组
`install` 命令 SHALL 接受 `--group <name>` 选项.  安装完成后, 系统 SHALL 自动将已安装 skill 的 source key 添加到指定虚拟 group 中.  group 不存在时自动创建.  安装目标路径不受 `--group` 影响 (始终按来源类型决定路径).  批量安装本地目录时, 若未指定 `--group`, 系统 SHALL 自动使用源目录名作为 group 名.

#### Scenario: install 本地 skill 并入组
- **WHEN** 用户执行 `skillsmgr install ./my-linter --group python`
- **THEN** skill 安装到 `custom/my-linter/` (不受 group 影响)
- **AND** `custom/my-linter` 被添加到 groups.json 的 python group

#### Scenario: install 远程 skill 并入组
- **WHEN** 用户执行 `skillsmgr install anthropic --group python`
- **THEN** skill 安装到 `official/anthropic/skills/` 下
- **AND** 每个安装的 skill key 被添加到 python group

#### Scenario: --group 指定的 group 不存在时自动创建
- **WHEN** 用户执行 `skillsmgr install ./my-linter --group new-group`, 且 new-group 不存在
- **THEN** 安装 skill, 自动创建 new-group, 并添加 skill 到该 group

#### Scenario: 批量安装自动使用目录名作为 group
- **WHEN** 用户执行 `skillsmgr install ./openspec` (批量安装, 未指定 --group)
- **THEN** 系统自动使用 "openspec" 作为 group 名
- **AND** 所有安装的 skills 被添加到 "openspec" group

#### Scenario: 批量安装 --group 覆盖目录名
- **WHEN** 用户执行 `skillsmgr install ./openspec --group tools`
- **THEN** 系统使用 "tools" 作为 group 名, 不创建 "openspec" group
