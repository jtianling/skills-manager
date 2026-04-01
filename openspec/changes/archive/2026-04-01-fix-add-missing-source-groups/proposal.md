## Why

`add` 命令的 `promptSkillsFromRepo` 在 `groupsData` 非空时使用 `buildVirtualGroupChoices`, 该函数只处理虚拟组分组, 完全忽略 source 层级的 owner/repo 分组.  一旦用户创建了任何虚拟组(如通过 `install ./openspec --all`), 所有 official/community skills 的 owner/repo 分组就会消失, 变成平铺显示.

## What Changes

- `promptSkillsFromRepo` 从 `buildVirtualGroupChoices` 切换为 `buildSourceGroupedChoices`, 与 `promptSkills`(deploy 用)保持一致
- 保留 add 命令特有的 `locked: true` 语义(已部署 skill 不可取消选中)

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `virtual-group-choices`: `promptSkillsFromRepo` 需要使用 `buildSourceGroupedChoices` 而非 `buildVirtualGroupChoices`, 同时保留 locked 语义

## Impact

- `src/commands/add.ts`: `promptSkillsFromRepo` 函数修改
- `src/commands/add.test.ts`: 相关测试调整
