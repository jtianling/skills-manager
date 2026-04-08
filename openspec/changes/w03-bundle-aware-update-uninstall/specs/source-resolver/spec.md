# Source Resolver (delta)

## ADDED Requirements

### Requirement: ResolvedTarget 新增 bundle kind

`ResolvedTarget.kind` 枚举 SHALL 新增 `'bundle'` 变体.  `ResolvedTarget` 数据结构 MUST 新增可选字段 `bundleId: string | undefined`, 在 `kind === 'bundle'` 时设置.  当 kind 为 bundle 时, sourceKeys 字段 SHALL 包含 bundle 的所有成员.

#### Scenario: bundle kind 返回结构
- **WHEN** resolve 识别出一个已存在的 bundle
- **THEN** 返回 `{ kind: 'bundle', bundleId: '<id>', sourceKeys: [<members>], originalInput: '<input>' }`

### Requirement: 本地 batch 路径返回 bundle kind

resolver SHALL 在处理本地路径输入时, 调用 `sourcesService.findBundleByUrl(normalizedUrl, 'local-batch')` 查找是否有对应 bundle.  若找到, 返回 `kind: 'bundle'`; 若未找到且路径是 batch 目录 (有子 SKILL.md), 返回 `kind: 'not-found'` 并在 reason 中说明"未找到对应 bundle, 请先 install".

#### Scenario: 本地 batch 路径命中 bundle
- **WHEN** 调用 `resolve('./spec-tdd')` 且 `local-batch:{absPath}/spec-tdd` bundle 存在
- **THEN** 返回 `{ kind: 'bundle', bundleId: 'local-batch:{absPath}/spec-tdd', sourceKeys: [<19 members>], ... }`

#### Scenario: 本地 batch 路径未命中 bundle
- **WHEN** 调用 `resolve('./new-dir')` 是 batch 目录但从未 install 过
- **THEN** 返回 `{ kind: 'not-found', reason: '未找到对应 bundle, 请先运行 install', ... }`

#### Scenario: 本地单 skill 路径仍返回 source kind
- **WHEN** 调用 `resolve('./my-skill')` 且 my-skill 根含 SKILL.md
- **THEN** 返回 `{ kind: 'source', sourceKeys: ['custom/my-skill'], ... }` (w01 行为不变)

### Requirement: git owner/repo 优先返回 bundle kind

resolver SHALL 在 owner/repo 解析时, 先调用 `findBundleByUrl('https://github.com/{owner}/{repo}', 'git')` 查找 bundle.  若找到, 返回 `kind: 'bundle'`; 若未找到但对应 source key 存在, 回退到 w01 的 `kind: 'source'` 行为.

#### Scenario: owner/repo 命中 bundle
- **WHEN** 调用 `resolve('anthropics/skills')` 且存在 `git:https://github.com/anthropics/skills` bundle
- **THEN** 返回 `{ kind: 'bundle', bundleId: 'git:https://github.com/anthropics/skills', sourceKeys: [<members>], ... }`

#### Scenario: owner/repo 未命中 bundle 回退 source
- **WHEN** 调用 `resolve('obra/superpowers')` 但 bundle 不存在 (比如未迁移的老数据 + 单 skill install)
- **THEN** 返回 `{ kind: 'source', sourceKeys: ['community/obra/superpowers'], ... }` (w01 行为)

### Requirement: URL 输入优先返回 bundle kind

resolver SHALL 对 URL 输入先走 URL 归一化, 然后调用 `findBundleByUrl(normalizedUrl, 'git')`.  匹配逻辑与 owner/repo 路径一致.

#### Scenario: HTTPS URL 命中 bundle
- **WHEN** 调用 `resolve('https://github.com/obra/superpowers')` 且 bundle 存在
- **THEN** 返回 `kind: 'bundle'`

#### Scenario: SSH URL 命中同一 bundle
- **WHEN** 调用 `resolve('git@github.com:obra/superpowers')`
- **THEN** 归一化后匹配到同一 bundle, 返回 `kind: 'bundle'`

## REMOVED Requirements

### Requirement: 本地 batch 目录返回 batch-unsupported

**Reason**: w03 实现了 bundle sync 语义, batch 目录不再是"不支持"状态, 而是返回 `kind: 'bundle'` 让 update/uninstall 走 BundleManager 流程.

**Migration**: `ResolvedTarget.kind` 中的 `'batch-unsupported'` 变体被移除, 改用 `'bundle'` (命中时) 或 `'not-found'` (未命中 bundle 时).  update/uninstall 命令的错误消息不再触发; 调用方若之前有 `case 'batch-unsupported'` 分支, 需要删除并按新 kind 处理.
