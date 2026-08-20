## ADDED Requirements

### Requirement: group 成员恒为 skill key

虚拟 group 与 collection group 的 `members` 数组中, 每一项 SHALL 是下列两种形态之一:

- **skill key**: `{source}/{name}`, 唯一定位一个已安装 skill, 满足 `` `${skill.source}/${skill.name}` === member ``
- **group 引用**: `group:<name>` 前缀项 (见 `group-references` capability)

系统 SHALL NOT 向 `members` 写入 **source key** (如 `community/{owner}/{repo}`、`registry/{pkg}`、`well-known/{host}`).  该约束适用于所有写入路径, 包括但不限于 `group add`、`install --group`、`install --from <collection>` 的 collection group 生成、以及未来新增的任何 source 类型.

判定方法: 对 custom 来源 source key 与 skill key 取值相同, 不构成违反; 对多段 source, 写入的成员必须比其 source key 多一段.

#### Scenario: 多段 source 的成员比 source key 多一段
- **GIVEN** source key 为 `well-known/docs.example.com`
- **WHEN** 该来源的 skill `foo` 被加入某 group
- **THEN** 成员 SHALL 为 `well-known/docs.example.com/foo`

#### Scenario: 写入 source key 的成员无法被解析
- **GIVEN** 某 group 的 members 含 `community/obra/superpowers` (source key)
- **WHEN** 用户执行 `skillsmgr add --group <name>`
- **THEN** 该成员 SHALL 匹配不到任何 skill 并被跳过并提示

#### Scenario: custom 来源两者同形不构成违反
- **GIVEN** custom skill `my-linter`, source key 与 skill key 均为 `custom/my-linter`
- **WHEN** 该 skill 被加入某 group
- **THEN** 成员 SHALL 为 `custom/my-linter`, 符合本需求

### Requirement: install --from 生成的 collection group 成员格式

`skillsmgr install --from <collection-ref>` 在安装完成后 SHALL 以该 collection ref 为名生成或更新一个 collection group.  其 `members` SHALL 为本次安装的每个 skill 的 skill key, 每个 skill 一条.

当同时指定 `--group <name>` 时, 写入该虚拟 group 的成员 SHALL 同样为 skill key.  两条写入路径 SHALL NOT 写入 source key.

#### Scenario: collection group 成员为 skill key
- **GIVEN** collection `@alice/kit` 含 registry 包 `pack-a` (2 个 skill) 与 `pack-b` (1 个 skill)
- **WHEN** 用户执行 `skillsmgr install --from @alice/kit`
- **THEN** collection group `@alice/kit` SHALL 含 3 条成员, 形如 `registry/pack-a/{skill}` 与 `registry/pack-b/{skill}`
- **THEN** SHALL NOT 含 `registry/pack-a` 或 `registry/pack-b`

#### Scenario: --from 同时指定 --group
- **WHEN** 用户执行 `skillsmgr install --from @alice/kit --group tools`
- **THEN** group `tools` SHALL 含全部 3 条 skill key 成员
- **THEN** collection group `@alice/kit` SHALL 同样含这 3 条成员

#### Scenario: collection group 成员可被 add --group 部署
- **GIVEN** 用户已执行 `skillsmgr install --from @alice/kit`
- **WHEN** 用户在某项目执行 `skillsmgr add --group @alice/kit`
- **THEN** 系统 SHALL 解析出全部 3 个 skill, SHALL NOT 输出 `No valid skills found in group`

### Requirement: update <collection-ref> 重写成员时保持 skill key

`skillsmgr update <collection-ref>` 同步 collection group 快照时 SHALL 写回 skill key, SHALL NOT 用 source key 覆盖已有的 skill key 成员.

每个 collection 成员包的 skill key SHALL 按下列优先级确定:

1. 本次新装的包 → 采用安装结果报告的 skill key
2. 快照中已有该包前缀 (`registry/{pkg}/`) 的成员 → 原样保留
3. 磁盘上该包已安装的 skill → 由其枚举生成 (使早于本变更的 source key 快照自然迁移)
4. 以上都取不到 → **原样保留快照中该包的既有条目**, SHALL NOT 把该包从 group 中移除

第 4 条是对数据的保护: 推导不出 skill key 时保留一个可见的旧条目, 优于静默清空用户的 group.  被保留的旧条目仍会在 `add --group` 时报"匹配不到"并跳过.

#### Scenario: 不用 source key 覆盖 skill key 成员
- **GIVEN** collection group 成员为 `registry/@alice/a/a-one` 与 `registry/@alice/a/a-two`
- **WHEN** 用户执行 `skillsmgr update @alice/kit` 且服务端该包无变化
- **THEN** 写回的成员 SHALL 仍为这两条 skill key
- **THEN** 写回的成员 SHALL NOT 含 `registry/@alice/a`

#### Scenario: 新装的包按安装结果写入 skill key
- **GIVEN** 服务端新增包 `@alice/b`, 安装后产出 2 个 skill
- **WHEN** 用户执行 `skillsmgr update @alice/kit`
- **THEN** 写回的成员 SHALL 含该包的 2 条 skill key, SHALL NOT 含 `registry/@alice/b`

#### Scenario: 服务端下架的包从快照移除
- **GIVEN** 快照含 `registry/@alice/dropped/gone`, 服务端已无该包
- **WHEN** 用户执行 update
- **THEN** 该成员 SHALL 从快照移除, 本地副本 SHALL 保留

#### Scenario: 推导不出时保留旧条目而非清空
- **GIVEN** 快照含早于本变更的条目 `registry/@alice/a` (source key), 且磁盘上无该包的 skill
- **WHEN** 用户执行 update
- **THEN** 写回的成员 SHALL 仍含 `registry/@alice/a`
- **THEN** SHALL NOT 把该包从 group 中移除
