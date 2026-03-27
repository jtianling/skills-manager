## 1. E2E 基础设施

- [x] 1.1 创建 vitest.config.e2e.ts (include e2e/**/*.e2e.ts, timeout 120s, 串行)
- [x] 1.2 在 package.json 添加 test:e2e 和 test:all scripts
- [x] 1.3 创建 e2e/helpers/tmux.ts — TmuxSession class (start, destroy, sendKeys, capturePane, waitForText, waitForExit)
- [x] 1.4 创建 e2e/helpers/tmux.ts — createTestEnv() 环境隔离工厂 (临时 HOME, project dir, cleanup)
- [x] 1.5 验证 tmux helper: 写一个最小 E2E 测试 (echo + capturePane) 确认框架能跑通

## 2. 单元/集成测试补全

- [x] 2.1 创建 src/commands/setup.test.ts — 目录创建, 模板复制, 幂等性
- [x] 2.2 创建 src/commands/remove.test.ts — 正常删除, skill 不存在, 无部署
- [x] 2.3 创建 src/services/sources.test.ts — addSource, removeSource, getAllSources, updateTimestamp, 文件不存在
- [x] 2.4 创建 src/services/git.test.ts — clone 命令构造 (mock execSync), isSpecificSkillUrl, custom 目录
- [x] 2.5 创建 src/commands/install.test.ts — 输入格式路由 (provider/alias/owner-repo/URL), --all, 未 setup 退出
- [x] 2.6 创建 src/commands/update.test.ts — 远程比对逻辑, 单源/全量, 无 sources
- [x] 2.7 创建 src/commands/init.test.ts — link/copy 部署, bridge 创建/移除, unmanaged 保留
- [x] 2.8 创建 src/commands/sync.test.ts — link up-to-date, copy 比对, orphan, conflict

## 3. E2E 测试 — 非交互场景

- [x] 3.1 创建 e2e/setup.e2e.ts — setup 创建目录, 幂等
- [x] 3.2 创建 e2e/install.e2e.ts — install anthropic --all (真实下载, 验证文件和 sources.json)
- [x] 3.3 创建 e2e/list.e2e.ts — list 显示已安装 skills, list --deployed
- [x] 3.4 创建 e2e/add-init.e2e.ts — add <skill> -a claude-code (非交互部署), --copy 模式

## 4. E2E 测试 — 交互场景

- [x] 4.1 创建 e2e/install.e2e.ts 追加 — install anthropic 交互选择 (interactiveCheckbox: Space 选, Enter 确认)
- [x] 4.2 创建 e2e/uninstall.e2e.ts — uninstall -f 非交互, uninstall 交互确认 (inquirer confirm: y + Enter)

## 5. E2E 测试 — 完整生命周期

- [x] 5.1 创建 e2e/lifecycle.e2e.ts — setup → install --all → list → add -a → list --deployed → remove → uninstall -f
