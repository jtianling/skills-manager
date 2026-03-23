## MODIFIED Requirements

### Requirement: Skills 目录

所有 12 个工具均支持 skills 部署.  部署时在项目中创建对应的目录结构:

```
project/
├── .agents/skills/        # Codex, Gemini CLI, OpenCode, OpenClaw, Antigravity, Cline
├── .claude/skills/        # Claude Code
├── .cursor/skills/        # Cursor
├── .kilocode/skills/      # Kilo Code
├── .roo/skills/           # Roo Code
├── .trae/skills/          # Trae
└── .windsurf/skills/      # Windsurf
```

6 个工具共享 `.agents/skills` 目录:

| 工具 | 标识符 | Skills 目录 |
|------|--------|------------|
| Codex | codex | .agents/skills |
| Gemini CLI | gemini-cli | .agents/skills |
| OpenCode | opencode | .agents/skills |
| OpenClaw | openclaw | .agents/skills |
| Antigravity | antigravity | .agents/skills |
| Cline | cline | .agents/skills |

6 个工具保持专属目录:

| 工具 | 标识符 | Skills 目录 |
|------|--------|------------|
| Claude Code | claude-code | .claude/skills |
| Cursor | cursor | .cursor/skills |
| Kilo Code | kilo-code | .kilocode/skills |
| Roo Code | roo-code | .roo/skills |
| Trae | trae | .trae/skills |
| Windsurf | windsurf | .windsurf/skills |

每个工具的 skills 目录是独立的.  同一个 skill 可以同时部署到多个工具.  当多个工具共享同一物理目录时, skill 只需部署一次, 文件系统幂等性保证不会重复.

#### Scenario: Universal 工具的 skillsDir 为 .agents/skills

- **WHEN** 查询 codex, gemini-cli, opencode, openclaw, antigravity, cline 的 ToolConfig
- **THEN** 它们的 skillsDir 均为 `.agents/skills`

#### Scenario: 非 universal 工具保持专属目录

- **WHEN** 查询 claude-code, cursor, kilo-code, roo-code, trae, windsurf 的 ToolConfig
- **THEN** 它们的 skillsDir 保持各自原有值不变

#### Scenario: 多个 universal 工具部署同一 skill

- **WHEN** 用户选择为 codex 和 cline 同时部署 skill "test-skill"
- **THEN** 两者共享 `.agents/skills` 目录, skill 只在 `.agents/skills/test-skill/` 存在一份

#### Scenario: 扫描共享目录

- **WHEN** `.agents/skills/` 目录下有已部署的 skills
- **THEN** 所有 6 个 universal 工具的 scanToolDeployment 都能扫描到这些 skills

### Requirement: 支持的工具

常量 `SUPPORTED_TOOLS` 定义了工具标识符列表, 分为两组:

**优先组** (手动排序, 固定顺序):

```
claude-code, codex, gemini-cli, opencode, openclaw, antigravity
```

**其余组** (按 displayName 字母顺序):

```
cline, cursor, kilo-code, roo-code, trae, windsurf
```

此顺序影响 UI 中工具选择的显示顺序和 `scanAllTools()` 的遍历顺序.

| 工具 | 标识符 | Skills 目录 | Commands 目录 | 模式支持 |
|------|--------|------------|--------------|---------|
| Claude Code | claude-code | .claude/skills | .claude/commands | No |
| Codex | codex | .agents/skills | - | No |
| Gemini CLI | gemini-cli | .agents/skills | .gemini/commands | No |
| OpenCode | opencode | .agents/skills | .opencode/commands | No |
| OpenClaw | openclaw | .agents/skills | - | No |
| Antigravity | antigravity | .agents/skills | .agent/workflows | No |
| Cline | cline | .agents/skills | - | No |
| Cursor | cursor | .cursor/skills | .cursor/commands | No |
| Kilo Code | kilo-code | .kilocode/skills | .kilocode/commands | Yes |
| Roo Code | roo-code | .roo/skills | .roo/commands | Yes |
| Trae | trae | .trae/skills | - | No |
| Windsurf | windsurf | .windsurf/skills | .windsurf/workflows | No |

**注意**: Commands 目录不变.  各工具保持原有 commandsDir 配置.

#### Scenario: 工具总表与 skillsDir 映射

- **WHEN** 遍历 SUPPORTED_TOOLS 中的所有工具
- **THEN** 每个工具的 skillsDir 与上表匹配

#### Scenario: Commands 目录保持不变

- **WHEN** 查询所有工具的 commandsDir
- **THEN** 所有 commandsDir 值与变更前一致, 不受 skillsDir 变更影响
