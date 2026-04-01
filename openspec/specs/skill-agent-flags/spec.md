# Skill & Agent Flags

### Requirement: --skill 可重复参数

install, uninstall, add, remove 四个命令 SHALL 支持 `-s, --skill <name>` 可重复参数, 用于精确指定操作目标 skill. 多次使用时累积为数组.

#### Scenario: 单个 --skill
- **WHEN** 用户执行 `skillsmgr install owner/repo --skill frontend-design`
- **THEN** 仅安装名为 `frontend-design` 的 skill, 跳过 skill 选择界面

#### Scenario: 多个 --skill 累积
- **WHEN** 用户执行 `skillsmgr install owner/repo -s frontend-design -s skill-creator`
- **THEN** 仅安装 `frontend-design` 和 `skill-creator` 两个 skill

#### Scenario: --skill 指定不存在的 skill
- **WHEN** 用户执行 `skillsmgr install owner/repo --skill nonexistent`
- **AND** 源中不存在名为 `nonexistent` 的 skill
- **THEN** 输出 `Skill 'nonexistent' not found.`
- **AND** 以退出码 1 退出

#### Scenario: --skill 与 --all 互斥
- **WHEN** 用户执行 `skillsmgr install owner/repo --skill s1 --all`
- **THEN** `--all` 优先, 安装所有 skill (与现有 --all 行为一致)

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

### Requirement: --skill 和 --agent 组合跳过所有交互

当 `-s` 和 `-a` 都提供时, 命令 SHALL 完全跳过交互选择, 直接执行操作.  同理, `--all` + `-a`, `-s` + `--same-agents`, `--all` + `--same-agents` 等组合也 SHALL 完全跳过交互.

#### Scenario: add 完全非交互
- **WHEN** 用户执行 `skillsmgr add owner/repo -s skill1 -s skill2 -a claude-code`
- **THEN** 从 owner/repo 部署 skill1 和 skill2 到 claude-code, 无任何交互提示

#### Scenario: remove 完全非交互
- **WHEN** 用户执行 `skillsmgr remove owner/repo -s skill1 -a claude-code`
- **THEN** 从 claude-code 移除 skill1, 无任何交互提示

#### Scenario: --all 加 -a 完全非交互
- **WHEN** 用户执行 `skillsmgr add owner/repo --all -a claude-code`
- **THEN** 部署所有 skills 到 claude-code, 无任何交互提示

#### Scenario: -s 加 --same-agents 完全非交互
- **WHEN** 用户执行 `skillsmgr add owner/repo -s skill1 --same-agents`
- **AND** 项目已配置 agents
- **THEN** 部署 skill1 到已配置 agents, 无任何交互提示

### Requirement: 仅 --skill 时只跳过 skill 选择

当只提供 `-s` 不提供 `-a`/`--same-agents` 时, 跳过 skill 选择但仍交互选择 agent (对于需要 agent 的命令).

#### Scenario: uninstall 有 skill
- **WHEN** 用户执行 `skillsmgr uninstall -s skill1 -s skill2`
- **THEN** 直接卸载 skill1 和 skill2, 无交互 (uninstall 无 agent 选择)

#### Scenario: add 有 skill 无 agent 进入 agent 选择
- **WHEN** 用户执行 `skillsmgr add owner/repo -s frontend-design`
- **THEN** 跳过 skill 选择, 直接进入 agent 选择交互

### Requirement: 仅 --agent 时只跳过 agent 选择

当只提供 `-a`/`--same-agents` 不提供 `-s`/`--all` 时, 跳过 agent 选择但仍交互选择 skill.

#### Scenario: add 有 agent 无 skill
- **WHEN** 用户执行 `skillsmgr add owner/repo -a claude-code`
- **THEN** 跳过 agent 选择, 直接进入 skill 选择交互

### Requirement: -y/--yes 智能推断标志

`add` 和 `remove` 命令 SHALL 支持 `-y, --yes` 标志.  `-y` 在进入交互流程之前展开为等效标志:
- 若未指定 `-a` 且未指定 `--same-agents`: 设置 `sameAgents = true`
- 若未指定 `--all` 且未指定 `-s`: 设置 `all = true`
- 两条规则独立判断, 可同时生效

