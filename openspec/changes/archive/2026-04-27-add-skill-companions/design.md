## Context

skillsmgr 当前部署模型: `Deployer.deploySkill()` 将 `skill.path`(skill 目录) 整个 link 或 copy 到 `.agents/skills/<name>/`, agent 工具的 native 目录 (如 `.claude/skills/`) 通过 symlink bridge 指向 `.agents/skills/`.  严格按 "skill 目录 = 部署单元" 边界, 部署 / 卸载 / 回滚都简单到一个目录 rmSync 即可.

`SkillManifest` (skill.json) 现在仅含 name / version / description / dependencies, 由 `src/services/manifest.ts` 校验.  `DeploymentManifest` (skillsmgr-deploy.json) 仅含 pinnedSkills / followGroups / mode.

新需求触发于 jt-codex skill: 它需要部署一个 Claude Code subagent 文件 (`.claude/agents/jt-codex-runner.md`), Claude Code 运行时约定要求 subagent 在仓库 `.claude/agents/` 下, 不能在 `.claude/skills/<skill>/agents/` 下 — 即必须落到 skill 边界**之外**.  且 jt-codex 整个 skill 只对 Claude Code 有意义.

**约束**:
- 不能破坏现有 skill (无 targetAgents / companions 字段) 的部署行为 — 向后兼容
- 部署后 skillsmgr 仍要能精确反向清理 (项目硬规则: install 一个不能多, remove 一个不能少)
- 不引入"硬依赖 / 软依赖"二分概念 (设计阶段已 push back, 用 skill 级 targetAgents 直接表达适用性)
- 源仓库 dual-location 通过 symlink 解决 (skills-creator 侧已确认改造)

## Goals / Non-Goals

**Goals**:
- 让 skill 能携带"必须部署到 skill 目录之外"的配套文件 (subagent / 配置 / 钩子等), 跟随 skill 生命周期严格绑定
- 让 skill 能声明自己只适用某些 agent 工具, 在不适用的项目里从候选列表中隐藏
- 部署阶段检测 companion 目标路径冲突, 防止两个 skill 静默互覆
- 卸载 / remove 时反向清理 companion, 不留孤儿文件

**Non-Goals**:
- 不引入 "extras" / "postDeploy" 等脱离 skill 概念的、由用户在 skillsmgr-deploy.json 维护的字段 (会失去 lifecycle 绑定)
- 不区分 companion 硬依赖 / 软依赖 — 用 skill 级 `targetAgents` 表达适用性
- 不在 v1 支持 companion 的 templating / 变量替换 (固定路径声明即可)
- 不修改现有 SkillInfo / SKILL.md frontmatter 格式 (新字段都在 skill.json 里, 已是独立 manifest)
- 不引入 agent-aware "部署模式" 切换 (link/copy 仍跟随 skill 主体, companion 用同一模式)

## Decisions

### 1. targetAgents 挂在 skill 级, 不从 companion 反推

**决策**: skill.json 顶层加 `targetAgents?: string[]` 字段.  空 / 不写 = 全集.  candidate 过滤规则: `(skill.targetAgents 为空) || (skill.targetAgents ∩ selected_agents !== ∅)`.

**理由**:
- skill 适用性是 skill 本身的属性, 不是 companion 的衍生属性
- 支持 Case B (主体通用 + 仅某 agent 的增强 companion): 主体通用就 `targetAgents` 不写, companion 在 `agentTargets` 里只列那个 agent → 部署到其它 agent 时主体走、companion 跳, 行为正确
- 不需要 v2 引入 enhancements 字段 — companion 永远是 "选中即部署" 的声明式映射

**Alternative**: 从 companion 的 agentTargets 反推 skill 适用性 (skills-creator 初版方案).
**Rejected**: 无法表达"无 companion 但仅某 agent 适用"的纯内容 skill; "硬/软"二分需要额外 schema 字段.

### 2. companion 路径放在 skill 目录内, source 用相对路径

**决策**: `Companion.source` 是相对 skill 根目录的路径, 真实文件必须落在 skill 边界内 (例: `agents/jt-codex-runner.md`).  `agentTargets[agent]` 是相对项目根的目标路径.

**理由**:
- 保持 "skill 目录 = 部署单元" 边界: install/uninstall/publish/registry 全部按目录边界处理, companion 文件随 skill 一同被 git tracked / packed
- 源仓库 dual-location 矛盾用 symlink 解决: 真文件在 `skills/<skill>/agents/<n>.md`, 仓库 root `.claude/agents/<n>.md` 是 symlink → 真文件.  本地 dev 时 Claude Code 通过 symlink 找得到; skillsmgr 部署时按 manifest 直接 link/copy 真文件到目标 `.claude/agents/`

**Alternative**: 真文件在仓库根 `.claude/agents/`, manifest source 用仓库根相对路径.
**Rejected**: 破坏 "skill 目录 = 部署单元" 边界, publish/install 流程都要为 companion 特殊处理仓库根, 复杂度爆炸.

### 3. companion 部署模式跟随 skill 主体的 link/copy 模式

**决策**: companion 的 link/copy 与 `Deployer.deploySkill(mode)` 的 mode 保持一致.

**理由**:
- 模式切换 (link → copy 或反之) 已经是 skill 全量重新部署的语义, companion 跟随同一语义
- 减少 manifest 字段 — companion 不需要单独的 mode 字段
- link 模式下 companion 在源仓库改了立刻在所有 deployed project 生效, 与 skill 主体行为一致

### 4. 实际部署路径由 deployments-registry 持久化记录

**决策**: `deployments-registry` 的 schema 增加 `deployedCompanions: string[]` (绝对路径数组).  `Deployer.deploySkill()` 每写一个 companion, 同步追加到该 skill 的记录; `removeSkill()` 反向遍历记录删除.

