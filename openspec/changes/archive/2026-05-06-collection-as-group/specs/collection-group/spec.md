## ADDED Requirements

### Requirement: Collection group 作为 first-class group kind
`groups.json` SHALL 支持 `kind: 'collection'` 类型的 group entry，包含 `ref`、`members`、`installedAt`、`updatedAt` 字段。Entry 的 key 必须是 collection ref（`@<owner>/<slug>` 形式）。

#### Scenario: 创建 collection group
- **WHEN** 用户首次执行 `skillsmgr install --from @alice/kit`
- **THEN** `groups.json` SHALL 出现 entry：`"@alice/kit": { kind: 'collection', ref: '@alice/kit', members: [...], installedAt, updatedAt }`

#### Scenario: 现有 virtual / local-batch group 不受影响
- **WHEN** `groups.json` 已经包含 virtual 和 local-batch group
- **THEN** 安装 collection 后，原有 group 的 schema 和数据 SHALL 保持不变

### Requirement: Collection ref 形式的 group key 校验
Collection group 的 key 校验规则 SHALL 与 `normalizeCollectionRef` 一致：`/^@[a-z0-9][a-z0-9._-]{0,48}\/[a-z0-9][a-z0-9-]{0,48}$/`。

#### Scenario: 合法 collection ref 接受为 group key
- **WHEN** 系统创建 group entry 时 key 为 `@alice/kit`
- **THEN** SHALL 校验通过

#### Scenario: 非法 ref 拒绝
- **WHEN** key 形如 `alice/kit`（缺 `@`）或 `@/kit`（owner 空）
- **THEN** SHALL 抛出 invalid collection ref 错误

#### Scenario: User-defined virtual group key 校验未变
- **WHEN** 用户执行 `skillsmgr group create my-tools`
- **THEN** SHALL 沿用 `[a-zA-Z0-9_-]+` 规则，与 collection group 校验隔离

### Requirement: install --from 自动维护 collection group
`skillsmgr install --from <ref>` SHALL 在 resolve 成功且至少安装一个 member 后，upsert 对应 collection group。

#### Scenario: 首次安装 collection
- **WHEN** 本地无 `@alice/kit` group，执行 `install --from @alice/kit`
- **THEN** SHALL 创建 collection group entry，`installedAt` 和 `updatedAt` 设为当前时间，`members` 是 resolve 返回的 skill name 列表

#### Scenario: 重新安装已存在的 collection
- **WHEN** 本地已有 `@alice/kit` group，再次执行 `install --from @alice/kit`
- **THEN** SHALL 保留原 `installedAt`，更新 `updatedAt`，覆盖 `members` 为最新 resolve 结果

#### Scenario: 安装失败时不污染 group
- **WHEN** 所有 member 安装均失败
- **THEN** SHALL 不创建/更新 collection group，避免空 group 残留

### Requirement: --group 引用 collection group
`add --group <ref>` 和 `remove --group <ref>` SHALL 在输入形如 collection ref 时识别为 collection group 操作；其余输入按 user-defined virtual group 处理。

#### Scenario: 通过 collection ref 部署
- **WHEN** 用户执行 `skillsmgr add --group @alice/kit`
- **THEN** SHALL 找到 collection group，按 members 部署到当前项目

#### Scenario: 通过 collection ref 取消部署
- **WHEN** 用户执行 `skillsmgr remove --group @alice/kit`
- **THEN** SHALL 找到 collection group，按 members 从当前项目取消部署

#### Scenario: collection ref 在本地不存在时报错
- **WHEN** 用户执行 `add --group @bob/missing` 但本地无对应 collection group
- **THEN** SHALL 报错提示 `collection group '@bob/missing' not installed; run skillsmgr install --from @bob/missing first.`

### Requirement: Collection group read-only
`group add/remove`（命令）SHALL 拒绝修改 collection group 的 members。

#### Scenario: 拒绝向 collection group 添加 skill
- **WHEN** 用户执行 `skillsmgr group add @alice/kit some-skill`
- **THEN** SHALL 报错：`Cannot manually modify collection group '@alice/kit'. Use 'skillsmgr update @alice/kit' to re-sync.`

#### Scenario: 拒绝从 collection group 删除 skill
- **WHEN** 用户执行 `skillsmgr group remove @alice/kit some-skill`
- **THEN** SHALL 同样报错

### Requirement: uninstall --from 删除 collection group
`uninstall --from <ref>` SHALL 在卸载 members 后同时删除对应 collection group entry。

#### Scenario: 卸载后清理 group
- **WHEN** 用户执行 `uninstall --from @alice/kit`
- **THEN** members 被卸载完成后 `groups.json` 中 `@alice/kit` 条目 SHALL 被删除

#### Scenario: 部分 member 不存在
- **WHEN** collection 含 3 个 member，本地仅装了 2 个
- **THEN** 卸载已装的 2 个，并删除 collection group entry

### Requirement: update <collection-ref> sync 差量
当 `skillsmgr update <ref>` 的 ref 形式被识别为 collection ref 时，系统 SHALL 重新调 resolve endpoint，对比 group 当前 members 与服务端最新 members，安装新增 skill，并更新 group snapshot。

#### Scenario: 增加新 member
- **WHEN** 服务端 collection 新增了一个 skill，用户执行 `skillsmgr update @alice/kit`
- **THEN** SHALL 安装新增 skill，把它加入 group members 列表，更新 `updatedAt`

#### Scenario: 服务端移除 member
- **WHEN** 服务端 collection 移除了一个 skill，本地原本有它
- **THEN** SHALL 从 group members 列表移除，但 SHALL NOT uninstall 该 skill 的本地副本（避免影响其他 group 引用）

#### Scenario: 对应 group 不存在时报错
- **WHEN** 用户执行 `update @bob/never-installed`
- **THEN** SHALL 报错提示先 `install --from @bob/never-installed`

### Requirement: groups list 展示 collection group
`skillsmgr group list` SHALL 在输出中区分展示 collection groups（与 virtual / local-batch 分组）。

#### Scenario: 含三种 group 的输出
- **WHEN** 本地有 1 virtual + 1 local-batch + 1 collection group
- **THEN** 输出 SHALL 标识每个 group 的 kind，collection group 显示 ref

### Requirement: skills list 标注 collection 归属
`skillsmgr list` SHALL 在每个 skill 行后标注其所属 collection group（如有），并在末尾汇总所有 collection groups。`--json` 输出 SHALL 给每个 skill 增加 `collections: string[]` 字段。

#### Scenario: skill 属于 collection group
- **WHEN** `@alice/kit` collection 安装后包含 skill `foo`
- **THEN** `skillsmgr list` 中 `foo` 行 SHALL 显示 `← @alice/kit`

#### Scenario: skill 同时属于多个 collection
- **WHEN** skill `foo` 出现在 `@alice/kit` 和 `@bob/cool` 两个 collection 中
- **THEN** 显示 `← @alice/kit, @bob/cool`

#### Scenario: 无 collection 归属
- **WHEN** skill 不属于任何 collection group
- **THEN** 行末不显示 `←` 标记

#### Scenario: 末尾汇总
- **WHEN** 本地至少有 1 个 collection group
- **THEN** `skillsmgr list` 末尾 SHALL 输出 `── collections ──` 段，列出所有 collection group ref + 成员数

#### Scenario: --json 输出
- **WHEN** 用户执行 `skillsmgr list --json`
- **THEN** 每个 skill 对象 SHALL 包含 `collections` 字段（string[]）
