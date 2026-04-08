# Bundle Sync

BundleManager 服务和 bundle 级的 sync / remove 操作实现, 用于支持 update / uninstall 的 group 同步语义.  Bundle 被视作一次 install 的聚合单位, sync 操作将本地 bundle 状态与源状态对齐.

## ADDED Requirements

### Requirement: BundleManager 公开接口

系统 SHALL 提供 `BundleManager` 类, 公开 `sync(bundleId, options)` 和 `remove(bundleId)` 两个异步方法, 分别用于同步和全量删除 bundle.  构造函数 SHALL 接受 `SourcesService`, `GitHubService`, 和文件系统辅助作为依赖以便测试 mock.

#### Scenario: sync 方法签名
- **WHEN** 调用 `bundleManager.sync(bundleId, { sync: boolean, verbose: boolean })`
- **THEN** 返回 `Promise<BundleSyncResult>` 包含 `updated`, `upToDate`, `added`, `addedSkipped`, `removedKept`, `removedHard`, `failed` 计数字段

#### Scenario: remove 方法签名
- **WHEN** 调用 `bundleManager.remove(bundleId)`
- **THEN** 返回 `Promise<BundleRemoveResult>` 包含 `removed` 计数字段

#### Scenario: bundle 不存在
- **WHEN** 调用任一方法且 bundleId 不存在
- **THEN** 抛出明确错误 "Bundle not found: {bundleId}"

### Requirement: local-batch bundle 扫描源目录

对 `type: 'local-batch'` 的 bundle, BundleManager SHALL 扫描 `bundle.url` 路径下包含 SKILL.md 的子目录作为当前源 skill 列表.  若 `bundle.url` 路径不存在, SHALL 报错 "Bundle source path not found: {path}" 并终止 sync.

#### Scenario: 扫描子目录
- **WHEN** bundle.url 指向 `/Users/foo/spec-tdd`, 该目录下有 `st-apply/SKILL.md`, `st-new/SKILL.md`, `st-archive/SKILL.md`
- **THEN** sync 扫描得到 skill 列表 `['st-apply', 'st-new', 'st-archive']`

#### Scenario: 源路径不存在
- **WHEN** bundle.url 指向 `/nonexistent/path`
- **THEN** sync 报错 "Bundle source path not found: /nonexistent/path"
- **THEN** 非零退出

### Requirement: git bundle 扫描远端目录

对 `type: 'git'` 的 bundle, BundleManager SHALL 通过 `GitHubService.listSkills` 尝试常见路径 (`skills`, `.`, `src/skills`) 获取远端 skill 列表.  扫描结果 MUST 包括所有包含 SKILL.md 的远端目录名.

#### Scenario: 扫描远端 skills 目录
- **WHEN** bundle.url 为 `https://github.com/obra/superpowers`
- **THEN** sync 调用 `listSkills('obra', 'superpowers', 'skills')` 获取远端列表

#### Scenario: 远端无 skills 目录但有根 SKILL.md
- **WHEN** 仓库根目录有 SKILL.md (root-skill repo)
- **THEN** sync 识别为单 skill repo, 列表只包含 repo name

### Requirement: diff 计算

BundleManager SHALL 对"当前源 skill 列表"和"bundle.members 里记录的 skill 名"计算 diff, 分为三类: `added` (源有, bundle 无), `existing` (两边都有), `removed` (bundle 有, 源无).  skill 名提取 SHALL 从 source key 取最后一段 (e.g. `custom/spec-tdd/st-apply` → `st-apply`).

#### Scenario: 完整 diff
- **WHEN** 当前源 `[st-apply, st-new, st-archive]`, bundle.members 含 `st-apply, st-archive, st-gone`
- **THEN** added = `[st-new]`
- **THEN** existing = `[st-apply, st-archive]`
- **THEN** removed = `[st-gone]`

### Requirement: existing 成员按内容 diff 更新

对 diff 结果中 `existing` 类的每个 skill, BundleManager SHALL 比对源中 SKILL.md 和本地 SKILL.md 内容, 不同则重新拷贝, 相同则跳过.  对 local-batch 类型直接比对文件内容.  对 git 类型通过 raw URL 获取远端 SKILL.md 比对.

#### Scenario: 内容未变
- **WHEN** existing skill 的本地 SKILL.md 与源相同
- **THEN** 计入 `upToDate`, 输出 `  ✓ {name}: up to date` (verbose 模式) 或折叠

#### Scenario: 内容已变
- **WHEN** existing skill 的本地 SKILL.md 与源不同
- **THEN** 删除本地目录, 从源重新拷贝, 计入 `updated`, 输出 `  ↑ {name}: updated`

### Requirement: added 成员按 selectionMode 处理

对 diff 结果中 `added` 类的每个 skill, BundleManager SHALL 按 bundle.selectionMode 应用不同策略:

- `selectionMode === 'all'`: 从源安装到本地, 新增 source 条目到 sources.json, 加入 bundle.members, 计入 `added`
- `selectionMode === 'subset'`: 跳过安装, 计入 `addedSkipped`, 输出提示

