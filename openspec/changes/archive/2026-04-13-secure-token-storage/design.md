## Context

当前 `skillsmgr login --token <token>` 要求 token 作为命令行参数传入，明文可见于：
- Shell history（`~/.zsh_history` 等）
- 进程列表（`ps aux`）
- CI/CD 日志（如果未做 mask）

交互式密码输入已使用 inquirer `type: 'password'` + `mask: '*'`，没有问题。

## Goals / Non-Goals

**Goals:**
- Token 不以明文出现在命令行参数中（除非用户主动选择）
- 提供环境变量 `SKILLSMGR_TOKEN` 作为 CI/CD 推荐方式
- 支持 stdin 管道输入，方便脚本集成
- `--token` 不带值时交互式掩码输入
- 向后兼容：`--token abc123` 仍可工作

**Non-Goals:**
- 不改变 token 的存储方式（auth.json 保持现有实现）
- 不涉及 token 加密/刷新机制
- 不修改 browser login 和 username/password login 流程

## Decisions

### 1. `--token` 参数改为可选值

**选择**: Commander.js 的 `--token [token]` 语法（方括号表示可选值）

**行为**:
- `--token abc123` → 直接使用 `abc123`（向后兼容）
- `--token`（无值）→ 检查环境变量 → 检查 stdin → 交互式掩码输入

**理由**: 最小改动，保持向后兼容。

### 2. Token 来源优先级

1. 命令行显式值：`--token abc123`
2. 环境变量：`SKILLSMGR_TOKEN`
3. Stdin 管道：`echo $TOKEN | skillsmgr login --token`
4. 交互式掩码输入：inquirer password prompt

**理由**: 遵循 CLI 工具惯例（显式参数 > 环境变量 > stdin > 交互），与 npm/gh 等工具一致。

### 3. Stdin 检测

**方案**: 检查 `process.stdin.isTTY`，若为 `false` 则从 stdin 读取

**理由**: 标准做法，无额外依赖。

## Risks / Trade-offs

- **[向后兼容]** → `--token abc123` 仍然可用，不强制阻止 → 通过文档和 help 信息引导用户使用安全方式
- **[环境变量泄露]** → 环境变量也可能通过 `/proc/*/environ` 泄露 → 相比命令行参数风险更低，且是业界标准做法
