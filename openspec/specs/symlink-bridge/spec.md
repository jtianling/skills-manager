# Symlink Bridge

非原生工具通过 symlink 桥接访问统一的 `.agents/skills/` 目录.

## Requirements

### Requirement: Symlink bridge creation for non-native tools

The system SHALL create a directory-level symlink from each selected non-native tool's skills path to `.agents/skills/` during deployment.  The symlink target MUST be `.agents/skills` (relative path).

Symlink mapping:

| Tool | Symlink Source | Symlink Target |
|------|---------------|----------------|
| claude-code | .claude/skills | .agents/skills |
| cursor | .cursor/skills | .agents/skills |
| kilo-code | .kilocode/skills | .agents/skills |
| roo-code | .roo/skills | .agents/skills |
| trae | .trae/skills | .agents/skills |
| windsurf | .windsurf/skills | .agents/skills |

The system SHALL create the parent directory (e.g., `.claude/`) if it does not exist before creating the symlink.

#### Scenario: Create symlink for claude-code

- **WHEN** user selects claude-code during init
- **THEN** `.claude/skills` is a symlink pointing to `.agents/skills`

#### Scenario: Create symlink for cursor

- **WHEN** user selects cursor during init
- **THEN** `.cursor/skills` is a symlink pointing to `.agents/skills`

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
