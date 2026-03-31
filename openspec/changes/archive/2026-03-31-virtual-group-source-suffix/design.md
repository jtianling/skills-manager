## Context

当前有两个 choice builder 函数处理虚拟 group 显示:

- `buildVirtualGroupChoices` (prompts.ts:192): 纯虚拟 group 视角, 用于 add/remove by owner/repo.  不区分 source, 所有 skill 只显示 name.
- `buildSourceGroupedChoices` (prompts.ts:260): source-first 视角, 用于 deploy/uninstall/remove 全局交互.  虚拟 group 只在 custom 分类内生效, 非 custom skill 始终在自己的 source 分类下.

`groups.json` 允许任意 source 的 skill key: `official/anthropic/skills/commit`, `community/bob/tools/linter`, `custom/my-tool`.  但显示层忽略了非 custom skill 的 source 信息.

suffix 机制已存在: `SelectChoice.suffix` 渲染为黄色文本, 跟在 skill name 后.  已有用途: `[deployed]`, `[configured]`, `(installed)`.

## Goals / Non-Goals

**Goals:**
- 虚拟 group 中的非 custom skill 显示来源 suffix, 格式 `(owner/repo)`
- `buildSourceGroupedChoices` 中, 属于虚拟 group 的非 custom skill 移入虚拟 group 显示, 不在 source 分类中重复出现
- 来源 suffix 与功能性 suffix 共存: `commit (anthropic/skills) [deployed]`
- `group list <name>` 显示每个 skill 的来源

**Non-Goals:**
- 不引入三级嵌套
- 不改变 `interactive-select.ts` 的渲染逻辑
- 不改变 `groups.json` 存储格式
- 不提供虚拟 group 内的 repo 级批量操作 (用户可在 source 分类区域操作)

## Decisions

### 1. 来源 suffix 格式

格式: `(owner/repo)`, 从 `skill.source` 中提取.

```
source = "official/anthropic/skills"  →  suffix = "(anthropic/skills)"
source = "community/bob/tools"        →  suffix = "(bob/tools)"
source = "custom"                     →  无 suffix (custom skill 不需要标注)
source = "custom/sub-pkg"             →  无 suffix (仍是 custom)
```

规则: `source.startsWith('custom')` 的 skill 不加来源 suffix.

### 2. suffix 合并策略

`SelectChoice.suffix` 是单个 string.  需要合并两种 suffix:

- **来源 suffix**: `(anthropic/skills)` — 由 choice builder 生成
- **功能 suffix**: `[deployed]` — 由调用方通过 `getSuffix` 回调生成

合并顺序: 来源在前, 功能在后.

```
"commit (anthropic/skills) [deployed]"
"my-linter [deployed]"                    ← custom, 无来源 suffix
"review (anthropic/skills)"               ← 无功能 suffix
```

实现: `toChoice` 中计算 sourceSuffix, 然后 `[sourceSuffix, callerSuffix].filter(Boolean).join(' ')`.

### 3. `buildSourceGroupedChoices` 中非 custom skill 的归属

属于虚拟 group 的非 custom skill 从其 source 分类**移出**, 显示在 custom 分类的虚拟 group 下.  避免同一 skill 在列表中出现两次.

```
── official ──
▼ ◯ anthropic/skills (2)          ← commit 被移走, 只剩 2 个
    ◯ review
    ◯ code-review
── custom ──
▼ ◯ my-tools (3)
    ◯ commit        (anthropic/skills)   ← 移到这里
    ◯ my-linter
    ◯ my-formatter
```

替代方案: 在两处都显示 → 导致同一 skill 有两个独立的 choice index, 选中状态不同步, UX 混乱.

替代方案: 只在 source 分类显示, 虚拟 group 标注为 suffix → 虚拟 group 变得不完整, 失去了"看到这个 group 有什么"的能力.

### 4. `buildVirtualGroupChoices` 改动

直接在 `toChoice` 中根据 `skill.source` 生成来源 suffix.  不需要额外参数.

### 5. `group list` 显示格式

从当前的纯 key 列表:
```
my-tools:
  official/anthropic/skills/commit
  custom/my-linter
```

改为更友好的格式:
```
my-tools:
  commit        (anthropic/skills)
  my-linter
```

与交互式列表的 suffix 风格保持一致.

## Risks / Trade-offs

- **source 分类中 skill 数减少**: 属于虚拟 group 的 official/community skill 不再出现在 source 分类下.  用户如果想按 repo 批量操作这些 skill, 需要先把它们从虚拟 group 中移除.  → 这是设计意图: 虚拟 group 是用户更强的归类意图, 优先于 source 分组.
- **suffix 变长**: `commit (anthropic/skills) [deployed]` 可能占用较多水平空间.  → CLI 通常 120 列以上, 可接受.
