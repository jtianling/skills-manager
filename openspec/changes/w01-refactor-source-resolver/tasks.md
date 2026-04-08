# Tasks: w01-refactor-source-resolver

## 1. SourceResolver 骨架

- [x] 1.1 创建 `src/services/source-resolver.ts`, 定义 `ResolvedTarget` interface 和 `SourceResolver` 类
- [x] 1.2 定义 `kind` 枚举: `'source' | 'skill' | 'batch-unsupported' | 'not-found'`
- [x] 1.3 构造函数接受 `SourcesService`, `SkillsService`, `GitHubService` 作为依赖 (便于测试 mock)
- [x] 1.4 导出 `resolve(input: string): Promise<ResolvedTarget>` 作为唯一公开入口
- [x] 1.5 内部实现分发方法骨架: `resolveOwnerRepo`, `resolveOwnerRepoSkill`, `resolveUrl`, `resolveLocalPath`, `resolveRegistry`, `resolveBareword`

## 2. Owner/repo 解析 + Official owner 翻译

- [x] 2.1 实现 `resolveOwnerRepo(owner, repo)`: 调用 `findOfficialProvider(owner)` 翻译, 按 `official/{providerKey}/{repo}` 匹配 sources.json
- [x] 2.2 若 official 路径未命中, 回退到 `community/{owner}/{repo}`
- [x] 2.3 若两者都未命中, 扫描所有 sources.json 的 url 字段做 URL 归一化匹配 (支持 GitLab 等非 github host)
- [x] 2.4 单元测试: `anthropics/skills` 命中 official, `obra/superpowers` 命中 community, `vercel/agent-skills` 命中 official 别名

## 3. URL 归一化

- [x] 3.1 实现 `resolveUrl(url)`: 调用 `githubService.parseGitHubUrl` 提取 owner/repo
- [x] 3.2 实现 URL 字符串归一化辅助函数: 去 `.git` 后缀, ssh → https 等价形式
- [x] 3.3 parseGitHubUrl 失败时, 扫描 sources.json 的 url 字段做归一化字面匹配
- [x] 3.4 单元测试: https / ssh / 带 .git / gitlab URL 都能映射到同一 source key

## 4. Owner/repo:skill 单 skill 解析

- [x] 4.1 实现 `resolveOwnerRepoSkill(owner, repo, skillName)`: 先走 owner/repo 路径确定 source key, 再在该 source 下查找 skill
- [x] 4.2 skill 存在返回 `kind: 'skill'` 带 skill info, 不存在返回 `not-found` (不自动安装)
- [x] 4.3 单元测试: 存在/不存在两种 case

## 5. Registry 包名解析

- [x] 5.1 实现 `resolveRegistry(input)`: 复用 `parseRegistryInput` 解析 bare/scoped/@version
- [x] 5.2 匹配 `registry/{packageName}` source key
- [x] 5.3 `@version` 后缀保存在 ResolvedTarget 的扩展字段 (新增 `requestedVersion?: string`)
- [x] 5.4 单元测试: `code-review`, `code-review@1.2.0`, `@acme/skill-x` 三种形式

## 6. 本地路径解析 + batch 检测

- [x] 6.1 实现 `resolveLocalPath(path)`: 展开 `~`, resolve 为绝对路径
- [x] 6.2 若路径不存在, 返回 `not-found` 并注明路径不存在
- [x] 6.3 若路径存在且根目录含 SKILL.md, 扫 sources.json 按 url 字面匹配 local-copy source
- [x] 6.4 若路径存在但根目录无 SKILL.md, 扫描子目录, 只要有一个包含 SKILL.md 即视为 batch 目录, 返回 `kind: 'batch-unsupported'`
- [x] 6.5 reason 文案包含 workaround 引导 ("update individual skills: skillsmgr update ./dir/<skill>")
- [x] 6.6 单元测试: 单 skill 目录匹配成功, batch 目录返回 batch-unsupported, 不存在路径返回 not-found

## 7. 裸词兜底解析

