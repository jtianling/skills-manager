## 1. SourcesService rebind APIs

- [x] 1.1 Add `rebindLocalBundle(oldBundleId: string, newUrl: string): { newBundleId: string }` to `src/services/sources.ts`: atomic single load/save, rewrite `bundle.url`, delete old bundle key and insert new key via `makeBundleId('local-batch', normalizeLocalPath(newUrl))`, update every member's `source.url`, update `updatedAt`
- [x] 1.2 Add `rebindLocalSource(sourceKey: string, newUrl: string): void` to `src/services/sources.ts`: atomic single load/save, update `sources[key].url`, update `updatedAt`
- [x] 1.3 Add `findLocalBatchBundlesByBasename(basename: string): Array<{ id: string; bundle: Bundle }>` helper on `SourcesService` that scans `bundles` for `type === 'local-batch'` and `basename(normalizeLocalPath(bundle.url)) === basename`
- [x] 1.4 Add `findLocalCopySourcesByBasename(basename: string): Array<{ key: string; info: SourceInfo }>` helper that scans `sources` for `installMethod === 'local-copy'` and `repoName === basename`
- [x] 1.5 Unit tests in `src/services/sources.test.ts` covering: rebind bundle happy path, rebind source happy path, rebind keeps other bundles/sources intact, rebind is atomic (single save), basename lookup returns empty/one/multiple candidates

## 2. SourceResolver basename fallback

- [x] 2.1 Extend `ResolvedTarget` (or add new `kind`) in `src/services/source-resolver.ts` to carry rebind candidate info: `{ kind: 'rebind-candidate', candidateType: 'source' | 'bundle', candidateKey: string, candidateUrl: string, newAbsolutePath: string, candidateStructureType: 'single' | 'batch' }`
- [x] 2.2 In `resolveLocalPath`, after existing exact-match branches miss, add basename fallback: compute `basename(absolutePath)`, call `findLocalBatchBundlesByBasename` + `findLocalCopySourcesByBasename`
- [x] 2.3 Handle multi-candidate: if total candidates > 1, return `not-found` with `reason` listing all candidate keys and URLs
- [x] 2.4 Handle single candidate: check candidate's `url` via `fileExists`; if still exists, return `not-found` with reason "old path still exists"
- [x] 2.5 Check type match: if candidate is single skill, require new path to have root SKILL.md; if batch, require new path to have no root SKILL.md but have nested SKILL.md; mismatch returns `not-found` with reason "path type mismatch"
- [x] 2.6 On all checks pass, return `kind: 'rebind-candidate'` target (not-found path isn't used here; treat as a new kind so update command can handle it)
- [x] 2.7 Unit tests in `src/services/source-resolver.test.ts` covering: exact match still works, single candidate + old path missing + type match → rebind-candidate, single candidate + old path exists → not-found, single candidate + type mismatch → not-found, multi candidate → not-found with list, bareword `tdd-spec` does NOT hit new fallback

## 3. update command rebind prompt

- [x] 3.1 In `src/commands/update.ts` `executeUpdateWithOptions`, add branch handling for `target.kind === 'rebind-candidate'`
- [x] 3.2 Compose rebind prompt message showing old URL, new absolute path, and skill/bundle name; default answer No
- [x] 3.3 Respect `--force` / `-y` to skip the prompt and proceed with rebind
- [x] 3.4 On user confirm, call `SourcesService.rebindLocalBundle` or `rebindLocalSource` depending on candidate type
- [x] 3.5 After rebind, re-resolve the input via `SourceResolver.resolve` (it should now match precisely) and continue to normal update logic — single skill goes through `updateLocalCopy`, batch goes through `bundleManager.sync`
- [x] 3.6 On user decline, print "Cancelled." and exit with code 0 without modifying sources.json
- [x] 3.7 Update the existing not-found fallback in `printUpdateNotFound` so when `resolveLocalPath` returns not-found with "old path still exists" reason, the error message is clearer about the reason
- [x] 3.8 Unit tests in `src/commands/update.test.ts` covering: rebind accepted → sources.json updated + update runs, rebind declined → sources.json unchanged + no update, `--force` → no prompt, old path still exists → not-found with specific reason, type mismatch → not-found with specific reason, multi-candidate → not-found with list, exact match still works unchanged

## 4. install command conflict detection

- [x] 4.1 In `src/commands/install-local.ts` `installFromLocalDir`, after resolving `skillDir` but before `prepareTargetDir`, check existing source: if `findInstalledCustomSkill(skillName)` returns non-null AND the associated `source.url` (from `sources.json`) normalized differs from the resolved `skillDir` normalized, throw an error with the new "already installed from X, run update" message
- [x] 4.2 Same-URL path must preserve existing overwrite-confirm behavior (idempotent reinstall)
- [x] 4.3 In `installFromLocalDirBatch`, before entering the per-skill loop, scan `sources.json` bundles for `type === 'local-batch'` with matching basename; if any found with different URL, throw error; if multiple with matching basename (historical dirty data), throw error listing all
- [x] 4.4 Same-URL bundle path proceeds normally (idempotent batch reinstall)
- [x] 4.5 Unit tests in `src/commands/install.test.ts` or `install-local`-specific test file covering: single skill same path → overwrite prompt (unchanged), single skill different path → error, batch same path → normal install, batch different path → error, batch multiple dirty candidates → error with list, single skill + same-name batch coexistence unaffected

## 5. Documentation and wiring

- [x] 5.1 Verify no orphaned helpers: `normalizeLocalPath` should already exist in `src/utils/url-normalize.ts`; basename extraction uses `path.basename`; avoid adding new modules unless necessary
- [x] 5.2 Run full test suite: `pnpm test` must pass
- [x] 5.3 Run typecheck / lint: `pnpm typecheck` (or equivalent) must pass
- [x] 5.4 Manual smoke test (on a throwaway fixture, not user's real ~/.skills-manager): install a batch, rename the source dir, run `update ./new-name`, verify prompt and rebind work
