## 1. 重构 executeUninstall 路由

- [x] 1.1 移除 `OFFICIAL_OWNERS` provider 分支, 裸词统一走 `uninstallByName()`
- [x] 1.2 新增 `--all` option 到 Commander 命令定义和 `UninstallOptions` 接口
- [x] 1.3 将 `owner/repo` 分支改为调用新的 `uninstallSource()` 函数

## 2. 实现 uninstallSource

- [x] 2.1 创建 `uninstallSource(owner, repo, options)` 函数, 依次查找 `official/{owner}/{repo}` 和 `community/{owner}/{repo}`
- [x] 2.2 用 `SkillsService.getAllSkills()` 过滤出该 source 下的 skills
- [x] 2.3 单个 skill 时跳过 checkbox, 直接走 `confirmUninstall` 流程
- [x] 2.4 多个 skill 且无 `--all` 时调用 `promptSkillsToUninstall()` 展示 scoped checkbox
- [x] 2.5 `--all` 时跳过 checkbox, 直接走 `confirmUninstall` 流程
- [x] 2.6 选中 skills 后复用现有的删除/清理逻辑 (removeDir, cleanEmptyParents, cleanSourcesForDir, removeSkillFromAll)

## 3. 清理遗留代码

- [x] 3.1 删除 `uninstallProvider()` 函数
- [x] 3.2 删除 `uninstallCommunitySource()` 函数
- [x] 3.3 移除 `OFFICIAL_OWNERS` import (如果不再被其他地方使用)

## 4. 测试

- [x] 4.1 更新 uninstall 单元测试: 移除 provider 分支测试, 新增 scoped 交互测试
- [x] 4.2 测试 `--all` 参数跳过交互的行为
- [x] 4.3 测试单 skill 跳过 checkbox 的行为
- [x] 4.4 测试 owner/repo 优先查找 official 再 community 的逻辑
