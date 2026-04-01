## Why

`group add` 目前只支持逐个添加 skill (按 name 或完整 key).  用户无法批量将 owner/repo 的所有 skill 或另一个 group 的 skill 添加到目标 group.  显示层 (source suffix, buildSourceGroupedChoices) 已经为跨 source 的 group 做好了准备, 但批量添加的入口缺失.  此外, 当目标 group 中已存在同名但不同 key 的 skill 时, 没有冲突检测机制.

## What Changes

- `group add <group> <identifier>` 的 identifier 解析扩展为统一搜索: skill name / full key / group name / owner/repo, 多类型匹配时提示用户选择
- 新增 group→group 批量添加: 将源 group 的所有 skill key 复制到目标 group, 自引用报错
- 新增 owner/repo 批量添加: 将 owner/repo 下所有已安装 skill 添加到目标 group
- 新增 name 级别冲突检测: 单个和批量添加时, 若目标 group 已有同名但不同 key 的 skill, 提示用户选择覆盖或跳过

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `virtual-group`: group add 子命令扩展 identifier 解析, 支持 group name 和 owner/repo 批量添加, 增加 name 冲突检测和自引用防护

## Impact

- `src/commands/group.ts`: `executeGroupAdd` 重构 identifier 解析和批量添加逻辑
- `src/services/groups.ts`: 可能新增 name 冲突检测辅助方法
- `src/utils/repo-lookup.ts`: 复用 `findRepoInCentralRepository` 和 `detectArgFormat`
- `src/utils/prompts.ts`: 可能新增冲突解决 prompt
- 涉及命令: `group add`
