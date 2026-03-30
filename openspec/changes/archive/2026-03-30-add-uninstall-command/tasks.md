## 1. Core Implementation

- [x] 1.1 Create `src/commands/uninstall.ts` with `executeUninstall()` function and `uninstallCommand` Commander definition (argument: `<identifier>`, option: `--force`)
- [x] 1.2 Implement identifier parsing: provider key/alias match -> `owner/repo` pattern match -> skill name search
- [x] 1.3 Implement provider-level uninstall: resolve provider key, list skills under `official/<providerKey>/`, delete directory, clean sources.json
- [x] 1.4 Implement community source-level uninstall: parse `owner/repo`, list skills under `community/<owner>/<repo>/`, delete directory, clean empty parent, clean sources.json
- [x] 1.5 Implement skill name-level uninstall: search all sources via `SkillsService.findSkillsByName()`, handle unique match and multiple matches (prompt selection), delete skill directory, check/clean empty parents, conditionally clean sources.json

## 2. Confirmation and Warning

- [x] 2.1 Implement confirmation prompt: list skills to be deleted, show symlink deployment warning, prompt `Confirm uninstall? (y/N)`, respect `--force` flag
- [x] 2.2 Implement sources.json cleanup logic: after file deletion, check if source directory still contains skills, remove source record if empty

## 3. Registration and Testing

- [x] 3.1 Register `uninstallCommand` in `src/index.ts`
- [x] 3.2 Write unit tests for identifier parsing, provider resolution, and sources.json cleanup logic
