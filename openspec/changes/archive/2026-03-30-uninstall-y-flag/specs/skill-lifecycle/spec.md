## ADDED Requirements

### Requirement: uninstall -y 作为 --all --force 的快捷方式

`uninstall` 命令 SHALL 支持 `-y` flag, 语义等同于 `--all --force`.  传入 `-y` 时跳过选择提示和确认提示, 直接卸载所有匹配 skills.

#### Scenario: uninstall owner/repo -y 卸载所有关联 skills
- **WHEN** 中央仓库中 official/anthropic/skills/ 下有 skill-a, skill-b, skill-c
- **AND** 用户执行 `skillsmgr uninstall anthropics/skills -y`
- **THEN** skill-a, skill-b, skill-c 全部被删除
- **AND** 输出包含 "Uninstalled 3 skills from anthropics/skills"
- **AND** 不出现任何交互式提示

#### Scenario: uninstall owner/repo -y 不影响其他来源的 skills
- **WHEN** 中央仓库中有 official/anthropic/skills/ 下的 skills 和 custom/my-skill
- **AND** 用户执行 `skillsmgr uninstall anthropics/skills -y`
- **THEN** official/anthropic/skills/ 下的 skills 全部被删除
- **AND** custom/my-skill 保持不变

#### Scenario: uninstall skill-name -y 跳过确认
- **WHEN** 中央仓库中有名为 "pdf" 的 skill
- **AND** 用户执行 `skillsmgr uninstall pdf -y`
- **THEN** pdf skill 被删除
- **AND** 不出现确认提示

#### Scenario: -y 与 --all 和 -f 可自由组合
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills -y --all -f`
- **THEN** 行为与单独使用 `-y` 完全相同, 不报错
