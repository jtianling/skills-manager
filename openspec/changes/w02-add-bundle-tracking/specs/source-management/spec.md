# Source Management (delta)

## MODIFIED Requirements

### Requirement: SourcesService 行为

`SourcesService` SHALL 读写 `~/.skills-manager/sources.json`, 支持 source 和 bundle 两类数据的 CRUD.  schema 版本 MUST 从 v1 (`"1.0"`) 自动升级到 v2 (`"2.0"`), 迁移发生在 `load()` 时检测到 v1 schema 或缺失 version 字段.

- **load()**: 读取 sources.json, 文件不存在时返回 `{ version: "2.0", sources: {}, bundles: {} }`; 检测到 v1 schema 时触发迁移并写回
- **save()**: 写入 sources.json, 使用 `JSON.stringify(data, null, 2)` 格式化, 使用原子写 (temp 文件 + rename) 避免半写; `ensureDir` 确保父目录存在
- **addSource(key, info)**: 添加或更新 source. `installedAt` 保留已有值 (如果 key 已存在), `updatedAt` 设为当前时间
- **getSource(key)**: 返回指定 source 或 undefined
- **getAllSources()**: 返回所有 sources 的 Record
- **removeSource(key)**: 使用 `delete` 删除指定 source
- **updateTimestamp(key)**: 仅更新 `updatedAt` 字段为当前时间, source 不存在时不做任何操作
- **getAllBundles()**: 返回所有 bundles 的 Record
- **getBundle(id)**: 返回指定 bundle 或 undefined
- **addBundle(id, info)**: 添加或更新 bundle. `installedAt` 保留已有值, `updatedAt` 设为当前时间
- **updateBundleMembers(id, members)**: 更新成员列表, 同时更新 `updatedAt`
- **updateBundleTimestamp(id)**: 仅更新 `updatedAt` 字段
- **removeBundle(id)**: 删除 bundle 条目 (不级联删除成员 source)
- **findBundleByUrl(normalizedUrl, type)**: 按归一化 URL 和 type 查找 bundle

#### Scenario: load 空文件返回 v2 结构
- **WHEN** sources.json 不存在
- **THEN** `load()` 返回 `{ version: "2.0", sources: {}, bundles: {} }`

#### Scenario: load 触发 v1 → v2 迁移
- **WHEN** sources.json 的 version 字段为 `"1.0"`
- **THEN** `load()` 执行迁移逻辑, 写回 v2 格式

#### Scenario: addSource 保留 installedAt
- **WHEN** 调用 `addSource(key, info)` 且该 key 已存在
- **THEN** 原 `installedAt` 被保留, `updatedAt` 更新为当前时间

#### Scenario: 原子写避免文件损坏
- **WHEN** save 过程中系统异常终止
- **THEN** sources.json 保持前一次成功写入的内容 (通过 temp + rename)

### Requirement: SourceInfo 数据结构

sources.json SHALL 使用 v2 schema 存储 source 和 bundle 两类数据.  文件 MUST 包含顶层字段 `version` (`"2.0"`), `sources`, `bundles`.  存储在 `~/.skills-manager/sources.json`:

```json
{
  "version": "2.0",
  "sources": {
    "official/anthropic/skills": {
      "url": "https://github.com/anthropics/skills",
      "type": "official",
      "repoName": "skills",
      "installedAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-02-01T15:30:00.000Z"
    },
    "community/obra/superpowers": {
      "url": "https://github.com/obra/superpowers",
      "type": "community",
      "repoName": "superpowers",
      "installedAt": "2025-03-01T10:00:00.000Z",
      "updatedAt": "2025-03-01T10:00:00.000Z"
    }
  },
  "bundles": {
    "git:https://github.com/obra/superpowers": {
      "type": "git",
      "url": "https://github.com/obra/superpowers",
      "selectionMode": "all",
      "members": ["community/obra/superpowers/foo", "community/obra/superpowers/bar"],
      "installedAt": "2025-03-01T10:00:00.000Z",
      "updatedAt": "2025-03-01T10:00:00.000Z"
    },
    "local-batch:/Users/jtianling/workspace/spec-tdd": {
      "type": "local-batch",
      "url": "/Users/jtianling/workspace/spec-tdd",
      "selectionMode": "all",
      "members": ["custom/spec-tdd/st-apply", "custom/spec-tdd/st-archive"],
      "installedAt": "2026-04-01T08:00:00.000Z",
      "updatedAt": "2026-04-01T08:00:00.000Z"
    }
  }
}
```

#### Scenario: Community source 记录完整 owner/repo
- **WHEN** 安装 community 仓库 `obra/superpowers`
- **THEN** source key SHALL 为 `"community/obra/superpowers"`, url 为 `"https://github.com/obra/superpowers"`

#### Scenario: v2 sources.json 同时持有 sources 和 bundles
- **WHEN** 系统安装多个 skill 形成一个 bundle
- **THEN** sources 字段记录每个 skill 的 source 条目
- **THEN** bundles 字段记录聚合 bundle 条目, members 引用 sources 中的 key

| sources 字段 | 类型 | 说明 |
|------|------|------|
| url | string | 远程仓库 URL 或本地路径 |
| type | "official" \| "community" \| "custom" \| "registry" | 来源类型 |
| repoName | string | 仓库名称 |
| installedAt | string (ISO 8601) | 首次安装时间, 后续安装不覆盖 |
| updatedAt | string (ISO 8601) | 最近更新时间 |

| bundles 字段 | 类型 | 说明 |
|------|------|------|
| type | "local-batch" \| "git" \| "zip" | bundle 类型 |
| url | string | 源 URL 或路径 (已归一化) |
| selectionMode | "all" \| "subset" | 安装时的选择意图 |
| members | string[] | 成员 source key 列表, 保持 install 顺序 |
| installedAt | string (ISO 8601) | 首次建 bundle 时间 |
| updatedAt | string (ISO 8601) | 最近修改时间 |
