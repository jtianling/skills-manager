## Why

`skillsmgr add <skill> -a <agent>` 在 skill 已部署时会裸早退打印 `already deployed`, 在解析 agent 与建 bridge 之前就 `return`, 导致"先只选了部分 agent, 之后想补 claude-code 支持"这一常见操作无法完成 —— `-a` 被完全忽略, `.claude/skills` bridge 永远建不出来.  与此同时 `remove` 的 project 模式 `-a` 从未实现 (仅 `--global` 用到), 且现有 spec 对它的表述与实际部署模型 (项目级目录 bridge) 相矛盾.  二者共同破坏了项目硬规则要求的"命令对称性".

## What Changes

- **add 补 agent**: skill 已部署时不再裸早退.  有 `-a` 时为指定 agent 补建项目级 bridge 并补写该 agent 的 companions; 无 `-a` 时进入 agent 交互选择界面 (已部署 skill 保持锁定语义, 只能新增 agent, 不能取消).  覆盖 `handleSkillName` 与 `handleRepoSkillSelection` 两条遗漏的早退路径, 与 `handleRemoteInstallAndDeploy` 已有的正确行为 (早退前 `ensureSymlinkBridges`) 对齐.
- **remove 对称**: project 模式下 `-a` 生效, 语义为撤除指定 agent 的项目级 bridge (并按记录清理该 agent 的 companions), 与 add 的 bridge 语义对称.  修正 `skill-agent-flags` 中"仅从 claude-code 移除 my-skill"这一在目录级 bridge 模型下**不可实现**的表述; 撤除 bridge 会使该 agent 失去经由该 bridge 对**全部** skill 的访问, 因此打印明确警告.
- **不改部署模型**: 仍是项目级目录 bridge (`.claude/skills → .agents/skills`), 与具体 skill 正交.  复用现有 `ensureSymlinkBridges` / `resolveTargetAgents` / `Deployer` (含已有的撤 bridge 与 companion 清理逻辑), 最小变更.

## Capabilities

### New Capabilities
<!-- 无新增 capability, 均为现有契约的修正 -->

### Modified Capabilities
- `skill-agent-flags`: 明确 `add -a` 在 skill 已部署时补 agent bridge 的语义; 修正 `remove -a` 在 project 模式的语义为"撤除项目级 agent bridge", 取代原先不可实现的 per-skill-per-agent 表述.
- `smart-add`: skill-name 流程与 repo 选择流程在目标 skill 已部署时不再裸早退, 转而进入 agent 补全 (有 `-a` 直接补, 无 `-a` 进交互).

## Impact

- `src/commands/add.ts`: `handleSkillName` / `handleRepoSkillSelection` 的 already-deployed 早退分支改为先解析 agent 并 `ensureSymlinkBridges` (+ 补 companions).
- `src/commands/remove.ts`: project 模式让 `-a` 生效, `removeSkillNames` 引入 agents 维度, 调用 deployer 撤 bridge.
- `src/services/deployer.ts`: 复用既有的撤 bridge / companion 清理方法, 按 agent 暴露所需入口.
- 测试: `src/commands/add.test.ts`, `src/commands/remove.test.ts` (TDD, 断言无副作用).
