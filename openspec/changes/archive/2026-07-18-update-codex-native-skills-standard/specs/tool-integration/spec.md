## ADDED Requirements

### Requirement: Codex 原生支持 Agents Skills Standard

项目级部署中，系统 SHALL 将 Codex 视为原生读取 `.agents/skills` 的工具。Codex
SHALL 出现在 “Agents Skills Standard” 聚合项中，系统 MUST NOT 为新的 Codex 项目
创建 `.codex/skills` symlink bridge。

#### Scenario: 标准部署供 Codex 直接使用

- **WHEN** 用户仅选择 “Agents Skills Standard” 并部署一个 skill
- **THEN** skill SHALL 部署到 `.agents/skills/<name>`
- **AND** Codex SHALL 被视为该标准部署支持的 native agent
- **AND** `.codex/skills` SHALL NOT 被创建

#### Scenario: 显式选择 Codex

- **WHEN** 用户通过 `-a codex` 显式选择 Codex进行项目级部署
- **THEN** 系统 SHALL 将 skill 部署到 `.agents/skills/<name>`
- **AND** 系统 MUST NOT 创建 `.codex/skills` bridge

### Requirement: 标准虚拟选择解析为真实 native agents

当业务逻辑需要真实 agent 身份时，系统 SHALL 将项目级
`agents-skills-standard` 虚拟值解析为所有 `native && showInList` agent 名称，并与
显式 agent 选择去重。虚拟值本身 MUST NOT 参与 manifest 兼容性匹配。

#### Scenario: 标准选择解析包含 Codex

- **WHEN** 用户选择 “Agents Skills Standard”
- **THEN** 解析后的真实 agent 集合 SHALL 包含 `codex`
- **AND** 集合 SHALL 不包含 `agents-skills-standard`
