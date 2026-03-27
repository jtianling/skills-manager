## ADDED Requirements

### Requirement: add -g/--global 全局部署模式

`add` 命令 SHALL 支持 `-g`/`--global` 参数, 启用全局部署模式.  全局模式下 skill 部署到各 agent 的 `globalSkillsDir` 而非项目级 `.agents/skills/`.

#### Scenario: -g 标志启用全局模式

- **WHEN** 用户执行 `skillsmgr add code-review -g`
- **THEN** 进入全局部署模式, 部署到选中 agent 的全局 skills 目录

#### Scenario: --global 长选项

- **WHEN** 用户执行 `skillsmgr add code-review --global`
- **THEN** 行为与 `-g` 相同

#### Scenario: 不指定 -g 保持项目级

- **WHEN** 用户执行 `skillsmgr add code-review` (无 -g)
- **THEN** 保持现有项目级部署行为

### Requirement: add --group 批量部署

`add --group <name>` SHALL 从中央仓库按组批量部署 skills, 不再透传给远程安装逻辑.

#### Scenario: --group 批量部署

- **WHEN** 用户执行 `skillsmgr add --group dev`
- **THEN** 查找 `custom/dev` 组下所有 skills 并展示选择列表

#### Scenario: --group 与 skill name 互斥

- **WHEN** 用户执行 `skillsmgr add code-review --group dev`
- **THEN** 输出错误 "Cannot use --group with a skill argument."
- **AND** 以退出码 1 退出

## MODIFIED Requirements

### Requirement: -a/--agent 标志指定 agent

`-a`/`--agent` 标志 SHALL 接受逗号分隔的 agent 列表, 跳过交互选择.  agent 标识符 SHALL 使用 45 个 SUPPORTED_TOOLS 中的任意值.

#### Scenario: 单个 agent

- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code`
- **THEN** 跳过 agent 选择, 部署到 claude-code

#### Scenario: 多个 agent

- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code,cursor`
- **THEN** 跳过 agent 选择, 部署到 claude-code 和 cursor

#### Scenario: 无效 agent 名称

- **WHEN** 用户执行 `skillsmgr add code-review -a invalid-name`
- **THEN** 输出 "Unknown agent: 'invalid-name'. Available agents: claude-code, codex, ..."
- **AND** 以退出码 1 退出

#### Scenario: 隐藏 agent 可通过 -a 使用

- **WHEN** 用户执行 `skillsmgr add code-review -a amp`
- **THEN** 部署成功, amp 虽不在交互列表但可通过 -a 操作

## REMOVED Requirements

### Requirement: -g/--group 作为 add 选项的旧含义

**Reason**: `-g` 改为 `--global`, `--group` 改为批量部署语义
**Migration**: 使用 `--global` 代替 `-g` 表示全局安装; `--group` 现在表示按组批量部署
