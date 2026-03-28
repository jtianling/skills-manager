## Context

skillsmgr 是一个 CLI 工具, 当前有 141 个单元/集成测试, 全部通过.  但核心命令 (install, update, init, remove, setup) 和关键 service (sources, git) 缺少测试覆盖.  完全没有 E2E 测试, 无法验证 TUI 交互 (自定义 interactiveCheckbox 和 inquirer prompts) 的真实行为.

现有测试模式: 真实 temp 目录 + vi.mock service 级别 mock + mock inquirer 返回值.

## Goals / Non-Goals

**Goals:**
- 补全缺失模块的单元/集成测试, 沿用现有模式
- 建立 E2E 测试框架, 使用 tmux 驱动 TUI 交互
- E2E 使用真实 GitHub API, 不做 mock
- E2E 环境完全隔离 (临时 HOME 目录)
- 独立的 vitest 配置, 不影响现有测试

**Non-Goals:**
- CI 集成 E2E 测试 (只在本地跑)
- 测试覆盖率指标
- 修改任何生产代码
- mock GitHub API

## Decisions

### 1. E2E 使用 tmux 驱动 TUI 交互

tmux 提供真实 PTY 环境, 可以 send-keys 模拟键盘输入, capture-pane 读取屏幕输出.  这是测试 TUI 应用的标准方式.

**替代方案**: expect/pty.js — 需要额外依赖, 且对 ANSI escape 处理不如 tmux 成熟.

### 2. E2E 使用真实 GitHub API

不做 mock, 直接请求 GitHub API.  测试只针对稳定的公开仓库 (anthropics/skills).

**替代方案**: 本地 mock server — 维护成本高, 需要改生产代码支持可配置 API base URL.

### 3. E2E 独立 vitest 配置 (vitest.config.e2e.ts)

E2E 测试需要: 更长 timeout (120s per test), 串行执行 (maxConcurrency: 1), 独立的 include 路径.  和单元测试混在一起会互相干扰.

### 4. 环境隔离通过临时 HOME 目录

每个 E2E 测试创建独立的 `/tmp/skillsmgr-e2e-{id}/` 作为 HOME, tmux session 中设置 `HOME` 环境变量.  测试后清理.  这样不会影响开发者的真实 `~/.skills-manager/`.

### 5. 单元测试沿用现有模式

真实 temp 目录 + mock services.  不改变已有测试的风格, 降低认知负担.

### 6. tmux helper 封装为 TmuxSession class

提供 start/destroy 生命周期, sendKeys/capturePane/waitForText 交互原语, waitForExit 退出检测.  所有 E2E 测试共用.

## Risks / Trade-offs

- **E2E 测试依赖网络** → 无网络时 E2E 会失败, 但这是预期行为 (真实环境测试)
- **GitHub API rate limit** → 传递 GITHUB_TOKEN 环境变量; E2E 只测 1 个 provider, API 调用量小 (<10 次)
- **tmux 需要安装** → macOS 默认有 (brew), Linux 需 apt install; 在 package.json 的 test:e2e script 中不做前置检查, 运行时报错即可
- **E2E 测试较慢** → 单个测试 10-30s (网络 + 交互), 全套 ~2-3 分钟; 可接受, 因为只在本地跑
- **interactiveCheckbox vs inquirer 键盘差异** → tmux helper 不抽象差异, 每个测试明确使用对应的键序列
