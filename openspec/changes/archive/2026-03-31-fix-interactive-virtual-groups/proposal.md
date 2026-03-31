## Why

`add` (交互式) 和 `uninstall` (交互式) 的 skill 选择列表使用 `buildSkillChoices` 按物理 source 路径分组, 无法识别虚拟 group (如 `develop`).  `remove` 已经迁移到 `buildVirtualGroupChoices`, 但这两个命令遗漏了.

## What Changes

- `promptSkills` 改用 `buildVirtualGroupChoices` 构建 choices, 按 `groups.json` 虚拟组显示
- `promptSkillsToUninstall` 同样改用 `buildVirtualGroupChoices`
- 两个函数新增参数接收 `groupsData`, 调用方负责传入
- 调用方 (`deploy.ts`, `add.ts`, `uninstall.ts`) 在交互前读取 `GroupsService` 并传入

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `virtual-group-choices`: 扩展现有 spec, 覆盖 `promptSkills` 和 `promptSkillsToUninstall` 也使用虚拟组分组

## Impact

- `src/utils/prompts.ts`: `promptSkills`, `promptSkillsToUninstall` 签名变更 (新增可选 `groupsData` 参数)
- `src/commands/deploy.ts`: 调用 `promptSkills` 时传入 groups 数据
- `src/commands/add.ts`: `handleRepoSkillSelection`, `handleRemoteInstallAndDeploy`, `handleGroupBatchDeploy` 中调用时传入
- `src/commands/uninstall.ts`: `interactiveUninstall` 中调用时传入
- `buildSkillChoices` 可能变为仅内部使用或移除 (如无其他调用方)
