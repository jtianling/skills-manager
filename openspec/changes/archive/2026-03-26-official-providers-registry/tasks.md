## 1. Constants & Registry

- [x] 1.1 在 `constants.ts` 中添加 `OfficialProvider` 接口和 `OFFICIAL_PROVIDERS` registry
- [x] 1.2 添加 `findOfficialProvider(owner, repo)` 函数, 反查 registry 返回 provider key 或 null
- [x] 1.3 移除 `ANTHROPIC_SKILLS_REPO` 常量

## 2. Install 命令重构

- [x] 2.1 将 `installFromAnthropic()` 重构为 `installFromOfficial(providerKey)`, 支持 skillsPath 参数
- [x] 2.2 重构 `executeInstall()` 输入解析: 快捷名查询 → owner/repo 反查 → 常规流程
- [x] 2.3 重构 `installFromGitHubUrl()`: official 判断改用 `findOfficialProvider()`, community 目录改为 `{owner}/{repo}`
- [x] 2.4 重构 `installViaGitClone()`: 同步 official 判断和 community 目录逻辑
- [x] 2.5 重构 `saveGitCloneSource()`: 适配新的 source key 和目录格式

## 3. GitHub Service 适配

- [x] 3.1 重构 `getTargetDir()`: official 判断改用 `findOfficialProvider()`, community 路径改为 `{owner}/{repo}`

## 4. Git Service 适配

- [x] 4.1 重构 `clone()`: 移除 anthropic 硬编码, 使用 registry 判断 official, community 路径改为 `{owner}/{repo}`
- [x] 4.2 重构 `cloneSpecificSkill()`: 同步 official 和 community 目录逻辑

## 5. Skills Service 适配

- [x] 5.1 检查 `skills.ts` 中 source 识别逻辑, 适配 community 三级路径 (`community/{owner}/{repo}`)

## 6. Update 命令适配

- [x] 6.1 更新 `update` 命令中的目标目录计算逻辑, 适配新路径格式
- [x] 6.2 验证 source 匹配逻辑对新 key 格式的兼容性 (suffix 匹配等)

## 7. 测试

- [x] 7.1 为 `OFFICIAL_PROVIDERS` registry 和 `findOfficialProvider()` 编写单元测试
- [x] 7.2 更新 `getTargetDir()` 测试: 适配新路径格式
- [x] 7.3 E2E 验证: `skillsmgr install anthropic`, `skillsmgr install openai`, `skillsmgr install obra/superpowers`
