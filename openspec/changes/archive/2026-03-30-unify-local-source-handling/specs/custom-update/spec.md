## REMOVED Requirements

### Requirement: custom-update 命令
**Reason**: 功能完全并入 `update` 命令. local-copy source 的更新通过 `update` 的本地路径支持处理.
**Migration**: 使用 `skillsmgr update ./path` 或 `skillsmgr update` (全量更新时自动处理 local-copy 来源).

### Requirement: custom-update 命令别名 cu
**Reason**: 随 `custom-update` 命令一起移除.
**Migration**: 使用 `skillsmgr update`.
