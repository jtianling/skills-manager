## Context

The skills-manager CLI already provides `custom-install` (alias `ci`) for copying local skill directories into `~/.skills-manager/custom/`. When a skill is already installed and the user iterates on it locally, they must re-run `custom-install` and deal with an overwrite confirmation prompt (or pass `-f`). A dedicated `custom-update` command streamlines this workflow by assuming update intent: it requires the skill to already exist and skips confirmation entirely.

The existing `custom-install.ts` command provides a well-established pattern: Commander.js command definition, shared utility imports (`copyDir`, `removeDir`, `fileExists`), setup prerequisite check, source validation, and target directory operations.

## Goals / Non-Goals

**Goals:**
- Provide a fast, no-prompt command to re-copy an already-installed custom skill from CWD
- Follow the exact same command structure and patterns as `custom-install`
- Register with alias `cu` for quick access

**Non-Goals:**
- Modifying or refactoring `custom-install` behavior
- Adding source path tracking or `sources.json` integration
- Supporting partial/incremental updates (full directory replacement only)
- Adding diff or changelog output between old and new versions

## Decisions

### 1. Mirror `custom-install` structure exactly

**Decision**: Create `src/commands/custom-update.ts` as a near-copy of `custom-install.ts` with inverted existence logic and no confirmation prompt.

**Rationale**: Consistency with existing codebase. The command shares the same validation steps (setup check, source validation) and the same copy mechanism. The only behavioral differences are: (a) the target must already exist, and (b) no overwrite prompt.

**Alternatives considered**:
- Adding an `--update` flag to `custom-install` instead of a new command: Rejected because it conflates install and update semantics, and the user requested a separate command.
- Sharing a base function between `ci` and `cu`: Premature abstraction for two small commands; can be refactored later if more custom-* commands emerge.

### 2. No `-f`/`--force` flag needed

**Decision**: `custom-update` does not accept a `--force` flag since it never prompts the user.

**Rationale**: The command's entire purpose is to be a direct, no-confirmation update path. Adding `--force` would be meaningless. This keeps the command surface minimal.

### 3. Error message directs users to `custom-install`

**Decision**: When the target skill does not exist in `custom/`, the error message explicitly tells the user to run `custom-install` (or `ci`) first.

**Rationale**: Clear user guidance for the correct workflow. The two commands form a pair: install first, then update.

## Risks / Trade-offs

- **[Accidental data loss]** Users may run `cu` when they meant to keep the old version. → Mitigation: The command name "update" clearly implies replacement intent, and the skill must already exist (so it cannot accidentally create new installations). This is an acceptable trade-off for workflow speed.
- **[Command proliferation]** Adding more custom-* commands increases CLI surface. → Mitigation: The `cu` alias keeps it ergonomic, and the command is small and focused.
