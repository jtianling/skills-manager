# Custom Update [REMOVED]

> **Status**: REMOVED.  功能完全并入 `update` 命令.
>
> **Migration**: 使用 `skillsmgr update ./path` 或 `skillsmgr update` (全量更新时自动处理 local-copy 来源).

~~原 `custom-update` 命令及其别名 `cu` 已移除.  local-copy source 的更新通过 `update` 的本地路径支持处理.~~

## Purpose
`custom-update` 命令 (及别名 `cu`) 已移除, 其 local-copy source 的更新能力完全并入 `update` 命令.  本 spec 仅保留移除与迁移记录.

## Requirements

### Requirement: custom-update 命令已移除
系统 SHALL NOT 提供独立的 `custom-update` 命令或其别名 `cu`.  local-copy source 的更新 SHALL 通过 `skillsmgr update ./path` 或全量 `skillsmgr update` 处理.

#### Scenario: 不再提供 custom-update 入口
- **WHEN** 用户需要更新 local-copy source 的 skill
- **THEN** 系统 SHALL 通过 `skillsmgr update` 处理, 不存在 `custom-update` / `cu` 命令
