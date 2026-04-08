# Uninstall (delta)

## ADDED Requirements

### Requirement: uninstall 接受本地 batch 路径

uninstall 命令 SHALL 接受本地 batch 目录路径作为输入, 委托 SourceResolver 解析得到 `kind: 'bundle'`, 再调用 `BundleManager.remove(bundleId)` 批量删除整个 bundle.  交互确认流程保留, 显示要删除的所有成员名列表.

#### Scenario: 本地 batch 路径批量卸载
- **WHEN** 用户执行 `skillsmgr uninstall ./spec-tdd` 且对应 bundle 存在 (含 19 个成员)
- **THEN** SourceResolver 返回 `kind: 'bundle'`, sourceKeys 为 19 条 member
- **THEN** uninstall 列出所有 19 个 skill 名, 显示 symlink 失效警告
- **THEN** 用户确认后调用 `bundleManager.remove(bundleId)`
- **THEN** 19 个本地 skill 目录被删除, sources.json 条目和 bundle 条目同时清理
- **THEN** 输出 "Uninstalled 19 skills from bundle local-batch:{path}"

#### Scenario: --force 跳过确认
- **WHEN** 用户执行 `skillsmgr uninstall ./spec-tdd --force`
- **THEN** 跳过确认提示直接执行 BundleManager.remove

#### Scenario: 本地 batch 路径未找到 bundle
- **WHEN** 用户执行 `skillsmgr uninstall ./random-dir` 且该路径从未 install 过
- **THEN** SourceResolver 返回 `kind: 'not-found'`
- **THEN** uninstall 报错 "No installed skill found from path: {absPath}"

### Requirement: uninstall 接受 owner/repo 走 bundle 批量删除

对 owner/repo 输入, uninstall 命令 SHALL 在 SourceResolver 返回 `kind: 'bundle'` 时走 BundleManager.remove 路径 (而不是沿用 w01 的按 source key 删除逻辑).  行为结果一致 (都是删除该 repo 下所有 skill), 但走统一的 BundleManager 流程以避免代码分叉.

#### Scenario: owner/repo 走 bundle remove
- **WHEN** 用户执行 `skillsmgr uninstall anthropics/skills` 且对应 git bundle 存在
- **THEN** SourceResolver 返回 `kind: 'bundle'`
- **THEN** uninstall 调用 `bundleManager.remove(bundleId)` 批量删除所有 skill
- **THEN** 结果与 w01 阶段的 `uninstallSource` 行为一致

#### Scenario: owner/repo 未找到 bundle 回退到 source kind
- **WHEN** 用户执行 `skillsmgr uninstall obra/superpowers` 但 bundle 不存在 (比如未迁移的数据)
- **THEN** SourceResolver 返回 `kind: 'source'`
- **THEN** uninstall 走 w01 的按 source key 批量删除逻辑
