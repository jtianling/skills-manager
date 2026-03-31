## MODIFIED Requirements

### Requirement: --agent 可重复参数

add, remove 两个命令 SHALL 支持 `-a, --agent <name>` 可重复参数, 用于精确指定目标 agent. install 和 uninstall 不支持 (install 只操作中央仓库不涉及 agent 部署, uninstall 同理).

#### Scenario: 单个 --agent
- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code`
- **THEN** 仅部署到 claude-code, 跳过 agent 选择界面

#### Scenario: 多个 --agent 累积
- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code -a opencode`
- **THEN** 部署到 claude-code 和 opencode

#### Scenario: --agent 指定无效 agent
- **WHEN** 用户执行 `skillsmgr add code-review -a invalid-name`
- **THEN** 输出 `Unknown agent: 'invalid-name'. Available agents: claude-code, codex, ...`
- **AND** 以退出码 1 退出

### Requirement: install 命令的 --skill 与 --agent 参数

install 命令 SHALL 支持 `--skill` 参数过滤安装的 skill. install 命令 SHALL NOT 支持 `--agent` 参数, 因为 install 只将 skill 下载到中央仓库, 不涉及 agent 部署.

#### Scenario: install 只装特定 skill
- **WHEN** 用户执行 `skillsmgr install anthropic -s code-review`
- **THEN** 从 anthropic 源仅安装 code-review

#### Scenario: install 不支持 --agent
- **WHEN** 用户执行 `skillsmgr install anthropic -a claude-code`
- **THEN** 命令报错: 未知选项 `-a`

## REMOVED Requirements

### Requirement: install 命令的 --skill 与 --agent 参数
**Reason**: install 只操作中央仓库, 不涉及 agent 部署. `--agent` 选项从未实现过功能, 属于废弃代码.
**Migration**: 使用 `skillsmgr install` 安装后, 用 `skillsmgr add -a <agent>` 部署到指定 agent.
