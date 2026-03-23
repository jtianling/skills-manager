## Context

skills-manager 当前同时管理 skills (目录, 含 SKILL.md) 和 commands (单个 .md 文件). 两者在代码中形成并行的逻辑分支: 每个 CLI 操作 (install, init, add, remove, list, sync, update) 都需要分别处理 skill 和 command. Claude Code 正在废弃 command, 其他工具也在跟进. 移除 command 支持可以显著简化代码.

当前 command 渗透的层次:
- 类型层: `CommandInfo`, `ScannedCommand`, `ToolConfig.commandsDir`
- 服务层: `CommandsService`, `Deployer` 的 command 方法, `DeploymentScanner` 的 command 扫描, `GitHubService` 的 command 方法
- CLI 层: 6 个命令都有 command 处理分支
- UI 层: `promptCommands`

## Goals / Non-Goals

**Goals:**
- 完全移除 command 概念, 包括类型, 服务, CLI 逻辑, 提示
- 简化所有 "skills and commands" 相关文案
- 保持 skill 相关功能完全不变

**Non-Goals:**
- 不提供 command → skill 的自动迁移工具
- 不清理用户项目中已部署的 command 文件 (如 `.claude/commands/`)
- 不修改 skill 的任何行为或数据模型

## Decisions

### 1. 完整删除 `services/commands.ts`

**选择**: 删除整个文件, 而非保留为空壳.

**理由**: `CommandsService` 的所有功能都是 command 独有的, 没有可复用的逻辑. 保留空文件无意义.

### 2. `ToolConfig` 中移除 `commandsDir` 字段

**选择**: 直接从接口和所有工具配置中删除 `commandsDir` 字段.

**理由**: 这是一个 breaking change, 但 skills-manager 是面向开发者的 CLI 工具, 没有公开的 programmatic API. 所有消费者都在项目内部.

### 3. `update.ts` 中保留 commands 目录跳过逻辑

**选择**: 保留 `if (skillName === 'commands') continue;` 这行代码.

**理由**: 用户在 `~/.skills-manager/official/anthropic/` 下可能仍有残留的 `commands/` 目录. 如果不跳过, `update` 命令会尝试将其当作 skill 处理, 导致 "not found in remote" 警告. 添加注释说明保留原因.

**替代方案**: 改为检查 `SKILL.md` 是否存在. 但当前代码已经在后续逻辑中检查 SKILL.md, 所以效果相同, 保留现有的显式跳过更清晰.

### 4. 文案清理策略

**选择**: 所有 "skills and commands" / "skill or command" 统一简化为 "skills" / "skill".

**涉及位置**:
- CLI 命令 description (如 `install` 的 "Download skills and commands from a repository")
- 错误消息 (如 "No skills or commands found in repository")
- 输出信息 (如 "Installed 3 skills and 2 commands to ...")
- 前置条件检查消息

### 5. 不修改 `deployer.test.ts`

当前测试文件不包含 command 相关测试, 无需修改. `init-unmanaged.test.ts` 包含 command 测试, 需要移除相关用例.

## Risks / Trade-offs

**[用户残留 command 文件]** → 已部署的 `.claude/commands/`, `.cursor/commands/` 等目录不会被清理. 用户需要手动删除. 这是可接受的, 因为这些文件不会影响工具的正常运行.

**[~/.skills-manager/ 中的 commands/ 目录]** → 通过保留 update.ts 中的跳过逻辑来缓解. 用户下次 `update` 时不会报错. 不主动删除这些目录, 避免意外数据丢失.

**[Breaking change]** → 所有变更都是移除性的, 不会影响现有 skill 功能. 作为 CLI 工具, 用户只需升级版本即可.
