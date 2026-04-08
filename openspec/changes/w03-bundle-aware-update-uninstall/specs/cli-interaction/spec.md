# CLI Interaction (delta)

## ADDED Requirements

### Requirement: update 命令新增 --sync 和 -v/--verbose 选项

`update` 命令 SHALL 接受 `--sync` flag 和 `-v/--verbose` flag.  `--sync` 在 bundle sync 时触发 removed 成员的硬删除.  `-v` 展开输出显示每个 skill 的状态, 默认折叠为计数.

#### Scenario: update --sync 触发硬删除
- **WHEN** 用户执行 `skillsmgr update ./spec-tdd --sync`
- **THEN** BundleManager.sync 被调用时 `options.sync = true`
- **THEN** 源中已删除的 skill 一并从本地删除

#### Scenario: update -v 展开输出
- **WHEN** 用户执行 `skillsmgr update ./spec-tdd -v`
- **THEN** 输出列出每个成员的状态, 包括 up-to-date 的

#### Scenario: update 默认折叠输出
- **WHEN** 用户执行 `skillsmgr update ./spec-tdd` (不加 -v)
- **THEN** 输出只列出有变化的 skill (updated, added, removed), up-to-date 折叠为计数

### Requirement: update 输出格式

`update` 命令对 bundle 的输出 SHALL 使用以下格式:

- `  ↑ {name}: updated` — 已存在成员内容变化
- `  + {name}: new in source (installed)` — 新增成员 all 模式
- `  + {name}: new in source (skipped, subset mode)` — 新增成员 subset 模式
- `  - {name}: removed from source (kept locally, use --sync to remove)` — 移除成员 warn-keep
- `  - {name}: removed` — 移除成员 sync 模式
- `  ✓ {name}: up to date` — 仅 verbose 模式显示
- `  ✓ {n} skills up to date` — 非 verbose 模式的折叠
- `  ✗ {name}: failed to update` — 失败

结尾统计行: `Done! {updated} updated, {added} added, {removedKept} removed (kept), {removedHard} removed, {upToDate} up to date, {failed} failed`

#### Scenario: 折叠模式输出示例
- **WHEN** sync 后 1 updated, 1 added, 1 removed-kept, 17 up-to-date
- **THEN** 输出 3 个变化行 + 1 个"17 skills up to date" 行 + 统计行

#### Scenario: verbose 模式输出所有
- **WHEN** `-v` 且 sync 后 20 个 skill 全部 up-to-date
- **THEN** 输出 20 个 `✓` 行 + 统计行
