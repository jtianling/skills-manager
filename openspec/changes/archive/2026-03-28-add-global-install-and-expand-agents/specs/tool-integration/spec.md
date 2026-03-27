## MODIFIED Requirements

### 支持的工具

常量 `SUPPORTED_TOOLS` 定义了 45 个工具标识符列表.

**交互显示组** (`showInList=true`, 按 displayOrder 固定顺序):

```
claude-code, codex, cursor, openclaw, opencode, gemini-cli,
github-copilot, cline, kilo, roo, kiro-cli, trae, trae-cn,
codebuddy, windsurf, goose
```

**隐藏组** (`showInList=false`, 按 displayName 字母顺序):

```
adal, amp, antigravity, augment, command-code, continue, cortex,
crush, deepagents, droid, firebender, iflow-cli, junie, kimi-cli,
kode, mcpjam, mistral-vibe, mux, neovate, openhands, pi, pochi,
qoder, qwen-code, replit, universal, warp, zencoder
```

此顺序影响 UI 中 agent 选择的显示顺序.

完整 agent 配置表:

| 工具 | 标识符 | Native | 项目级 Skills 目录 | Symlink 源 | 全局 Skills 目录 | showInList |
|------|--------|--------|-------------------|-----------|-----------------|-----------|
| Claude Code | claude-code | No | .agents/skills | .claude/skills | ~/.claude/skills | Yes |
| Codex | codex | Yes | .agents/skills | - | ~/.codex/skills | Yes |
| Cursor | cursor | Yes | .agents/skills | - | ~/.cursor/skills | Yes |
| OpenClaw | openclaw | No | .agents/skills | skills | ~/.openclaw/skills | Yes |
| OpenCode | opencode | Yes | .agents/skills | - | ~/.config/opencode/skills | Yes |
| Gemini CLI | gemini-cli | Yes | .agents/skills | - | ~/.gemini/skills | Yes |
| GitHub Copilot | github-copilot | Yes | .agents/skills | - | ~/.copilot/skills | Yes |
| Cline | cline | Yes | .agents/skills | - | ~/.agents/skills | Yes |
| Kilo Code | kilo | No | .agents/skills | .kilocode/skills | ~/.kilocode/skills | Yes |
| Roo Code | roo | No | .agents/skills | .roo/skills | ~/.roo/skills | Yes |
| Kiro CLI | kiro-cli | No | .agents/skills | .kiro/skills | ~/.kiro/skills | Yes |
| Trae | trae | No | .agents/skills | .trae/skills | ~/.trae/skills | Yes |
| Trae CN | trae-cn | No | .agents/skills | .trae/skills | ~/.trae-cn/skills | Yes |
| CodeBuddy | codebuddy | No | .agents/skills | .codebuddy/skills | ~/.codebuddy/skills | Yes |
| Windsurf | windsurf | No | .agents/skills | .windsurf/skills | ~/.codeium/windsurf/skills | Yes |
| Goose | goose | No | .agents/skills | .goose/skills | ~/.config/goose/skills | Yes |
| Amp | amp | Yes | .agents/skills | - | ~/.config/agents/skills | No |
| Antigravity | antigravity | Yes | .agents/skills | - | ~/.gemini/antigravity/skills | No |
| Augment | augment | No | .agents/skills | .augment/skills | ~/.augment/skills | No |
| Warp | warp | Yes | .agents/skills | - | ~/.agents/skills | No |
| Kimi Code CLI | kimi-cli | Yes | .agents/skills | - | ~/.config/agents/skills | No |
| Replit | replit | Yes | .agents/skills | - | ~/.config/agents/skills | No |
| Universal | universal | Yes | .agents/skills | - | ~/.config/agents/skills | No |
| Deep Agents | deepagents | Yes | .agents/skills | - | ~/.deepagents/agent/skills | No |
| Firebender | firebender | Yes | .agents/skills | - | ~/.firebender/skills | No |
| Command Code | command-code | No | .agents/skills | .commandcode/skills | ~/.commandcode/skills | No |
| Continue | continue | No | .agents/skills | .continue/skills | ~/.continue/skills | No |
| Cortex Code | cortex | No | .agents/skills | .cortex/skills | ~/.snowflake/cortex/skills | No |
| Crush | crush | No | .agents/skills | .crush/skills | ~/.config/crush/skills | No |
| Droid | droid | No | .agents/skills | .factory/skills | ~/.factory/skills | No |
| iFlow CLI | iflow-cli | No | .agents/skills | .iflow/skills | ~/.iflow/skills | No |
| Junie | junie | No | .agents/skills | .junie/skills | ~/.junie/skills | No |
| Kode | kode | No | .agents/skills | .kode/skills | ~/.kode/skills | No |
| MCPJam | mcpjam | No | .agents/skills | .mcpjam/skills | ~/.mcpjam/skills | No |
| Mistral Vibe | mistral-vibe | No | .agents/skills | .vibe/skills | ~/.vibe/skills | No |
| Mux | mux | No | .agents/skills | .mux/skills | ~/.mux/skills | No |
| OpenHands | openhands | No | .agents/skills | .openhands/skills | ~/.openhands/skills | No |
| Pi | pi | No | .agents/skills | .pi/skills | ~/.pi/agent/skills | No |
| Qoder | qoder | No | .agents/skills | .qoder/skills | ~/.qoder/skills | No |
| Qwen Code | qwen-code | No | .agents/skills | .qwen/skills | ~/.qwen/skills | No |
| Zencoder | zencoder | No | .agents/skills | .zencoder/skills | ~/.zencoder/skills | No |
| Neovate | neovate | No | .agents/skills | .neovate/skills | ~/.neovate/skills | No |
| Pochi | pochi | No | .agents/skills | .pochi/skills | ~/.pochi/skills | No |
| AdaL | adal | No | .agents/skills | .adal/skills | ~/.adal/skills | No |

