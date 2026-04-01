## Context

`add` 命令的 `promptSkillsFromRepo` 函数(add.ts:22-53)在 `groupsData` 非空时使用 `buildVirtualGroupChoices`, 该函数只处理虚拟组, 不处理 source 层级(official/community/custom + owner/repo)的分组.  而 `deploy` 命令的 `promptSkills` 始终使用 `buildSourceGroupedChoices`, 后者同时处理 source 分层和虚拟组.

当用户创建任何虚拟组后(例如通过 `install ./openspec --all` 自动创建 `openspec` 组), `groupsData` 变为非空, 导致 `promptSkillsFromRepo` 选择了错误的分组函数, 所有 owner/repo 分组消失.

## Goals / Non-Goals

**Goals:**
- `promptSkillsFromRepo` 使用 `buildSourceGroupedChoices`, 与 `promptSkills` 一致
- 保留 add 命令的 locked 语义(已部署 skill 不可取消选中)

**Non-Goals:**
- 不修改 `buildVirtualGroupChoices` 或 `buildSourceGroupedChoices` 本身
- 不修改 deploy 命令的行为

## Decisions

### Decision 1: 复用 `buildSourceGroupedChoices` 而非修改 `buildVirtualGroupChoices`

`buildSourceGroupedChoices` 已正确处理 source 分层 + 虚拟组的组合显示.  `promptSkillsFromRepo` 只需切换到使用它, 并通过选项参数传入 `getLocked` 即可保留 add 的锁定语义.

替代方案: 扩展 `buildVirtualGroupChoices` 使其也支持 source 分层 → 会导致两个函数功能重叠, 违反 DRY.

### Decision 2: `buildSourceGroupedChoices` 的 `getLocked` 支持

`buildSourceGroupedChoices` 的 `ChoiceOptions` 当前支持 `getChecked` 和 `getSuffix`, 需确认是否已支持 `getLocked`.  若不支持需添加.

## Risks / Trade-offs

- [风险] `buildSourceGroupedChoices` 可能不支持 `getLocked` 选项 → 需检查并添加
- [风险] `promptSkillsFromRepo` 不再需要 `buildVirtualGroupChoices` 的 import → 检查是否有其他调用方, 避免错误移除