#### Scenario: all 模式自动安装新增 skill
- **WHEN** bundle.selectionMode === 'all' 且源中新增了 `st-new`
- **THEN** BundleManager 从源拷贝/下载 `st-new` 到对应目标路径
- **THEN** sourcesService.addSource 写入新的 source 条目
- **THEN** bundle.members 追加新的 source key
- **THEN** 输出 `  + st-new: new in source (installed)`

#### Scenario: subset 模式跳过新增 skill
- **WHEN** bundle.selectionMode === 'subset' 且源中新增了 `st-new`
- **THEN** BundleManager 不安装
- **THEN** bundle.members 不变
- **THEN** 输出 `  + st-new: new in source (skipped, subset mode)`

### Requirement: removed 成员按 --sync flag 处理

对 diff 结果中 `removed` 类的每个 skill, BundleManager SHALL 按 options.sync 应用不同策略:

- 默认 (options.sync !== true): 保留本地目录和 bundle.members 条目, 计入 `removedKept`, 输出 warn 提示
- `options.sync === true`: 删除本地目录, 从 sources.json 和 bundle.members 中移除, 清理 groups.json 引用, 计入 `removedHard`, 输出删除信息

#### Scenario: 默认 warn-keep
- **WHEN** bundle.members 中有 `st-gone` 但源中已不存在, options.sync !== true
- **THEN** 本地 `st-gone` 目录保留
- **THEN** bundle.members 保留 `st-gone`
- **THEN** 输出 `  - st-gone: removed from source (kept locally, use --sync to remove)`

#### Scenario: --sync 硬删除
- **WHEN** bundle.members 中有 `st-gone` 但源中已不存在, options.sync === true
- **THEN** 本地 `st-gone` 目录被删除
- **THEN** sources.json 中对应条目被移除
- **THEN** bundle.members 中移除 `st-gone`
- **THEN** groups.json 中相关引用被清理
- **THEN** 输出 `  - st-gone: removed`

### Requirement: sync 后更新 bundle 时间戳

sync 完成后 (无论是否有变化), BundleManager SHALL 调用 `sourcesService.updateBundleTimestamp` 刷新 bundle.updatedAt.  若 members 有变化 (added 或 removed 实际生效), MUST 同步调用 `updateBundleMembers` 更新成员列表.

#### Scenario: 无变化仅更新时间戳
- **WHEN** sync 后 diff 为空 (全部 existing 且 up to date)
- **THEN** bundle.updatedAt 仍被更新到当前时间
- **THEN** bundle.members 不变

#### Scenario: 有变化同步更新 members
- **WHEN** sync 后有 added (all 模式) 或 removed (sync 模式)
- **THEN** bundle.members 被替换为新列表
- **THEN** bundle.updatedAt 更新

### Requirement: 单 skill 失败不中断 sync

sync 过程中对某个子 skill 的操作 (下载, 拷贝) 失败时, BundleManager SHALL 捕获错误, 计入 `failed` 计数, 输出错误消息, 继续处理剩余 skill.  sync 方法 SHALL 不抛异常返回, 调用方据 failed > 0 判断整体是否失败.

#### Scenario: 网络失败部分 skill
- **WHEN** git bundle sync 时某个 skill 的 downloadSkill 失败
- **THEN** 输出 `  ✗ {name}: failed to update` 或对应错误信息
- **THEN** 计入 failed += 1
- **THEN** 其他 skill 继续处理
- **THEN** 最终返回的统计中 failed 反映失败数

### Requirement: BundleManager.remove 全量删除

`remove(bundleId)` SHALL 删除 bundle.members 中所有 source 对应的本地目录, 清理 sources.json 中每条 source, 清理 groups.json 中引用, 最后删除 bundle 条目本身.  `cleanEmptyParents` 逻辑 SHALL 在删除后清理空的父目录.

#### Scenario: 批量删除所有成员
- **WHEN** 调用 `remove(bundleId)` 且 bundle.members 有 19 条
- **THEN** 19 个本地 skill 目录被删除
- **THEN** sources.json 中 19 条 source 条目被移除
- **THEN** groups.json 中这些 skill 的引用被清理
- **THEN** bundle 条目本身被从 bundles 中移除
- **THEN** 空的父目录被清理

#### Scenario: 成员部分已不存在不影响其他成员
- **WHEN** remove 时某成员的本地目录已被手动删除
- **THEN** 该成员跳过, 不报错
- **THEN** 其他成员正常删除
- **THEN** bundle 条目仍被移除

### Requirement: BundleManager sync 对 zip bundle 的处理

`type: 'zip'` 的 bundle 对 sync 操作 SHALL 输出 "zip bundle update not supported, reinstall required" 并返回空结果 (所有计数为 0).  不影响 `remove` 操作.

#### Scenario: zip bundle sync 跳过
- **WHEN** 调用 `sync(zipBundleId)`
- **THEN** 输出提示消息
- **THEN** 返回 `{ updated: 0, upToDate: 0, ... }` 全零结果

#### Scenario: zip bundle remove 正常工作
- **WHEN** 调用 `remove(zipBundleId)`
- **THEN** 按通用 remove 流程批量删除 members
