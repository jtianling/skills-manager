## 1. plugin.json marketplace 格式支持

- [x] 1.1 修改 `src/services/plugin-manifest.ts` 的 `getPluginSkillPaths`: 对 plugin.json parsed result 检测是否有 `plugins` 数组, 有则调用 `parseMarketplaceManifest`
- [x] 1.2 在 `src/services/plugin-manifest.test.ts` 补充测试: plugin.json marketplace 格式, 同时有两种格式, 纯简单格式 (不变)

## 2. 标准发现路径扩展

- [x] 2.1 提取标准路径常量 `STANDARD_SKILL_PATHS = ['skills', '.agents/skills', '.claude/skills', '.github/skills']`
- [x] 2.2 修改 `src/commands/install-git.ts` 的 `findRepoSkills`: 遍历所有标准路径扫描 skill
- [x] 2.3 修改 `src/commands/install.ts` 的 `listGitHubRepoSkills`: 标准路径列表与 git clone 对齐

## 3. 测试验证

- [x] 3.1 运行现有测试确保无回归
- [x] 3.2 手动验证 `skillsmgr install microsoft/skills` 能发现 skills
