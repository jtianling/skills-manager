## Context

当前 skills-manager 为 12 个工具各自配置独立的 skillsDir.  行业趋势是多个工具开始支持 `.agents/skills/` 统一目录标准.  根据 vercel-labs/skills 的 agents.ts, 以下工具在项目级采纳了 `.agents/skills/`: Codex, Cline, Gemini CLI, OpenCode, Antigravity 等.

当前配置中, 这些工具使用各自专属目录 (`.codex/skills`, `.cline/skills` 等), 导致同一 skill 被部署多份.  本次改动将它们统一到 `.agents/skills/`.

## Goals / Non-Goals

**Goals:**

- 将支持 `.agents/skills/` 的工具的 skillsDir 改为 `.agents/skills`
- 扫描和部署逻辑正确处理多个工具共享同一 skills 目录
- 避免重复部署: 当多个共享目录的工具被选中时, skill 只部署一次

**Non-Goals:**

- 不引入 "universal agent" 概念或抽象层
- 不改变 commands 目录 (各工具的 commandsDir 保持不变)
- 不改变非 universal 工具 (Claude Code, Cursor, Windsurf, Roo Code, Kilo Code, Trae) 的配置
- 不支持全局级 `~/.agents/skills/` 目录 (仅改项目级)

## Decisions

### 1. 哪些工具改为 `.agents/skills/`

将以下 6 个工具的 skillsDir 改为 `.agents/skills`:
- codex: `.codex/skills` → `.agents/skills`
- gemini-cli: `.gemini/skills` → `.agents/skills`
- opencode: `.opencode/skills` → `.agents/skills`
- openclaw: `.openclaw/skills` → `.agents/skills`
- antigravity: `.agent/skills` → `.agents/skills`
- cline: `.cline/skills` → `.agents/skills`

**理由**: 这些工具在 vercel-labs/skills 的定义中项目级均使用 `.agents/skills/`.  主流工具 (Claude Code, Cursor, Windsurf) 仍使用专属目录, 不在此次变更范围.

### 2. 共享目录的去重策略

当多个工具共享 `.agents/skills/` 时, 扫描和部署需要处理去重:

- **扫描**: 每个工具独立扫描 `.agents/skills/`, 各自生成 ScannedToolDeployment.  同一个物理目录被多个工具扫描是正常的 — 它反映了"这个 skill 对这些工具都可用"的语义.
- **部署**: Deployer 已有幂等性 — `linkDir`/`copyDir` 对已存在的目标不会报错.  无需额外去重逻辑.
- **init 增量部署**: `init` 命令为每个工具独立计算 toAdd/toRemove/toKeep.  由于多个工具指向同一目录, 第一个工具部署后, 后续工具发现 skill 已存在, 归入 toKeep.

**理由**: 保持各工具逻辑独立, 不引入跨工具协调, 复杂度最低.  物理层面的重复由文件系统幂等性保证.

### 3. commands 目录不变

虽然部分工具的 commandsDir 也可以统一, 但 `.agents/` 标准主要定义了 skills 目录.  各工具的 commands/workflows 目录名和语义有差异 (如 Antigravity 用 `workflows`), 不适合强制统一.

**理由**: 最小变更原则, 避免引入额外风险.

## Risks / Trade-offs

- **[已部署项目迁移]** → 已部署到旧目录 (如 `.codex/skills/`) 的项目不会自动迁移.  用户需手动删除旧目录或重新 `init`.  → 可在未来添加迁移命令, 本次不处理.
- **[扫描重复]** → 多个工具扫描同一 `.agents/skills/` 目录, `scanAllTools()` 返回的 deployments 中同一 skill 会出现多次 (每个工具一次).  → 这是正确语义, 不需要去重.  UI 层面 `list --deployed` 已按工具分组显示.
- **[Antigravity 特殊性]** → Antigravity 原来用 `.agent/skills` (不带 s), 现改为 `.agents/skills` (带 s).  行为变更但与 vercel-labs/skills 对齐.
