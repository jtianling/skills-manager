## Why

skill 目录是 skillsmgr 当前的部署单元: `Deployer` 把 `skill.path` 整个 link/copy 到 `.agents/skills/<name>/`, bridge symlink 把每个 agent 工具的目录 (如 `.claude/skills`) 指向它.  这个边界让部署、卸载、回滚都简单, 但也意味着 **skill 没法声明"有些文件必须落到 skill 目录之外的特定位置"**.

具体场景: jt-codex 这种 skill 配套一个 Claude Code subagent 文件 (`.claude/agents/jt-codex-runner.md`), 运行时约定要求这个 subagent 必须在仓库的 `.claude/agents/` 下, **不能**在 `.claude/skills/jt-codex/agents/` 下 — Claude Code 不会扫 skills 目录里的 agent 文件.  当前 skillsmgr 部署 jt-codex 到目标项目时, 只有 skill 主体被 link 过去, runner 文件不会被分发, 用户那边 Agent tool 就找不到 jt-codex-runner subagent.

这不是 jt-codex 一个 skill 的问题: 任何带配套 subagent 的 skill (尤其 orchestrator 类) 都会撞到同样的坑.

同时, 这类 skill 往往**只对特定 agent 有意义** (jt-codex 整个就是 "在 Claude Code 里调 Codex CLI", 在纯 codex / cursor 项目里没意义).  当前 skillsmgr `add` / `deploy` 候选列表不区分 agent 适用性, 所有 skill 在所有 agent 项目里都是候选 — 用户在 codex 项目里看到 jt-codex 是噪音.

## What Changes

- skill.json 新增 `targetAgents?: string[]` 字段, 声明 skill 适用哪些 agent (不写 = 所有 agent)
- skill.json 新增 `companions?: Companion[]` 字段, 每条声明:
  - `source: string` — skill 目录内的相对路径
  - `agentTargets: Record<agentName, targetPath>` — 哪些 agent 选中时分发到哪个目标路径 (项目相对)
- manifest validation 新增规则: `companion.agentTargets` 的 keys MUST 是 `skill.targetAgents` 的子集 (当 `targetAgents` 设置时)
- `add` / `deploy` 候选列表按 targetAgents 过滤: `skill.targetAgents ∩ selected_agents !== ∅` (空集 = 不过滤)
- Deployer 部署 skill 时, 按当前选中 agent 集合分发 companions 到目标路径 (link 或 copy, 与 skill 主体一致)
- `deployments-registry` 新增 `deployedCompanions: string[]` 字段, 记录每个 skill 实际部署的 companion 绝对路径
- Uninstall / remove 时, 按 registry 反向清理 companion 路径 (不能依赖部署时重读 manifest, 因 manifest 可能已变)
- Deploy 阶段冲突检测: 如果两个 skill 的 companion 目标路径相同 (规范化后), 报错并中止部署
- 命令对称性: `install` / `uninstall`, `add` / `remove`, `group add` / `group remove` 都按上述规则同步更新 (正向部署 companion → 反向清理 companion)

不在本次范围:
- `companion` 不区分硬依赖 / 软依赖 (enhancements) — 用 skill 级 `targetAgents` 表达适用性, companion 永远是 "选中即部署" 的声明式映射
- 不引入 `extras` / `postDeploy` 等脱离 skill 概念的 deploy.json 级字段

## Capabilities

### New Capabilities

- `skill-target-agents`: skill 级 agent 适用性声明 + `add` / `deploy` 候选过滤
- `skill-companions`: skill 目录外 companion 文件的声明、分发、生命周期跟踪与冲突检测

### Modified Capabilities

无.  所有新行为都封装在两个新能力中: `skill-target-agents` 自洽包含 schema / 校验 / 候选过滤; `skill-companions` 自洽包含 schema / 校验 / 部署 / 生命周期 / 冲突.  现有 `skill-lifecycle`, `smart-add`, `uninstall` 的既有 requirements 不需要重写, 只是被新能力的 requirements 在运行时 *叠加*.

## Impact

- **Code**:
  - `src/types.ts`: 扩展 `SkillManifest`, 新增 `Companion` 类型
  - `src/services/manifest.ts`: validation 加子集约束, schema 校验 `agentTargets` 路径合法性
  - `src/services/deployer.ts`: 新增 companion dispatch 路径 (单文件 link/copy), 新增冲突检测
  - `src/services/deployments-registry.ts`: 记录 schema 增加 `deployedCompanions`, 反向清理逻辑
  - `src/commands/add.ts` / `deploy.ts`: 候选过滤按 `targetAgents`
  - `src/commands/uninstall.ts` / `remove.ts` / `group*.ts`: 反向清理 companion
- **Files / Conventions**:
  - skill 作者侧: skill.json 新增可选字段, 旧 skill 不写则行为不变 (向后兼容)
  - 源仓库 dual-location 通过 symlink 解决: 真文件在 skill 内 `agents/<name>.md`, 仓库 root `.claude/agents/<name>.md` 是 symlink → skill 内文件 (skills-creator 侧改造)
- **e2e**: 新增 companion 部署 + 卸载 + 冲突检测的 e2e 场景, jt-codex 作为第一个 fixture
- **向后兼容**: 旧 skill 不写 `targetAgents` / `companions` 完全不受影响; skillsmgr-deploy.json 格式不变
