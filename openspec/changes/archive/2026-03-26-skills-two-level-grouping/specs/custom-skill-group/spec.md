## ADDED Requirements

### Requirement: custom-install --group 选项
`custom-install` 命令 SHALL 接受 `--group / -g` 选项, 指定 skill 安装到 `~/.skills-manager/custom/{group}/{name}/` 目录.

#### Scenario: 使用 --group 安装 custom skill
- **WHEN** 用户运行 `skillsmgr ci ./my-skill --group my-tools`, 且 `./my-skill/SKILL.md` 存在
- **THEN** 系统将 `./my-skill/` 复制到 `~/.skills-manager/custom/my-tools/my-skill/`, 输出成功消息

#### Scenario: 使用 -g 短选项安装
- **WHEN** 用户运行 `skillsmgr ci ./my-skill -g my-tools`
- **THEN** 行为与 `--group my-tools` 一致

#### Scenario: 不使用 --group 时保持现有行为
- **WHEN** 用户运行 `skillsmgr ci ./my-skill` (无 --group 选项)
- **THEN** 系统将 `./my-skill/` 复制到 `~/.skills-manager/custom/my-skill/`, 与现有行为一致

#### Scenario: --group 目录自动创建
- **WHEN** 用户使用 `--group my-tools`, 且 `~/.skills-manager/custom/my-tools/` 不存在
- **THEN** 系统自动创建 `my-tools/` 目录, 然后安装 skill

#### Scenario: --group 下已有同名 skill 时提示覆盖
- **WHEN** 用户运行 `skillsmgr ci ./abc --group my-tools`, 且 `~/.skills-manager/custom/my-tools/abc/` 已存在
- **THEN** 系统提示 "Skill 'abc' already exists in group 'my-tools'. Overwrite?" 并等待确认

#### Scenario: --group 下 --force 跳过确认
- **WHEN** 用户运行 `skillsmgr ci ./abc --group my-tools -f`
- **THEN** 系统不提示确认, 直接覆盖

### Requirement: custom 目录分组扫描
`getSkillsFromSource` 处理 custom 来源时 SHALL 区分无分组 skill 和分组目录.

#### Scenario: 含 SKILL.md 的一级子目录为无分组 skill
- **WHEN** `~/.skills-manager/custom/solo-skill/SKILL.md` 存在
- **THEN** 该 skill 的 source 为 "custom"

#### Scenario: 不含 SKILL.md 的一级子目录为分组目录
- **WHEN** `~/.skills-manager/custom/my-tools/` 存在且不含 SKILL.md, 但 `~/.skills-manager/custom/my-tools/tool-a/SKILL.md` 存在
- **THEN** tool-a 的 source 为 "custom/my-tools"

#### Scenario: 分组目录下无有效 skill
- **WHEN** `~/.skills-manager/custom/empty-group/` 存在且不含 SKILL.md, 且其子目录也不含 SKILL.md
- **THEN** 不返回任何 skill, 不报错

### Requirement: custom-update 适配分组路径
`custom-update` 命令 SHALL 支持更新分组目录下的 skill.

#### Scenario: 更新分组下的 custom skill
- **WHEN** 用户运行 `skillsmgr cu abc`, 且 `~/.skills-manager/custom/my-tools/abc/` 存在 (而 `~/.skills-manager/custom/abc/` 不存在)
- **THEN** 系统在分组路径下找到并更新该 skill

#### Scenario: 优先匹配无分组路径
- **WHEN** 用户运行 `skillsmgr cu abc`, 且 `~/.skills-manager/custom/abc/` 和 `~/.skills-manager/custom/my-tools/abc/` 都存在
- **THEN** 系统更新 `~/.skills-manager/custom/abc/` (无分组路径优先)
