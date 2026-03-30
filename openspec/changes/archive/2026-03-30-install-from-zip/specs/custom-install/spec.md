## REMOVED Requirements

### Requirement: custom-install 命令
**Reason**: 功能完全并入 `install` 命令. 本地目录安装通过 `install` 的统一 source 识别自动处理.
**Migration**: 使用 `skillsmgr install <path>` 替代 `skillsmgr custom-install <path>`. `--group` 和 `--force` 参数在 `install` 命令上同样可用.

### Requirement: custom-install 命令别名 ci
**Reason**: 随 `custom-install` 命令一起移除.
**Migration**: 使用 `skillsmgr install` 或 `skillsmgr i`.
