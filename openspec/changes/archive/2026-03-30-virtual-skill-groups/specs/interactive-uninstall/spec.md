## MODIFIED Requirements

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
