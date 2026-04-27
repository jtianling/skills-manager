# skill-companions Specification

## Purpose

声明跟随 skill 部署到 skill 目录之外的单文件 (companion). 典型场景: 给 Claude Code skill 配套的 subagent 文件, 必须落到 .claude/agents/ (运行时约定), 不能放进 .claude/skills/<skill>/agents/. companion 与 skill 生命周期严格绑定 — 部署时按 agent 选择分发, 卸载时按 deployments-registry 反向清理, 部署阶段做路径冲突预检.

## Requirements

### Requirement: skill.json companions 字段 schema

`SkillManifest` SHALL 支持可选字段 `companions: Companion[]`, 每个 Companion 描述一个必须部署到 skill 目录之外的文件.

`Companion` 结构:

| 字段 | 类型 | 说明 |
|------|------|------|
| source | string | 相对 skill 根目录的源文件路径, MUST 是单文件 (非目录), MUST 落在 skill 边界内 |
| agentTargets | `Record<agent, targetPath>` | 每个 agent 对应的目标路径 (相对项目根) |

约束:
- `source` 路径不写或显式为空 SHALL 使 manifest 校验失败
- `source` MUST NOT 包含 `..` 片段, 解析后 MUST 落在 skill 目录内
- `agentTargets` 的 keys MUST 是 `SUPPORTED_TOOLS` 内的 agent 名 (与 `targetAgents` 同样校验)
- `agentTargets` 的 values (目标路径) MUST NOT 包含 `..` 片段, MUST 是相对路径, 解析后 MUST 落在项目根目录内
- `agentTargets` 不能为空对象 — 至少声明一个 agent 的目标路径

#### Scenario: skill.json 不写 companions

- **WHEN** skill.json 没有 `companions` 字段
- **THEN** `validateManifest` SHALL 通过校验, skill 部署时无 companion 分发, 行为与现状一致

#### Scenario: 合法的 companions 声明

- **WHEN** skill.json 含
  ```json
  {
    "companions": [
      {
        "source": "agents/jt-codex-runner.md",
        "agentTargets": { "claude-code": ".claude/agents/jt-codex-runner.md" }
      }
    ]
  }
  ```
- **THEN** `validateManifest` SHALL 通过校验

#### Scenario: source 路径包含 ..

- **WHEN** companion `source: "../etc/passwd"` 或 `source: "agents/../../etc"`
- **THEN** `validateManifest` SHALL 返回错误, 错误信息 MUST 指明 `source` 路径不允许 `..` 片段

#### Scenario: agentTargets 路径包含 ..

- **WHEN** companion `agentTargets: { "claude-code": "../../outside/file.md" }`
- **THEN** `validateManifest` SHALL 返回错误, 错误信息 MUST 指明目标路径必须落在项目根目录内

#### Scenario: agentTargets 为空对象

- **WHEN** companion `agentTargets: {}`
- **THEN** `validateManifest` SHALL 返回错误, 错误信息 MUST 指明 `agentTargets` 至少需要一个 agent 条目

#### Scenario: agentTargets 包含未知 agent

- **WHEN** companion `agentTargets: { "unknown-tool": "..." }`
- **THEN** `validateManifest` SHALL 返回错误, 错误信息 MUST 指明该 agent 名未被识别

### Requirement: agentTargets keys 是 targetAgents 子集

当 skill.json 同时声明 `targetAgents` 与 `companions` 时, 对每个 companion, 其 `agentTargets` 的 keys 集合 MUST 是 `skill.targetAgents` 的子集.  当 `skill.targetAgents` 为空 / 未声明 (即"全集") 时, 此约束自动满足.

理由: 防止 companion 声明了"在某 agent 选中时部署到这里", 但 skill 本身已声明"我不适用这个 agent" 的逻辑矛盾.

#### Scenario: agentTargets 是 targetAgents 子集

- **WHEN** skill.json `targetAgents: ["claude-code"]`, companion `agentTargets: { "claude-code": ".claude/agents/x.md" }`
- **THEN** `validateManifest` SHALL 通过校验

#### Scenario: targetAgents 为空时无子集约束

- **WHEN** skill.json 未声明 `targetAgents`, companion `agentTargets: { "claude-code": ".claude/agents/x.md" }`
- **THEN** `validateManifest` SHALL 通过校验 (targetAgents 视为全集)

#### Scenario: agentTargets 含 targetAgents 之外的 agent