所有工具的 `skillsDir` SHALL 为 `.agents/skills`.

#### Scenario: All tools have skillsDir as .agents/skills

- **WHEN** 遍历 TOOL_CONFIGS 中所有 45 个工具
- **THEN** 每个工具的 skillsDir 均为 `.agents/skills`

#### Scenario: Native tools have native=true

- **WHEN** 查询 codex, cursor, opencode, gemini-cli, github-copilot, cline, amp, antigravity, warp, kimi-cli, replit, universal, deepagents, firebender 的 ToolConfig
- **THEN** native 为 true 且 symlinkDir 为 undefined

#### Scenario: Non-native tools have native=false with symlinkDir

- **WHEN** 查询 claude-code, openclaw, kilo, roo, kiro-cli, trae, trae-cn, codebuddy, windsurf, goose, augment, command-code, continue, cortex, crush, droid, iflow-cli, junie, kode, mcpjam, mistral-vibe, mux, openhands, pi, qoder, qwen-code, zencoder, neovate, pochi, adal 的 ToolConfig
- **THEN** native 为 false 且 symlinkDir 为对应的工具 skills 路径

#### Scenario: All tools have globalSkillsDir

- **WHEN** 查询任意工具的 ToolConfig
- **THEN** globalSkillsDir 为对应的全局路径字符串

## MODIFIED Requirements

### ToolConfig

| 字段 | 类型 | 说明 |
|------|------|------|
| name | ToolName | 工具标识符 |
| displayName | string | 显示名称 |
| skillsDir | string | 统一为 `.agents/skills` |
| globalSkillsDir | string | 全局 skills 目录路径 |
| supportsLink | boolean | 是否支持 symlink 部署 skill |
| native | boolean | 是否原生支持 `.agents/skills` |
| symlinkDir | string? | 非原生工具的 symlink 源路径 |
| showInList | boolean | 交互选择是否显示 |

#### Scenario: ToolConfig has globalSkillsDir field

- **WHEN** 查询任意工具的 ToolConfig
- **THEN** 存在 `globalSkillsDir` 属性且为非空字符串

#### Scenario: ToolConfig has showInList field

- **WHEN** 查询任意工具的 ToolConfig
- **THEN** 存在 `showInList` 属性且为布尔值

### ToolName

类型别名 `typeof SUPPORTED_TOOLS[number]`, 是 45 个工具标识符的联合类型.

#### Scenario: ToolName includes 45 identifiers

- **WHEN** 检查 SUPPORTED_TOOLS 长度
- **THEN** 长度为 45

## RENAMED Requirements

### kilo-code → kilo

- **FROM:** `kilo-code`
- **TO:** `kilo`

### roo-code → roo

- **FROM:** `roo-code`
- **TO:** `roo`

## MODIFIED Requirements

### 2. Tool selection UI grouping

工具选择 UI SHALL 根据部署模式 (项目级/全局) 使用不同显示逻辑:

**项目级** (无 `-g`):
1. "Agents Skills Standard" — 聚合显示所有 native 且 `showInList=true` 的工具名称, 选中时表示部署 `.agents/skills/`
2. 每个 non-native 且 `showInList=true` 的工具单独显示, 标注 symlink 关系

**全局级** (`-g`):
1. 每个 `showInList=true` 的工具独立显示 (无聚合选项)
2. 显示全局路径作为说明

#### Scenario: 项目级 UI displays grouped agents

- **WHEN** 用户进入 agent 选择 (`add` 命令, 无 `-g`)
- **THEN** 工具选择列表显示 "Agents Skills Standard" 选项, 后跟 native 工具名称列表
- **AND** 每个 non-native 且 showInList=true 的工具单独显示

#### Scenario: 全局级 UI displays individual agents

- **WHEN** 用户进入 agent 选择 (`add -g` 命令)
- **THEN** 每个 showInList=true 的工具独立显示, 附带全局路径
- **AND** 无 "Agents Skills Standard" 聚合选项
