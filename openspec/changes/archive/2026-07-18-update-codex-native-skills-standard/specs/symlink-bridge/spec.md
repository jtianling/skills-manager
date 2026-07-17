## ADDED Requirements

### Requirement: Codex 不使用项目级 symlink bridge

系统 SHALL NOT 为 Codex创建、检测或移除 `.codex/skills` 项目级 bridge。已有该
路径时，系统 MUST 保持其不变，不得将其作为 Codex configured 状态的必要条件。

#### Scenario: 没有旧 bridge 时扫描 Codex

- **WHEN** `.agents/skills` 中存在已部署 skill 且 `.codex/skills` 不存在
- **THEN** scanner SHALL 将 Codex报告为 configured native agent

#### Scenario: 已有旧 bridge 保持不变

- **WHEN** 项目升级前已存在 `.codex/skills` symlink
- **THEN** add/deploy/remove 操作 MUST NOT 主动删除或重写该 symlink
