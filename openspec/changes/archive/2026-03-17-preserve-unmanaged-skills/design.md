## Context

`init` 命令执行增量部署时, 通过 `DeploymentScanner` 扫描目标目录中已有的 skill 和 command.  扫描结果中, 由 skills-manager 管理的项有明确的 source (如 "official/anthropic", "custom"), 而用户手动创建的或其他工具部署的项, source 为 `"unknown"`.

当前逻辑将所有扫描到的项参与增量计算, 导致 `source === 'unknown'` 的项在用户未选中时被删除.  `sync` 命令将这些项视为 "orphaned" 并提示用户, 行为略好但标签不准确.

## Goals / Non-Goals

**Goals:**

- init 命令仅管理 (添加/移除) skills-manager 自身部署的 skill 和 command
- 未托管项在 init 输出中可见, 但不被修改或删除
- sync 命令对未托管项使用 "unmanaged" 标签而非 "orphaned"

**Non-Goals:**

- 不引入持久化元数据文件来追踪部署状态
- 不改变 add/remove 命令的行为 (它们基于名称精确操作)
- 不改变 `DeploymentScanner` 的扫描逻辑, 只改变消费方对结果的处理

## Decisions

### 1. 使用 `source === 'unknown'` 判断未托管状态

ScannedSkill 和 ScannedCommand 的 source 字段已经区分了管理状态:
- 管理中的项: source 为 "official/anthropic", "community/repo", "custom" 等
- 未托管项: source 为 "unknown"

直接复用现有字段, 无需新增标记.

**替代方案**: 在 ScannedSkill/ScannedCommand 中增加 `managed: boolean` 字段.  被否决, 因为 `source` 字段已足够表达, 增加字段会造成冗余.

### 2. init 中过滤 toRemove

在 `init.ts` 中计算 `toRemove` 时, 增加 `source !== 'unknown'` 条件:

```typescript
const toRemove = previouslyDeployed.filter(
  (s) => !selectedSkillNames.includes(s.name) && s.source !== 'unknown'
);
```

未托管项单独收集并输出:

```typescript
const unmanaged = previouslyDeployed.filter(
  (s) => s.source === 'unknown'
);
```

### 3. sync 中区分 unmanaged 和 orphaned

在 `sync.ts` 中, 对 `source === 'unknown'` 的项:
- 直接显示 `~ name (unmanaged)` 并跳过后续检查
- 不再提示用户 "orphaned" 操作

真正的 orphaned (有已知 source 但源文件不存在) 保持现有逻辑不变.

### 4. 输出标记

| 状态 | 标记 | 说明 |
|------|------|------|
| 新增 | `✓ name (linked/copied)` | 新部署 |
| 保留 | `· name (unchanged)` | 已部署且仍选中 |
| 移除 | `✗ name (removed)` | 已部署但取消选中 |
| 未托管 | `~ name (unmanaged)` | 不由 skills-manager 管理 |

## Risks / Trade-offs

- [source 误判] 当 copy 模式的 skill 对应的源被卸载后, 其 source 变为 "unknown", 会从 "可管理" 变为 "未托管".  → 这实际上是合理的行为: 源已不存在, 不应再自动删除
- [输出噪音] 如果目标目录有大量未托管 skill, 输出会变长.  → 可接受, 用户需要知道这些文件的存在
