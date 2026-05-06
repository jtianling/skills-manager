## Context

- 现有 `GroupKind = 'virtual' | 'local-batch'`；`validateGroupName` 限制 `[a-zA-Z0-9_-]+`
- `groups.json` v2 是 `Record<string, GroupEntry>`
- `install --from`、`uninstall --from` 已经在 `install-collection.ts` 实现，但没有任何持久化记录
- web-master 提供的 `/api/collections/resolve` 是 collection 真值

## Goals / Non-Goals

**Goals:**
- 安装 collection 后，本地 `groups.json` 有一条 entry 标识它，可被 `--group <ref>` 引用
- `add --group @alice/kit`、`remove --group @alice/kit`、`update --from @alice/kit`、`uninstall --from @alice/kit` 都能正确联动
- Collection group read-only — 用户不能手动 `group add/remove` 改 members
- 兼容现有 group 命令和 schema，不破坏 virtual / local-batch

**Non-Goals:**
- 不做"创建 collection"（CLI 端发布/管理 collection 由后续 change 处理）
- 不做用户自定义 collection group（即用户起任意名而不绑定 registry ref）
- 不改变 collection 安装期间的成员发现行为（resolve endpoint 是真值）

## Decisions

### 1. 新 Group Kind: `collection`

```ts
export interface CollectionGroupEntry {
  kind: 'collection';
  ref: string;          // "@alice/kit" — same as the entry's key for collection groups
  members: string[];    // skill names returned by resolve, snapshot at last sync
  installedAt: string;
  updatedAt: string;
}
```

Key 即 ref（`@alice/kit`）。Members 是 skill name 列表（来自 `memberToSkillName(packageName)`），与 virtual group 的 members 字段同构，便于 add/remove/list 复用。

### 2. Group name 校验放宽

新增 `validateCollectionGroupKey(key)`：必须形如 `@<owner>/<slug>`，匹配 `/^@[a-z0-9][a-z0-9._-]{0,48}\/[a-z0-9][a-z0-9-]{0,48}$/`（与 `normalizeCollectionRef` 同套规则）。

`validateGroupName` 保持现状（拒绝 `@/`），所有 user-defined virtual group 仍走它。`GroupsService` 内部按 kind 分派校验。

### 3. CLI lookup 规则

`--group <input>`：
- 如果 `input.startsWith('@')` 且匹配 collection ref 格式 → 查 collection group
- 否则查 virtual / local-batch group（现状）

不引入 `--collection` 之类新 flag，保持命令面板简单。

### 4. Read-only 强制

`groupCommand add/remove` 检测目标 group kind 为 `collection` 时报错：
> Cannot manually modify collection group '@alice/kit'. Use 'skillsmgr update --from @alice/kit' to re-sync.

### 5. 生命周期

- **install --from <ref>**：resolve → 安装 members → upsert collection group（merge 到现有，覆盖 members snapshot；installedAt 仅新建时设，updatedAt 总更新）
- **uninstall --from <ref>**：现有 uninstall 流程 + 删除 collection group
- **update <ref>**：复用现有 `update [source]` 入口，输入若是 collection ref 形式（`@owner/slug` 或 `skillsmgr.dev/c/...`），路由到 collection sync：重新 resolve → 比对现有 members → 安装新增（差量）；不卸载消失的 members（避免删用户其他地方仍依赖的 skill）；更新 members snapshot
- **没有 `--from` 但 add/remove --group @...**：仅操作 group→deploy 关系，不改 members snapshot

### 6. JSON 输出兼容

- `install --from --json`：原有 shape 不变，附加 `group: "@alice/kit"`
- `groups list`：collection groups 单独一节展示（kind 标识）
- `update @alice/kit --json`：新增 `{ collection, added: [...], unchanged: [...], warnings: [...] }`

## Risks / Trade-offs

- **[shell 转义]** → `--group @alice/kit` 在 zsh 里没 globbing 但 `@` 在某些环境有特殊含义 → 文档建议引号 `--group "@alice/kit"`，CLI 不做特殊处理
- **[snapshot 漂移]** → 服务端 collection 改了，本地 group members 还是旧的 → 用 `update --from` 显式同步；不做自动后台 sync
- **[孤儿 skill]** → update 时 collection 移除了某 skill，本地不卸载它（避免影响其他 group 引用） → 文档说明，用户自行 `uninstall <skill>`
- **[ref 冲突]** → 不同用户/版本同名 collection（`@alice/kit` 转移给 `@bob`）→ 服务端有 redirect 表（90 天）；本地 group key 锁定 ref 字符串，redirect 后 ref 不变（resolve 内部会 follow）
