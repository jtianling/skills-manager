# Symlink Bridge

## Purpose
非原生工具通过 symlink 桥接访问统一的 `.agents/skills/` 目录.  全局部署时通过 per-skill symlink 部署到各 agent 的全局 skills 目录.

## Requirements

### Requirement: 全局级 per-skill symlink

全局部署时, 系统 SHALL 为每个选中的 agent 在其 `globalSkillsDir` 下创建单个 skill 的 symlink, 而非目录级桥接.

symlink 方向: `{globalSkillsDir}/{skill.name}` → `{skill.path}` (中央仓库绝对路径)

#### Scenario: 全局 symlink 创建

- **WHEN** 全局部署 skill "code-review" 到 claude-code
- **THEN** `~/.claude/skills/code-review` 是指向中央仓库 skill 路径的 symlink

#### Scenario: 全局 symlink 与项目级 bridge 共存

- **WHEN** 项目级已通过 bridge 部署 (.claude/skills → .agents/skills)
- **AND** 用户全局安装同一 skill
- **THEN** 全局 `~/.claude/skills/code-review` symlink 独立于项目级 bridge

### Requirement: Symlink bridge creation for non-native tools

The system SHALL create a directory-level symlink from each selected non-native tool's skills path to `.agents/skills/` during project-level deployment.  The symlink target MUST be `.agents/skills` (relative path).

Symlink mapping (updated for 45 agents):

| Tool | Symlink Source | Symlink Target |
|------|---------------|----------------|
| claude-code | .claude/skills | .agents/skills |
| openclaw | skills | .agents/skills |
| kilo | .kilocode/skills | .agents/skills |
| roo | .roo/skills | .agents/skills |
| kiro-cli | .kiro/skills | .agents/skills |
| trae | .trae/skills | .agents/skills |
| trae-cn | .trae/skills | .agents/skills |
| codebuddy | .codebuddy/skills | .agents/skills |
| windsurf | .windsurf/skills | .agents/skills |
| goose | .goose/skills | .agents/skills |
| augment | .augment/skills | .agents/skills |
| command-code | .commandcode/skills | .agents/skills |
| continue | .continue/skills | .agents/skills |
| cortex | .cortex/skills | .agents/skills |
| crush | .crush/skills | .agents/skills |
| droid | .factory/skills | .agents/skills |
| iflow-cli | .iflow/skills | .agents/skills |
| junie | .junie/skills | .agents/skills |
| kode | .kode/skills | .agents/skills |
| mcpjam | .mcpjam/skills | .agents/skills |
| mistral-vibe | .vibe/skills | .agents/skills |
| mux | .mux/skills | .agents/skills |
| openhands | .openhands/skills | .agents/skills |
| pi | .pi/skills | .agents/skills |
| qoder | .qoder/skills | .agents/skills |
| qwen-code | .qwen/skills | .agents/skills |
| zencoder | .zencoder/skills | .agents/skills |
| neovate | .neovate/skills | .agents/skills |
| pochi | .pochi/skills | .agents/skills |
| adal | .adal/skills | .agents/skills |

The system SHALL create the parent directory (e.g., `.claude/`) if it does not exist before creating the symlink.

#### Scenario: Create symlink for claude-code

- **WHEN** user selects claude-code during init
- **THEN** `.claude/skills` is a symlink pointing to `.agents/skills`

#### Scenario: Create symlink for new agent kiro-cli

- **WHEN** user selects kiro-cli during init
- **THEN** `.kiro/skills` is a symlink pointing to `.agents/skills`

#### Scenario: Parent directory auto-creation

- **WHEN** user selects trae and `.trae/` directory does not exist
- **THEN** `.trae/` directory is created and `.trae/skills` is a symlink pointing to `.agents/skills`

#### Scenario: Existing symlink is replaced

- **WHEN** `.claude/skills` already exists as a symlink pointing to a different target
- **THEN** the old symlink is removed and a new symlink pointing to `.agents/skills` is created

#### Scenario: Existing real directory blocks symlink

- **WHEN** `.claude/skills` already exists as a real directory (not a symlink)
- **THEN** the system logs a warning and skips symlink creation for that tool

### Requirement: Symlink bridge removal

The system SHALL remove the symlink (not the target directory) when a non-native tool is unconfigured.  The `.agents/skills/` directory and its contents MUST NOT be affected.

#### Scenario: Remove symlink when tool is deselected

- **WHEN** user deselects claude-code during init (previously configured)
- **THEN** `.claude/skills` symlink is removed
- **AND** `.agents/skills/` directory and contents remain intact

### Requirement: Symlink bridge detection

The system SHALL detect existing symlink bridges during scanning to determine which non-native tools are configured.

#### Scenario: Detect configured symlink tool

- **WHEN** `.cursor/skills` is a symlink pointing to `.agents/skills`
- **THEN** cursor is reported as a configured tool

#### Scenario: Non-symlink directory not detected as bridge

- **WHEN** `.cursor/skills` is a real directory (not a symlink)
- **THEN** cursor is NOT reported as a configured tool via symlink bridge detection

### Requirement: Codex 不使用项目级 symlink bridge

系统 SHALL NOT 为 Codex创建、检测或移除 `.codex/skills` 项目级 bridge。已有该
路径时，系统 MUST 保持其不变，不得将其作为 Codex configured 状态的必要条件。

#### Scenario: 没有旧 bridge 时扫描 Codex

- **WHEN** `.agents/skills` 中存在已部署 skill 且 `.codex/skills` 不存在
- **THEN** scanner SHALL 将 Codex报告为 configured native agent

#### Scenario: 已有旧 bridge 保持不变

- **WHEN** 项目升级前已存在 `.codex/skills` symlink
- **THEN** add/deploy/remove 操作 MUST NOT 主动删除或重写该 symlink