#### Scenario: -y 展开为 --same-agents + --all
- **WHEN** 用户执行 `skillsmgr add owner/repo -y`
- **AND** 项目已配置 agents
- **THEN** 等效于 `skillsmgr add owner/repo --same-agents --all`
- **AND** 无任何交互

#### Scenario: -y 不覆盖已指定的 -a
- **WHEN** 用户执行 `skillsmgr add owner/repo -a claude-code -y`
- **THEN** agent 使用 `-a` 指定的 claude-code
- **AND** skill 选择等效 `--all`
- **AND** 无任何交互

#### Scenario: -y 不覆盖已指定的 -s
- **WHEN** 用户执行 `skillsmgr add owner/repo -s my-skill -y`
- **AND** 项目已配置 agents
- **THEN** skill 使用 `-s` 指定的 my-skill
- **AND** agent 选择等效 `--same-agents`
- **AND** 无任何交互

#### Scenario: -y 不覆盖已指定的 --all
- **WHEN** 用户执行 `skillsmgr add owner/repo --all -y`
- **AND** 项目已配置 agents
- **THEN** `--all` 已确定 skill 选择
- **AND** `-y` 仅推断 `--same-agents`
- **AND** 无任何交互

### Requirement: collector 模式参数解析

`-s` 和 `-a` SHALL 使用 Commander.js collector 函数解析, 每次调用累积一个值到数组. 不支持逗号分隔, 不支持空格分隔多值.

#### Scenario: 逗号分隔被视为单个值
- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code,opencode`
- **THEN** 系统将 `claude-code,opencode` 视为单个 agent 名称
- **AND** 输出 `Unknown agent: 'claude-code,opencode'. Available agents: ...`

### Requirement: install 命令的 --skill 参数

install 命令 SHALL 支持 `--skill` 参数过滤安装的 skill. install 命令 SHALL NOT 支持 `--agent` 参数, 因为 install 只将 skill 下载到中央仓库, 不涉及 agent 部署.

#### Scenario: install 只装特定 skill
- **WHEN** 用户执行 `skillsmgr install anthropic -s code-review`
- **THEN** 从 anthropic 源仅安装 code-review

#### Scenario: install 不支持 --agent
- **WHEN** 用户执行 `skillsmgr install anthropic -a claude-code`
- **THEN** 命令报错: 未知选项 `-a`

### Requirement: remove 命令的 positional arg 与 --skill 合并

remove 命令 SHALL 将 positional arg `[name]` 和 `-s` 参数的值合并为操作目标列表. 两者都不提供时报错.

#### Scenario: 只用 positional arg (向后兼容)
- **WHEN** 用户执行 `skillsmgr remove my-skill`
- **THEN** 移除 `my-skill`, 行为与之前完全一致

#### Scenario: positional arg 与 --skill 合并
- **WHEN** 用户执行 `skillsmgr remove my-skill -s other-skill`
- **THEN** 同时移除 `my-skill` 和 `other-skill`

#### Scenario: 只用 --skill
- **WHEN** 用户执行 `skillsmgr remove -s skill1 -s skill2`
- **THEN** 移除 `skill1` 和 `skill2`

#### Scenario: 无参数也无 --skill
- **WHEN** 用户执行 `skillsmgr remove`
- **THEN** 输出错误信息提示需要指定 skill 名称
- **AND** 以退出码 1 退出

### Requirement: remove 命令的 --agent 参数

remove 命令 SHALL 支持 `-a, --agent <name>` 可重复参数, 仅从指定 agent 移除 skill. 不指定时从所有已配置 agent 移除.

#### Scenario: remove 指定 agent
- **WHEN** 用户执行 `skillsmgr remove my-skill -a claude-code`
- **THEN** 仅从 claude-code 的部署中移除 `my-skill`, 其他 agent 的部署不受影响

#### Scenario: remove 不指定 agent
- **WHEN** 用户执行 `skillsmgr remove my-skill`
- **THEN** 从所有已配置 agent 移除 `my-skill` (保持现有行为)
