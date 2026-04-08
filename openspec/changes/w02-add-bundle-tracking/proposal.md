# Proposal: w02-add-bundle-tracking

## Why

w01 让 update/uninstall 能对称接受 install 的所有**单 skill 范围** input 形式, 但无法表达"一个 batch 目录 / 一次 install 安装的多个 skill 是一个整体"这种关系.  要实现 w03 的"update batch 时同步源里新增/删除的 skill"语义, 必须先在数据层记录"bundle"概念: 一次 install 的产物集合, 带 selectionMode (`all` 或 `subset`), 源 url, 成员列表.

本 change 只动数据模型和 install 的写入逻辑.  update / uninstall 行为不变, 用户层无感知.  是 w03 的前置依赖.

## What Changes

- sources.json schema v1 → v2, 新增顶层 `bundles` section (与 `sources` 并列)
- Bundle 数据结构: `id`, `type`, `url`, `selectionMode`, `members`, `installedAt`, `updatedAt`
- **BREAKING** (内部): `SourcesService` 增加 `addBundle`, `getBundle`, `listBundles`, `removeBundle`, `updateBundle` 等方法, 并在 load 时执行 v1 → v2 迁移
- install 命令在写 sources 的同时写 bundle 条目:
  - 单 skill install → 不建 bundle (bundle 是多成员概念)
  - 本地 batch install (`installFromLocalDirBatch`) → 建 `type: 'local-batch'` bundle
  - git install (`installViaGitClone`) → 建 `type: 'git'` bundle
  - zip install → 建 `type: 'zip'` bundle
  - registry install → 不建 bundle (registry 包总是单 skill)
- selectionMode 推断:
  - 传 `--all` flag → `all`
  - 传 `-s/--skill` 显式列表 → `subset`
  - 交互式选择"全选了" → `all`
  - 交互式部分选 → `subset`
  - 单 skill 只有 1 个可选 → `all`
- 交互式 prompt 函数 (`promptSkillsToInstall`) 返回类型从 `string[]` 改为 `{ names: string[], isAll: boolean }`
- 迁移逻辑: 首次读 v1 sources.json 时, 按 `url` + `installMethod` 聚合现有 source 条目成 bundle, selectionMode 默认为 `all` (无历史信息), 写回为 v2

## Capabilities

### New Capabilities
- `bundle-tracking`: sources.json 的 bundle 数据模型, 记录多 skill install 的聚合元数据, 为 batch-aware update/uninstall 提供底座

### Modified Capabilities
- `source-management`: sources.json schema 升级到 v2, 新增 bundles section 和迁移逻辑描述
- `install-directory-batch`: install 本地 batch 目录时写入 bundle 条目, selectionMode 基于交互式选择推断
- `custom-install`: install 写入 bundle 条目的行为扩展到所有 multi-skill install 路径 (git, zip)
- `cli-interaction`: 交互式 `promptSkillsToInstall` 返回类型变化

## Impact

- **代码**:
  - `src/services/sources.ts`: 新增 Bundle 相关方法和 v1 → v2 migration
  - `src/commands/install.ts`, `src/commands/install-local.ts`, `src/commands/install-git.ts`: 写 bundle 条目, 传递 selectionMode
  - `src/utils/prompts.ts`: `promptSkillsToInstall` 返回类型变化
  - `src/types.ts`: 新增 `Bundle`, `SelectionMode`, `BundleType` 类型
- **测试**:
  - `src/services/sources.test.ts`: 新增 bundle CRUD 测试, migration 测试 (v1 → v2)
  - install 各路径的测试更新: 验证 bundle 条目被正确写入
- **用户感知**:
  - 第一次运行升级后的版本时, sources.json 会被自动迁移 (加 bundles section), mtime 变化但 sources 内容不变
  - `skillsmgr list` 等现有命令行为不变
  - update / uninstall 行为不变 (w03 才会使用 bundles)
- **向后兼容**:
  - 旧版本 skillsmgr 读 v2 sources.json 时, 能继续工作 (忽略 bundles 字段), 但写回会丢 bundles — **需文档提醒用户不要混用新旧版本**
  - v2 sources.json 读 v1 格式 OK (migration 自动补全)
- **依赖**: 无新增第三方依赖
