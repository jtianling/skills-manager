## Why

The `custom-install` command handles initial installation and overwrites with confirmation, but there is no streamlined command for updating an already-installed custom skill. Users who iterate on local skills need a fast, no-prompt path to re-copy their changes. A dedicated `custom-update` command (alias `cu`) fills this gap by requiring the skill to already exist and skipping confirmation, making the edit-update cycle frictionless.

## What Changes

- Add a new `custom-update` CLI command (alias `cu`) that re-copies a local skill directory from CWD to `~/.skills-manager/custom/<name>/`
- The command requires the target skill to already exist in `custom/`; if it does not, it exits with an error directing the user to use `custom-install` first
- No overwrite confirmation prompt (update semantics imply intent)
- Same source validation as `custom-install`: skill directory must exist in CWD with a `SKILL.md` file
- Same setup prerequisite check as `custom-install`

## Capabilities

### New Capabilities
- `custom-update`: Command that updates an already-installed custom skill by re-copying from the current working directory, requiring prior installation

### Modified Capabilities

(none)

## Impact

- New file: `src/commands/custom-update.ts`
- Modified file: `src/index.ts` (register new command)
- Uses existing utilities: `copyDir`, `removeDir`, `fileExists` from `src/utils/fs.ts`
- No changes to `sources.json`, source tracking, or any existing command behavior
- New alias `cu` added (no conflict with existing aliases `ci`, `i`)
