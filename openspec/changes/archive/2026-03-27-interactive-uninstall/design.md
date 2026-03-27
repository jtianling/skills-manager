## Context

`skillsmgr uninstall` 当前要求 `<identifier>` 必填, 只能逐个卸载.  `init` 命令已有成熟的交互式分组列表 UI (`interactiveCheckbox` + `promptSkills`), 本变更复用其分组逻辑为 uninstall 增加交互模式.

## Goals / Non-Goals

**Goals:**
- 无参数时展示分组列表, 支持批量卸载
- 复用已有的 `interactiveCheckbox` 和 `parseSource` 分组逻辑
- 有参数时行为完全不变

**Non-Goals:**
- 不修改 `interactiveCheckbox` 组件本身
- 不改变已有的带参数卸载逻辑
- 不增加 deployed 状态标记 (中央仓库无此概念)

## Decisions

### 1. 新增 `promptSkillsToUninstall` 而非复用 `promptSkills`

`promptSkills(allSkills, deployedSkillNames)` 的签名和行为绑定了 deploy 场景 (checked 由 deployed 决定, 带 `[deployed]` suffix).  新增一个专用函数更清晰:

```typescript
// prompts.ts
export async function promptSkillsToUninstall(skills: SkillInfo[]): Promise<string[]>
```

内部复用 `parseSource()` 构建 choices (group/subGroup 逻辑一致), 但:
- `checked: false` (全部不选)
- 无 suffix
- message: "Select skills to uninstall:"

**备选方案**: 给 `promptSkills` 加 options 参数.  但这会增加已稳定函数的复杂度, 且 uninstall 场景足够独立.

### 2. `<identifier>` 改为可选, Commander.js 的 `argument` 使用方括号语法

```typescript
.argument('[identifier]', '...')
```

action 回调中判断 `identifier` 是否为 undefined, 分流到 `interactiveUninstall()` 或原有逻辑.

### 3. 删除逻辑: 逐个删除 + `cleanEmptyParents`

选中的 skill 列表为 `SkillInfo[]`, 每个有 `path` 字段.  逐个 `rmSync(path, { recursive: true, force: true })`, 删除后调用已有的 `cleanEmptyParents(parentDir, SKILLS_MANAGER_DIR)` 清理空目录, 再调用 `cleanSourcesForDir` 清理 sources.json.

### 4. 确认流程复用 `confirmUninstall`

已有 `confirmUninstall(skillNames, force)` 可直接复用, 它会列出 skill 名称、显示警告、要求确认.  交互模式下 force 始终为 false.

## Risks / Trade-offs

- [风险] `getAllSkills()` 每次都重新扫描文件系统, skill 数量极多时可能有延迟 → 当前 skill 规模下不是问题, 暂不优化
- [权衡] `promptSkillsToUninstall` 与 `promptSkills` 有分组逻辑重复 → 可接受, 两个函数各约 20 行, 逻辑清晰独立
