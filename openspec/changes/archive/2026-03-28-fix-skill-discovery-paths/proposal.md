## Why

`skillsmgr install microsoft/skills` 报错 "No skills found in repository", 但该仓库有 166 个 SKILL.md.  根因是 `plugin.json` 使用了 marketplace 格式 (含 `metadata.pluginRoot` + `plugins[]`), 但代码只按简单格式解析 (只读顶层 `skills` 字段).  同时, ref repo 规范定义的标准发现路径 (`.agents/skills/`, `.claude/skills/` 等) 也未覆盖.

## What Changes

- `plugin.json` 增加 marketplace 格式检测: 当包含 `plugins` 数组时, 使用 `parseMarketplaceManifest` 而非 `parsePluginManifest`
- git clone 和 GitHub API 两条发现路径都增加 ref repo 规范的标准目录: `.agents/skills/`, `.claude/skills/`
- GitHub API 路径 (`listGitHubRepoSkills`) 的标准路径列表与 git clone 路径对齐

## Capabilities

### New Capabilities

### Modified Capabilities
- `plugin-manifest`: plugin.json 需支持 marketplace 格式 (有 `metadata`/`plugins` 字段时按 marketplace 解析)

## Impact

- `src/services/plugin-manifest.ts` — `getPluginSkillPaths` 增加格式判断
- `src/commands/install-git.ts` — `findRepoSkills` 增加标准路径扫描
- `src/commands/install.ts` — `listGitHubRepoSkills` 标准路径列表扩展
- 现有测试需要补充 plugin.json marketplace 格式的用例
