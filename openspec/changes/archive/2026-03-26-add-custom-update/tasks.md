## 1. Create custom-update command

- [x] 1.1 Create `src/commands/custom-update.ts` with Commander.js command definition (alias `cu`, argument `<name>`)
- [x] 1.2 Implement setup prerequisite check (`~/.skills-manager/` must exist, exit 1 with "Run: skillsmgr setup" if not)
- [x] 1.3 Implement source directory validation (resolve `<name>` in CWD, check `SKILL.md` exists, exit 1 with error if not found)
- [x] 1.4 Implement target existence check (`~/.skills-manager/custom/<name>/` must already exist, exit 1 with error directing user to `custom-install` if not)
- [x] 1.5 Implement update logic: remove old target directory, copy source directory to target, print success message

## 2. Register command

- [x] 2.1 Import `customUpdateCommand` in `src/index.ts` and register it with `program.addCommand()`

## 3. Tests

- [x] 3.1 Add unit tests for `custom-update` command covering: successful update, target not installed error, source not found error, setup not done error
