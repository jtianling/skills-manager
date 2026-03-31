## Context

`skillsmgr add <name>` 按名称搜索中央仓库时, `findSkillsByName` 可能返回多个同名 skill.  当前消歧义逻辑用 `source` 字段区分, 但嵌套 custom skill (如 `custom/init-project/jt-release`) 的 source 与顶层 custom skill (如 `custom/jt-release`) 相同, 都是 `"custom"`.  这导致:

1. 消歧义 prompt 的选项完全一样, 用户无法区分
2. `promptSelect` 返回值与 `find` 不匹配时 `skill` 为 undefined, 导致 crash

相关代码:
- `src/services/skills.ts`: `getSkillsFromSource` custom 分支, 嵌套 skill 的 `source` 直接用 `sourcePrefix` ("custom")
- `src/commands/add.ts`: `handleSkillName` 中 choices 用 `s.source` 做 value, find 也用 `s.source` 匹配

对比 official/community: 它们的 source 包含完整路径 (如 `official/anthropic/skills`), 天然可区分.

## Goals / Non-Goals

**Goals:**
- 同名 skill 消歧义时, 用户能看到有意义的区分信息
- `promptSelect` 返回异常值时不 crash, 优雅退出
- 嵌套 custom skill 保留父目录上下文

**Non-Goals:**
- 不改变 custom skill 的物理存储结构
- 不改变 official/community source 的逻辑
- 不引入新的 CLI 命令或选项

## Decisions

### Decision 1: 嵌套 custom skill 的 source 保留父目录

**选择**: `custom/init-project/jt-release` 的 source 改为 `"custom/init-project"`.

**理由**: 与 official/community 一致 — 它们都保留了完整的组织路径 (如 `official/anthropic/skills`).  这样 source 天然唯一, 消歧义 prompt 自动生效.

**替代方案**: 只改 prompt 显示 (用 path 区分) 但不改 source.  放弃, 因为 source 本身就该包含完整上下文, 其他依赖 source 的逻辑 (如 group、list) 也会受益.

### Decision 2: 消歧义 choices 使用 path 作为 value

**选择**: `handleSkillName` 中 choices 的 `value` 从 `s.source` 改为 `s.path`, `find` 也按 path 匹配.

**理由**: path 是每个 skill 的唯一标识, 即使 source 修复后仍可能有 edge case (两个 source 不同但名称相同的 skill).  用 path 做 value 是最安全的.

显示文本: `"1. custom/init-project/jt-release"` vs `"2. custom/jt-release"` — 使用 `${s.source}/${s.name}` 显示, source 修复后自然有区分.

### Decision 3: null guard 防御性检查

**选择**: `find` 之后检查 undefined, 输出 "Failed to resolve skill selection." 并退出.

**理由**: 即使上述修复到位, `promptSelect` 在某些边界条件下 (non-TTY, inquirer bug) 仍可能返回异常值.  防御性检查是必须的.

## Risks / Trade-offs

- **source 语义变化**: 嵌套 custom skill 的 source 从 `"custom"` 变为 `"custom/init-project"`.  依赖 source 的逻辑 (如 group addSkill) 使用的是 `{source}/{name}` 格式, 会从 `custom/jt-release` 变成 `custom/init-project/jt-release`.  → 需检查 groups.json 中是否有已存储的旧格式 key, 如有则需迁移或在 bug fix 范围内接受不一致.
- **嵌套 custom 是 legacy 结构**: `custom/init-project/` 这种嵌套结构是历史遗留 (07a-virtual-group 已规定 custom skill 平铺到 `custom/{name}/`).  本修复保持向后兼容, 不删除嵌套 skill.
