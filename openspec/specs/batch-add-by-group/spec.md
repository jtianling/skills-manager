# Batch Add by Group

## Purpose
按组从中央仓库批量部署 skills 到项目.

## Requirements

### Requirement: 按组批量部署 skills

`add --group <name>` SHALL 从 `groups.json` 中查找指定 group 的所有 skill 引用并批量部署.

查找逻辑: 读取 `GroupsService.getGroup(name)`, 对每个 skill key 通过 `SkillsService.getAllSkills()` 查找对应 skill.

#### Scenario: 批量部署组内所有 skills

- **WHEN** groups.json 中 `dev` group 包含 3 个 skill key
- **AND** 用户执行 `skillsmgr add --group dev`
- **THEN** 展示这 3 个 skills 的选择列表
- **AND** 用户选择后部署到项目

#### Scenario: 组内无 skills

- **WHEN** groups.json 中不存在 `mygroup` 或该 group 为空数组
- **AND** 用户执行 `skillsmgr add --group mygroup`
- **THEN** 输出 "No skills found in group 'mygroup'."
- **AND** 以退出码 1 退出

#### Scenario: 组内部分 skills 已部署

- **WHEN** `dev` group 包含 3 个 skill, 其中 1 个已部署到项目
- **AND** 用户执行 `skillsmgr add --group dev`
- **THEN** 选择列表中已部署的 skill 预选且锁定

#### Scenario: --group 与 -g 可组合

- **WHEN** 用户执行 `skillsmgr add --group dev -g`
- **THEN** 批量查找 dev 组的 skills, 以全局模式部署

#### Scenario: group 内存在悬空引用

- **WHEN** `dev` group 包含 `custom/deleted-skill` 但该 skill 已不存在
- **AND** 用户执行 `skillsmgr add --group dev`
- **THEN** 跳过不存在的 skill, 输出警告 "Skill 'custom/deleted-skill' not found, skipping."
- **AND** 继续处理其余 skill

### Requirement: --group 不再透传给 install

`add --group` SHALL 不再将 group 参数传递给远程安装逻辑.  它仅用于从 groups.json 按组批量部署.

#### Scenario: --group 仅用于本地批量操作

- **WHEN** 用户执行 `skillsmgr add --group dev`
- **THEN** 不触发任何远程安装
- **AND** 仅从 groups.json 引用的已安装 skills 中查找
