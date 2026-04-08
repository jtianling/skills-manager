# Custom Install (delta)

## ADDED Requirements

### Requirement: Multi-skill install 写入 bundle 条目

所有 multi-skill install 路径 (本地 batch, git, zip) SHALL 在 sources 写入完成后向 sources.json 的 bundles section 写入对应的 bundle 条目.  install 命令 MUST 根据 install 类型选择 bundle type:

- 本地 batch (`installFromLocalDirBatch`) → `type: 'local-batch'`, url 为源目录绝对路径
- git (`installViaGitClone`) → `type: 'git'`, url 为归一化后的 https URL
- 本地 zip (`installFromZip`) → `type: 'zip'`, url 为 zip 文件的绝对路径
- 远程 zip (`installFromRemoteZip`) → `type: 'zip'`, url 为原始下载 URL

单 skill install 路径 (单 skill 本地目录, registry, owner/repo:skill) SHALL NOT 写入 bundle 条目.

#### Scenario: git install 写 bundle
- **WHEN** 用户执行 `skillsmgr install anthropics/skills --all`
- **THEN** sources 中新增多个 `official/anthropic/skills/*` 条目
- **THEN** bundles 中新增 `git:https://github.com/anthropics/skills` 条目
- **THEN** bundle.members 包含所有新安装 skill 的 source key
- **THEN** bundle.selectionMode 为 `'all'`

#### Scenario: zip install 写 bundle
- **WHEN** 用户执行 `skillsmgr install ./pack.zip --all`
- **THEN** bundles 中新增 `zip:{absPath}/pack.zip` 条目

#### Scenario: 单 skill install 不写 bundle
- **WHEN** 用户执行 `skillsmgr install obra/superpowers:specific-skill`
- **THEN** sources 中新增单个 source 条目
- **THEN** bundles 中不生成任何条目

#### Scenario: registry install 不写 bundle
- **WHEN** 用户执行 `skillsmgr install code-review`
- **THEN** sources 中新增 `registry/code-review` 条目
- **THEN** bundles 中不生成任何条目

### Requirement: install 命令推断 selectionMode

install 命令 SHALL 根据用户传入的 flag 和交互式选择结果推断 bundle 的 selectionMode, 并在写 bundle 时传入.  推断规则 MUST 与 bundle-tracking spec 中定义的优先级一致.

#### Scenario: --all flag 推断为 all
- **WHEN** 用户执行 `skillsmgr install anthropics/skills --all`
- **THEN** bundle.selectionMode 为 `'all'`

#### Scenario: -s 显式列表推断为 subset
- **WHEN** 用户执行 `skillsmgr install anthropics/skills -s skill-a -s skill-b`
- **THEN** bundle.selectionMode 为 `'subset'`

#### Scenario: 交互式全选推断为 all
- **WHEN** 用户在交互式选择时通过 toggle-all 或手动勾选了全部 skill
- **THEN** `promptSkillsToInstall` 返回 `{ names: [...all], isAll: true }`
- **THEN** bundle.selectionMode 为 `'all'`

#### Scenario: 交互式部分选推断为 subset
- **WHEN** 用户在交互式选择时只勾选了一部分 skill
- **THEN** `promptSkillsToInstall` 返回 `{ names: [...partial], isAll: false }`
- **THEN** bundle.selectionMode 为 `'subset'`
