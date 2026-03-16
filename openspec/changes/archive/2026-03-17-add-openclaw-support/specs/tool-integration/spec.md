## MODIFIED Requirements

### Requirement: 支持的工具

常量 `SUPPORTED_TOOLS` 定义了工具标识符列表, 顺序为:

```
antigravity, codex-cli, roo-code, claude-code, gemini-cli,
opencode, cline, cursor, kilo-code, trae, windsurf, openclaw
```

此顺序影响 UI 中工具选择的显示顺序和 `scanAllTools()` 的遍历顺序.

| 工具 | 标识符 | Skills 目录 | Commands 目录 | 模式支持 |
|------|--------|------------|--------------|---------|
| Antigravity | antigravity | .agent/skills | .agent/workflows | No |
| Codex CLI | codex-cli | .codex/skills | - | No |
| Roo Code | roo-code | .roo/skills | .roo/commands | Yes |
| Claude Code | claude-code | .claude/skills | .claude/commands | No |
| Gemini CLI | gemini-cli | .gemini/skills | .gemini/commands | No |
| OpenCode | opencode | .opencode/skills | .opencode/commands | No |
| Cline | cline | .cline/skills | - | No |
| Cursor | cursor | .cursor/skills | .cursor/commands | No |
| Kilo Code | kilo-code | .kilocode/skills | .kilocode/commands | Yes |
| Trae | trae | .trae/skills | - | No |
| Windsurf | windsurf | .windsurf/skills | .windsurf/workflows | No |
| OpenClaw | openclaw | .openclaw/skills | - | No |

#### Scenario: OpenClaw 出现在支持工具列表中
- **WHEN** 读取 SUPPORTED_TOOLS 常量
- **THEN** 列表中 SHALL 包含 `openclaw` 标识符

#### Scenario: OpenClaw 配置完整
- **WHEN** 通过 `getToolConfig('openclaw')` 获取配置
- **THEN** SHALL 返回 ToolConfig 对象, 其中 name 为 `openclaw`, displayName 为 `OpenClaw`, skillsDir 为 `.openclaw/skills`, commandsDir 为 undefined, supportsLink 为 true, supportsModeSpecific 为 false

### Requirement: Skills 目录

所有 12 个工具均支持 skills 部署.  部署时在项目中创建对应的目录结构:

```
project/
├── .agent/skills/          # Antigravity
├── .claude/skills/         # Claude Code
├── .cline/skills/          # Cline
├── .codex/skills/          # Codex CLI
├── .cursor/skills/         # Cursor
├── .gemini/skills/         # Gemini CLI
├── .kilocode/skills/       # Kilo Code
├── .openclaw/skills/       # OpenClaw
├── .opencode/skills/       # OpenCode
├── .roo/skills/            # Roo Code
├── .trae/skills/           # Trae
└── .windsurf/skills/       # Windsurf
```

每个工具的 skills 目录是独立的.  同一个 skill 可以同时部署到多个工具.

#### Scenario: OpenClaw skills 目录部署
- **WHEN** 用户选择将 skill 部署到 OpenClaw
- **THEN** skill SHALL 被部署到项目的 `.openclaw/skills/` 目录下

### Requirement: Commands 目录

8 个工具支持 commands (commandsDir 不为 undefined):
- Claude Code: `.claude/commands`
- Cursor: `.cursor/commands`
- Roo Code: `.roo/commands`
- Kilo Code: `.kilocode/commands`
- Gemini CLI: `.gemini/commands`
- OpenCode: `.opencode/commands`
- Antigravity: `.agent/workflows` (目录名为 workflows)
- Windsurf: `.windsurf/workflows` (目录名为 workflows)

不支持 commands 的工具 (commandsDir 为 undefined):
- Cline
- Codex CLI
- Trae
- OpenClaw

#### Scenario: OpenClaw 不支持 commands
- **WHEN** 通过 `getCommandsTargetDir()` 获取 OpenClaw 的 commands 目录
- **THEN** SHALL 返回 undefined

### Requirement: ToolConfig 结构

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| name | ToolName | - | 工具标识符, 与 SUPPORTED_TOOLS 中的值对应 |
| displayName | string | - | 用户可见的显示名称 (如 "Claude Code", "OpenClaw") |
| skillsDir | string | - | skills 部署目录, 相对于项目根目录 |
| commandsDir | string? | undefined | commands 部署目录, 不支持时为 undefined |
| supportsLink | boolean | true | 是否支持 symlink, 当前所有工具均为 true |
| supportsModeSpecific | boolean | false | 是否支持模式特定部署 |
| modePattern | string? | undefined | 模式目录模式, 仅 mode-specific 工具有值 |
| availableModes | string[]? | undefined | 可用模式列表, 仅 mode-specific 工具有值 |

#### Scenario: ToolName 联合类型包含 openclaw
- **WHEN** TypeScript 编译器推导 ToolName 类型
- **THEN** SHALL 包含字面量类型 `'openclaw'`
