# Bundle Tracking

sources.json 中的 bundle 元数据, 记录一次 install 产生的多 skill 聚合关系, 为后续的 batch-aware update/uninstall 操作提供底座.  Bundle 是系统态概念, 和用户态虚拟 group (`groups.json`) 完全独立.

## ADDED Requirements

### Requirement: sources.json v2 schema

sources.json SHALL 使用 version `"2.0"` 表示新 schema, 包含 `sources` 和 `bundles` 两个顶层 section.  `sources` section 与 v1 结构一致, `bundles` section 记录聚合元数据.

#### Scenario: v2 schema 结构
- **WHEN** 系统读取 version `"2.0"` 的 sources.json
- **THEN** 顶层字段包含 `version`, `sources`, `bundles`
- **THEN** `bundles` 是以 bundleId 为键的对象

#### Scenario: 缺失 bundles section
- **WHEN** v2 sources.json 中 `bundles` 字段不存在或为 undefined
- **THEN** 系统视为空对象 `{}`, 不报错

### Requirement: Bundle 数据结构

每个 bundle 条目 SHALL 包含字段: `type` (`'local-batch' | 'git' | 'zip'`), `url` (string), `selectionMode` (`'all' | 'subset'`), `members` (string[] 记录 source key), `installedAt` (ISO 8601), `updatedAt` (ISO 8601).

#### Scenario: local-batch bundle 示例
- **WHEN** 系统存储一个本地 batch install 的 bundle
- **THEN** 该 bundle 的 `type` 为 `'local-batch'`
- **THEN** `url` 为源目录的绝对路径
- **THEN** `members` 列出所有 `custom/{dirName}/{skillName}` source key

#### Scenario: git bundle 示例
- **WHEN** 系统存储一个 git install 的 bundle
- **THEN** 该 bundle 的 `type` 为 `'git'`
- **THEN** `url` 为归一化后的 https URL (去 `.git` 后缀)
- **THEN** `members` 列出所有 `official/|community/` source key

#### Scenario: members 保持 install 时的顺序
- **WHEN** install 命令按顺序安装多个 skill 并写入 bundle
- **THEN** bundle.members 的顺序与 install 顺序一致

### Requirement: bundleId 生成规则

bundleId SHALL 按 `{type}:{normalizedUrl}` 格式生成.  URL 归一化 MUST 与 w01 SourceResolver 的 URL 归一化规则一致 (去 `.git`, ssh→https 等价, host 小写).  同一 `(type, normalizedUrl)` 组合 SHALL 总是产生同一 bundleId (幂等).

#### Scenario: 本地 batch bundleId
- **WHEN** 源路径为 `/Users/foo/spec-tdd`
- **THEN** bundleId 为 `local-batch:/Users/foo/spec-tdd`

#### Scenario: git bundleId (https)
- **WHEN** git URL 为 `https://github.com/obra/superpowers`
- **THEN** bundleId 为 `git:https://github.com/obra/superpowers`

#### Scenario: git bundleId (ssh 归一化)
- **WHEN** git URL 为 `git@github.com:obra/superpowers.git`
- **THEN** bundleId 归一化为 `git:https://github.com/obra/superpowers` (与 https 形式相同)

#### Scenario: 同 url 重复 install 幂等
- **WHEN** 用户对同一源执行两次 install
- **THEN** 两次都得到同一 bundleId, 第二次 install 更新 bundle 而不是新建

### Requirement: SelectionMode 定义和推断

bundle.selectionMode SHALL 反映 install 时用户对成员的选择意图.  `'all'` 表示"装源里的所有 skill", `'subset'` 表示"只装我选定的这些".  install 命令 SHALL 按以下优先级推断 selectionMode:

1. `--all` flag → `all`
2. `-s/--skill` 显式列表 → `subset`
3. 非交互且只有 1 个可选 → `all`
4. 交互式选择全部 → `all`
5. 交互式选择部分 → `subset`

#### Scenario: --all flag
- **WHEN** 用户执行 `skillsmgr install ./spec-tdd --all`
- **THEN** bundle.selectionMode 为 `'all'`

#### Scenario: -s 显式列表
- **WHEN** 用户执行 `skillsmgr install ./spec-tdd -s st-apply -s st-archive`
- **THEN** bundle.selectionMode 为 `'subset'`

#### Scenario: 交互式全选
- **WHEN** 用户在交互式选择时勾选了所有可选 skill 后回车
- **THEN** bundle.selectionMode 为 `'all'`

