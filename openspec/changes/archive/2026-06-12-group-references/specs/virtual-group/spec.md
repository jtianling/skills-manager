## MODIFIED Requirements

### Requirement: group add 子命令
`skillsmgr group add <group> <identifier>` SHALL 将已安装的 skill 加入指定 group.  identifier 支持四种格式: skill name, full source key, group name, owner/repo.  多类型匹配时交互提示用户选择.  添加时 SHALL 检测 name 级别冲突.

此外, `skillsmgr group add <group> --group <src>` SHALL 向 group 写入对 src 的**动态引用** (`group:<src>` 引用项), 语义独立于 positional identifier 匹配 group name 时的一次性快照复制: positional = 复制 src 当前成员, `--group` = 动态跟随 src.  两条路径并存.  `--group` 的 src 等于 target 时 SHALL 报错 "Cannot reference a group from itself.".

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

#### Scenario: identifier 匹配 group name — 批量添加 (快照)
- **WHEN** 用户执行 `skillsmgr group add develop openspec`, 且 `openspec` 是已存在的 group 包含 10 个 skill key
- **THEN** 将 openspec group 的当前所有 skill key 复制到 develop group (快照, 不建立引用), 逐条显示添加结果

#### Scenario: identifier 匹配 owner/repo — 批量添加
- **WHEN** 用户执行 `skillsmgr group add develop obra/superpowers`, 且 `obra/superpowers` 下有 5 个已安装 skill
- **THEN** 将这 5 个 skill 的 key 全部添加到 develop group, 逐条显示添加结果

#### Scenario: owner/repo 未安装
- **WHEN** 用户执行 `skillsmgr group add develop foo/bar`, 且 `foo/bar` 未安装任何 skill
- **THEN** 输出 "No installed skills found for 'foo/bar'." 并退出

#### Scenario: 多类型匹配时交互选择
- **WHEN** 用户执行 `skillsmgr group add develop openspec`, 且同时存在名为 `openspec` 的 skill 和名为 `openspec` 的 group
- **THEN** 交互提示用户选择: `skill: openspec (custom/openspec)` 或 `group: openspec (10 skills)`

#### Scenario: 自引用防护 (positional 快照)
- **WHEN** 用户执行 `skillsmgr group add openspec openspec`, identifier 解析为 group `openspec`
- **THEN** 输出 "Cannot add a group to itself." 并退出

#### Scenario: --group 添加动态引用
- **WHEN** 用户执行 `skillsmgr group add vercel-develop --group develop`
- **THEN** vercel-develop 写入 `group:develop` 引用项, 不复制 develop 的成员快照

#### Scenario: --group 自引用防护
- **WHEN** 用户执行 `skillsmgr group add develop --group develop`
- **THEN** 输出 "Cannot reference a group from itself." 并退出, 不写入引用

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

### Requirement: group remove 子命令
`skillsmgr group remove <group> <identifier>` SHALL 从指定 group 中移除 skill 引用.  identifier 支持 skill name/key, group name, owner/repo 三种格式.  不删除 skill 文件.

此外, `skillsmgr group remove <group> --group <src>` SHALL 从 group 移除对 src 的**动态引用** (`group:<src>` 引用项), 与 `group add --group` 对称.

#### Scenario: 从 group 移除单个 skill
- **WHEN** 用户执行 `skillsmgr group remove python commit`
- **THEN** 从 python group 中移除 commit 的引用, skill 文件不受影响

#### Scenario: 按 group 批量移除
- **WHEN** 用户执行 `skillsmgr group remove develop openspec`, 标识符解析为 group 类型
- **THEN** 从 develop 中移除所有同时存在于 openspec 中的 skill 引用

#### Scenario: 按 owner/repo 批量移除
- **WHEN** 用户执行 `skillsmgr group remove develop anthropic/skills`, 标识符解析为 repo 类型
- **THEN** 从 develop 中移除该 repo 下所有 skill 引用

#### Scenario: --group 移除动态引用
- **WHEN** vercel-develop 含 `group:develop`, 用户执行 `skillsmgr group remove vercel-develop --group develop`
- **THEN** 移除 `group:develop` 引用项, develop 本身不受影响

#### Scenario: --group 移除不存在的引用
- **WHEN** vercel-develop 不含 `group:develop`, 用户执行 `skillsmgr group remove vercel-develop --group develop`
- **THEN** 输出提示该引用不存在, 不报致命错误

#### Scenario: skill 不在 group 中
- **WHEN** 用户执行 `skillsmgr group remove python nonexistent`
- **THEN** 输出提示信息并退出

#### Scenario: group 不存在
- **WHEN** 用户执行 `skillsmgr group remove nonexistent commit`
- **THEN** 输出 "Group 'nonexistent' not found." 并退出
