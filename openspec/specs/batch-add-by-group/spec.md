# Batch Add by Group

按组从中央仓库批量部署 skills 到项目.

## Requirements

### Requirement: 按组批量部署 skills

`add --group <name>` SHALL 从中央仓库中查找 `custom/<name>` 组下的所有 skills 并批量部署.

查找逻辑: 从 `SkillsService.getAllSkills()` 中过滤 `source` 以 `custom/<name>` 开头的 skill.

#### Scenario: 批量部署组内所有 skills

- **WHEN** 中央仓库 `custom/dev/` 下有 skill-a, skill-b, skill-c
- **AND** 用户执行 `skillsmgr add --group dev`
- **THEN** 展示这 3 个 skills 的选择列表
- **AND** 用户选择后部署到项目

#### Scenario: 组内无 skills

- **WHEN** 中央仓库中不存在 `custom/mygroup/` 或该组下无 skills
- **AND** 用户执行 `skillsmgr add --group mygroup`
- **THEN** 输出 "No skills found in group 'mygroup'."
- **AND** 以退出码 1 退出

#### Scenario: 组内部分 skills 已部署

- **WHEN** `custom/dev/` 下有 3 个 skills, 其中 1 个已部署到项目
- **AND** 用户执行 `skillsmgr add --group dev`
- **THEN** 选择列表中已部署的 skill 预选且锁定

#### Scenario: --group 与 -g 可组合

- **WHEN** 用户执行 `skillsmgr add --group dev -g`
- **THEN** 批量查找 dev 组的 skills, 以全局模式部署

### Requirement: --group 不再透传给 install

`add --group` SHALL 不再将 group 参数传递给远程安装逻辑.  它仅用于从中央仓库按组批量部署.

#### Scenario: --group 仅用于本地批量操作

- **WHEN** 用户执行 `skillsmgr add --group dev`
- **THEN** 不触发任何远程安装
- **AND** 仅从中央仓库已安装的 skills 中查找
