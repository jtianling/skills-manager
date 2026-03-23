## Why

越来越多 AI 编程工具采纳 `.agents/skills/` 作为统一的技能目录标准 (Codex, Cline, Gemini CLI, OpenCode, Antigravity 等).  当前 skills-manager 为每个工具使用各自专属目录, 导致同一个 skill 需要在项目中部署多份副本.  对于支持 `.agents/skills/` 的工具, 应该统一部署到该目录, 减少冗余.

## What Changes

- 将支持 `.agents/skills/` 标准的工具的 `skillsDir` 改为 `.agents/skills`
- 受影响的工具: codex, gemini-cli, opencode, openclaw, antigravity, cline
- Claude Code, Cursor, Windsurf, Roo Code, Kilo Code, Trae 保持各自专属目录不变 (这些工具目前不读取 `.agents/skills/`)
- 多个工具部署到同一目录时, 只需创建一次 symlink/copy, 避免重复部署

## Capabilities

### New Capabilities

(无新能力引入)

### Modified Capabilities

- `tool-integration`: 6 个工具的 skillsDir 从各自专属目录改为 `.agents/skills`, 部署扫描和初始化逻辑需要适配多工具共享同一目录的场景

## Impact

- `src/tools/configs.ts`: 修改 6 个工具的 `skillsDir` 配置
- `src/services/scanner.ts`: 扫描逻辑需处理多个工具共享同一 skills 目录的去重
- `src/services/deployer.ts`: 部署时需检测目标目录是否已有相同 skill (由其他共享目录的工具部署)
- `src/commands/init.ts`: 工具选择和增量部署需考虑共享目录
- 现有测试用例需更新以反映新的目录映射
