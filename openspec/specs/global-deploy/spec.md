# Global Deploy

## Purpose
全局部署机制: 将 skill 以 symlink 或 copy 模式部署到各 agent 的全局 skills 目录, 并处理目标路径冲突与全局模式下的 agent 交互选择.

## Requirements

### Requirement: 全局部署 per-skill symlink

`add -g` 全局模式 SHALL 对每个选中的 agent, 在其 `globalSkillsDir` 下创建单个 skill 的 symlink, 指向中央仓库中 skill 的路径.

symlink 方向: `{agent.globalSkillsDir}/{skill.name}` → `{skill.path}` (中央仓库绝对路径)

#### Scenario: 全局安装单个 skill 到 Claude Code

- **WHEN** 用户执行 `skillsmgr add code-review -g -a claude-code`
- **THEN** `~/.claude/skills/code-review` 是指向 `~/.skills-manager/.../code-review` 的 symlink

#### Scenario: 全局安装到多个 agent

- **WHEN** 用户执行 `skillsmgr add code-review -g -a claude-code,cursor`
- **THEN** `~/.claude/skills/code-review` 和 `~/.cursor/skills/code-review` 各自是指向中央仓库同一 skill 路径的 symlink

#### Scenario: 全局目录不存在时自动创建

- **WHEN** `~/.claude/skills/` 目录不存在
- **THEN** 系统自动创建该目录后再创建 symlink

### Requirement: 全局部署 copy 模式

`add -g --copy` SHALL 将 skill 目录复制到各 agent 的 `globalSkillsDir`, 而非创建 symlink.

#### Scenario: copy 模式全局安装

- **WHEN** 用户执行 `skillsmgr add code-review -g --copy -a claude-code`
- **THEN** `~/.claude/skills/code-review/` 是独立的目录副本, 不是 symlink

### Requirement: 全局部署目标路径冲突处理

当目标路径已存在时, 系统 SHALL 按类型处理:
- 若为 symlink: 删除旧 symlink, 创建新的
- 若为真实目录: 输出警告, 跳过该 agent

#### Scenario: 已存在 symlink 被替换

- **WHEN** `~/.claude/skills/code-review` 已是指向其他路径的 symlink
- **THEN** 旧 symlink 被删除, 创建新 symlink

#### Scenario: 已存在真实目录跳过

- **WHEN** `~/.claude/skills/code-review` 是真实目录
- **THEN** 输出 `⚠ ~/.claude/skills/code-review is a real directory, skipping`
- **AND** 继续处理其他 agent, 不中断

### Requirement: 全局模式下的 agent 交互选择

`add -g` 无 `-a` 参数时 SHALL 显示交互 agent 选择列表:
- 列表中每个 agent 独立显示 (无 "Agents Skills Standard" 聚合选项)
- 仅显示 `showInList=true` 的 agent
- 显示全局路径作为说明文字
- 按 displayOrder 排列

#### Scenario: 全局模式 agent 选择列表

- **WHEN** 用户执行 `skillsmgr add code-review -g` (未指定 -a)
- **THEN** 显示 16 个 agent 的选择列表, 每个独立显示
- **AND** 第一项为 "Claude Code" 带 `~/.claude/skills` 说明
- **AND** 无 "Agents Skills Standard" 聚合选项

#### Scenario: 全局模式 -a 指定 agent

- **WHEN** 用户执行 `skillsmgr add code-review -g -a claude-code`
- **THEN** 跳过交互选择, 直接部署到 claude-code 的全局目录

#### Scenario: 全局模式 -a 指定隐藏 agent

- **WHEN** 用户执行 `skillsmgr add code-review -g -a amp`
- **THEN** 跳过交互选择, 部署到 amp 的全局目录 `~/.config/agents/skills/`
- **AND** 虽然 amp 不在交互列表中, 通过 -a 仍可操作