**理由**:
- "无副作用纪律" 要求精确清理, 不能依赖卸载时重读 skill 的 manifest (manifest 在 install / update 间可能已变, 比如 skill 升级新增/删除了 companion 条目, 下次 update 把旧 companion 留作孤儿)
- 持久化 deploy-time 实际写入路径, 是唯一能保证"部署一个不多, 卸载一个不少"的真相源
- registry 已经存在, 加字段是最小变更

**Alternative**: 卸载时重新解析 manifest 算 companion 路径再删.
**Rejected**: skill 升级 / 重新部署后 manifest 可能变, 实际部署的 companion 跟当前 manifest 不一致, 算出的路径有偏差.

### 5. 冲突检测在 deploy 阶段做, 不在 install / publish 阶段

**决策**: `Deployer.deploySkill()` 在写入 companion 前, 检查目标绝对路径是否已被其它 skill 通过 registry 占用.  若占用, 抛错并回滚本次部署 (本 skill 已部署的 companion 全部撤销).

**理由**:
- install / publish 阶段无法预知"项目里会同时部署哪些 skill", 检查不全
- deploy 阶段的 registry 是当前项目实际部署状态的真相源, 检查最准确
- 报错 + 回滚而非覆盖, 避免静默互覆 (用户明确知道两个 skill 冲突, 选其一)

**Alternative**: 后部署的覆盖先部署的.
**Rejected**: 静默 overwrite 违反 "remove 一个不能少" 原则 (后续 uninstall 会删掉同路径文件, 覆盖前的 skill 仍以为自己有 companion).

### 6. 路径安全校验

**决策**: `Companion.source` 与 `Companion.agentTargets[agent]` 都校验:
- 不允许 `..` 片段 (防 path traversal)
- `source` 必须解析后落在 skill 目录内
- `agentTargets[agent]` 必须解析后落在项目目录内
- `agentTargets[agent]` 的 `agent` key 必须是 `SUPPORTED_TOOLS` 之一

**理由**: 与 plugin-manifest 的路径安全要求保持一致, 防止 skill 作者 (或恶意 publish) 写入项目外路径.

### 7. 候选过滤粒度: agent 集合, 不是单 agent

**决策**: 过滤判定基于"当前部署/添加流程已选 agent 集合"与 `skill.targetAgents` 的交集.  `add` 命令的 agent 选择阶段 (interactive / `-a` flag) 完成后, 再根据已选集合过滤 skill 候选列表.

**理由**:
- skillsmgr 单次 `add` / `deploy` 可同时面向多个 agent, 单 agent 判定不够
- 交集语义清晰: 只要有一个已选 agent 适用该 skill, 该 skill 就该出现
- agent 选择必须在 skill 选择之前 (现有交互流程已是这个顺序, 见 `interactive-flow-order` capability)

## Risks / Trade-offs

- **[Risk] 现有 skill 作者迁移成本**: 已发布的 skill 不写 `targetAgents` / `companions` 行为不变, 但作者要发布 companion 时需要同时改 source repo (加 symlink)、skill.json (加字段)、了解新约束.
  → **Mitigation**: skills-creator 已确认会按 frozen draft 改造 jt-codex 当 first fixture, 后续 skill 可参考.  README / docs 同步更新.

- **[Risk] uninstall 路径列表与文件系统不一致**: 如果用户手动删除了 companion 文件, registry 里仍有记录, uninstall 试图 rm 不存在的文件.
  → **Mitigation**: 反向清理使用 idempotent 删除 (与 `removeSkill` 现有 `pathOrLinkExists` 检查一致), 文件不存在跳过.

- **[Risk] 同一 skill 在 link 与 copy 模式之间切换时 companion 状态**: 切换模式现已是全量重新部署, companion 跟随重新部署, 不引入新风险.

- **[Risk] companion 路径冲突回滚不彻底**: 部署 skill A, 中途发现 companion 与 skill B 冲突, 已写入的 A.companion[0] 必须撤销.
  → **Mitigation**: deploy companion 必须事务式 — 先全部预检冲突 (read-only), 全无冲突再开始写入; 写入过程意外失败时, 已写入的逐个撤销 (现有 `rollback.ts` 提供 hooks).

- **[Trade-off] 不支持 companion 模板化**: 用户没法在 companion 里引用 skill 名 / agent 名做替换.  v1 选择简单声明式映射, 复杂场景留 v2.

- **[Trade-off] 命令对称性扩展面**: install/uninstall, add/remove, group add/group remove 全部都要跟着改 — 工作量集中在 deployer + registry, 命令层调用收口 OK, 但每个命令的 e2e 都要补对应 case.

## Migration Plan

无破坏性变更, 旧 skill 全量兼容.  新字段为可选, validate 阶段不写就跳过.

部署侧策略:
1. 先合并 manifest schema + validation (低风险, 不改运行时行为)
2. 再合并 deployer companion 分发 + registry 字段 (新行为, 仅在 manifest 写了 companions 时生效)
3. 再合并 candidate 过滤 (新行为, 仅在 manifest 写了 targetAgents 时生效)
4. 最后命令对称性 + e2e 覆盖

回滚策略: 每步 PR 独立可 revert.  registry schema 加字段是 additive, 旧版本读到带 `deployedCompanions` 的 record 应忽略未知字段 (检查现有代码已是 lenient parsing).

## Open Questions

无.  设计阶段所有歧义已通过与 skills-creator 的邮件往返收敛 (targetAgents 抽象点、dual-location symlink 方案、companion v1 不分硬软依赖、不做短期文档 unblock).
