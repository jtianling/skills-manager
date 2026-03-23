## REMOVED Requirements

### Requirement: CommandInfo data model
**Reason**: Command 概念已被废弃, 所有工具转向使用 skill
**Migration**: 无需迁移, command 功能不再可用

### Requirement: ScannedCommand data model
**Reason**: 随 command 概念一起移除
**Migration**: 无

### Requirement: Command discovery and loading
**Reason**: `CommandsService` 不再需要
**Migration**: 无

### Requirement: Command installation
**Reason**: 不再安装 command
**Migration**: 无

### Requirement: Command deployment
**Reason**: 不再部署 command
**Migration**: 用户手动清理已部署的 command 文件

### Requirement: Command removal
**Reason**: 不再管理 command
**Migration**: 无

### Requirement: Command sync
**Reason**: 不再同步 command
**Migration**: 无

### Requirement: Command update
**Reason**: 不再更新 command
**Migration**: 无