- [x] 7.1 实现 `resolveBareword(input)`: 按 registry → source key 后缀 → repoName → skill name 优先级依次尝试
- [x] 7.2 source key 后缀: `k.endsWith('/' + input)` (保留旧 fuzzy 行为)
- [x] 7.3 repoName 精确匹配: 遍历 sources.json 比较 `info.repoName === input`
- [x] 7.4 skill name 走 `resolveSkillByName(input, allSkills)`, 多匹配时走交互式选择
- [x] 7.5 全部失败返回 `not-found` 并在 reason 中列出尝试过的路径
- [x] 7.6 单元测试: 每种优先级下的命中 case + 全部失败 case

## 8. Resolve 总入口分发

- [x] 8.1 `resolve(input)` 方法内部调用 `detectSourceType`, 按类型分发到对应子方法
- [x] 8.2 对 `owner-repo-skill` 走 `resolveOwnerRepoSkill`
- [x] 8.3 对 `remote-url` 走 `resolveUrl`
- [x] 8.4 对 `owner-repo` 走 `resolveOwnerRepo`
- [x] 8.5 对 `local-path` 走 `resolveLocalPath`
- [x] 8.6 对 `registry` 走 `resolveRegistry`
- [x] 8.7 对 `unknown` 走 `resolveBareword`
- [x] 8.8 对 `local-zip` / `remote-zip`: 返回 `not-found` 并说明 zip 源需要 manual reinstall
- [x] 8.9 单元测试: 端到端 resolve 测试, 覆盖每个 kind

## 9. update 命令迁移到 SourceResolver

- [x] 9.1 修改 `src/commands/update.ts`: 删除现有 `local-path` 快速路径和 fallback fuzzy 匹配分支
- [x] 9.2 统一调用 `resolver.resolve(source)`
- [x] 9.3 按 `ResolvedTarget.kind` 分发:
  - `source` → 遍历 sourceKeys 调用 `updateSource`
  - `skill` → 调用 `updateSource` 但过滤出指定 skill (新增辅助 `updateSingleSkill`)
  - `batch-unsupported` → 输出 reason 并 `process.exit(1)`
  - `not-found` → 保留现有 "Source 'X' not found" 输出
- [x] 9.4 registry 源的 @version 切换逻辑: 当 `requestedVersion` 存在时, 传递给 `updateRegistrySource` 覆盖 latest 行为
- [x] 9.5 更新 `updateRegistrySource` 接受可选 `targetVersion` 参数

## 10. uninstall 命令迁移到 SourceResolver

- [x] 10.1 修改 `src/commands/uninstall.ts`: 删除 `extractOwnerRepo` + `uninstallByName` 二分分支
- [x] 10.2 统一调用 `resolver.resolve(identifier)`
- [x] 10.3 按 `ResolvedTarget.kind` 分发:
  - `source` → 列出所有 skill, 交互确认后批量删
  - `skill` → 精确删除单个 skill
  - `batch-unsupported` → 输出 reason 并 `process.exit(1)`
  - `not-found` → 保留现有错误行为
- [x] 10.4 保留 symlink 部署失效警告 (`printWarning`)
- [x] 10.5 保留 `--force`, `--yes`, `--all` 等选项行为

## 11. 回归测试

- [x] 11.1 新增 `src/services/source-resolver.test.ts`, 覆盖 specs 中每个 Scenario
- [x] 11.2 更新 `src/commands/update.test.ts`: 新增 `update anthropics/skills` (洞 2 修复), `update https://github.com/...`, `update code-review@1.2.0` 测试
- [x] 11.3 更新 `src/commands/uninstall.test.ts`: 新增 `uninstall https://github.com/obra/superpowers.git`, `uninstall git@...`, `uninstall owner/repo:skill` 测试
- [x] 11.4 新增 batch 路径回归测试: `update ./spec-tdd` 和 `uninstall ./spec-tdd` 都应返回 batch-unsupported 引导消息 (非零退出)
- [x] 11.5 运行 `pnpm test` 确认所有测试通过
- [x] 11.6 用 `src/commands/update.test.ts` 对 `update anthropics/skills` 的回归测试覆盖该场景, 无需额外手动验证

## 12. 文档与 lint

- [x] 12.1 更新 README 中 update / uninstall 章节, 列出所有支持的 input 形式
- [x] 12.2 运行 `pnpm build` 确认无错误 (`tsup` + DTS 生成可覆盖类型正确性)
- [x] 12.3 运行 `openspec validate w01-refactor-source-resolver --strict` 确认 spec 无效
