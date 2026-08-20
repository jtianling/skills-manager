## MODIFIED Requirements

### Requirement: install --group 自动入组
`install` 命令 SHALL 接受 `--group <name>` 选项.  安装完成后, 系统 SHALL 自动将每个已安装 skill 的 **skill key** (`{source}/{name}`) 添加到指定虚拟 group 中, 每个 skill 一条成员.  系统 SHALL NOT 写入 source key.  group 不存在时自动创建.  安装目标路径不受 `--group` 影响 (始终按来源类型决定路径).  批量安装本地目录时, 若未指定 `--group`, 系统 SHALL 自动使用源目录名作为 group 名.

当 `--group` 已指定而系统无法确定任一已安装 skill 的 skill key 时, SHALL 报错, SHALL NOT 静默跳过入组.

对 custom 来源, skill 平铺于 `custom/{name}`, 其 source key 与 skill key 取值相同; 对 community / registry / well-known 等多段来源, 二者不同, SHALL 以 skill key 为准.

#### Scenario: install 本地 skill 并入组
- **WHEN** 用户执行 `skillsmgr install ./my-linter --group python`
- **THEN** skill 安装到 `custom/my-linter/` (不受 group 影响)
- **AND** `custom/my-linter` 被添加到 groups.json 的 python group

#### Scenario: install 远程 skill 并入组
- **WHEN** 用户执行 `skillsmgr install anthropics/skills --group python`
- **THEN** skill 安装到 `official/anthropic/skills/` 下
- **AND** 每个安装的 skill key 被添加到 python group

#### Scenario: --group 指定的 group 不存在时自动创建
- **WHEN** 用户执行 `skillsmgr install ./my-linter --group new-group`, 且 new-group 不存在
- **THEN** 安装 skill, 自动创建 new-group, 并添加 skill 到该 group

#### Scenario: 批量安装自动使用目录名作为 group
- **WHEN** 用户执行 `skillsmgr install ./openspec` (批量安装, 未指定 --group)
- **THEN** 系统自动使用 "openspec" 作为 group 名
- **AND** 所有安装的 skills 被添加到 "openspec" group

#### Scenario: community 来源写入完整 skill key
- **GIVEN** 仓库 `obra/superpowers` 含 3 个 skill
- **WHEN** 用户执行 `skillsmgr install obra/superpowers --group tools` 并全选
- **THEN** group `tools` SHALL 含 3 条成员, 形如 `community/obra/superpowers/{skillName}`
- **THEN** group `tools` SHALL NOT 含 `community/obra/superpowers`

#### Scenario: registry 来源写入完整 skill key
- **GIVEN** registry 包 `my-pack` 含 2 个 skill
- **WHEN** 用户执行 `skillsmgr install my-pack --group tools`
- **THEN** group `tools` SHALL 含 2 条成员, 形如 `registry/my-pack/{skillName}`

#### Scenario: well-known 来源写入完整 skill key
- **GIVEN** 站点 `https://docs.example.com` 发布 8 个 skill
- **WHEN** 用户执行 `skillsmgr install https://docs.example.com --group site` 并全选
- **THEN** group `site` SHALL 含 8 条成员, 形如 `well-known/docs.example.com/{skillName}`

#### Scenario: 入组成员可被 add --group 解析部署
- **GIVEN** 用户已执行 `skillsmgr install https://docs.example.com --group site`
- **WHEN** 用户在某项目执行 `skillsmgr add --group site`
- **THEN** 系统 SHALL 解析出全部成员对应的 skill, SHALL NOT 输出 `No valid skills found in group`

#### Scenario: 成员数量与安装 skill 数量一致
- **GIVEN** 用户从一个多段来源选装了 3 个 skill (该来源共有 8 个)
- **WHEN** 安装完成
- **THEN** 目标 group SHALL 恰好新增 3 条成员, 对应选中的 3 个 skill
- **THEN** 未选中的 5 个 skill SHALL NOT 出现在该 group 中

#### Scenario: 无副作用 — 不影响其他 group
- **GIVEN** 已存在 group `develop` 含 5 条成员
- **WHEN** 用户执行 `skillsmgr install obra/superpowers --group tools`
- **THEN** group `develop` 的成员 SHALL 保持不变

#### Scenario: 无法确定 skill key 时报错
- **WHEN** `--group` 已指定, 但安装流程未能为任一已安装 skill 产出 skill key
- **THEN** 系统 SHALL 报错, SHALL NOT 静默完成安装而不入组
