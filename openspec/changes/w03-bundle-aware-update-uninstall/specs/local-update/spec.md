# Local Update (delta)

## MODIFIED Requirements

### Requirement: 通过本地路径参数指定更新

update 命令 SHALL 接受本地路径参数 (`./skill`, `../x/skill`, `/abs/skill`, `~/skill`), 委托给 SourceResolver 进行匹配.  对单 skill 目录 (kind='source') 走 local-copy 更新流程.  对本地 batch 目录 (kind='bundle') 委托 `BundleManager.sync` 处理, 实现 group 同步语义.  `--sync` 和 `-v/--verbose` 选项 MUST 被支持, 透传给 BundleManager.

#### Scenario: 单 skill 路径匹配已安装 source
- **WHEN** 用户执行 `skillsmgr update ./my-skill` 且 `my-skill` 根目录含 SKILL.md
- **THEN** SourceResolver 返回 `kind: 'source'`
- **THEN** 执行 local-copy 更新流程

#### Scenario: 本地 batch 路径走 bundle sync
- **WHEN** 用户执行 `skillsmgr update ./spec-tdd` 且 `spec-tdd/` 是 batch 目录 (对应 bundle 存在)
- **THEN** SourceResolver 返回 `kind: 'bundle'` 含 bundleId
- **THEN** update 命令调用 `bundleManager.sync(bundleId, { sync: false, verbose: false })`
- **THEN** 输出合并后的统计: `Done! {updated} updated, {added} added, {removedKept} removed (kept), {upToDate} up to date`

#### Scenario: 本地 batch 路径使用 --sync flag
- **WHEN** 用户执行 `skillsmgr update ./spec-tdd --sync`
- **THEN** BundleManager.sync 被调用时 `options.sync = true`
- **THEN** 源里已删除的 skill 被硬删除

#### Scenario: 本地 batch 路径使用 -v flag
- **WHEN** 用户执行 `skillsmgr update ./spec-tdd -v`
- **THEN** BundleManager.sync 被调用时 `options.verbose = true`
- **THEN** 输出列出每个 skill 的状态 (包括 up-to-date), 不折叠

#### Scenario: 本地 batch 未找到 bundle
- **WHEN** 用户执行 `skillsmgr update ./random-dir` 且该路径从未 install 过
- **THEN** SourceResolver 返回 `kind: 'not-found'`
- **THEN** update 报错 "No installed skill found from path: {absPath}"

#### Scenario: 路径未匹配任何已安装 source
- **WHEN** 用户执行 `skillsmgr update ./unknown-skill`
- **THEN** SourceResolver 返回 `kind: 'not-found'`
- **THEN** 系统报错 "No installed skill found from path: {absPath}"
