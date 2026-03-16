## Why

OpenClaw 是一个日渐流行的开源个人 AI 助手, 使用与 skills-manager 兼容的 SKILL.md 格式.  将其纳入支持范围, 用户可统一管理 OpenClaw 与其他工具的技能部署.

## What Changes

- 在 `SUPPORTED_TOOLS` 中新增 `openclaw` 工具标识符
- 在 `TOOL_CONFIGS` 中新增 OpenClaw 的工具配置, skills 部署目录为 `.openclaw/skills`
- 不支持 commands (OpenClaw 的 slash commands 即为 skills, 无独立 commands 目录)
- 不支持 mode-specific 部署

## Capabilities

### New Capabilities

无新能力引入.  本变更仅在已有 tool-integration 框架内增加一个配置项.

### Modified Capabilities

- `tool-integration`: 新增 OpenClaw 工具配置, 将支持的工具数量从 11 增加到 12

## Impact

- `src/constants.ts`: SUPPORTED_TOOLS 数组新增一项, ToolName 联合类型自动扩展
- `src/tools/configs.ts`: TOOL_CONFIGS 新增一个配置对象
- `openspec/specs/tool-integration/spec.md`: 规范文档需同步更新
- 下游 scanner, deployer, CLI 等模块无需修改 — 架构为配置驱动, 自动适配
