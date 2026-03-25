## 1. Core Implementation

- [x] 1.1 Create `src/commands/custom-install.ts` with `customInstallCommand` using Commander.js
- [x] 1.2 Implement skill directory validation: check `<cwd>/<name>/SKILL.md` exists
- [x] 1.3 Implement setup prerequisite check: verify `~/.skills-manager/` exists
- [x] 1.4 Implement copy logic: `removeDir` old + `copyDir` to `~/.skills-manager/custom/<name>/`
- [x] 1.5 Implement overwrite confirmation using `promptConfirm` when target exists
- [x] 1.6 Implement `-f`/`--force` flag to skip confirmation

## 2. CLI Registration and Aliases

- [x] 2.1 Register `customInstallCommand` in `src/index.ts`
- [x] 2.2 Add `.alias('ci')` to `custom-install` command
- [x] 2.3 Add `.alias('i')` to existing `install` command in `src/commands/install.ts`

## 3. Build and Verify

- [x] 3.1 Build project and verify no type errors
- [x] 3.2 Manually test `skillsmgr custom-install` with a local skill directory
