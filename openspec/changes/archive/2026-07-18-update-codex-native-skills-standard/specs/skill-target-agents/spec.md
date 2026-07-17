## ADDED Requirements

### Requirement: 标准选择匹配 Codex targetAgents

项目级 add/deploy 在进行 `targetAgents` 过滤或显式兼容性校验前，SHALL 使用标准
虚拟选择解析出的真实 native agent 集合。

#### Scenario: Codex 专用 skill 匹配标准选择

- **WHEN** skill 声明 `targetAgents: ["codex"]` 且用户选择
  “Agents Skills Standard”
- **THEN** 该 skill SHALL 通过候选过滤和显式兼容性校验

#### Scenario: 不兼容的 non-native 专用 skill 仍被过滤

- **WHEN** skill 仅声明某个 non-native agent 且用户只选择
  “Agents Skills Standard”
- **THEN** 该 skill SHALL 被 targetAgents 过滤排除
