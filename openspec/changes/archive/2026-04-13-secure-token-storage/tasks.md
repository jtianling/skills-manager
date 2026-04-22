## 1. 参数修改

- [x] 1.1 将 `--token <token>` 改为 `--token [token]`（Commander.js 可选值语法）
- [x] 1.2 实现 token 来源优先级逻辑：显式值 > SKILLSMGR_TOKEN 环境变量 > stdin > 交互式输入

## 2. 输入渠道实现

- [x] 2.1 添加 `SKILLSMGR_TOKEN` 环境变量读取
- [x] 2.2 添加 stdin 管道读取（检测 `process.stdin.isTTY`，非 TTY 时从 stdin 读取并 trim）
- [x] 2.3 添加交互式掩码输入（inquirer password prompt，mask: '*'）

## 3. 测试

- [x] 3.1 测试 `--token value` 直接使用值（向后兼容）
- [x] 3.2 测试 `--token` 无值时读取 SKILLSMGR_TOKEN 环境变量
- [x] 3.3 测试 stdin 管道输入
- [x] 3.4 测试交互式掩码输入（mock inquirer）
- [x] 3.5 测试优先级：显式值 > 环境变量 > stdin
