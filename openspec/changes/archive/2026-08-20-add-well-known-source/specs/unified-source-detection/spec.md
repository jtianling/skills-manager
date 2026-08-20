## MODIFIED Requirements

### Requirement: 统一的 source 类型识别
`detectSourceType` SHALL 对未匹配任何已知格式的裸词返回 `'unknown'`, 不再 fallback 到 `'local-path'`. SourceType 联合类型新增 `'unknown'`.

SourceType 联合类型 SHALL 再新增 `'well-known'`.  http(s) 输入的归类顺序 SHALL 为:

1. `.zip` / `.skill` 结尾 → `'remote-zip'`
2. hostname 在 git 主机排除表内 (`github.com`, `gitlab.com`, `raw.githubusercontent.com`, `codeload.github.com`) → `'remote-url'`
3. 路径以 `.git` 结尾 → `'remote-url'`
4. 其余 → `'well-known'`

`git@` 开头的 SSH 输入 SHALL 继续返回 `'remote-url'`, 不受影响.  `detectSourceType` SHALL 保持同步且零网络.

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

#### Scenario: 非 git 主机 URL 返回 well-known
- **WHEN** 输入为 `https://docs.stripe.com`
- **THEN** `detectSourceType` 返回 `'well-known'`

#### Scenario: git 主机 URL 仍返回 remote-url
- **WHEN** 输入为 `https://github.com/openai/skills` 或 `https://gitlab.com/foo/bar`
- **THEN** `detectSourceType` 返回 `'remote-url'`

#### Scenario: .git 后缀仍返回 remote-url
- **WHEN** 输入为 `https://git.company.com/team/skills.git`
- **THEN** `detectSourceType` 返回 `'remote-url'`

#### Scenario: SSH 输入不受影响
- **WHEN** 输入为 `git@example.com:foo/bar.git`
- **THEN** `detectSourceType` 返回 `'remote-url'`
