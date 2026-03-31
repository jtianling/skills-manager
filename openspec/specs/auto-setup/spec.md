# Auto Setup

自动初始化守卫: 所有依赖 `~/.skills-manager/` 目录的 CLI 命令在执行前自动检查并创建目录结构.

## Requirements

### Requirement: 统一 auto-setup 守卫
所有依赖 `~/.skills-manager/` 目录的 CLI 命令 SHALL 在执行前自动检查并创建目录结构.  提供共享的 `ensureSetup()` 函数, 封装检查和初始化逻辑.

#### Scenario: 首次使用 install 命令自动初始化
- **WHEN** `~/.skills-manager/` 不存在, 用户执行 `skillsmgr install anthropic`
- **THEN** 自动创建 `~/.skills-manager/` 目录结构, 然后继续执行 install 流程

#### Scenario: 首次使用 list 命令自动初始化
- **WHEN** `~/.skills-manager/` 不存在, 用户执行 `skillsmgr list`
- **THEN** 自动创建 `~/.skills-manager/` 目录结构, 然后继续执行 list 流程

#### Scenario: 首次使用 deploy 命令自动初始化
- **WHEN** `~/.skills-manager/` 不存在, 用户执行 `skillsmgr deploy`
- **THEN** 自动创建 `~/.skills-manager/` 目录结构, 然后继续执行 deploy 流程

#### Scenario: 目录已存在时跳过
- **WHEN** `~/.skills-manager/` 已存在, 用户执行任何命令
- **THEN** 不执行 setup, 直接进入命令逻辑

### Requirement: setup 不复制 example skill
`executeSetup()` SHALL 只创建目录结构, 不再复制 example skill 模板.

#### Scenario: setup 执行后无 example skill
- **WHEN** `ensureSetup()` 触发自动初始化
- **THEN** `~/.skills-manager/custom/` 目录存在但为空, 不包含 `example-skill/`

### Requirement: setup 完成提示使用 deploy
`executeSetup()` 的完成提示 SHALL 引导用户使用 `deploy` 命令而非 `init`.

#### Scenario: setup 提示文本
- **WHEN** auto-setup 完成并打印 "Next steps"
- **THEN** 提示中包含 `skillsmgr deploy` 而非 `skillsmgr init`
