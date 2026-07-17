## ADDED Requirements

### Requirement: Codex 显示在 Agents Skills Standard 聚合项

项目级 agent 选择和 deployed 状态输出 SHALL 将 Codex显示为 Agents Skills
Standard 原生工具，而不是单独的 symlink agent。

#### Scenario: 项目级 agent 选择

- **WHEN** 用户运行需要项目级 agent 选择的 `skillsmgr add`
- **THEN** “Agents Skills Standard” 标签 SHALL 包含 Codex
- **AND** 列表 SHALL NOT 出现独立的 Codex symlink 选项

#### Scenario: deployed 状态输出

- **WHEN** `.agents/skills` 中存在已部署 skill 且用户查看 deployed 状态
- **THEN** configured agents 的标准聚合项 SHALL 包含 Codex
- **AND** 输出 SHALL NOT 声称存在 `.codex/skills` bridge
