## ADDED Requirements

### Requirement: 独立的 E2E vitest 配置
系统 SHALL 有独立的 vitest.config.e2e.ts 配置文件, 与单元测试配置分离.

#### Scenario: E2E 配置参数
- **WHEN** vitest.config.e2e.ts 被加载
- **THEN** include 路径为 e2e/**/*.e2e.ts
- **THEN** testTimeout 为 120000ms
- **THEN** hookTimeout 为 30000ms
- **THEN** maxConcurrency 为 1 (串行)

#### Scenario: npm scripts
- **WHEN** 开发者运行 pnpm test:e2e
- **THEN** 使用 vitest.config.e2e.ts 配置执行 E2E 测试
- **WHEN** 开发者运行 pnpm test:all
- **THEN** 先执行单元测试, 再执行 E2E 测试

### Requirement: TmuxSession helper class
系统 SHALL 提供 TmuxSession class 封装 tmux 交互, 位于 e2e/helpers/tmux.ts.

#### Scenario: 创建隔离的 tmux session
- **WHEN** TmuxSession.start(cmd) 被调用
- **THEN** 创建新的 tmux session (尺寸 120x40)
- **THEN** session 使用指定的环境变量 (HOME, PATH, GITHUB_TOKEN)
- **THEN** 在 session 中执行指定命令

#### Scenario: 发送键盘输入
- **WHEN** sendKeys(keys) 被调用
- **THEN** 通过 tmux send-keys 发送到 session
- **THEN** 支持特殊键名: Enter, Space, Up, Down, Escape, C-a, C-c

#### Scenario: 捕获屏幕输出
- **WHEN** capturePane() 被调用
- **THEN** 返回当前 tmux pane 的文本内容 (去除 trailing 空行)

#### Scenario: 等待特定输出
- **WHEN** waitForText(pattern, timeout) 被调用
- **THEN** 轮询 capturePane() 直到匹配 pattern
- **THEN** 轮询间隔 200ms
- **THEN** 超时默认 30000ms
- **THEN** 超时时抛出错误, 错误信息包含最后一次 capture 内容

#### Scenario: 等待进程退出
- **WHEN** waitForExit(timeout) 被调用
- **THEN** 轮询检查 tmux session 是否仍存在
- **THEN** session 消失表示命令已退出

#### Scenario: 清理 session
- **WHEN** destroy() 被调用
- **THEN** kill tmux session (如果存在)
- **THEN** 不因 session 已消失而报错

### Requirement: 测试环境隔离工厂
系统 SHALL 提供 createTestEnv() 函数创建隔离的测试环境.

#### Scenario: 创建隔离环境
- **WHEN** createTestEnv() 被调用
- **THEN** 创建 /tmp/skillsmgr-e2e-{timestamp}-{random}/ 目录
- **THEN** 包含 home/ 子目录 (作为 HOME)
- **THEN** 包含 project/ 子目录 (作为 cwd)

#### Scenario: 清理环境
- **WHEN** cleanup() 被调用
- **THEN** 递归删除整个临时目录

#### Scenario: 环境变量配置
- **WHEN** 创建 TmuxSession 时使用 testEnv
- **THEN** HOME 指向 testEnv.homeDir
- **THEN** PATH 包含项目 dist/ 目录 (优先)
- **THEN** GITHUB_TOKEN 从 process.env 传递 (如果存在)
