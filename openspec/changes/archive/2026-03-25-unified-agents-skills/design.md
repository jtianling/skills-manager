## Context

当前 12 个工具各自维护独立的 skillsDir 配置.  其中 6 个工具 (codex, gemini-cli, opencode, openclaw, antigravity, cline) 已共享 `.agents/skills`, 但其余 6 个 (claude-code, cursor, kilo-code, roo-code, trae, windsurf) 各有独立目录.  部署时为每个工具单独创建 skills 目录并部署 skills, 即使内容完全相同.

## Goals / Non-Goals

**Goals:**
- `.agents/skills/` 成为唯一真实的 skills 物理目录
- 非原生工具通过 `.xxx/skills → .agents/skills` symlink 桥接
- 工具选择 UI 分组显示, 区分 "Agents Skills Standard" 和需要 symlink 的独立工具
- 简化 ToolConfig 数据模型, 移除 mode-specific 相关字段

**Non-Goals:**
- 不改变 skill 的来源管理 (install, update, sources)
- 不改变 `~/.skills-manager/` 的目录结构
- 不修改 sync 命令的差异检测逻辑
- 不处理已有项目的迁移 (用户需手动重新 init)

## Decisions

### 1. 工具分类: native vs symlink

将工具分为两类:

- **native**: 原生使用 `.agents/skills` 的工具, 无需额外操作
- **symlink**: 需要创建 `.xxx/skills → .agents/skills` 桥接的工具

ToolConfig 新增 `native: boolean` 字段替代原来的 skillsDir 差异:

| 类型 | 工具 | native | symlink 路径 |
|------|------|--------|-------------|
| native | codex, gemini-cli, opencode, openclaw, antigravity, cline | true | - |
| symlink | claude-code | false | .claude/skills → .agents/skills |
| symlink | cursor | false | .cursor/skills → .agents/skills |
| symlink | kilo-code | false | .kilocode/skills → .agents/skills |
| symlink | roo-code | false | .roo/skills → .agents/skills |
| symlink | trae | false | .trae/skills → .agents/skills |
| symlink | windsurf | false | .windsurf/skills → .agents/skills |

**理由**: 布尔标志比比较 skillsDir 字符串更清晰, 且所有工具的 skillsDir 统一为 `.agents/skills` 后, 需要另一种方式知道该工具是否需要 symlink.

### 2. ToolConfig 简化

移除字段:
- `supportsModeSpecific` → 删除
- `modePattern` → 删除
- `availableModes` → 删除

新增字段:
- `native: boolean` — 是否原生支持 `.agents/skills`
- `symlinkDir?: string` — symlink 工具的目录路径 (如 `.claude/skills`), native 工具无此字段

保留字段:
- `name`, `displayName` — 不变
- `skillsDir` — 所有工具统一为 `.agents/skills`
- `supportsLink` — 保留, 用于 skill 部署方式 (link vs copy)

### 3. 部署策略

部署流程变为:

1. 将 skills 部署到 `.agents/skills/` (link 或 copy)
2. 对每个选中的 symlink 工具, 创建 `.xxx/skills → .agents/skills` 的 symlink
3. native 工具无需额外操作 (它们直接读 `.agents/skills`)

**移除 skills 时**: 从 `.agents/skills/` 移除即可.  Symlink 桥接目录不受影响.

**移除工具时**: 删除对应的 symlink (如 `rm .claude/skills`).  `.agents/skills/` 本身不受影响.

### 4. 扫描策略

扫描只需扫描 `.agents/skills/` 目录, 不再遍历每个工具的独立目录.  但需要额外检查各工具的 symlink 是否存在来判断"已配置"状态.

`getConfiguredTools()` 新逻辑:
- native 工具: `.agents/skills/` 有 skills → 视为已配置
- symlink 工具: `.xxx/skills` 是指向 `.agents/skills` 的 symlink → 视为已配置

### 5. UI 分组方案

工具选择 UI 改为分组:

```
Select target tools:
  ◻ Agents Skills Standard → Codex, Gemini CLI, OpenCode, OpenClaw, Antigravity, Cline
  ◻ Claude Code (symlink: .claude/skills → .agents/skills)
  ◻ Cursor (symlink: .cursor/skills → .agents/skills)
  ◻ Kilo Code (symlink: .kilocode/skills → .agents/skills)
  ◻ Roo Code (symlink: .roo/skills → .agents/skills)
  ◻ Trae (symlink: .trae/skills → .agents/skills)
  ◻ Windsurf (symlink: .windsurf/skills → .agents/skills)
```

"Agents Skills Standard" 是一个虚拟选项, 选中时不创建任何 symlink, 仅表示部署 `.agents/skills/`.  它在 SUPPORTED_TOOLS 中不是一个独立的 tool, 而是 UI 层的聚合展示.

### 6. `getTargetDir` 函数简化

移除 mode 参数, 所有工具返回 `.agents/skills`:

```typescript
export function getTargetDir(): string {
  return '.agents/skills';
}
```

## Risks / Trade-offs

- **[Mode-specific 用户受影响]** → Roo Code / Kilo Code 的 mode-specific 用户需要手动清理旧的 `skills-code/` 和 `skills-architect/` 目录.  在变更日志中说明.
- **[Symlink 兼容性]** → 部分 Windows 环境不支持 symlink.  但 `supportsLink` 字段保留, 未来可用于 fallback.  当前 macOS/Linux 无此问题.
- **[Cursor 等工具可能不跟随 symlink]** → 已知风险, 如果某工具不跟随 symlink, 用户需要改用 copy 模式.  但目前所有工具均标记 supportsLink: true.
- **[不可逆]** → 用户需重新运行 `init` 来迁移.  旧的独立目录不会自动清理.
