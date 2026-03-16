## Context

skillsmgr 采用配置驱动架构, 所有工具集成通过 `SUPPORTED_TOOLS` 常量和 `TOOL_CONFIGS` 配置记录定义.  当前支持 11 种工具.  OpenClaw 是一个开源 AI 助手, 使用 `.openclaw/skills` 目录存放 workspace-level 技能, 格式与 skills-manager 的 SKILL.md 兼容.

## Goals / Non-Goals

**Goals:**
- 将 OpenClaw 作为第 12 个支持的工具加入 skills-manager
- 使用 `.openclaw/skills` 作为部署路径
- 保持与现有架构完全一致的集成方式

**Non-Goals:**
- 不集成 ClawhHub (OpenClaw 的公共技能注册中心)
- 不支持 OpenClaw 的 commands (其 slash commands 即为 skills, 无独立目录)
- 不支持 mode-specific 部署
- 不解析 OpenClaw 特有的 metadata 字段 (如 requires, os 等)

## Decisions

### 1. 部署路径选择 `.openclaw/skills`

OpenClaw 原生支持两个技能路径: workspace 级 `skills/` 和用户级 `~/.openclaw/skills/`.  选择 `.openclaw/skills` 而非 `skills/`:
- 与其他工具的 `.{tool}/skills` 模式一致
- 避免与项目中可能存在的 `skills/` 目录冲突
- `.openclaw/skills` 可通过 OpenClaw 的 `skills.load.extraDirs` 配置加载

### 2. 不设置 commandsDir

OpenClaw 的 user-invocable skills 等同于 slash commands, 但并不使用独立的 commands 目录.  设 `commandsDir` 为 undefined, 与 cline, codex-cli, trae 的处理方式一致.

### 3. 工具顺序

在 `SUPPORTED_TOOLS` 数组末尾追加 `'openclaw'`, 保持现有顺序不变.

## Risks / Trade-offs

- [OpenClaw 默认不扫描 `.openclaw/skills`] → 用户需在 `openclaw.json` 中配置 `skills.load.extraDirs` 指向 `.openclaw/skills`.  可在文档中说明.
