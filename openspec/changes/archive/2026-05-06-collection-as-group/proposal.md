## Why

Collection 是 registry 的策展产物（`@alice/kit`），用户用 `--from <ref>` 安装后，本地没有结构化记录这批 skill 属于哪个 collection。后续部署/重装/卸载只能逐个或手动维护 group。需要把"安装的 collection"作为一种 first-class group 落地，让 add/remove/uninstall/update 都能直接引用 collection ref。

## What Changes

- `groups.json` 新增 `kind: 'collection'` 类型；entry 含 `ref` 元数据
- Group key 允许 `@<owner>/<slug>` 形式（仅 collection kind 例外，其他 kind 仍受现有 `[a-zA-Z0-9_-]+` 约束）
- `install --from <ref>` 自动创建/更新对应 collection group（read-only，由服务端 members 决定）
- `add --group @alice/kit` / `remove --group @alice/kit` 可直接操作 collection group
- `uninstall --from <ref>` 删除对应 collection group
- `update <ref>` 复用现有 source 参数：当输入是 collection ref（`@owner/slug` 或 URL）时，重新调 resolve endpoint sync collection group members（增删差量）
- Collection group 是 read-only：禁止 `group add/remove` 手动改 members（保持服务端为准）

## Capabilities

### New Capabilities
- `collection-group`: Collection 作为 first-class group——存储 schema、生命周期管理、与现有命令的交互规则

### Modified Capabilities

（无现有 spec 级别的行为变更——`install-collection` 在 archive 中，本 change 扩展其行为）

## Impact

- **代码**: `types.ts` 扩 GroupKind；`services/groups.ts` 新增 collection group CRUD；`commands/install-collection.ts`、`commands/install.ts`、`commands/uninstall.ts`、`commands/remove.ts`、`commands/update.ts` 集成
- **存储**: `groups.json` schema 仍是 V2，新增 `'collection'` kind，新字段 `ref`
- **兼容性**: 旧 groups.json 不受影响（无 collection 条目）；现有 `--group <name>` 用户输入仍走 virtual lookup，加 `@` 前缀才命中 collection group
