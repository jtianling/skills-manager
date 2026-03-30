# Unified Source Detection

统一的 source 类型识别逻辑.

## Requirements

### Requirement: 统一的 source 类型识别
`detectSourceType` SHALL 对未匹配任何已知格式的裸词返回 `'unknown'`, 不再 fallback 到 `'local-path'`. SourceType 联合类型新增 `'unknown'`.

#### Scenario: 裸词返回 unknown
- **WHEN** 输入为不含路径前缀的裸词 (如 `my-skill`, `anthropic`)
- **THEN** `detectSourceType` 返回 `'unknown'`

#### Scenario: 显式本地路径仍返回 local-path
- **WHEN** 输入以 `/`, `./`, `../`, `~` 开头
- **THEN** `detectSourceType` 返回 `'local-path'`

#### Scenario: install 命令处理 unknown 类型
- **WHEN** `detectSourceType` 返回 `'unknown'`
- **THEN** install 命令报错: "Unknown source format '{input}'. Use ./name for local, owner/repo for GitHub."

#### Scenario: update 命令处理 unknown 类型
- **WHEN** `detectSourceType` 返回 `'unknown'` 且 `update` 命令收到此输入
- **THEN** update 命令按已安装 source 名匹配 (现有 repoName 查找逻辑)