- **WHEN** skill.json `targetAgents: ["claude-code"]`, companion `agentTargets: { "claude-code": "...", "codex": ".codex/agents/x.md" }` (codex 不在 targetAgents 中)
- **THEN** `validateManifest` SHALL 返回错误, 错误信息 MUST 列出违规的 agent (`codex`) 与当前 `targetAgents`

### Requirement: 部署 skill 时分发 companions

`Deployer.deploySkill(skill, mode)` SHALL 在部署 skill 主体后, 遍历 manifest 中的 companions:

对每个 companion:
1. 取出当前已选 agent 集合与 `companion.agentTargets` 的 keys 求交集
2. 对交集中的每个 agent, 解析目标绝对路径 = `projectDir + agentTargets[agent]`
3. 按 `mode` (link 或 copy) 将 `skillPath + companion.source` 部署到目标绝对路径
4. 确保目标路径的父目录存在 (`ensureDir`)
5. 将实际写入的目标绝对路径加入 deployments-registry 的 `deployedCompanions` 列表

如果 skill 没有 companions 字段或交集为空, 跳过该步骤, 行为退化为现有部署逻辑.

#### Scenario: jt-codex 部署到选中 claude-code 的项目

- **WHEN** 用户在选择了 `claude-code` 的项目运行 `skillsmgr add jt-codex`, jt-codex skill.json 声明 `companions: [{ source: "agents/jt-codex-runner.md", agentTargets: { "claude-code": ".claude/agents/jt-codex-runner.md" } }]`, 部署模式为 link
- **THEN** 系统 SHALL 在 `<projectDir>/.claude/agents/jt-codex-runner.md` 创建 symlink 指向 `~/.skills-manager/custom/jt-codex/agents/jt-codex-runner.md`
- **AND** deployments-registry 中 jt-codex 的 `deployedCompanions` SHALL 包含该绝对路径

#### Scenario: copy 模式部署 companion

- **WHEN** 部署模式为 copy, jt-codex 部署到 claude-code 项目
- **THEN** 系统 SHALL 将 companion 源文件 copy (不是 link) 到目标路径

#### Scenario: 没有 agent 与 companion agentTargets 匹配, companion 跳过

- **WHEN** 项目只选了 codex, react-patterns skill 的 companion 仅声明 `agentTargets: { "claude-code": ".claude/agents/helper.md" }`
- **THEN** skill 主体 SHALL 部署到 `.agents/skills/react-patterns/`, 但 companion SHALL NOT 被部署
- **AND** deployments-registry 中 react-patterns 的 `deployedCompanions` 应为空数组

#### Scenario: 目标路径父目录不存在

- **WHEN** 部署 companion 时目标路径的父目录 (例 `.claude/agents/`) 不存在
- **THEN** 系统 SHALL 自动创建父目录 (递归), 然后写入 companion

### Requirement: deployments-registry 记录 deployedCompanions

`deployments-registry` 的每条 skill 部署记录 SHALL 包含 `deployedCompanions: string[]` 字段, 列出该 skill 在该 project 部署时实际写入的所有 companion 绝对路径.

字段语义:
- 路径 MUST 是绝对路径
- 数组元素顺序按部署写入顺序
- 旧记录 (无该字段) 视为 `deployedCompanions: []`, 读取时不报错 (lenient parsing)
- 重新部署 (例如 `deploy --refresh`) SHALL 先清空旧 `deployedCompanions`, 再按新部署写入填充

#### Scenario: 旧 registry 记录无 deployedCompanions 字段

- **WHEN** registry 中已存在的 skill 记录是旧版本 (无 `deployedCompanions` 字段)
- **THEN** 读取 SHALL 不抛错, 视为空数组

#### Scenario: 重新部署清空旧 companion 记录

- **WHEN** skill A 已部署 (registry 中 deployedCompanions 含 path-1, path-2), 用户运行 deploy --refresh, 新版本 skill A 的 companion 只产生 path-1
- **THEN** registry 中 skill A 的 `deployedCompanions` SHALL 为 `[path-1]`, path-2 SHALL 已从文件系统中删除 (反向清理)

### Requirement: 卸载 / remove 时反向清理 companions

`uninstall`, `remove`, `group remove` 等所有反向命令 SHALL 在删除 skill 部署 (即删除 `.agents/skills/<skill>/`) 之前或之后, 遍历 deployments-registry 中该 skill 的 `deployedCompanions`, 删除每个文件.

