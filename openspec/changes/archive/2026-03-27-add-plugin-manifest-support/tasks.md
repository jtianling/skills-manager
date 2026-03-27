## 1. Plugin Manifest 解析模块

- [x] 1.1 创建 `src/services/plugin-manifest.ts`, 实现 `getPluginSkillPaths(basePath)` 函数, 解析 `.claude-plugin/marketplace.json` 和 `.claude-plugin/plugin.json`, 返回 skill 搜索路径数组
- [x] 1.2 实现路径安全校验: 路径必须以 `./` 开头, 不含 `..`, 解析后在 basePath 内
- [x] 1.3 跳过远程 source(对象类型的 plugin.source), 仅处理字符串本地路径
- [x] 1.4 编写 `src/services/plugin-manifest.test.ts` 单元测试, 覆盖: marketplace.json 多 plugin, plugin.json 单 plugin, 文件不存在, 格式错误, 路径穿越, 远程 source 跳过

## 2. 集成到 Git Clone 安装流程

- [x] 2.1 修改 `src/commands/install-git.ts` 的 `collectGitCloneSkills`, 在递归扫描前调用 `getPluginSkillPaths` 获取 manifest 路径, 对每个路径用 `scanSkillDirectories` 扫描, 与原有结果按 name 去重合并
- [x] 2.2 修改 `src/commands/install-git.ts` 的 `findRepoSkills`, 同样集成 manifest 发现逻辑
- [x] 2.3 编写集成测试, 模拟包含 marketplace.json 的仓库结构, 验证能发现 manifest 声明的 skills 并与顶层 skills 合并

## 3. 验证

- [x] 3.1 运行全量测试确保无回归
- [x] 3.2 用 `microsoft/skills` 仓库实际测试, 验证发现的 skills 数量从 9 增长到 171 (162 manifest + 9 顶层; 4 个嵌套子 skill 因父级 SKILL.md 截断, 与 npx skills 行为一致)
