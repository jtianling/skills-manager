## Context

`remove` 命令已迁移到 `buildVirtualGroupChoices` + `loadGroupsData` 模式, 按虚拟 group 分组显示 skill.  `promptSkills` (被 `add` 交互和 `deploy` 使用) 和 `promptSkillsToUninstall` (被 `uninstall` 交互使用) 仍使用 `buildSkillChoices`, 按物理 source 路径分组, 无法识别虚拟 group.

## Goals / Non-Goals

**Goals:**
- `promptSkills` 和 `promptSkillsToUninstall` 按虚拟 group 分组显示
- 复用已有的 `buildVirtualGroupChoices` helper, 不重复造轮子
- `loadGroupsData` 提升为公共函数, 避免重复定义

**Non-Goals:**
- 不改变 `buildVirtualGroupChoices` 本身的逻辑
- 不改变 `add --group` 的批量部署逻辑
- 不改变非交互式路径 (带参数的 `add`, `uninstall`)

## Decisions

### 1. `promptSkills` 和 `promptSkillsToUninstall` 新增可选 `groupsData` 参数

**选择:** 两个函数签名新增 `groupsData?: VirtualGroupsData`, 有值时用 `buildVirtualGroupChoices`, 无值时保持 `buildSkillChoices` 兼容.

**替代方案:** 直接在函数内部读取 `GroupsService` → 拒绝, 因为会引入隐式依赖, 不利于测试.

**理由:** 调用方显式传入数据, 职责清晰, 与 `remove` 的使用模式一致.

### 2. `loadGroupsData` 从 `remove.ts` 提取到 `prompts.ts` 导出

**选择:** 将 `loadGroupsData` 移到 `prompts.ts` 并 export, `remove.ts` 改为 import.

**替代方案:** 每个调用方各自写一遍 → 违反 DRY.  放到 `GroupsService` 上 → 该方法返回的格式是 UI 层的 `VirtualGroupsData`, 不属于 service 职责.

### 3. `buildSkillChoices` 保留但不再公开使用

**选择:** 不删除 `buildSkillChoices`, 作为 `groupsData` 未传入时的 fallback.  未来如无调用场景可清理.

**理由:** 保持向后兼容, 最小变更原则.

## Risks / Trade-offs

- **[签名变更]** `promptSkills` / `promptSkillsToUninstall` 新增参数 → 可选参数, 无 breaking change, 不传则行为不变.
- **[source 映射]** `buildVirtualGroupChoices` 需要 skill 的 `source` 字段匹配 `groups.json` 中的 key 前缀.  `promptSkills` 接收的 `SkillInfo` 的 source 已经是完整的 source 路径 (如 `custom/jt-codex`), skill key 为 `{source}/{name}`, 与 `groups.json` 格式一致, 无需额外映射.
