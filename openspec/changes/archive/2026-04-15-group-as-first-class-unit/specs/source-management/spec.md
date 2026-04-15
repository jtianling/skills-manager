## ADDED Requirements

### Requirement: sources.json V3 schema — bundles 字段限缩

`sources.json` SHALL 升级到 `version: '3.0'`.  顶层 `bundles` 字段 SHALL 仅包含 `type === 'git'` 或 `type === 'zip'` 的 entry.  `type === 'local-batch'` 的 entry 在迁移时 SHALL 移出 `sources.json`, 写入 `groups.json` 作为物理 group (见 `group-as-first-class-unit` capability 的 "迁移策略" 需求).

V3 示例:
```json
{
  "version": "3.0",
  "sources": { ... },
  "bundles": {
    "git:https://github.com/obra/superpowers": { "type": "git", "url": "...", "members": [...], ... },
    "zip:https://example.com/pack.zip": { "type": "zip", "url": "...", "members": [...], ... }
  }
}
```

`SourcesService` SHALL 拒绝向 `bundles` 字段写入 `type === 'local-batch'` 的 entry (开发期断言), 防止旧调用路径残留.

#### Scenario: V3 sources.json 不含 local-batch bundle
- **WHEN** 系统读取已迁移的 V3 sources.json
- **THEN** `bundles` 字段中所有 entry 的 `type` 都是 `'git'` 或 `'zip'`
- **THEN** 不存在 `type === 'local-batch'` 的 entry

#### Scenario: 写入 local-batch bundle 被拒绝
- **WHEN** 代码尝试调用 `SourcesService.addBundle(id, { type: 'local-batch', ... })`
- **THEN** SHALL 抛出错误 `local-batch bundles must be stored as physical groups in groups.json`

### Requirement: SourcesService V2→V3 迁移

`SourcesService.load` SHALL 在检测到 `version !== '3.0'` 时执行一次性迁移:

1. 写入 backup 文件 `sources.json.v2.backup` (atomic)
2. 收集所有 `bundles` 中 `type === 'local-batch'` 的 entry
3. 对每个 local-batch bundle, 调用 `GroupsService.migrateLocalBatchToPhysicalGroup(basename, bundle)` (定义见 `virtual-group` capability)
4. 从 `bundles` 字段中删除已迁移的 entry
5. 设 `version = '3.0'`, atomic 写回

迁移 SHALL 是无 opt-out 的, 失败时不损坏原数据 (atomic write 保证).  迁移后系统 SHALL 在 stderr 打印迁移摘要并写 `~/.skills-manager/migration.log`.

#### Scenario: V2 含 local-batch 自动迁移
- **GIVEN** sources.json 为 V2, `bundles` 含 1 个 local-batch entry (basename = `tdd-spec`)
- **WHEN** 系统首次 load
- **THEN** 写出 `sources.json.v2.backup`
- **THEN** local-batch entry 从 `bundles` 移除
- **THEN** `groups.json` 新增物理 group `tdd-spec`
- **THEN** sources.json `version` 升为 `'3.0'`

#### Scenario: 已是 V3 不重复迁移
- **GIVEN** sources.json `version === '3.0'`
- **WHEN** 系统 load
- **THEN** 不执行迁移逻辑, 不写 backup
