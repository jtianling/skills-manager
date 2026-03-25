## 1. Data Model & Config

- [x] 1.1 Update ToolConfig interface in types.ts: remove supportsModeSpecific, modePattern, availableModes; add native: boolean, symlinkDir?: string
- [x] 1.2 Rewrite TOOL_CONFIGS in configs.ts: all skillsDir to `.agents/skills`, set native/symlinkDir for each tool
- [x] 1.3 Simplify getTargetDir to return `.agents/skills` (remove mode parameter)

## 2. Deployer

- [x] 2.1 Rewrite Deployer.deploySkill to always deploy to `.agents/skills/`; remove targetMode parameter
- [x] 2.2 Add Deployer.createSymlinkBridge(config) to create `.xxx/skills → .agents/skills` symlink with parent dir auto-creation
- [x] 2.3 Add Deployer.removeSymlinkBridge(config) to remove symlink without affecting `.agents/skills/`
- [x] 2.4 Handle edge case: existing real directory blocks symlink creation (log warning, skip)

## 3. Scanner

- [x] 3.1 Rewrite scanAllTools to scan `.agents/skills/` once, remove per-tool directory scanning
- [x] 3.2 Rewrite getConfiguredTools: native tools configured if `.agents/skills/` has skills; symlink tools configured if symlink exists and points to `.agents/skills`
- [x] 3.3 Remove mode-specific scanning logic from scanToolDeployment

## 4. Commands

- [x] 4.1 Rewrite init command: deploy skills to `.agents/skills/`, create symlink bridges for selected non-native tools, remove symlink bridges for deselected tools
- [x] 4.2 Rewrite add command: deploy skill to `.agents/skills/` only, no per-tool deployment
- [x] 4.3 Rewrite remove command: remove skill from `.agents/skills/` only
- [x] 4.4 Remove mode prompt from init flow (promptMode no longer needed)

## 5. UI

- [x] 5.1 Rewrite promptTools: add "Agents Skills Standard" virtual option with native tool names, show non-native tools individually with symlink annotation
- [x] 5.2 Remove promptMode function from prompts.ts
- [x] 5.3 Update init command to handle "agents-skills-standard" virtual selection

## 6. Tests

- [x] 6.1 Update tool config tests: verify all skillsDir are `.agents/skills`, verify native/symlinkDir fields, remove mode-specific tests
- [x] 6.2 Add symlink bridge tests: creation, removal, detection, edge cases (existing real dir)
- [x] 6.3 Update deployer tests: verify single-directory deployment
- [x] 6.4 Update scanner tests: verify `.agents/skills`-only scanning, configured tool detection via symlink
