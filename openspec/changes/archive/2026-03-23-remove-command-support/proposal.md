## Why

Claude Code 正在淘汰 command 功能, 转向统一使用 skill.  其他 AI 编程工具也在跟进相同方向.  skills-manager 中的 command 支持增加了代码复杂度, 每个 CLI 操作都需要同时处理 skill 和 command 两条逻辑分支.  现在是时候移除 command 支持, 简化代码库.

## What Changes

- **BREAKING**: 移除所有 command 相关的数据模型 (`CommandInfo`, `ScannedCommand`)
- **BREAKING**: 移除 `ToolConfig.commandsDir` 字段, 所有工具配置不再包含 commands 目录
- **BREAKING**: 移除 `CommandsService` 整个服务类
- **BREAKING**: 移除 `Deployer` 中所有 command 部署/移除方法
- **BREAKING**: 移除 `DeploymentScanner` 中 command 扫描逻辑
- **BREAKING**: 移除 `GitHubService` 中 command 相关方法 (`listCommands`, `downloadCommandFile`, `getCommandsTargetDir`)
- **BREAKING**: 移除安装流程中 command 自动安装逻辑 (`installCommandsFromGitHub`, `countCommandsInRepo`)
- **BREAKING**: 移除所有 CLI 命令中 command 处理分支 (init, add, remove, list, sync, update)
- **BREAKING**: 移除 `promptCommands` 交互式提示
- **BREAKING**: 移除 `getCommandsTargetDir` 工具函数
- 清理所有 "skills and commands" 文案, 简化为 "skills"

## Capabilities

### New Capabilities

(无新增)

### Modified Capabilities

- `tool-integration`: 移除 `ToolConfig.commandsDir` 字段及 commands 目录相关配置, 移除 `getCommandsTargetDir` 函数
- `command-lifecycle`: 整个 capability 被移除
- `skill-lifecycle`: 移除 skill 生命周期中对 command 的引用 (如 init 中的 command 部署分支, remove 中的 command 检查)
- `source-management`: 移除安装和更新流程中的 command 处理逻辑
- `cli-interaction`: 移除 command 相关的提示, 输出格式, 前置条件检查

## Impact

- **代码文件**: ~12 个文件需要修改, 1 个文件 (`services/commands.ts`) 完整删除
- **类型定义**: `CommandInfo`, `ScannedCommand` 接口移除, `ToolConfig` 接口精简
- **测试**: command 相关测试用例需要移除或更新
- **已部署项目**: 已部署的 command 文件 (如 `.claude/commands/*.md`) 不会被自动清理, 用户需手动处理
- **CLI 描述**: install, list, init, add, remove, sync, update 命令的 description 需要更新
