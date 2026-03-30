## MODIFIED Requirements

### Requirement: update 流程中 local-copy 来源处理
update 命令在遇到 installMethod 为 `'local-copy'` 的 source 时, SHALL 从 sources.json 中记录的 `url` (原始路径) 读取最新内容并对比, 替代之前的"跳过"行为.

#### Scenario: 全量更新包含 local-copy source
- **WHEN** 用户执行 `skillsmgr update` (无参数)
- **THEN** 系统遍历所有 source, 对 local-copy 来源执行路径对比更新
- **THEN** 对 zip 来源仍跳过
- **THEN** 对 git 来源仍走 GitHub 更新

#### Scenario: 按名称更新 local-copy source
- **WHEN** 用户执行 `skillsmgr update my-skill` 且匹配到 local-copy source
- **THEN** 系统执行路径对比更新, 不再跳过
