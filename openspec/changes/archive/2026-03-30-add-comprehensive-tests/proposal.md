## Why

项目当前有 141 个单元/集成测试, 但 11 个命令中只有 6 个有测试, 8 个 service 中只有 5 个有测试, 且完全没有 E2E 测试.  缺少测试覆盖的模块 (install, update, init, remove, setup) 恰恰是用户最常使用的核心命令, 后续修改这些命令时没有安全网, 容易引入回归 bug.

## What Changes

- 补全 5 个缺失命令的单元/集成测试: setup, install, update, init, remove
- 补全 2 个缺失 service 的单元测试: sources, git
- 新增独立的 E2E 测试框架, 使用 tmux 处理 TUI 交互, 真实 GitHub API, 隔离的临时 HOME 目录
- 新增 E2E 测试覆盖: setup, install (含交互选择), list, add+init, uninstall, 完整生命周期
- 新增 vitest.config.e2e.ts 独立配置 (更长 timeout, 串行执行)
- 新增 package.json 的 test:e2e 和 test:all scripts

## Capabilities

### New Capabilities
- `unit-test-coverage`: 补全缺失模块的单元/集成测试 (setup, install, update, init, remove, sources, git)
- `e2e-test-framework`: E2E 测试基础设施 — tmux helper, 环境隔离, vitest 独立配置
- `e2e-test-suite`: E2E 测试场景集 — 覆盖所有命令的真实 CLI 执行和 TUI 交互

### Modified Capabilities

## Impact

- 新增文件: ~15 个测试文件 + tmux helper + vitest.config.e2e.ts
- 修改文件: package.json (新增 scripts)
- 新增开发依赖: 无 (tmux 通过 child_process 调用, vitest 已有)
- 运行要求: E2E 测试需要 tmux 已安装, 需要网络访问 GitHub API
- 不修改任何生产代码
