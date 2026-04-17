## MODIFIED Requirements

### Requirement: 按 skill name 查找已安装的 custom skill
系统 SHALL 提供 `findInstalledCustomSkill(skillName)` 函数, 在 `~/.skills-manager/custom/` 目录中按 skill name 查找已安装的 skill.  查找 SHALL 检查直接子目录 (`custom/{name}/`) 和一层子目录 (`custom/*/{name}/`).  当有多个匹配时返回第一个 (顶层优先).

本函数 SHALL 是 **custom 本地 skill 存在性检测的权威路径** — 所有需要回答"名为 X 的 custom skill 是否已安装"的调用 (install overwrite 检测, update 解析本地路径, uninstall 按 name 删除, group 引用解析等) SHALL 通过本函数或同类磁盘扫描完成, SHALL NOT 改用 sources.json 中是否存在 `custom/<name>` 条目作为替代判据.

#### Scenario: 直接子目录匹配
- **WHEN** `~/.skills-manager/custom/jt-release/SKILL.md` 存在
- **THEN** `findInstalledCustomSkill("jt-release")` SHALL 返回 `{ key: "custom/jt-release", path: "~/.skills-manager/custom/jt-release" }`

#### Scenario: 子目录中匹配
- **WHEN** `~/.skills-manager/custom/jt-release/` 不存在
- **AND** `~/.skills-manager/custom/develop/jt-release/SKILL.md` 存在
- **THEN** `findInstalledCustomSkill("jt-release")` SHALL 返回 `{ key: "custom/develop/jt-release", path: "~/.skills-manager/custom/develop/jt-release" }`

#### Scenario: 未找到
- **WHEN** `~/.skills-manager/custom/` 下不存在名为 `unknown-skill` 的 skill
- **THEN** `findInstalledCustomSkill("unknown-skill")` SHALL 返回 `null`

#### Scenario: sources.json 无条目但磁盘有 (legacy 孤儿)
- **GIVEN** `~/.skills-manager/custom/jt-share/SKILL.md` 存在, `sources.json` 中无 `custom/jt-share` 条目
- **WHEN** `findInstalledCustomSkill("jt-share")` 被调用
- **THEN** SHALL 返回 `{ key: "custom/jt-share", path: "~/.skills-manager/custom/jt-share" }`
- **THEN** 该返回值的权威性与"有 sources.json 条目时相同" — 调用方不需要再查 sources.json 做二次验证
