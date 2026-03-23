## MODIFIED Requirements

### Requirement: ToolConfig data model

ToolConfig 接口定义工具的配置信息. 移除 command 相关字段后的结构:

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| name | ToolName | - | 工具标识符 |
| displayName | string | - | 用户可见的显示名称 |
| skillsDir | string | - | skills 部署目录 |
| supportsLink | boolean | true | 是否支持 symlink |
| supportsModeSpecific | boolean | false | 是否支持模式特定部署 |
| modePattern | string? | undefined | 模式目录模式 |
| availableModes | string[]? | undefined | 可用模式列表 |

`commandsDir` 字段 SHALL 被移除. 所有 12 个工具配置中的 `commandsDir` 定义 SHALL 被删除.

#### Scenario: ToolConfig no longer has commandsDir
- **WHEN** 查询任意工具的 ToolConfig
- **THEN** 不存在 `commandsDir` 属性

### Requirement: Tool configuration table

所有 12 个工具 SHALL 只保留 skills 相关配置:

| 工具 | Skills 目录 | 模式支持 |
|------|------------|---------|
| Claude Code | .claude/skills | No |
| Codex | .agents/skills | No |
| Gemini CLI | .agents/skills | No |
| OpenCode | .agents/skills | No |
| OpenClaw | .agents/skills | No |
| Antigravity | .agents/skills | No |
| Cline | .agents/skills | No |
| Cursor | .cursor/skills | No |
| Kilo Code | .kilocode/skills | Yes |
| Roo Code | .roo/skills | Yes |
| Trae | .trae/skills | No |
| Windsurf | .windsurf/skills | No |

#### Scenario: All tool configs only have skill properties
- **WHEN** 遍历 TOOL_CONFIGS 中所有工具
- **THEN** 每个配置只包含 name, displayName, skillsDir, supportsLink, supportsModeSpecific 以及可选的 modePattern, availableModes

## REMOVED Requirements

### Requirement: getCommandsTargetDir function
**Reason**: 不再有 commands 目录概念
**Migration**: 无, 内部函数无外部消费者

### Requirement: Commands directory support in deployment scanning
**Reason**: `DeploymentScanner` 不再扫描 commands 目录
**Migration**: 无

### Requirement: Commands directory in tool configuration table
**Reason**: 工具不再区分是否支持 commands
**Migration**: 无
