## ADDED Requirements

### Requirement: remove 支持 owner/repo 格式批量移除

`remove` 命令 SHALL 支持 `owner/repo` 格式参数, 检测到该格式时通过中央仓库查找该 source 下的所有 skills, 过滤出已部署到当前项目的, 批量移除.

格式检测规则: 参数含 `/` 且不含 `://` 时视为 `owner/repo` 格式.

匹配逻辑:
1. 通过 `findRepoInCentralRepository(ownerRepo)` 在中央仓库查找匹配的 skills
2. 获取当前项目已部署的 skills
3. 交叉匹配: 只移除既在中央仓库该 source 下、又在项目已部署中的 skills
4. 逐个移除并输出 `✓ Removed <name>`

#### Scenario: owner/repo 格式移除已部署的 skills
- **WHEN** 用户执行 `skillsmgr remove mattpocock/skills`
- **AND** 中央仓库 `community/mattpocock/skills` 下有 skill-a, skill-b, skill-c
- **AND** 项目中已部署 skill-a 和 skill-b
- **THEN** 移除 skill-a 和 skill-b 的部署
- **AND** 输出 `✓ Removed skill-a` 和 `✓ Removed skill-b`
- **AND** skill-c 不受影响 (未部署)

#### Scenario: owner/repo 格式匹配 official provider
- **WHEN** 用户执行 `skillsmgr remove anthropics/skills`
- **AND** 中央仓库 `official/anthropic/skills` 下有 commit, code-review
- **AND** 项目中已部署 commit
- **THEN** 移除 commit 的部署

#### Scenario: owner/repo 无已部署 skill
- **WHEN** 用户执行 `skillsmgr remove mattpocock/skills`
- **AND** 中央仓库存在该 source 但项目中没有部署任何对应 skill
- **THEN** 输出 "No deployed skills found from 'mattpocock/skills'"
- **AND** 以退出码 1 退出

#### Scenario: owner/repo 在中央仓库中不存在
- **WHEN** 用户执行 `skillsmgr remove unknown/repo`
- **AND** 中央仓库中不存在匹配的 source
- **THEN** 输出 "'unknown/repo' not found in central repository"
- **AND** 以退出码 1 退出

#### Scenario: owner/repo 不影响其他 source 的同名 skill
- **WHEN** 项目中部署了来自 `community/mattpocock/skills` 的 skill-a 和来自 `official/anthropic/skills` 的 skill-a (同名)
- **AND** 用户执行 `skillsmgr remove mattpocock/skills`
- **THEN** 只移除来自 `community/mattpocock/skills` 的 skill-a
- **AND** 来自 `official/anthropic/skills` 的 skill-a 保持不变

#### Scenario: owner/repo 与 --global 模式组合
- **WHEN** 用户执行 `skillsmgr remove mattpocock/skills -g`
- **THEN** 在全局 agent 目录中查找并移除该 source 下的 skills

#### Scenario: 纯 skill name 行为不变
- **WHEN** 用户执行 `skillsmgr remove commit`
- **THEN** 行为与现有逻辑完全一致, 按名称精确匹配已部署 skill
