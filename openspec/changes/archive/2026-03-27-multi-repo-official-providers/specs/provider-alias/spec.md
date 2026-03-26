## ADDED Requirements

### Requirement: OfficialProvider aliases 字段

`OfficialProvider` interface SHALL 新增 `aliases?: string[]` 可选字段, 定义该 provider 的别名列表.

#### Scenario: Provider 定义了别名
- **WHEN** vercel-labs provider 定义 `aliases: ['vercel']`
- **THEN** `OFFICIAL_PROVIDERS` 中 vercel-labs 条目 SHALL 包含 aliases 字段

#### Scenario: Provider 无别名
- **WHEN** provider 未定义 aliases (如 anthropic)
- **THEN** aliases 字段 SHALL 为 undefined 或空数组

### Requirement: resolveProviderAlias 函数

系统 SHALL 提供 `resolveProviderAlias(input: string): string | null` 函数, 在所有 provider 的 aliases 中查找匹配, 返回对应的 provider key.

#### Scenario: 别名匹配成功
- **WHEN** 调用 `resolveProviderAlias('vercel')`
- **THEN** SHALL 返回 `'vercel-labs'`

#### Scenario: 别名无匹配
- **WHEN** 调用 `resolveProviderAlias('unknown')`
- **THEN** SHALL 返回 `null`

#### Scenario: 输入已是 provider key
- **WHEN** 调用 `resolveProviderAlias('vercel-labs')`
- **THEN** SHALL 返回 `null` (不在 aliases 中, 由 OFFICIAL_PROVIDERS[key] 直接匹配)

### Requirement: install 入口别名解析

`executeInstall` 入口 SHALL 在检查 `OFFICIAL_PROVIDERS[source]` 之后, 额外检查别名. 别名仅适用于 provider key 级别的单词输入.

#### Scenario: 通过别名安装
- **WHEN** 用户执行 `skillsmgr install vercel`
- **THEN** 系统 SHALL 解析 `vercel` 为 `vercel-labs`, 效果等同于 `skillsmgr install vercel-labs`

#### Scenario: owner/repo 格式不做别名解析
- **WHEN** 用户执行 `skillsmgr install vercel/agent-browser`
- **THEN** 系统 SHALL 不做别名解析, 按 owner/repo 简写逻辑处理 (owner=vercel, repo=agent-browser)
