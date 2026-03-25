## Why

`.agents/skills` 已成为 agents skills 的标准规范目录, 多数工具原生支持.  当前架构为每个工具维护独立的 skillsDir 配置和独立的物理目录, 导致同一份 skill 在项目中存在多个副本 (即使是 symlink 也有多个不同路径).  统一为单一真实目录 + symlink 桥接, 简化部署逻辑和用户心智模型.

## What Changes

- **BREAKING**: 移除 mode-specific 部署支持 (kilo-code, roo-code 的 `skills-code/`, `skills-architect/` 模式)
- **BREAKING**: 所有工具统一部署到 `.agents/skills/`, 不再为每个工具创建独立的 skills 目录
- 不原生支持 `.agents/skills` 的工具 (claude-code, cursor, kilo-code, roo-code, trae, windsurf) 通过 symlink `.xxx/skills → .agents/skills` 桥接
- 原生支持 `.agents/skills` 的工具 (codex, gemini-cli, opencode, openclaw, antigravity, cline) 无需额外操作
- 工具选择 UI 从扁平列表改为分组显示: "Agents Skills Standard" 作为一组 (含工具列表), 需要 symlink 的工具各自显示并标注 symlink 关系
- ToolConfig 数据模型简化: 移除 `supportsModeSpecific`, `modePattern`, `availableModes` 字段, 新增 `native` 标志区分原生/symlink 工具

## Capabilities

### New Capabilities

- `symlink-bridge`: 为非原生工具创建 `.xxx/skills → .agents/skills` 的 symlink 桥接, 替代当前的独立目录部署

### Modified Capabilities

- `tool-integration`: 工具分为原生组 (native) 和 symlink 组, 移除 mode-specific 支持, ToolConfig 数据模型变更, 部署扫描逻辑重构, UI 分组显示

## Impact

- `src/tools/configs.ts`: ToolConfig 结构重构, 移除 mode-specific 字段, 新增 native 标志
- `src/types.ts`: ToolConfig 接口变更
- `src/constants.ts`: SUPPORTED_TOOLS 列表可能需要重新分组
- `src/services/deployer.ts`: 部署逻辑重写 — 原生工具直接部署到 `.agents/skills`, symlink 工具创建目录级 symlink
- `src/services/scanner.ts`: 扫描逻辑适配新的目录结构, 需要识别 symlink 桥接
- `src/utils/prompts.ts`: 工具选择 UI 分组重构
- `src/commands/init.ts`: 适配新的部署流程
- `src/commands/add.ts`, `src/commands/remove.ts`: 适配新的部署/移除逻辑
- 测试文件: mode-specific 相关测试移除, 新增 symlink 桥接测试
