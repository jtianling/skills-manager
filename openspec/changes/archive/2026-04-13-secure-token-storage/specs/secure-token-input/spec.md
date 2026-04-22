## ADDED Requirements

### Requirement: Token 可选值参数
`--token` SHALL 接受可选值。当提供值时（`--token abc123`）直接使用该值；当不提供值时（`--token`）SHALL 按优先级从其他来源获取 token。

#### Scenario: 带值调用
- **WHEN** 用户执行 `skillsmgr login --token abc123`
- **THEN** 系统 SHALL 使用 `abc123` 作为 token 进行登录

#### Scenario: 不带值调用且环境变量存在
- **WHEN** 用户执行 `skillsmgr login --token` 且 `SKILLSMGR_TOKEN` 环境变量已设置
- **THEN** 系统 SHALL 使用环境变量的值作为 token

#### Scenario: 不带值调用且无环境变量但有 stdin
- **WHEN** 用户执行 `echo $TOKEN | skillsmgr login --token` 且无 `SKILLSMGR_TOKEN` 环境变量
- **THEN** 系统 SHALL 从 stdin 读取 token

#### Scenario: 不带值调用且无环境变量且无 stdin
- **WHEN** 用户在 TTY 终端执行 `skillsmgr login --token` 且无 `SKILLSMGR_TOKEN` 环境变量
- **THEN** 系统 SHALL 以掩码方式（不回显）交互式提示用户输入 token

### Requirement: 环境变量支持
系统 SHALL 支持 `SKILLSMGR_TOKEN` 环境变量。当 `--token` 不带显式值且该环境变量存在时，SHALL 使用其值作为 token。

#### Scenario: 仅通过环境变量登录
- **WHEN** 用户设置 `SKILLSMGR_TOKEN=abc123` 并执行 `skillsmgr login --token`
- **THEN** 系统 SHALL 使用 `abc123` 登录，不提示输入

#### Scenario: 显式值优先于环境变量
- **WHEN** 用户设置 `SKILLSMGR_TOKEN=env_token` 并执行 `skillsmgr login --token cli_token`
- **THEN** 系统 SHALL 使用 `cli_token`，忽略环境变量

### Requirement: Stdin 管道输入
当 stdin 不是 TTY（即通过管道输入）时，系统 SHALL 从 stdin 读取 token（去除首尾空白）。

#### Scenario: 管道输入 token
- **WHEN** 用户执行 `echo "my-token" | skillsmgr login --token`
- **THEN** 系统 SHALL 使用 `my-token`（去除换行符）登录

### Requirement: 交互式掩码输入
当所有非交互式来源均不可用时，系统 SHALL 使用掩码输入提示用户输入 token，输入内容 SHALL 不在终端回显（或以 `*` 掩码显示）。

#### Scenario: 掩码输入 token
- **WHEN** 系统进入交互式 token 输入
- **THEN** 提示文本 SHALL 为 "Token:"
- **THEN** 用户输入的字符 SHALL 以 `*` 掩码显示，不以明文回显
