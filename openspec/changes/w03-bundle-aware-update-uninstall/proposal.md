# Proposal: w03-bundle-aware-update-uninstall

## Why

w02 让 sources.json 持有 bundle 元数据, 但 update / uninstall 还没用上.  用户原始需求: `update ./spec-tdd` 应该把整个 batch 同步更新, 并且源里新增的 skill 也应该自动安装 (group 更新语义).  本 change 把 update / uninstall 接到 bundle 上, 实现 group sync 语义.

## What Changes

- 新增 `src/services/bundle-manager.ts`, 提供 `BundleManager` 类封装 bundle 级 sync 和 remove 操作
- SourceResolver (w01) 新增 bundle 识别能力: 本地 batch 路径不再返回 `batch-unsupported`, 而是返回 `kind: 'bundle'` 带 bundleId
- `ResolvedTarget` 新增 `kind: 'bundle'` 变体和 `bundleId?: string` 字段
- `update` 命令收到 `kind: 'bundle'` 时调用 `bundleManager.sync(bundleId, options)`:
  - 扫描源当前 skill 列表 (local-batch: 扫目录; git: 调 `listSkills`)
  - 对比 `bundle.members`, 计算 diff (新增/已存在/已删除)
  - 按 `selectionMode` 应用规则:
    - `all`: 新增 → 自动安装; 已存在 → 按内容 diff 更新
    - `subset`: 新增 → 跳过 (用户当初没选); 已存在 → 更新
  - 已删除的成员 (在 bundle.members 中但源里没了):
    - 默认: 保留本地, warn 提示用户 (warn-keep)
    - `--sync` flag: 一并删除本地 (sync-remove)
- `uninstall` 命令收到 `kind: 'bundle'` 时调用 `bundleManager.remove(bundleId)`: 批量删除所有 members 和 bundle 条目本身
- update/uninstall 新增 `--sync` / `--verbose` / `-v` 等 flag 描述
- update 输出格式优化: 默认折叠"up to date"计数, 只列出有变化的 skill; `-v` 全部列出

## Capabilities

### New Capabilities
- `bundle-sync`: BundleManager 服务和 bundle 级的 sync / remove 操作, 实现 group 同步语义

### Modified Capabilities
- `source-resolver`: `ResolvedTarget` 新增 `bundle` kind, 本地 batch 路径返回 bundle 而不是 batch-unsupported
- `local-update`: update 命令接受本地 batch 路径, 走 bundle 流程
- `uninstall`: uninstall 命令接受本地 batch 路径和 bundle 批量删除
- `cli-interaction`: update / uninstall 新增 `--sync`, `-v/--verbose` 选项

## Impact

- **代码**:
  - 新增 `src/services/bundle-manager.ts` 和 `src/services/bundle-manager.test.ts`
  - 修改 `src/services/source-resolver.ts`: 加 bundle 识别 (w03 依赖 w01 + w02)
  - 修改 `src/commands/update.ts`: 处理 `kind: 'bundle'`
  - 修改 `src/commands/uninstall.ts`: 处理 `kind: 'bundle'`
  - 可能需要复用 `src/commands/install-local.ts` 的 skill 扫描逻辑, 抽成共享 helper
- **测试**:
  - BundleManager 单元测试覆盖 all/subset selectionMode, warn-keep/sync-remove, local-batch/git 两种 type
  - update / uninstall 集成测试覆盖本地 batch 路径
  - 完整回归: 修改/新增/删除子 skill 后 update 的行为符合预期
- **用户感知**:
  - `skillsmgr update ./spec-tdd` 从报错变成正常工作, 同步源目录
  - 源目录新增的 skill 被自动安装 (selectionMode=all) 或跳过并 warn (selectionMode=subset)
  - 源目录删除的 skill 默认保留并 warn, `--sync` flag 触发硬删除
  - `skillsmgr uninstall ./spec-tdd` 批量删除整个 bundle
  - update 输出默认折叠 up-to-date 项, `-v` 显示完整列表
- **向后兼容**:
  - 依赖 w02 的 v2 schema, 旧 sources.json 在 w02 迁移后自动生效
  - 未迁移的 v1 sources.json 仍能工作 (w02 会自动迁移)
  - 没有 bundle 条目的 single-skill source 行为与 w01 完成后一致
