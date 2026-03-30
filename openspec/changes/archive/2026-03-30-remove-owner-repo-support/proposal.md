## Why

`remove` 命令只支持按 skill 名称移除 (如 `skillsmgr remove commit`), 不支持 `owner/repo` 格式 (如 `skillsmgr remove mattpocock/skills`).  而 `add` 和 `uninstall` 都已支持 `owner/repo` 格式, 导致用户体验不一致.  用户按直觉使用 `remove mattpocock/skills` 时会得到 "not found" 错误.

## What Changes

- `remove` 命令增加 `owner/repo` 格式检测, 检测到时通过中央仓库查找该 source 下的所有 skills, 过滤出已部署的, 批量移除
- 对齐 `add` 和 `uninstall` 已有的参数格式路由模式

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `skill-lifecycle`: `remove` 操作增加 `owner/repo` 格式支持, 可按 source 批量移除已部署的 skills

## Impact

- `src/commands/remove.ts`: 增加格式检测和 owner/repo 处理分支
- 复用 `add.ts` 中的 `detectArgFormat` 和 `findRepoInCentralRepository` 逻辑 (或提取为共享工具函数)
- 现有按 skill name 移除的行为不变
