## 1. Data Model (constants.ts)

- [x] 1.1 Define `OfficialProviderRepo` interface with `repo` and optional `skillsPath` fields
- [x] 1.2 Modify `OfficialProvider` interface: replace `repo: string` with `repos: OfficialProviderRepo[]`, add optional `aliases?: string[]`
- [x] 1.3 Update `OFFICIAL_PROVIDERS` data: convert all entries to new format (anthropic, openai, microsoft, vercel-labs); add `agent-browser` to vercel-labs repos; add `aliases: ['vercel']` to vercel-labs
- [x] 1.4 Define `OfficialMatch` interface with `providerKey: string` and `exactRepoMatch: boolean`
- [x] 1.5 Rewrite `findOfficialProvider(owner, repo)` to return `OfficialMatch | null` with owner-level matching: match if `provider.owner === owner`, set `exactRepoMatch` based on whether repo is in `provider.repos[]`
- [x] 1.6 Add `resolveProviderAlias(input: string): string | null` function that searches all providers' aliases arrays

## 2. Install Command (install.ts)

- [x] 2.1 Rewrite `installFromOfficial(providerKey, targetRepo?)`: iterate over `provider.repos[]` (or single targetRepo if specified), fetch skills from each repo, build per-repo grouped skill list with `subGroup` set to repo name
- [x] 2.2 Update `installFromOfficial` download paths from `official/{key}/{skillName}` to `official/{key}/{repoName}/{skillName}`
- [x] 2.3 Update `installFromOfficial` source recording: write per-repo source entries with key `official/{providerKey}/{repoName}` and URL `https://github.com/{owner}/{repoName}`
- [x] 2.4 Update `installFromGitHubUrl`: change `findOfficialProvider` call to handle `OfficialMatch` return type; update `targetBase` to include repo layer (`official/{providerKey}/{repo}`)
- [x] 2.5 Update `installFromGitHubUrl` source key construction to `official/{providerKey}/{repo}`
- [x] 2.6 Update `saveGitCloneSource`: handle `OfficialMatch` return type, include repo in official path and source key
- [x] 2.7 Update `executeInstall` entry point: after `OFFICIAL_PROVIDERS[source]` check, add alias resolution via `resolveProviderAlias`; update `owner/repo` shorthand to use `OfficialMatch` (`exactRepoMatch: true` → `installFromOfficial(key, repo)`, `false` → GitHub URL with official classification)

## 3. GitHub Service (github.ts)

- [x] 3.1 Update `getTargetDir`: handle `OfficialMatch` return type from `findOfficialProvider`, include repo in official path (`official/{providerKey}/{repo}/{skillName}`)

## 4. Skills Service (services/skills.ts)

- [x] 4.1 Rewrite official branch in `getSkillsFromSource`: change from two-level traversal (`providerKey/{skillName}`) to three-level (`providerKey/{repoName}/{skillName}`), aligning with community's traversal pattern; source string becomes `official/{providerKey}/{repoName}`

## 5. Tests

- [x] 5.1 Add unit tests for new `findOfficialProvider` behavior: owner+repo exact match returns `exactRepoMatch: true`, owner-only match returns `exactRepoMatch: false`, no match returns `null`
- [x] 5.2 Add unit tests for `resolveProviderAlias`: alias match returns provider key, no match returns null, direct provider key input returns null
- [x] 5.3 Update existing install tests to reflect new path structure (`official/{providerKey}/{repoName}/{skillName}`)
- [x] 5.4 Add test for multi-repo installFromOfficial: verifies skills from multiple repos are fetched and grouped
- [x] 5.5 Add test for alias install flow: `skillsmgr install vercel` resolves to vercel-labs
- [x] 5.6 Add test for owner-level official classification: `vercel-labs/unknown-repo` installs to official path
- [x] 5.7 Update SkillsService tests to verify three-level official traversal and correct source string format

## 6. Build Verification

- [x] 6.1 Run `pnpm build` to verify TypeScript compilation succeeds with no errors
- [x] 6.2 Run `pnpm test` to verify all existing and new tests pass
