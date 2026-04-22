## Why

`skillsmgr login --token abc123` 将 token 以明文暴露在命令行参数中，可通过 shell history（`~/.bash_history`、`~/.zsh_history`）和进程列表（`ps aux`）被读取。CI/CD 环境中也不应鼓励将 token 直接写在命令参数里。需要提供安全的 token 输入方式。

## What Changes

- `--token` 改为可选值参数：不带值时交互式提示输入（密码掩码，不回显）
- 新增 `SKILLSMGR_TOKEN` 环境变量支持，CI/CD 推荐使用
- 支持 stdin 管道输入：`echo $TOKEN | skillsmgr login --token`
- 优先级：`--token <value>` > `SKILLSMGR_TOKEN` 环境变量 > 交互式掩码输入

## Capabilities

### New Capabilities
- `secure-token-input`: 安全 token 输入能力——定义 token 的多种安全输入渠道及优先级策略

### Modified Capabilities

（无现有 spec 级别的行为变更）

## Impact

- **代码**: `src/commands/login.ts` 修改 `--token` 参数处理逻辑
- **依赖**: 无新增依赖（inquirer password prompt 已有）
- **兼容性**: `--token <value>` 仍可用（向后兼容），但文档引导用户使用更安全的方式
- **CI/CD**: 推荐使用 `SKILLSMGR_TOKEN` 环境变量替代命令行参数
