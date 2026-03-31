## Why

`skillsmgr add <name>` 在中央仓库中找到多个同名 skill 时, 如果它们的 `source` 相同 (如 `custom/jt-release` 和 `custom/init-project/jt-release` 都得到 `source: "custom"`), 消歧义 prompt 的选项无法区分, 且 `promptSelect` 返回值与 `find` 不匹配时直接 crash (`TypeError: Cannot read properties of undefined`).

## What Changes

- 修复 `SkillsService.getSkillsFromSource` 中嵌套 custom skill 的 source 值, 保留父目录上下文 (如 `"custom/init-project"` 而非 `"custom"`)
- 修复 `handleSkillName` 中消歧义逻辑: 用 `path` (唯一) 替代 `source` (可重复) 作为 choices value, 并在显示中加入足够区分信息
- 添加 null guard: `promptSelect` 返回值或 `find` 结果为 undefined 时优雅退出

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `smart-add`: 多匹配消歧义场景需要处理同 source 的情况, 用 path 替代 source 区分

## Impact

- `src/services/skills.ts`: `getSkillsFromSource` 中 custom 嵌套分支的 source 参数
- `src/commands/add.ts`: `handleSkillName` 中的消歧义逻辑和 null guard
- 不影响 official/community source 的逻辑 (它们已经在 source 中包含完整路径如 `official/anthropic/skills`)
