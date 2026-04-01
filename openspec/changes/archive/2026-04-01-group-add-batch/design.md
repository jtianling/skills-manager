## Context

`group add <group> <skill>` 当前通过 `resolveSkillKey` 解析 identifier, 只支持 skill name 和 full key 两种输入.  显示层 (source suffix, buildSourceGroupedChoices) 已支持跨 source 的虚拟 group, 但缺少批量添加入口.

相关已有代码:
- `detectArgFormat(arg)` (`repo-lookup.ts`): 区分 `owner-repo` / `skill-name` / `install-source`
- `findRepoInCentralRepository(ownerRepo, skillsService)` (`repo-lookup.ts`): 按 owner/repo 查找已安装 skill
- `GroupsService.addSkill(group, skillKey)` (`groups.ts`): key 级别去重, 无 name 级别检测
- `resolveSkillByName(name, allSkills)` (`skill-resolve.ts`): skill name/key 解析, 同名时交互选择

## Goals / Non-Goals

**Goals:**
- `group add` 的 identifier 统一解析: skill name / full key / group name / owner/repo, 多类型匹配时交互选择
- group→group 批量添加 (一次性复制 skill keys, 非动态引用)
- owner/repo 批量添加
- name 级别冲突检测: 目标 group 已有同名但不同 key 的 skill 时, 提示覆盖或跳过
- 自引用防护: `group add X X` 报错

**Non-Goals:**
- group 之间的动态引用或嵌套
- 双向复制检测 (允许 A→B 后 B→A)
- 修改 `group remove` 行为

## Decisions

### 1. identifier 统一解析策略

`executeGroupAdd` 中对 identifier 并行搜索所有候选类型, 收集后决策:

```
candidates = []

1. full key match: allSkills.find(s => `${s.source}/${s.name}` === identifier)
   → 命中则加入 candidates, type: "skill"

2. name match: allSkills.filter(s => s.name === identifier)
   → 命中则逐个加入 candidates, type: "skill"

3. group match: groupsService.getGroup(identifier) !== null
   → 命中则加入 candidates, type: "group"

4. owner/repo: detectArgFormat(identifier) === "owner-repo"
   → findRepoInCentralRepository 找到结果则加入 candidates, type: "repo"
```

注意: owner/repo 格式包含 `/`, group name 不允许 `/`, 所以 3 和 4 天然互斥.  full key 也包含 `/`, 但 full key 匹配是精确匹配 (整个 `source/name` 完全一致), 与 owner/repo 的 `owner/repo` 两段格式不冲突 (full key 至少三段).

决策逻辑:
- 0 个 candidate → 报错 "No skill, group, or repo found for '<identifier>'"
- 1 个 candidate → 直接执行
- 多个 candidate → 交互提示选择 (显示类型标签: `skill:`, `group:`)

### 2. name 冲突检测

在 `addSkill` 操作前, 检查目标 group 中是否已有 **同名但不同 key** 的 skill.

从 skill key 提取 name: `key.split('/').pop()`.  对每个待添加的 key:
1. 提取 name
2. 在目标 group 的现有 keys 中查找 name 相同但 key 不同的条目
3. 存在冲突 → 交互提示: 覆盖 (替换旧 key) / 跳过

单个添加和批量添加共用同一检测逻辑.

### 3. 批量添加的输出格式

```
Added N skills from group 'openspec' to 'develop':
  ✓ openspec-explore
  ✓ openspec-new-change
  · openspec-archive-change (already in develop, skipped)
  ⚠ openspec-verify-change (name conflict with custom/other/openspec-verify-change, replaced)
```

- `✓` 成功添加
- `·` key 已存在, 静默跳过
- `⚠` name 冲突, 用户选择了覆盖

### 4. 自引用防护

`group add X X` 时, 如果 X 解析为 group 且目标 group 同名, 在执行前报错 "Cannot add a group to itself."  在 candidate 过滤阶段实现: 如果 candidate type 为 group 且 name 等于目标 group, 从 candidates 中移除.

## Risks / Trade-offs

- **name 提取依赖 key 格式**: `key.split('/').pop()` 假设 name 总是 key 的最后一段.  当前所有 source 格式 (`official/provider/repo/name`, `community/owner/repo/name`, `custom/name`, `custom/sub/name`) 均满足.  → 如果 key 格式变化需要同步更新.
- **批量操作的交互次数**: 如果有多个 name 冲突, 用户需要逐个确认.  → 可接受, 冲突应为少数情况.  后续可加 `--force` 全部覆盖或 `--skip-conflicts` 全部跳过.
