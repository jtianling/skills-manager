## MODIFIED Requirements

### Requirement: 按 skill 名称卸载
系统 SHALL 支持通过 skill 名称搜索并卸载单个 skill.  搜索范围覆盖 official, community, custom 三种来源.

对 **custom** skill (含磁盘上 `custom/<name>/SKILL.md` 的单 skill 本地安装), 搜索 SHALL 以磁盘扫描为权威 — 调用 `findInstalledCustomSkills(name)` 获取所有匹配, 不依赖 sources.json 中是否有对应条目.  卸载完成后 SHALL 删除磁盘目录并清理 `groups.json` 中对该 key 的引用; SHALL NOT 尝试删除 sources.json 中的条目 (按新设计, 单 skill 本地安装不会有条目).

对 **official / community** skill, 搜索与卸载流程保持原样 (遍历 sources.json 中的 git source + 扫描对应磁盘目录), 卸载后仍清理 sources.json 中的相应条目.

#### Scenario: 唯一匹配的 skill (custom, 磁盘有 sources 无)
- **GIVEN** `custom/jt-share/SKILL.md` 存在, `sources.json` 无 `custom/jt-share` 条目
- **WHEN** 用户执行 `skillsmgr uninstall jt-share`
- **THEN** 系统通过 `findInstalledCustomSkills("jt-share")` 发现唯一匹配
- **THEN** 显示 skill 信息 (名称, 路径); warning + 确认
- **THEN** 确认后 删除 `custom/jt-share/` 目录
- **THEN** 从 `groups.json` 所有 group 的 members 中移除 `custom/jt-share` 引用
- **THEN** SHALL NOT 尝试删除 sources.json 条目 (本来就没有)
- **THEN** 以退出码 0 结束

#### Scenario: 唯一匹配的 skill (custom, 磁盘有 sources 也有 legacy 条目)
- **GIVEN** `custom/jt-share/SKILL.md` 存在, `sources.json` 含 legacy `custom/jt-share` local-copy 条目
- **WHEN** 用户执行 `skillsmgr uninstall jt-share`
- **THEN** 磁盘目录被删除, groups.json 引用被清理
- **THEN** 下次 `SourcesService` 有其他写操作时 legacy 条目被自然过滤清除 (不是本命令直接删除)

#### Scenario: 唯一匹配的 skill (official / community)
- **WHEN** 用户执行 `skillsmgr uninstall skill-name`, 在 official 或 community 下找到唯一匹配
- **THEN** 流程与 pre-change 行为一致: 显示 skill 信息, warning + 确认, 删除磁盘目录, 检查同 source 下是否还有其他 skill, 若无则清理 sources.json 对应条目

#### Scenario: 多个同名 skill
- **WHEN** 用户执行 `skillsmgr uninstall skill-name` 且多个来源存在同名 skill (可能跨 custom/community/official)
- **THEN** 系统列出所有匹配的 skills 及其来源
- **THEN** 提示用户选择要卸载的 skill

#### Scenario: 未找到 skill
- **WHEN** 用户执行 `skillsmgr uninstall skill-name` 但无匹配 (三种来源的磁盘扫描 + sources.json 查询都空)
- **THEN** 系统输出错误信息并退出

### Requirement: sources.json 清理

系统 SHALL 在删除 skills 后检查并清理 `sources.json` 中相关的 git / registry / 物理 group 成员的无效记录.

对单 skill local-copy 卸载路径, SHALL NOT 尝试清理 sources.json — 按 "sources.json 不追踪 local-copy 条目" 需求, 本来就没有条目可清.

对物理 group 卸载路径, 清理范围 SHALL 覆盖 `affectedKeys` (物理目录扫描 ∪ sources.json 中以 `custom/<name>/` 开头的 key) 全部, 不依赖 bundle.members 快照 (不变).

#### Scenario: source 下所有 skills 已删除 (git)
- **WHEN** 删除 git source 下最后一个 skill 后, 该 source 目录不再有任何 skill
- **THEN** 系统从 `sources.json` 中移除该 git source 的记录

#### Scenario: source 下仍有其他 skills (git)
- **WHEN** 删除 skill 后, 该 git source 目录下仍有其他 skills
- **THEN** 系统保留 `sources.json` 中该 git source 的记录

#### Scenario: 单 skill 本地卸载不涉及 sources.json 清理
- **WHEN** 用户执行 `skillsmgr uninstall jt-share` (本地 skill)
- **THEN** 系统删除磁盘目录, 清理 groups.json 引用
- **THEN** 系统 SHALL NOT 执行 "清理 sources.json 条目" 步骤 (本来就没有条目)
- **THEN** 若 sources.json 恰好有 legacy 条目, 不报错, 不主动删除 (由读路径过滤 + 下次自然写入清除)

#### Scenario: 物理 group 卸载清理范围以 affectedKeys 为准 (不变)
- **GIVEN** 物理 group `tdd-spec`, 物理目录有 `ts-newname/SKILL.md`, sources.json 含 `custom/tdd-spec/tdd-old1` (物理已不存在)
- **WHEN** 用户执行 `skillsmgr uninstall tdd-spec`
- **THEN** affectedKeys = `{ custom/tdd-spec/ts-newname, custom/tdd-spec/tdd-old1 }`
- **THEN** sources.json 中两条全部清除 (物理 group 成员仍由 sources.json 追踪)
