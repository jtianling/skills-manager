## MODIFIED Requirements

### Requirement: group add 子命令
`skillsmgr group add <group> <identifier>` SHALL 将已安装的 skill 加入指定 group.  identifier 支持四种格式: skill name, full source key, group name, owner/repo.  多类型匹配时交互提示用户选择.  添加时 SHALL 检测 name 级别冲突.

#### Scenario: 按 name 添加唯一匹配
- **WHEN** 用户执行 `skillsmgr group add python commit`, 且只有一个名为 commit 的 skill (key: `official/anthropic/skills/commit`)
- **THEN** 将 `official/anthropic/skills/commit` 添加到 python group

#### Scenario: 同名 skill 冲突
- **WHEN** 用户执行 `skillsmgr group add python commit`, 且存在 `official/anthropic/skills/commit` 和 `community/someone/tools/commit` 两个同名 skill
- **THEN** 交互提示用户选择其中一个

#### Scenario: 使用完整 source key 添加
- **WHEN** 用户执行 `skillsmgr group add python official/anthropic/skills/commit`
- **THEN** 将该 key 添加到 python group

#### Scenario: skill 已在 group 中
- **WHEN** `official/anthropic/skills/commit` 已在 python group 中, 用户再次执行 `skillsmgr group add python commit`
- **THEN** 输出 "Skill 'commit' is already in group 'python'."

#### Scenario: group 不存在时自动创建
- **WHEN** 用户执行 `skillsmgr group add newgroup commit`, 且 newgroup 不存在
- **THEN** 自动创建 newgroup 并添加 skill

#### Scenario: identifier 匹配 group name — 批量添加
- **WHEN** 用户执行 `skillsmgr group add develop openspec`, 且 `openspec` 是已存在的 group 包含 10 个 skill key
- **THEN** 将 openspec group 的所有 skill key 复制到 develop group, 逐条显示添加结果

#### Scenario: identifier 匹配 owner/repo — 批量添加
- **WHEN** 用户执行 `skillsmgr group add develop obra/superpowers`, 且 `obra/superpowers` 下有 5 个已安装 skill
- **THEN** 将这 5 个 skill 的 key 全部添加到 develop group, 逐条显示添加结果

#### Scenario: owner/repo 未安装
- **WHEN** 用户执行 `skillsmgr group add develop foo/bar`, 且 `foo/bar` 未安装任何 skill
- **THEN** 输出 "No installed skills found for 'foo/bar'." 并退出

#### Scenario: 多类型匹配时交互选择
- **WHEN** 用户执行 `skillsmgr group add develop openspec`, 且同时存在名为 `openspec` 的 skill 和名为 `openspec` 的 group
- **THEN** 交互提示用户选择: `skill: openspec (custom/openspec)` 或 `group: openspec (10 skills)`

#### Scenario: 自引用防护
- **WHEN** 用户执行 `skillsmgr group add openspec openspec`, identifier 解析为 group `openspec`
- **THEN** 输出 "Cannot add a group to itself." 并退出

#### Scenario: 无任何匹配
- **WHEN** 用户执行 `skillsmgr group add python nonexistent`, 且无同名 skill, 无同名 group, 非 owner/repo 格式
- **THEN** 输出 "No skill, group, or repo found for 'nonexistent'." 并退出

#### Scenario: name 冲突检测 — 单个添加
- **WHEN** develop group 已有 `community/alice/tools/commit` (name: commit), 用户执行 `skillsmgr group add develop commit` 解析为 `official/anthropic/skills/commit`
- **THEN** 提示用户: 覆盖 (替换为 `official/anthropic/skills/commit`) 或跳过 (保留 `community/alice/tools/commit`)

#### Scenario: name 冲突检测 — 批量添加
- **WHEN** develop group 已有 `custom/my-explore` (name: explore), 用户通过 group 批量添加, 其中包含 `custom/openspec/openspec-explore` (name: openspec-explore, 无冲突) 和 `custom/other/explore` (name: explore, 冲突)
- **THEN** 对无冲突的 skill 直接添加, 对冲突的 skill 逐个提示覆盖或跳过

#### Scenario: 批量添加 key 已存在时静默跳过
- **WHEN** develop group 已有 `custom/openspec/openspec-explore`, 用户通过 group 批量添加 openspec, 其中包含该 key
- **THEN** 该 skill 静默跳过 (key 级别幂等), 输出标记 "already in develop, skipped"

#### Scenario: 空 group 批量添加
- **WHEN** 用户执行 `skillsmgr group add develop empty-group`, 且 `empty-group` 存在但无 skill
- **THEN** 输出 "Group 'empty-group' is empty, nothing to add."
