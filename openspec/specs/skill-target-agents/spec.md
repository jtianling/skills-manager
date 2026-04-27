# skill-target-agents Specification

## Purpose

声明 skill 适用哪些 agent 工具, 让 `add` / `deploy` 候选列表按用户已选 agent 集合自动过滤无关 skill.  适用于"整个 skill 只对特定 agent 有意义"的场景 (例如 jt-codex 只对 Claude Code 有意义).

## Requirements

### Requirement: skill.json targetAgents 字段 schema

`SkillManifest` SHALL 支持可选字段 `targetAgents: string[]`, 用于声明该 skill 适用哪些 agent 工具.

约束:
- 类型为字符串数组, 不写或显式为 `undefined` / 空数组 视为"全集" (所有 agent 都适用)
- 数组中每个元素 MUST 是 `SUPPORTED_TOOLS` (即 `src/constants.ts` 中 `SUPPORTED_TOOLS` 常量) 内的 agent 名
- 字段大小写敏感, 必须与 `SUPPORTED_TOOLS` 完全一致

#### Scenario: skill.json 不写 targetAgents

- **WHEN** skill.json 没有 `targetAgents` 字段
- **THEN** `validateManifest` SHALL 通过校验, 系统行为视为该 skill 适用所有 agent

#### Scenario: skill.json 显式声明空数组

- **WHEN** skill.json `targetAgents: []`
- **THEN** `validateManifest` SHALL 通过校验, 行为等同于不写 (适用所有 agent)

#### Scenario: skill.json targetAgents 列出有效 agent

- **WHEN** skill.json `targetAgents: ["claude-code"]`, 其中 `claude-code` 是 `SUPPORTED_TOOLS` 之一
- **THEN** `validateManifest` SHALL 通过校验

#### Scenario: skill.json targetAgents 列出未知 agent

- **WHEN** skill.json `targetAgents: ["unknown-agent"]`, 该名不在 `SUPPORTED_TOOLS` 中
- **THEN** `validateManifest` SHALL 返回错误, 错误信息 MUST 指明该 agent 名未被识别, 并提示 `SUPPORTED_TOOLS` 列表

#### Scenario: skill.json targetAgents 类型错误

- **WHEN** skill.json `targetAgents: "claude-code"` (字符串而非数组) 或 `targetAgents: [123]` (元素非字符串)
- **THEN** `validateManifest` SHALL 返回错误, 错误信息 MUST 指明 `targetAgents` 必须是字符串数组

### Requirement: add 候选列表按 targetAgents 过滤

`add` 命令在确定已选 agent 集合后, SHALL 在显示 skill 候选列表前应用 targetAgents 过滤规则.

过滤规则:
- 若 skill 的 `targetAgents` 为空 / 未声明, 该 skill SHALL 出现在候选列表中
- 若 skill 的 `targetAgents` 与已选 agent 集合的交集非空, 该 skill SHALL 出现在候选列表中
- 否则, 该 skill SHALL NOT 出现在候选列表中

过滤发生在 agent 选择之后, skill 选择之前.  当用户后续修改已选 agent 集合 (例如交互中切换 agent), 候选列表应该按新集合重新过滤.

#### Scenario: 用户只选 claude-code, jt-codex (targetAgents 为 [claude-code]) 出现

- **WHEN** 用户运行 `skillsmgr add` 且交互或 `-a` flag 选择 `claude-code`, 本地存在 jt-codex skill 其 skill.json 声明 `targetAgents: ["claude-code"]`
- **THEN** skill 候选列表 SHALL 包含 jt-codex

#### Scenario: 用户只选 codex, jt-codex 不出现

- **WHEN** 用户运行 `skillsmgr add` 且选择 `codex` (不选 claude-code), 本地存在 jt-codex skill 其 `targetAgents: ["claude-code"]`
- **THEN** skill 候选列表 SHALL NOT 包含 jt-codex

#### Scenario: 用户同时选 claude-code 和 codex, jt-codex 出现

- **WHEN** 用户选择 `claude-code` 和 `codex`, jt-codex `targetAgents: ["claude-code"]`
- **THEN** skill 候选列表 SHALL 包含 jt-codex (交集非空: claude-code)

#### Scenario: 通用 skill (无 targetAgents) 在任何 agent 集合下都出现

- **WHEN** skill `react-patterns` 的 skill.json 未声明 `targetAgents`, 用户选任意 agent 集合
- **THEN** skill 候选列表 SHALL 包含 react-patterns

### Requirement: deploy 候选列表按 targetAgents 过滤

`deploy` 命令在交互选择 skill 时, SHALL 应用与 `add` 相同的 `targetAgents` 过滤规则, 基于当前已部署或将要部署的 agent 集合.

`deploy` 与 `add` 的语义差异 (`add` 锁定已部署不可取消, `deploy` 允许通过取消选中实现 remove) 不影响过滤规则的判定逻辑.

#### Scenario: deploy 时 jt-codex 在不适用 agent 项目中不出现

- **WHEN** 项目当前选择部署到 `codex` (无 claude-code), 用户运行 `skillsmgr deploy`
- **THEN** jt-codex (`targetAgents: ["claude-code"]`) SHALL NOT 出现在 deploy 候选列表中

#### Scenario: deploy 时通用 skill 始终出现

- **WHEN** 项目部署到任意 agent 集合, 通用 skill (无 `targetAgents`) 已安装
- **THEN** 该通用 skill SHALL 出现在 deploy 候选列表中

### Requirement: 已部署但变得不适用的 skill 在 deploy 中保留为已选

如果 skill 已部署到项目, 但因 agent 集合变化或 skill 升级导致 `targetAgents` 不再与当前 agent 集合相交, `deploy` 命令 SHALL 仍在候选列表中显示该 skill 并标记为"已部署"(不锁定).

理由: 让用户有机会通过取消选中显式 remove 该 skill, 而不是静默隐藏.

#### Scenario: skill 已部署但 targetAgents 不再匹配

- **WHEN** jt-codex 已部署到当前项目, 用户在 `deploy` 流程中将已选 agent 改为只 codex (移除 claude-code)
- **THEN** jt-codex SHALL 仍出现在候选列表中, 状态标记为 "已部署 (将被移除)" 或类似提示, 用户可通过取消选中确认 remove
