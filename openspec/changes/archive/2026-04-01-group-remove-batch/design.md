## Context

`group add` 通过 `resolveGroupAddIdentifier` 支持三种标识符类型:
- `skill`: 单个 skill (by name or full key)
- `group`: 源 group 的所有 skill keys
- `repo`: owner/repo 下的所有已安装 skill

`group remove` 当前只调用 `resolveSkillKey` 解析单个 skill, 不支持 group 和 repo 批量移除.

## Goals / Non-Goals

**Goals:**
- `group remove` 支持与 `group add` 对等的三种标识符: skill, group, repo
- 批量移除输出格式与 `group add` 的 batch 输出对称
- 复用 `resolveGroupAddIdentifier` 避免重复实现解析逻辑

**Non-Goals:**
- 不改变 `GroupsService` 接口
- 不改变 `group add` 的行为

## Decisions

### D1: 复用 resolveGroupAddIdentifier

**选择**: `executeGroupRemove` 直接复用 `resolveGroupAddIdentifier` 解析标识符, 按返回的 candidate type 分发到不同的 remove 逻辑.

**替代方案**: 新建 `resolveGroupRemoveIdentifier` 专用函数 → 逻辑重复, 维护成本高.

**理由**: 解析逻辑完全相同, 只是操作从 add 变为 remove. 复用保证标识符解析行为一致.

### D2: 批量移除语义 — 只移除交集

对于 `group remove develop openspec`:
- 读取 openspec group 的所有 skill keys
- 只移除同时存在于 develop 中的 key (交集)
- 不在 develop 中的 key 跳过, 不报错

这与 `group add` 的 "already-present skip" 语义对称.

### D3: 输出格式与 group add 对称

`group add` batch 输出:
```
Added 3 skills from group 'openspec' to 'develop':
  · skill-a (added)
  · skill-b (already in develop, skipped)
```

`group remove` batch 输出:
```
Removed 3 skills from group 'openspec' in 'develop':
  · skill-a (removed)
  · skill-b (not in develop, skipped)
```

### D4: 不允许自引用

`group remove develop develop` → 报错 "Cannot remove a group from itself.", 与 `group add` 的 "Cannot add a group to itself." 对称.  复用 `resolveGroupAddIdentifier` 已过滤此情况.

## Risks / Trade-offs

**[resolveGroupAddIdentifier 的 targetGroup 过滤]** → 该函数会过滤掉 `candidate.type === 'group' && candidate.name === targetGroup` 的情况. 对 remove 场景同样适用 (不能从自己移除自己). 无风险.

**[歧义解析]** → 如果标识符同时匹配 skill name 和 group name, `resolveGroupAddIdentifier` 会弹出 prompt 让用户选择. remove 场景完全复用此交互. 无额外处理.
