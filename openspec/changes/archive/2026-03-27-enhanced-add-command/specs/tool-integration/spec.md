## MODIFIED Requirements

### Requirement: Tool selection UI grouping

工具选择 UI SHALL 分组显示, 用户面术语使用 "agents" 替代 "tools":

1. "Agents Skills Standard" -- 聚合显示所有 native 工具名称, 选中时表示部署 `.agents/skills/`
2. 每个 non-native 工具单独显示, 标注 symlink 关系

"Agents Skills Standard" 是一个虚拟选项, 不对应 SUPPORTED_TOOLS 中的单个工具.  选中时不创建 symlink, 仅确保 `.agents/skills/` 目录存在.

提示消息从 "Select target tools:" 改为 "Select target agents:".

#### Scenario: UI displays grouped agents
- **WHEN** 用户进入 agent 选择 (init 或 add 命令)
- **THEN** 提示消息为 "Select target agents:"
- **AND** 工具选择列表显示 "Agents Skills Standard" 选项, 后跟 native 工具名称列表
- **AND** 每个 non-native 工具单独显示, 标注 "(symlink: .xxx/skills -> .agents/skills)"

#### Scenario: Selecting Agents Skills Standard only
- **WHEN** 用户仅选择 "Agents Skills Standard"
- **THEN** skills 部署到 `.agents/skills/`, 不创建任何 symlink

#### Scenario: Selecting non-native agent implies agents skills
- **WHEN** 用户选择 Claude Code (non-native tool)
- **THEN** skills 部署到 `.agents/skills/` 且 `.claude/skills -> .agents/skills` symlink 被创建

### Requirement: list --deployed 输出中的术语

`list --deployed` 输出中的 "Configured tools:" SHALL 改为 "Configured agents:".

#### Scenario: list deployed 使用 agents 术语
- **WHEN** 执行 `list --deployed`
- **THEN** 输出中显示 "Configured agents:" 而非 "Configured tools:"
