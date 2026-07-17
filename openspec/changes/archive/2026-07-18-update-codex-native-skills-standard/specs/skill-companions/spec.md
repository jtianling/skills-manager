## ADDED Requirements

### Requirement: 标准选择部署 Codex companion

项目级部署 companion 时，系统 SHALL 使用标准虚拟选择解析出的真实 native agent
集合匹配 `companion.agentTargets`。

#### Scenario: 部署 Codex companion

- **WHEN** 通用 skill 声明 Codex companion，且用户选择
  “Agents Skills Standard” 部署该 skill
- **THEN** Codex companion SHALL 部署到 manifest 指定的项目内目标路径

#### Scenario: 不部署未选 non-native companion

- **WHEN** skill 同时声明 Codex 与某个 non-native agent companion，且用户只选择
  “Agents Skills Standard”
- **THEN** Codex companion SHALL 被部署
- **AND** non-native agent companion SHALL 不被部署
