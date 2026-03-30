## Why

`install` 命令支持 URL 格式(`https://github.com/owner/repo`, `git@github.com:owner/repo.git`), 但 `uninstall` 和 `remove` 命令不支持.  用户用 URL 安装后, 直觉上期望能用同样的 URL 卸载/移除, 当前会报 `Skill 'https://...' not found` 错误.  需要补齐输入格式的对称性.

## What Changes

- 新增共享的 URL → owner/repo 提取函数, 支持 GitHub/GitLab 及其他 Git 托管平台
- `uninstall` 命令接受 URL 输入, 自动提取 owner/repo 后走已有的 `uninstallSource()` 逻辑
- `remove` 命令接受 URL 输入, 自动提取 owner/repo 后走已有的 `removeByOwnerRepo()` 逻辑
- `detectArgFormat()` 增加对 URL 类型的处理, 返回 `'owner-repo'` 而非 `'install-source'`

## Capabilities

### New Capabilities

- `url-to-owner-repo`: 从 Git URL(HTTPS/SSH)提取 owner/repo 标识符的共享能力

### Modified Capabilities

- `uninstall`: 新增 URL 格式作为合法输入, 自动解析为 owner/repo 后执行已有卸载流程
- `source-management`: `detectArgFormat()` 对 URL 输入返回 `'owner-repo'`(附带解析后的值), 而非 `'install-source'`

## Impact

- `src/utils/repo-lookup.ts`: 修改 `detectArgFormat()`, 新增 URL 提取逻辑
- `src/commands/uninstall.ts`: `executeUninstall()` 增加 URL → owner/repo 分支
- `src/commands/remove.ts`: `executeRemove()` 中 URL 输入能正确路由到 `removeByOwnerRepo()`
- 无依赖变更, 无 API 变更, 无 breaking change
