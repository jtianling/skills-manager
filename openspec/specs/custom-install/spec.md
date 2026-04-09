# Custom Install

从当前工作目录安装本地 skill 到 `~/.skills-manager/custom/` 目录.

## Requirements

### Requirement: Overwrite confirmation for existing skill
install 命令 SHALL 使用 `findInstalledCustomSkill(skillName)` 检测 skill 是否已安装, 替代直接检查目标目录路径是否存在.  当 skill 已安装时, 系统 SHALL 按照已记录 source URL 与当前 install 路径是否一致区分处理:

- **相同 URL** (归一化后 `normalizeLocalPath(info.url) === normalizeLocalPath(skillDir)`): 视为重新安装同一位置, 提示 overwrite 确认, 保持现有行为
- **不同 URL**: 视为命名冲突(同 basename 不同目录), 系统 SHALL 报错终止安装, 错误文案 SHALL 明确指出已安装的原路径, 并引导用户使用 `skillsmgr update ./<name>` 进行 rebind

`findInstalledCustomSkill` SHALL 支持两层查找: 先查 `custom/{name}/SKILL.md`, 再扫描 `custom/*/{name}/SKILL.md`.

#### Scenario: Existing skill with same URL prompts overwrite
- **WHEN** 用户执行 `skillsmgr install ./abc`, `findInstalledCustomSkill("abc")` 返回非 null, 且已记录 source 的 `url` 归一化后等于 `./abc` 的绝对路径
- **THEN** 系统使用查找到的路径作为 targetDir, 提示 "Skill 'abc' already exists. Overwrite?"

#### Scenario: User declines overwrite
- **WHEN** 用户拒绝 overwrite 确认
- **THEN** 系统输出 "Cancelled." 并以退出码 0 正常结束

#### Scenario: Existing skill with different URL is rejected
- **WHEN** 用户执行 `skillsmgr install /new/path/abc`, `findInstalledCustomSkill("abc")` 返回非 null, 已记录 source 的 `url` 归一化后为 `/old/path/abc` (不等于 `/new/path/abc`)
- **THEN** 系统 SHALL 报错, 错误文案 SHALL 形如 `Error: Skill 'abc' is already installed from /old/path/abc. To move it to /new/path/abc, run: skillsmgr update /new/path/abc`
- **AND** 系统 SHALL 以非 0 退出码终止, 不写入 `sources.json`, 不修改物理目录

#### Scenario: skill 在子目录中被找到
- **WHEN** 用户执行 `skillsmgr install ./abc`, 且 `custom/abc/SKILL.md` 不存在, 但 `custom/openspec/abc/SKILL.md` 存在
- **THEN** `findInstalledCustomSkill("abc")` SHALL 返回 `{ key: "custom/abc", path: "...custom/openspec/abc" }`

### Requirement: install --group 自动入组
`install` 命令 SHALL 接受 `--group <name>` 选项.  安装完成后, 系统 SHALL 自动将已安装 skill 的 source key 添加到指定虚拟 group 中.  group 不存在时自动创建.  安装目标路径不受 `--group` 影响 (始终按来源类型决定路径).  批量安装本地目录时, 若未指定 `--group`, 系统 SHALL 自动使用源目录名作为 group 名.

#### Scenario: install 本地 skill 并入组
- **WHEN** 用户执行 `skillsmgr install ./my-linter --group python`
- **THEN** skill 安装到 `custom/my-linter/` (不受 group 影响)
- **AND** `custom/my-linter` 被添加到 groups.json 的 python group

#### Scenario: install 远程 skill 并入组
- **WHEN** 用户执行 `skillsmgr install anthropics/skills --group python`
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

### Requirement: getCustomSkillDir 支持可选 subdirectory
`getCustomSkillDir` SHALL 接受可选的 `subdirectory` 参数.  有 subdirectory 时返回 `custom/{subdirectory}/{skillName}/`, 无时返回 `custom/{skillName}/` (现有行为).

#### Scenario: 无 subdirectory
- **WHEN** 调用 `getCustomSkillDir("my-skill")`
- **THEN** 返回 `~/.skills-manager/custom/my-skill/`

#### Scenario: 有 subdirectory
- **WHEN** 调用 `getCustomSkillDir("openspec-explore", "openspec")`
- **THEN** 返回 `~/.skills-manager/custom/openspec/openspec-explore/`

### Requirement: SkillsService custom 两层扫描
`SkillsService.getSkillsFromSource` 对 custom 来源 SHALL 支持两层目录结构.  扫描 `custom/` 下每个子目录: 若子目录含 SKILL.md 则作为 skill 加载 (现有行为); 若子目录无 SKILL.md 则继续扫描其子目录找 SKILL.md.

#### Scenario: 一层 custom skill
- **WHEN** `~/.skills-manager/custom/my-skill/SKILL.md` 存在
- **THEN** 系统 SHALL 加载该 skill, source 为 `"custom"`

#### Scenario: 两层 custom skill (子目录分组)
- **WHEN** `~/.skills-manager/custom/openspec/openspec-explore/SKILL.md` 存在
- **AND** `~/.skills-manager/custom/openspec/SKILL.md` 不存在
- **THEN** 系统 SHALL 加载 openspec-explore, source 为 `"custom"`

#### Scenario: 混合结构
- **WHEN** `custom/` 下同时有 `my-skill/SKILL.md` (一层) 和 `openspec/openspec-explore/SKILL.md` (两层)
- **THEN** 系统 SHALL 同时发现两个 skills, 所有 skill 的 source 均为 `"custom"`
