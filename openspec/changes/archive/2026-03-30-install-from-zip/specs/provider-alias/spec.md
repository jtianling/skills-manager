## REMOVED Requirements

### Requirement: Provider alias 解析
**Reason**: 去掉 official provider shorthand 后, alias 机制失去意义. 裸词一律解析为本地目录.
**Migration**: 使用 `owner/repo` 格式安装. 例如 `skillsmgr install vercel-labs/skills` 替代 `skillsmgr install vercel`.

### Requirement: resolveProviderAlias 函数
**Reason**: 随 alias 机制一起移除.
**Migration**: 不再需要 alias 解析, 直接使用 `owner/repo`.
