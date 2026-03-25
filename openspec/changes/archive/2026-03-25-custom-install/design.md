## Context

Skills-manager stores skills in `~/.skills-manager/` under three sources: `official/`, `community/`, `custom/`. The `install` command handles remote sources (GitHub). Local custom skills are currently placed manually into `custom/`. The codebase uses Commander.js for CLI, `inquirer` for prompts, and has utilities for file operations (`copyDir`, `fileExists`, `removeDir`) and prompts (`promptConfirm`).

## Goals / Non-Goals

**Goals:**
- Provide a CLI command to install a local skill directory into `~/.skills-manager/custom/`
- Handle existing skill overwrite with confirmation prompt
- Support `-f`/`--force` to skip confirmation
- Add command aliases (`ci` for `custom-install`, `i` for `install`)

**Non-Goals:**
- Symlink mode (always copy, keeps custom skills independent of source location)
- Recursive discovery of skills in subdirectories
- Validation of SKILL.md content beyond existence check

## Decisions

1. **Copy semantics, not symlink**: Custom-install copies the directory rather than symlinking. Custom skills should remain independent of their source location (user may delete or modify the source). This matches the mental model of "installing" something.

2. **CWD-relative resolution**: `skillsmgr custom-install abc` looks for `./abc/SKILL.md` relative to CWD. This is the simplest, most intuitive behavior - users run the command from the parent directory of their skill.

3. **Reuse existing utilities**: Use `copyDir` for copying, `removeDir` for clearing old version before overwrite, `fileExists` for checks, `promptConfirm` for user confirmation. No new utilities needed.

4. **Commander `.alias()` for abbreviations**: Commander.js natively supports `.alias()` on commands. Use this for both `ci` → `custom-install` and `i` → `install`.

## Risks / Trade-offs

- [Overwrite replaces entirely] → Using `removeDir` + `copyDir` instead of merging. Simpler and avoids stale files from previous versions. User is warned via confirmation prompt.
- [No SKILL.md content validation] → Only checks existence, not format. Acceptable for now; validation can be added later if needed.
