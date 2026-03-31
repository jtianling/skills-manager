## 1. 提取公共函数

- [x] 1.1 将 `loadGroupsData` 从 `src/commands/remove.ts` 移到 `src/utils/prompts.ts` 并 export
- [x] 1.2 `src/commands/remove.ts` 改为从 `src/utils/prompts.ts` import `loadGroupsData`

## 2. 改造 promptSkills

- [x] 2.1 `promptSkills` 新增可选参数 `groupsData?: VirtualGroupsData`, 有值时用 `buildVirtualGroupChoices` 构建 choices (保留 deployed suffix/checked 逻辑), 无值时保持原有 `buildSkillChoices`
- [x] 2.2 `executeDeploy` 中调用 `promptSkills` 时传入 `loadGroupsData(new GroupsService())`

## 3. 改造 promptSkillsToUninstall

- [x] 3.1 `promptSkillsToUninstall` 新增可选参数 `groupsData?: VirtualGroupsData`, 有值时用 `buildVirtualGroupChoices` 构建 choices, 无值时保持原有 `buildSkillChoices`
- [x] 3.2 `interactiveUninstall` 中调用 `promptSkillsToUninstall` 时传入 `loadGroupsData(new GroupsService())`

## 4. add 命令调用方适配

- [x] 4.1 `handleRepoSkillSelection` 和 `handleGroupBatchDeploy` 中调用 `promptSkillsFromRepo` 或直接调用 `promptSkills` 的地方传入 groupsData
- [x] 4.2 `handleRemoteInstallAndDeploy` 中同样适配

## 5. 验证

- [x] 5.1 编译通过, 运行 `pnpm build`
- [x] 5.2 已有单元测试通过, `pnpm test`