清理规则:
- 删除 SHALL 是 idempotent: 文件不存在不报错 (用户可能手动删除过)
- 仅删除文件本身, 不递归删除其父目录 (避免误删用户其它内容)
- 若 companion 是 symlink, SHALL 用 `unlinkSync` 删除 symlink 而非 follow 删除目标文件
- 删除完成后, registry 中该 skill 的 `deployedCompanions` SHALL 被清空 (随同 skill 记录的整体清理)
- 若 companion 路径已被另一个 skill 占用 (registry 中其它 skill 的 deployedCompanions 含同一路径), SHALL 跳过删除并记录警告 (理论上冲突检测已防止此场景, 防御性兜底)

#### Scenario: uninstall jt-codex 清理其 companion

- **WHEN** 用户运行 `skillsmgr uninstall jt-codex`, 当前 project 部署了 jt-codex 且 registry 中其 `deployedCompanions` 含 `.claude/agents/jt-codex-runner.md` 绝对路径
- **THEN** 系统 SHALL 删除 `.claude/agents/jt-codex-runner.md` (无论 symlink 还是真文件)
- **AND** SHALL 删除 `.agents/skills/jt-codex/`
- **AND** registry 中不再有 jt-codex 的记录

#### Scenario: companion 文件已被用户手动删除

- **WHEN** uninstall 流程发现 registry 列出的 companion 路径在文件系统中不存在
- **THEN** 系统 SHALL 跳过该路径不报错, 继续清理其余项

#### Scenario: companion 是 symlink, 删除时不 follow

- **WHEN** uninstall 流程检测到 companion 路径是 symlink
- **THEN** 系统 SHALL 用 `unlinkSync` 删除 symlink, 不修改 symlink 指向的真文件

#### Scenario: remove 命令同样反向清理 companion

- **WHEN** 用户运行 `skillsmgr remove jt-codex` (从 project 取消部署但保留 ~/.skills-manager 中的 skill)
- **THEN** 系统 SHALL 按上述规则清理 companion, 与 uninstall 行为一致 (skill 主体 link 也被删除)

### Requirement: 部署阶段冲突检测

`Deployer.deploySkill()` 在写入任何 companion 之前 SHALL 预检本次部署所有 companion 目标路径与 deployments-registry 中已部署的 companion 路径是否冲突 (规范化后绝对路径相同).

冲突处理:
- 若发现冲突, deployer SHALL 抛错并指明冲突双方 (本次部署的 skill 与已占用 skill 的名字, 以及冲突路径)
- 抛错前 SHALL NOT 写入任何本次的 companion 文件 (事务式预检)
- 若多个 companion 同 skill 内自相冲突 (例两个 companion 写同一目标), SHALL 同样抛错

预检使用规范化路径比较 (`path.resolve` + 去尾随分隔符), 防止 `./a/b` 与 `a/b/` 等价但字面不同导致漏检.

#### Scenario: 两个 skill 的 companion 目标路径冲突

- **WHEN** skill A 已部署且 registry 中其 `deployedCompanions` 含 `.claude/agents/runner.md` 绝对路径; 用户尝试部署 skill B, 其 manifest 声明 companion 也写入 `.claude/agents/runner.md`
- **THEN** `Deployer.deploySkill(B)` SHALL 抛错, 错误信息 MUST 包含 skill A 名称、skill B 名称、冲突路径
- **AND** 文件系统中 `.claude/agents/runner.md` SHALL 仍指向 skill A 的 companion (未被覆盖)
- **AND** registry 中 skill B SHALL NOT 有部署记录

#### Scenario: 同 skill 内 companion 自相冲突

- **WHEN** skill X 的 manifest 含两个 companion, 都解析到同一目标路径
- **THEN** `Deployer.deploySkill(X)` SHALL 抛错, 错误信息 MUST 指明 skill 内部声明冲突
- **AND** 文件系统不被修改, registry 不被修改

#### Scenario: 部署中途意外失败的回滚

- **WHEN** 预检通过后, deployer 写入第一个 companion 成功, 写入第二个 companion 时遭遇磁盘错误
- **THEN** 系统 SHALL 撤销已写入的第一个 companion, 抛错给上层
- **AND** registry 中本次部署的所有变更 SHALL 被回滚 (skill 主体 link 也撤销)
