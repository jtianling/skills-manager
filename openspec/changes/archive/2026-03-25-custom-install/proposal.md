## Why

Users who develop skills locally have no CLI command to install them into `~/.skills-manager/custom/`. They must manually copy directories, which is error-prone and tedious. A `custom-install` command closes this gap.

## What Changes

- Add `skillsmgr custom-install <name>` command that copies a skill from the current directory into `~/.skills-manager/custom/<name>/`
- Look for `<name>/` subdirectory in CWD containing a `SKILL.md`
- If the target already exists in `~/.skills-manager/custom/`, prompt user for overwrite confirmation
- `-f` / `--force` flag skips the confirmation prompt
- Add alias `ci` for `custom-install`
- Add alias `i` for existing `install` command

## Capabilities

### New Capabilities
- `custom-install`: CLI command to install a local skill directory into `~/.skills-manager/custom/`, with overwrite confirmation and force flag

### Modified Capabilities
- `cli-interaction`: Add `ci` alias for `custom-install` and `i` alias for `install`

## Impact

- New file: `src/commands/custom-install.ts`
- Modified: `src/index.ts` (register new command)
- Modified: `src/commands/install.ts` (add alias)
- Uses existing utilities: `copyDir`, `fileExists`, `promptConfirm` from `src/utils/`
