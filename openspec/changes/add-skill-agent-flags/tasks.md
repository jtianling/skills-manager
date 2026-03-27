## 1. 类型和工具函数

- [x] 1.1 更新 `types.ts` 中 `AddOptions.agent` 从 `string` 改为 `string[]`, 新增 `skill: string[]` 字段
- [x] 1.2 新增 `InstallOptions.skill: string[]` 和 `InstallOptions.agent: string[]` 字段
- [x] 1.3 在 `types.ts` 或合适位置添加 Commander.js collector 函数 `collect(val, acc)`
- [x] 1.4 更新 `prompts.ts` 中 `ResolveAgentsOptions.agent` 从 `string` 改为 `string[]`, `resolveTargetAgents()` 移除逗号 split 逻辑

## 2. install 命令

- [x] 2.1 在 `install.ts` 的 Commander 定义中添加 `-s, --skill` 和 `-a, --agent` 选项 (collector 模式)
- [x] 2.2 修改 `install-utils.ts` 的 `selectSkills()` 函数, 支持 `options.skill` 数组过滤, 有值时跳过交互
- [x] 2.3 在 install 流程中集成 agent 选择逻辑 (复用 `resolveTargetAgents`) — install 只安装到中央仓库不 deploy, --agent 选项已添加但当前不使用

## 3. uninstall 命令

- [x] 3.1 在 `uninstall.ts` 的 Commander 定义中添加 `-s, --skill` 选项 (collector 模式)
- [x] 3.2 修改 uninstall 逻辑, 当 `--skill` 指定时按名称过滤并跳过交互选择

## 4. add 命令

- [x] 4.1 在 `add.ts` 的 Commander 定义中添加 `-s, --skill` 选项, 将 `-s` 从 `--same-agents` 移除, `-a` 改为 collector 模式
- [x] 4.2 修改 provider/repo 流程 (`handleRepoSkillSelection`), 当 `--skill` 指定时按名称过滤跳过交互
- [x] 4.3 修改 URL 安装流程, 当 `--skill` 指定时按名称过滤跳过交互

## 5. remove 命令

- [x] 5.1 将 remove 的 positional arg 从 `<name>` 改为 `[name]`, 添加 `-s, --skill` 选项 (--agent 不适用于统一目录架构, 跳过)
- [x] 5.2 实现 positional arg 与 `--skill` 合并逻辑, 无参数时报错
- [x] 5.3 实现 `--agent` 过滤: 指定时仅从特定 agent 移除, 不指定时从所有已配置 agent 移除 — 跳过: 统一 .agents/skills/ 架构下无法按 agent 移除

## 6. 测试

- [x] 6.1 为 collector 函数和参数解析编写单元测试
- [x] 6.2 为各命令的 --skill 过滤逻辑编写测试 (包含不存在 skill 的错误路径)
- [x] 6.3 为 remove 的参数合并编写测试 (--agent 过滤因架构限制跳过)
- [x] 6.4 更新现有测试中使用逗号分隔 `-a` 的用例
