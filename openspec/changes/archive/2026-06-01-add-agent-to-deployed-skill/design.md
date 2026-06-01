## Context

部署模型 (关键背景):

- `.agents/skills/` 是所有 skill 的唯一真相源.
- 非 native agent (claude-code 等) 经由**项目级目录 bridge** 访问: `.claude/skills → .agents/skills` (单条目录级 symlink, 见 `symlink-bridge` spec).  一旦该 bridge 存在, 该 agent 即可见 `.agents/skills/` 下**全部** skill.  bridge 与具体 skill 正交.
- copy 模式只影响 skill 内容如何进入 `.agents/skills/` (复制而非软链), **不影响** bridge —— bridge 在 link / copy 两种模式下都是同一条目录级 symlink, 由 `ensureSymlinkBridges` / `createSymlinkBridge` 统一创建.
- companions 是按 agent 落到 skill 目录之外的单文件: `deploySkill(skill, mode, selectedAgents)` 用 `selectedAgents` 决定写哪些 companion (`companion.agentTargets ∩ selectedAgents`); 写入路径记录在 `deployments.json`, 反向按记录清理.

当前缺陷:

- `add.ts` 的 `handleSkillName` (已部署判定后裸 `return`) 与 `handleRepoSkillSelection` (allDeployed / newSkills===0 分支裸 `return`) 在补 bridge 之前早退, 故对已部署 skill 无法补 agent.  `handleRemoteInstallAndDeploy` 的对应分支**已**在早退前调用 `ensureSymlinkBridges(selectedAgents)`, 是正确范例.
- `remove.ts` project 模式 (`removeSkillNames`) 只调 `deployer.removeSkill(name)` 删 `.agents/skills/<skill>` (对所有 agent 生效), 完全忽略 `-a`; `-a` 仅在 `--global` 分支被 `resolveTargetAgents` 消费.

## Goals / Non-Goals

**Goals:**
- add 对已部署 skill 可补 agent: 有 `-a` 补指定 agent 的 bridge (+ 该 agent 的 companions); 无 `-a` 进入 agent 交互选择.
- remove 在 project 模式让 `-a` 生效, 语义与 add 对称.
- 修正 `skill-agent-flags` 中与目录级 bridge 模型矛盾的 remove `-a` 表述.
- 三条 add 早退路径行为一致 (都走 `ensureSymlinkBridges`).

**Non-Goals:**
- 不改部署模型: 不引入 per-skill-per-agent 的项目级软链 (那会推翻目录级 bridge 架构).
- 不动 `--global` 模式 (它本就是 per-skill-per-agent, 已正确).
- 不改 install / uninstall (它们不涉及 agent 部署).

## Decisions

### 决策 1: `-a` 的统一语义 —— 维度区分而非 per-skill-per-agent

把 add/remove 的行为按"是否带 `-a`"切成两个正交维度, 形成干净对称:

| | 无 `-a` (skill 内容维度) | 有 `-a` (agent bridge 维度) |
|---|---|---|
| **add** | 把 skill 放入 `.agents/skills/` (+ 交互选 agent 建 bridge) | 确保指定 agent 的 bridge 存在 (+ 该 agent 的 companions) |
| **remove** | 从 `.agents/skills/` 删 skill (对所有 agent 生效) | 撤除指定 agent 的项目级 bridge (+ 该 agent 该 skill 的 companions) |

这样 "无 `-a` 操作 skill 内容, 有 `-a` 操作 agent bridge" 在两侧严格对称.  `add <skill> -a X` / `remove <skill> -a X` 中的 `<skill>` 对 bridge 操作而言是"挂名"参数 (bridge 是项目级), 仅用于 scope companions.

**Alternative (rejected)**: 让 remove `-a` 真正做到"仅从某 agent 移除某一个 skill".  目录级 bridge 模型下不可实现 —— 撤 bridge 会让该 agent 失去全部 skill, 保留 bridge 又无法对单 skill 隐藏.  唯一能做到 per-skill-per-agent 的是 companions, 不足以表达"移除 skill 本体".  故放弃, 并修正现有 spec 中该不可实现的表述.

### 决策 2: add 已部署补 agent 复用 `deploySkill` + `ensureSymlinkBridges`

已部署 skill 补 agent 时:
1. `ensureSymlinkBridges(selectedAgents, deployer)` 建缺失的 bridge (幂等, 已存在则跳过).
2. 若 skill 声明了 companions, 重新 `deploySkill(skill, mode, selectedAgents)` 以补写所选 agent 的 companions (re-link 幂等; companion 写入对同一 skill 重入安全).

不新造机制, 全部复用现有方法.  三条早退路径统一改为"早退前先解析 agent 并补 bridge", 与 `handleRemoteInstallAndDeploy` 看齐.

### 决策 3: 无 `-a` 进入 agent 交互, 已配置 agent 锁定 (add-only)

`add <已部署 skill>` 无 `-a` 时进入 agent 选择交互.  沿用 add 命令"已部署项锁定、只增不减"的硬规则, 但下沉到 agent 粒度: 已有 bridge 的 agent 标记为 locked + checked, 用户只能勾选新增 agent, 取消选中无效.  交互结果交给决策 2 的补 agent 流程.

### 决策 4: remove 撤 bridge 打印警告

`remove <skill> -a X` 撤除 X 的 bridge 前打印警告, 说明 X 将失去经该 bridge 对**全部** skill 的访问 (因为 bridge 是项目级).  复用 `deployer` 既有的撤 bridge 逻辑 (`existsSync && isSymlink → unlinkSync`) 与 companion 反向清理.  指定的 agent 无 bridge 时为 no-op 并提示.

## Risks / Trade-offs

- [remove `-a` 撤 bridge 的爆炸半径超出"单 skill"直觉] → 决策 4 的显式警告 + 文档/spec 明确语义; `<skill>` 对 bridge 为挂名参数这一点在 spec scenario 中讲清.
- [重入 `deploySkill` 补 companions 可能触发 companion 冲突预检] → 对同一 skill 重写自身 companions 不构成跨 skill 冲突; 测试覆盖"已部署 skill 带 companions 补 agent"场景.
- [修改现有 `skill-agent-flags` 的 remove `-a` 表述属于行为契约变更] → 通过 MODIFIED delta 显式记录, 原 scenario 本就未实现 (project 模式忽略 `-a`), 不存在已依赖该行为的真实用户路径.
- [无副作用要求] → 测试断言: 补一个 agent 后其余 agent bridge 与已部署 skill 不受影响; 撤一个 agent 后其余 agent 与 `.agents/skills/` 内容仍在.

## Open Questions

- 无 (两处设计岔路已由用户拍板: 无 `-a` 进交互; remove 与 add 对称).
