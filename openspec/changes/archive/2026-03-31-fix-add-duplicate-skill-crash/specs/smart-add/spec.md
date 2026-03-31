## MODIFIED Requirements

### Requirement: 中央仓库搜索 skill 名称

按名称搜索中央仓库, 找到后让用户选择目标 agent 并部署.

#### Scenario: 找到单个匹配
- **WHEN** 中央仓库中只有一个名为 `code-review` 的 skill
- **THEN** 直接使用该 skill, 进入 agent 选择

#### Scenario: 找到多个匹配 (不同 source)
- **WHEN** 中央仓库中有多个名为 `code-review` 的 skill, 来自不同 source (如 `official/anthropic/skills` 和 `community/someuser/somerepo`)
- **THEN** 提示用户选择, 列表中显示 `{source}/{name}` 便于区分
- **AND** 用户选择后按 path 精确匹配对应 skill

#### Scenario: 找到多个匹配 (相同 source)
- **WHEN** 中央仓库中有多个名为 `jt-release` 的 skill, 来自相同 source 前缀 (如都在 `custom` 下)
- **THEN** 提示用户选择, 列表中显示包含父目录的完整路径便于区分
- **AND** 用户选择后按 path 精确匹配对应 skill

#### Scenario: 用户消歧义选择返回无效值
- **WHEN** 多匹配消歧义 prompt 返回了无法匹配到任何 skill 的值
- **THEN** 输出 "Failed to resolve skill selection."
- **AND** 以退出码 1 退出
- **AND** 不 crash

#### Scenario: 未找到匹配
- **WHEN** 中央仓库中没有名为 `xxx` 的 skill
- **THEN** 输出 "Skill 'xxx' not found in central repository.\nUse 'skillsmgr add owner/repo' or a full URL to install from remote."
- **AND** 以退出码 1 退出

## ADDED Requirements

### Requirement: 嵌套 custom skill source 保留父目录

`getSkillsFromSource` 扫描 `custom/` 目录时, 嵌套在子目录中的 skill SHALL 在 source 中保留父目录路径.

#### Scenario: 顶层 custom skill source
- **WHEN** `~/.skills-manager/custom/jt-release/SKILL.md` 存在
- **THEN** 该 skill 的 source SHALL 为 `"custom"`

#### Scenario: 嵌套 custom skill source 包含父目录
- **WHEN** `~/.skills-manager/custom/init-project/jt-release/SKILL.md` 存在
- **AND** `~/.skills-manager/custom/init-project/SKILL.md` 不存在
- **THEN** 该 skill 的 source SHALL 为 `"custom/init-project"`

#### Scenario: 嵌套 custom skill 与顶层同名时可区分
- **WHEN** 存在 `custom/jt-release` (source: `"custom"`) 和 `custom/init-project/jt-release` (source: `"custom/init-project"`)
- **THEN** 两个 skill 的 `{source}/{name}` 分别为 `"custom/jt-release"` 和 `"custom/init-project/jt-release"`, 互不相同
