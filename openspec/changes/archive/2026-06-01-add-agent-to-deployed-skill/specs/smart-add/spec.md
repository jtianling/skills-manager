## ADDED Requirements

### Requirement: 已部署 skill 不裸早退而进入 agent 补全

`add` 的 skill-name 流程 (`handleSkillName`) 与 repo 选择流程 (`handleRepoSkillSelection`) 在判定目标 skill 已部署时 SHALL NOT 直接 `return`, 而是进入 agent 补全 —— 解析目标 agent 后补建缺失的项目级 bridge.  此行为 SHALL 与远程安装流程 (`handleRemoteInstallAndDeploy`) 在"全部 skill 已部署"时调用 `ensureSymlinkBridges` 的既有正确行为一致, 使三条 already-deployed 路径表现统一.

#### Scenario: skill-name 流程已部署补 bridge

- **WHEN** 用户执行 `skillsmgr add code-review -a claude-code`, 而 `code-review` 已部署但 claude-code 无 bridge
- **THEN** 不打印 `already deployed` 后无操作返回
- **AND** 补建 `.claude/skills` bridge

#### Scenario: repo 选择流程全部已部署仍补 bridge

- **WHEN** 用户执行 `skillsmgr add owner/repo -a claude-code`, 该 repo 的全部 skill 均已部署但 claude-code 无 bridge
- **THEN** 不在 "all already deployed" 分支裸早退
- **AND** 补建 claude-code 的 bridge 后再返回
