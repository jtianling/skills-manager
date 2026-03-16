## 1. 核心配置

- [x] 1.1 在 `src/constants.ts` 的 `SUPPORTED_TOOLS` 数组末尾追加 `'openclaw'`
- [x] 1.2 在 `src/tools/configs.ts` 的 `TOOL_CONFIGS` 中新增 OpenClaw 配置对象 (name: `openclaw`, displayName: `OpenClaw`, skillsDir: `.openclaw/skills`, 无 commandsDir, supportsLink: true, supportsModeSpecific: false)

## 2. 规范同步

- [x] 2.1 更新 `openspec/specs/tool-integration/spec.md` 中的工具列表, 数量, 目录结构等内容
