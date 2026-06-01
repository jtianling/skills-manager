## ADDED Requirements

### Requirement: add 为已部署 skill 补 agent

当目标 skill 已部署 (其目录已存在于 `.agents/skills/`) 时, `add` 命令 SHALL NOT 裸早退打印 `already deployed` 后直接返回, 而是为选定的 agent 补建项目级 bridge.  补 agent 行为对所有进入 add 的路径 (skill-name 流程、repo 选择流程、远程安装流程) 一致.

- 有 `-a` 时: 为指定 agent 确保项目级 bridge 存在 (幂等, 已存在则跳过); 若该 skill 声明了 companions, 补写这些 agent 对应的 companions.
- 已部署 skill 的 bridge 补建 SHALL 与部署模式 (link / copy) 无关 —— bridge 始终是 `<agentDir>/skills → .agents/skills` 的目录级 symlink.

#### Scenario: 为已部署 skill 补一个 agent

- **WHEN** skill `code-review` 已部署 (仅建了 codex 的 bridge), 用户执行 `skillsmgr add code-review -a claude-code`
- **THEN** 创建 `.claude/skills → .agents/skills` bridge
- **AND** 不重复报错 `already deployed` 后无操作返回
- **AND** codex 的 bridge 与 `.agents/skills/code-review` 内容不受影响

#### Scenario: 补的 agent bridge 已存在 (幂等)

- **WHEN** skill `code-review` 已部署且 claude-code 的 bridge 已存在, 用户执行 `skillsmgr add code-review -a claude-code`
- **THEN** 不重复创建 bridge, 不报错, 视为已满足

#### Scenario: 为带 companions 的已部署 skill 补 agent

- **WHEN** skill `with-companion` 已部署到 codex, 其声明了 claude-code 的 companion, 用户执行 `skillsmgr add with-companion -a claude-code`
- **THEN** 创建 claude-code 的 bridge
- **AND** 补写 claude-code 的 companion 文件并记录到 `deployments.json`

### Requirement: add 无 -a 补 agent 进入交互且锁定已配置 agent

当对已部署 skill 执行 `add` 且未提供 `-a` / `--same-agents` 时, `add` 命令 SHALL 进入 agent 选择交互界面, 而非裸早退.  交互中已有 bridge 的 agent SHALL 标记为锁定且选中 (locked + checked), 用户只能新增 agent, 取消选中无效 —— 与 add 命令"已部署项只增不减"的锁定语义一致, 下沉到 agent 粒度.

#### Scenario: 已部署 skill 无 -a 进入 agent 交互

- **WHEN** skill `code-review` 已部署到 codex, 用户执行 `skillsmgr add code-review` (无 `-a`, 交互环境)
- **THEN** 弹出 agent 选择界面
- **AND** codex 显示为锁定且已选中状态
- **AND** 用户勾选 claude-code 后, 为 claude-code 补建 bridge

#### Scenario: 已部署 skill 无 -a 取消已配置 agent 无效

- **WHEN** 上述交互中用户尝试取消选中已锁定的 codex
- **THEN** 取消无效, codex 的 bridge 保持不变

## MODIFIED Requirements

### Requirement: remove 命令的 --agent 参数

remove 命令 SHALL 支持 `-a, --agent <name>` 可重复参数.  在 **project 模式** (非 `--global`) 下, `-a` 的语义为撤除指定 agent 的**项目级 bridge** (并按 `deployments.json` 记录清理该 agent 该 skill 的 companions), 与 `add -a` 补 bridge 的语义对称.  由于项目级 bridge 是覆盖全部 skill 的目录级 symlink, 撤除会使该 agent 失去经该 bridge 对**全部** skill 的访问, 因此 `<skill>` 对 bridge 操作而言为挂名参数, 仅用于 scope companions; 撤除前 SHALL 打印警告说明该影响.  不指定 `-a` 时维持现有行为 —— 从 `.agents/skills/` 删除该 skill (对所有 agent 生效).

#### Scenario: remove 指定 agent 撤除其 bridge

- **WHEN** 项目已为 codex 与 claude-code 建了 bridge, 用户执行 `skillsmgr remove my-skill -a claude-code`
- **THEN** 撤除 `.claude/skills` bridge 并打印警告说明 claude-code 将失去对全部 skill 的访问
- **AND** 清理 claude-code 的 `my-skill` companions (若有)
- **AND** codex 的 bridge 与 `.agents/skills/` 内容不受影响

#### Scenario: remove 指定的 agent 无 bridge

- **WHEN** 用户执行 `skillsmgr remove my-skill -a claude-code` 但 claude-code 没有 bridge
- **THEN** 为 no-op 并提示该 agent 未配置 bridge, 不报致命错误

#### Scenario: remove 不指定 agent

- **WHEN** 用户执行 `skillsmgr remove my-skill`
- **THEN** 从 `.agents/skills/` 删除 `my-skill` (对所有 agent 生效, 保持现有行为)
