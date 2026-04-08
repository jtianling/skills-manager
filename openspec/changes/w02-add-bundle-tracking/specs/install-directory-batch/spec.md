# Install Directory Batch (delta)

## ADDED Requirements

### Requirement: 本地 batch install 写入 bundle 条目

本地目录批量安装完成后, install 命令 SHALL 向 sources.json 的 bundles section 写入一条 `type: 'local-batch'` 的 bundle 条目, bundleId 为 `local-batch:{absolutePath}`, members 为所有被安装 skill 的 source key 列表.  bundle 的 selectionMode SHALL 按用户的选择行为推断 (详见 bundle-tracking spec).

#### Scenario: 本地 batch 全选生成 all bundle
- **WHEN** 用户执行 `skillsmgr install ./spec-tdd --all` 且 spec-tdd 下有 19 个 skill
- **THEN** bundles 中新增 `local-batch:{absPath}/spec-tdd` 条目
- **THEN** members 包含 19 个 `custom/spec-tdd/*` source key
- **THEN** selectionMode 为 `'all'`

#### Scenario: 本地 batch 部分选生成 subset bundle
- **WHEN** 用户执行 `skillsmgr install ./spec-tdd` 并在交互式选择中勾选 5 个
- **THEN** bundles 中新增条目, members 包含 5 个 source key
- **THEN** selectionMode 为 `'subset'`

#### Scenario: 重复 install 同一 batch 更新 bundle
- **WHEN** 用户第二次执行 `skillsmgr install ./spec-tdd --all`
- **THEN** 已有 bundle 的 members 被更新, `updatedAt` 刷新
- **THEN** `installedAt` 保持首次 install 的时间

#### Scenario: 单 skill install 不建 bundle
- **WHEN** 用户执行 `skillsmgr install ./my-skill` 且 my-skill 根有 SKILL.md
- **THEN** sources 中新增 `custom/my-skill` 条目
- **THEN** bundles 中不生成任何条目
