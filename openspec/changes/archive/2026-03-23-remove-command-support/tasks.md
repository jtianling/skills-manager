## 1. Type and Config Layer

- [x] 1.1 Remove `CommandInfo` interface from `types.ts`
- [x] 1.2 Remove `commandsDir` from `ToolConfig` interface in `types.ts`
- [x] 1.3 Remove `commandsDir` from all tool configs in `tools/configs.ts`
- [x] 1.4 Remove `getCommandsTargetDir` function from `tools/configs.ts`

## 2. Service Layer

- [x] 2.1 Delete `services/commands.ts` entirely
- [x] 2.2 Remove command methods from `services/deployer.ts` (`deployCommand`, `deployCommands`, `removeCommand`, `getDeployedCommandPath`, `isCommandDeployed`) and `CommandInfo` import
- [x] 2.3 Remove command scanning from `services/scanner.ts` (`ScannedCommand` interface, `scanCommandsDirectory`, `getDeployedCommands`, command portions of `scanToolDeployment`, `getConfiguredTools`, `isToolConfigured`, `scanAllTools`)
- [x] 2.4 Remove command methods from `services/github.ts` (`listCommands`, `downloadCommandFile`, `getCommandsTargetDir`)

## 3. CLI Commands

- [x] 3.1 Remove command logic from `commands/install.ts` (`installCommandsFromGitHub`, `countCommandsInRepo`, all command-related branches in `installFromAnthropic`, `installFromGitHubUrl`, `installViaGitClone`)
- [x] 3.2 Remove command logic from `commands/init.ts` (command prompting, command deployment section, command-related output)
- [x] 3.3 Remove command logic from `commands/add.ts` (command search, command deployment fallback)
- [x] 3.4 Remove command logic from `commands/remove.ts` (command removal branch)
- [x] 3.5 Remove command logic from `commands/list.ts` (command listing in both available and deployed modes)
- [x] 3.6 Remove command logic from `commands/sync.ts` (command sync loop)
- [x] 3.7 Remove command logic from `commands/update.ts` (commands update section, keep `commands` directory skip)

## 4. UI Layer

- [x] 4.1 Remove `promptCommands` function from `utils/prompts.ts` and `CommandInfo` import

## 5. Text Cleanup

- [x] 5.1 Update CLI command descriptions to only mention skills
- [x] 5.2 Update error messages and output strings to remove "and commands" / "or command" references
- [x] 5.3 Update `list --deployed` description option text

## 6. Tests

- [x] 6.1 Remove command-related tests from `commands/init-unmanaged.test.ts`
- [x] 6.2 Verify existing tests pass after all changes
