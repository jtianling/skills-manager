# Install Directory Batch

本地目录批量安装: 当目标目录无 SKILL.md 但子目录含 skills 时, 批量安装并自动创建虚拟 group.

## Requirements

### Requirement: 本地目录批量安装
当 `install` 的本地路径目标无 SKILL.md 但其子目录中包含 skills 时, 系统 SHALL 将该目录视为 skill 集合, 批量安装所有子目录中的 skills.

#### Scenario: 目录无 SKILL.md 但子目录有 skills
- **WHEN** 用户执行 `skillsmgr install ./openspec`, 且 `./openspec/SKILL.md` 不存在
- **AND** `./openspec/` 下有子目录 `openspec-explore/SKILL.md`, `openspec-ff-change/SKILL.md` 等
- **THEN** 系统扫描 `./openspec/` 子目录, 找到所有包含 SKILL.md 的目录
- **AND** 提示用户选择要安装的 skills (与 git/zip 安装的选择交互一致)

#### Scenario: 目录无 SKILL.md 且子目录也无 skills
- **WHEN** 用户执行 `skillsmgr install ./empty-dir`, 且 `./empty-dir/SKILL.md` 不存在
- **AND** `./empty-dir/` 子目录中也无 SKILL.md
- **THEN** 系统 SHALL 报错 "No skills found in ./empty-dir"

#### Scenario: 目录有 SKILL.md 时保持现有行为
- **WHEN** 用户执行 `skillsmgr install ./my-skill`, 且 `./my-skill/SKILL.md` 存在
- **THEN** 系统 SHALL 按现有单 skill 安装逻辑处理, 不扫描子目录

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

### Requirement: 批量安装自动创建虚拟 group
批量安装 SHALL 自动创建以源目录名命名的虚拟 group, 并将所有安装的 skills 加入该 group.  `--group` 选项 SHALL 覆盖自动命名, 但不影响物理存储路径.

#### Scenario: 自动创建 group
- **WHEN** 用户执行 `skillsmgr install ./openspec`, 安装了 3 个 skills
- **THEN** groups.json 中 SHALL 新增 `"openspec"` group, 包含 3 个 skill key

#### Scenario: --group 覆盖自动命名
- **WHEN** 用户执行 `skillsmgr install ./openspec --group tools`
- **THEN** groups.json 中 SHALL 新增 `"tools"` group (不是 `"openspec"`)
- **AND** 物理存储路径仍为 `custom/openspec/{skillName}/`

#### Scenario: group 已存在时追加
- **WHEN** 用户执行 `skillsmgr install ./openspec`, 且 `"openspec"` group 已存在并包含其他 skills
- **THEN** 新安装的 skills SHALL 追加到现有 group, 不覆盖已有引用

### Requirement: 批量安装支持 --all, --skill, --force 选项
批量安装 SHALL 复用现有 `selectSkills` 逻辑, 支持与 git/zip 安装一致的选项.

#### Scenario: --all 跳过选择
- **WHEN** 用户执行 `skillsmgr install ./openspec --all`
- **THEN** 系统 SHALL 安装目录下所有 skills, 不弹出选择交互

#### Scenario: --skill 指定安装
- **WHEN** 用户执行 `skillsmgr install ./openspec --skill openspec-explore --skill openspec-ff-change`
- **THEN** 系统 SHALL 只安装指定的两个 skills

#### Scenario: --force 覆盖已有
- **WHEN** 用户执行 `skillsmgr install ./openspec --force`, 且部分 skills 已安装
- **THEN** 系统 SHALL 覆盖已存在的 skills, 不弹出确认

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
