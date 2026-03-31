## MODIFIED Requirements

### Requirement: 批量安装物理存储到子目录
批量安装的 skills SHALL 存储到 `custom/{dirName}/{skillName}/`, 其中 `dirName` 为源目录的 basename.  即使 `custom/` 下已存在同名 skill, 批量安装 SHALL 仍安装到 `custom/{dirName}/{skillName}/`, 不重定向到已有路径.

#### Scenario: 批量安装存储路径
- **WHEN** 用户执行 `skillsmgr install ./openspec`, 选择安装 openspec-explore 和 openspec-ff-change
- **THEN** skills 存储到 `~/.skills-manager/custom/openspec/openspec-explore/` 和 `~/.skills-manager/custom/openspec/openspec-ff-change/`

#### Scenario: skill key 包含子目录
- **WHEN** 批量安装 `openspec-explore` 到 `custom/openspec/openspec-explore/`
- **THEN** skill key SHALL 为 `custom/openspec/openspec-explore`, 包含子目录前缀

#### Scenario: 同名 skill 共存
- **WHEN** `custom/jt-codex/` 已存在 (之前单独安装的)
- **AND** 用户执行 `skillsmgr install ./develop`, develop/ 下包含 jt-codex
- **THEN** jt-codex SHALL 安装到 `custom/develop/jt-codex/`, 不影响 `custom/jt-codex/`
- **AND** source key 为 `custom/develop/jt-codex`, 与 `custom/jt-codex` 不冲突

### Requirement: 批量安装已有 skill 检测
批量安装 SHALL 通过检查目标路径 `custom/{dirName}/{skillName}/` 是否存在来判断 skill 是否已安装, 不使用 bare name 全局查找.

#### Scenario: 目标路径不存在
- **WHEN** 用户执行 `skillsmgr install ./develop`, develop/ 下包含 jt-codex
- **AND** `custom/develop/jt-codex/` 不存在 (即使 `custom/jt-codex/` 存在)
- **THEN** jt-codex SHALL 视为未安装, 在选择交互中不标记为 installed

#### Scenario: 目标路径已存在
- **WHEN** 用户执行 `skillsmgr install ./develop`, develop/ 下包含 jt-codex
- **AND** `custom/develop/jt-codex/` 已存在
- **THEN** jt-codex SHALL 视为已安装, 在选择交互中标记为 installed
- **AND** 用户选择安装时触发 overwrite 确认

#### Scenario: 全部已安装在目标路径
- **WHEN** 用户执行 `skillsmgr install ./develop`, develop/ 下所有 skills 在 `custom/develop/` 下都已存在
- **THEN** 系统 SHALL 显示 "All N skills already installed."