#### Scenario: 交互式部分选
- **WHEN** 用户在交互式选择时只勾选了部分 skill
- **THEN** bundle.selectionMode 为 `'subset'`

### Requirement: SourcesService bundle CRUD

`SourcesService` SHALL 提供以下 bundle 操作方法: `getAllBundles()`, `getBundle(id)`, `addBundle(id, info)`, `updateBundleMembers(id, members)`, `updateBundleTimestamp(id)`, `removeBundle(id)`, `findBundleByUrl(normalizedUrl, type)`.  所有写操作 SHALL 维持 `installedAt` (首次添加时间, 不被后续 update 覆盖) 和 `updatedAt` (每次修改时间).

#### Scenario: addBundle 新建
- **WHEN** 调用 `addBundle(bundleId, info)` 且该 id 不存在
- **THEN** bundles section 新增条目, `installedAt` 和 `updatedAt` 均为当前时间

#### Scenario: addBundle 已存在更新
- **WHEN** 调用 `addBundle(bundleId, info)` 且该 id 已存在
- **THEN** 保留原 `installedAt`, 更新 `updatedAt` 和其他字段

#### Scenario: findBundleByUrl 归一化匹配
- **WHEN** 调用 `findBundleByUrl('https://github.com/obra/superpowers', 'git')`
- **THEN** 返回 bundleId 匹配 `git:https://github.com/obra/superpowers` 的条目

#### Scenario: removeBundle 清除
- **WHEN** 调用 `removeBundle(bundleId)`
- **THEN** bundles section 中该条目被移除
- **THEN** members 列表中的 source 条目**不**被自动删除 (由调用方负责清理)

### Requirement: v1 → v2 自动迁移

`SourcesService.load()` SHALL 在读到 version `"1.0"` 或缺失 version 字段的 sources.json 时自动执行迁移.  迁移 MUST 保留所有原有 source 条目, 按 `(type, url, installMethod)` 聚合生成 bundle 条目.  单成员组 SHALL 不生成 bundle.  生成的 bundle selectionMode SHALL 统一为 `'all'`.  迁移完成后 SHALL 写回 version 为 `"2.0"` 的 sources.json.  写入 MUST 使用原子操作 (temp 文件 + rename).

#### Scenario: v1 文件自动升级
- **WHEN** 系统读取 version 为 `"1.0"` 的 sources.json
- **THEN** 系统执行聚合逻辑生成 bundles
- **THEN** 写回时 version 字段为 `"2.0"`
- **THEN** 原有 sources 条目不变

#### Scenario: 多成员聚合
- **WHEN** 旧 sources.json 中有 19 条 `custom/spec-tdd/*` 都指向同一 url `/Users/foo/spec-tdd`
- **THEN** 迁移生成一个 `local-batch:/Users/foo/spec-tdd` bundle
- **THEN** 该 bundle 的 members 包含 19 个 source key
- **THEN** selectionMode 为 `'all'`

#### Scenario: 单成员不建 bundle
- **WHEN** 旧 sources.json 中 `custom/jt-codex` 是唯一指向 `/Users/foo/jt-codex` 的 source
- **THEN** 迁移 NOT 为它生成 bundle

#### Scenario: 缺失 version 字段视为 v1
- **WHEN** 旧 sources.json 没有 version 字段
- **THEN** 系统按 v1 处理, 触发迁移

#### Scenario: 原子写避免半写
- **WHEN** 迁移过程中写入失败
- **THEN** sources.json 保持原 v1 内容, 不被破坏

#### Scenario: 迁移失败不阻塞读操作
- **WHEN** 迁移的写回阶段失败 (如磁盘满)
- **THEN** 内存中 load 返回的 SourcesData 仍然是已迁移的 v2 结构
- **THEN** 下次 load 再尝试写

### Requirement: Bundle 不影响现有命令行为

本 change 引入的 bundle 数据模型 SHALL NOT 改变 `skillsmgr list`, `skillsmgr search`, `skillsmgr add`, `skillsmgr deploy`, `skillsmgr group` 等命令的用户可见输出和行为.

#### Scenario: list 命令输出不变
- **WHEN** 用户执行 `skillsmgr list`
- **THEN** 输出格式与 v1 schema 时完全一致

#### Scenario: update / uninstall 行为不变
- **WHEN** 用户执行 `skillsmgr update <source>` 或 `skillsmgr uninstall <source>`
- **THEN** 命令行为与 w01 完成后的状态一致, bundle 信息不被使用 (留给 w03)
