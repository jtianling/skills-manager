## MODIFIED Requirements

### Requirement: Install local skill to custom directory
The system SHALL provide a `custom-install` command that copies a skill directory from the current working directory into `~/.skills-manager/custom/<name>/`, or into `~/.skills-manager/custom/<group>/<name>/` when `--group` is specified.

#### Scenario: Successful install from CWD
- **WHEN** user runs `skillsmgr custom-install abc` and `./abc/SKILL.md` exists
- **THEN** the system copies the `./abc/` directory to `~/.skills-manager/custom/abc/` and outputs a success message

#### Scenario: Skill directory not found
- **WHEN** user runs `skillsmgr custom-install abc` and `./abc/` does not exist or `./abc/SKILL.md` does not exist
- **THEN** the system exits with code 1 and outputs an error message indicating the skill was not found in the current directory

#### Scenario: Install with --group option
- **WHEN** user runs `skillsmgr custom-install abc --group my-tools` and `./abc/SKILL.md` exists
- **THEN** the system copies `./abc/` to `~/.skills-manager/custom/my-tools/abc/` and outputs a success message

#### Scenario: Install with -g short option
- **WHEN** user runs `skillsmgr custom-install abc -g my-tools`
- **THEN** behavior is identical to `--group my-tools`

### Requirement: Overwrite confirmation for existing skill
The system SHALL prompt the user for confirmation when the target skill already exists in `~/.skills-manager/custom/`, including within a group directory.

#### Scenario: Existing skill with confirmation
- **WHEN** user runs `skillsmgr custom-install abc` and `~/.skills-manager/custom/abc/` already exists
- **THEN** the system prompts "Skill 'abc' already exists. Overwrite?" and proceeds only if the user confirms

#### Scenario: User declines overwrite
- **WHEN** user declines the overwrite confirmation
- **THEN** the system outputs "Cancelled." and exits normally (code 0)

#### Scenario: Existing skill in group with confirmation
- **WHEN** user runs `skillsmgr custom-install abc --group my-tools` and `~/.skills-manager/custom/my-tools/abc/` already exists
- **THEN** the system prompts "Skill 'abc' already exists in group 'my-tools'. Overwrite?" and proceeds only if the user confirms

### Requirement: Force flag skips confirmation
The system SHALL accept `-f` / `--force` flag to skip the overwrite confirmation prompt.

#### Scenario: Force overwrite
- **WHEN** user runs `skillsmgr custom-install -f abc` and `~/.skills-manager/custom/abc/` already exists
- **THEN** the system overwrites the existing skill without prompting

#### Scenario: Force overwrite in group
- **WHEN** user runs `skillsmgr custom-install -f abc --group my-tools` and `~/.skills-manager/custom/my-tools/abc/` already exists
- **THEN** the system overwrites without prompting

### Requirement: Setup prerequisite check
The system SHALL verify `~/.skills-manager/` exists before executing.

#### Scenario: Skills manager not set up
- **WHEN** user runs `skillsmgr custom-install abc` and `~/.skills-manager/` does not exist
- **THEN** the system exits with code 1 and outputs "Run: skillsmgr setup"
