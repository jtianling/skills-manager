## Why

`init` 命令执行增量部署时, 会将目标目录中所有已扫描到但未被用户选中的 skill 和 command 删除.  这意味着用户手动创建的、其他工具部署的、或不在 skills-manager 注册表中的 skill/command 会被意外删除.  这些 "未托管" 的内容应当被保留, init 命令只应管理自己部署的资源.

## What Changes

- init 命令在计算 `toRemove` 列表时, 过滤掉 `source === 'unknown'` 的 skill 和 command, 仅移除由 skills-manager 管理的项
- 对于未托管的 skill/command, 在部署输出中以独立标记显示 (如 `~ skill-name (unmanaged)`), 让用户知道这些内容的存在但不会被触碰
- sync 命令对 `source === 'unknown'` 的项也采用类似策略, 显示为 "unmanaged" 而非 "orphaned"

## Capabilities

### New Capabilities

(无新能力)

### Modified Capabilities

- `skill-lifecycle`: init 增量部署逻辑变更 — toRemove 排除未托管 skill; 新增 unmanaged 状态显示
- `command-lifecycle`: init 增量部署逻辑变更 — toRemove 排除未托管 command; 新增 unmanaged 状态显示

## Impact

- 受影响文件: `src/commands/init.ts`, `src/commands/sync.ts`
- 不涉及 API 变更、依赖变更或破坏性修改
- 已有的 link/copy 部署机制不受影响
