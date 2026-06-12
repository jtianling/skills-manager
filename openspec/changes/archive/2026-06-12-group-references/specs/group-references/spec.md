## ADDED Requirements

### Requirement: group 引用的存储表示

虚拟 group 的 `members` 数组 SHALL 允许混入 group 引用项, 引用项以 `group:<name>` 前缀标记 (例如 `"group:develop"`), 与直接 skill key (`<source>/<name>`) 共存且保持原有顺序.  groups.json 仍为 version 2.0, 不升级 schema, 不引入新字段.

#### Scenario: 引用项与 skill key 混合存放

- **GIVEN** 虚拟 group `vercel-develop`
- **WHEN** 它引用了 `develop` 并直接含 `custom/jt-role-vercel-logger`
- **THEN** `groups.json` 中 `vercel-develop` 为 `{ "kind": "virtual", "members": ["group:develop", "custom/jt-role-vercel-logger"] }`

#### Scenario: 旧文件无引用项时完全兼容

- **GIVEN** 一份不含任何 `group:` 项的旧 groups.json
- **WHEN** 系统 load 并读取 group
- **THEN** 行为与引入本能力前完全一致, 不报错、不改写

### Requirement: addSkill 拒绝 group 引用前缀

`GroupsService.addSkill(group, skillKey)` SHALL 拒绝以 `group:` 开头的 `skillKey`, 防止把引用误当作 skill 写入.  group 引用的增删 MUST 通过专用的引用操作 (`addGroupRef` / `removeGroupRef`) 完成.

#### Scenario: addSkill 收到 group 前缀报错

- **WHEN** 调用 `addSkill("python", "group:develop")`
- **THEN** SHALL 抛出错误, 提示应使用 group 引用操作而非 addSkill

#### Scenario: addSkill 正常 skill key 不受影响

- **WHEN** 调用 `addSkill("python", "custom/foo")`
- **THEN** 正常写入, 行为不变

### Requirement: getGroupMembers 递归展开 group 引用

`GroupsService.getGroupMembers(name)` SHALL 在返回前递归展开 `members` 中的 `group:<x>` 引用项: 直接 skill key 原样收集, 引用项替换为 `getGroupMembers(x)` 的展开结果.  展开 SHALL 使用 visited 集合记录已展开的 group 名以防环, 并对最终 skill key 去重 (保留首次出现顺序).  被引用的 group 可为任意 kind (virtual 继续递归 / local-batch 扫物理目录 / collection 读 members).  `getGroupMembers` SHALL 保持无副作用, 不打印日志.

#### Scenario: 展开单层引用并保持顺序

- **GIVEN** `develop` 含 `["custom/a", "custom/b"]`, `vercel-develop` 含 `["group:develop", "custom/c"]`
- **WHEN** 调用 `getGroupMembers("vercel-develop")`
- **THEN** 返回 `["custom/a", "custom/b", "custom/c"]`

#### Scenario: 动态跟随被引用 group 变化

- **GIVEN** `vercel-develop` 含 `["group:develop"]`, `develop` 含 `["custom/a"]`
- **WHEN** 向 `develop` 添加 `custom/x` 后再次调用 `getGroupMembers("vercel-develop")`
- **THEN** 返回包含 `custom/x` (无需改动 vercel-develop 自身)

#### Scenario: 多层嵌套引用

- **GIVEN** `c` 含 `["group:b"]`, `b` 含 `["group:a"]`, `a` 含 `["custom/a"]`
- **WHEN** 调用 `getGroupMembers("c")`
- **THEN** 返回 `["custom/a"]`

#### Scenario: 环引用安全终止

- **GIVEN** `a` 含 `["group:b", "custom/a"]`, `b` 含 `["group:a", "custom/b"]`
- **WHEN** 调用 `getGroupMembers("a")`
- **THEN** 返回 `["custom/a", "custom/b"]` (不无限递归, 已访问的 group 跳过)

#### Scenario: 多路径可达的 skill 去重

- **GIVEN** `x` 含 `["group:a", "group:b"]`, `a` 与 `b` 都含 `custom/shared`
- **WHEN** 调用 `getGroupMembers("x")`
- **THEN** `custom/shared` 只出现一次

#### Scenario: 悬空引用静默展开为空

- **GIVEN** `x` 含 `["group:gone", "custom/a"]`, 不存在名为 `gone` 的 group
- **WHEN** 调用 `getGroupMembers("x")`
- **THEN** 返回 `["custom/a"]` (悬空引用跳过, 不报错、不打印)

#### Scenario: 引用物理 group 展开为派生成员

- **GIVEN** `x` 含 `["group:tdd-spec"]`, 物理 group `tdd-spec` 的 `custom/tdd-spec/` 含 `ts-apply`、`ts-verify`
- **WHEN** 调用 `getGroupMembers("x")`
- **THEN** 返回 `["custom/tdd-spec/ts-apply", "custom/tdd-spec/ts-verify"]`

### Requirement: group add --group 添加动态引用

`skillsmgr group add <target> --group <src>` SHALL 向 target 虚拟 group 写入对 src 的动态引用项 (`group:<src>`).  此语义独立于 positional `group add <target> <src-group>` 的一次性快照复制, 二者并存.

#### Scenario: 添加 group 引用

- **WHEN** 用户执行 `skillsmgr group add vercel-develop --group develop`
- **THEN** `vercel-develop` 的 members 新增 `group:develop` 引用项
- **AND** 之后 `getGroupMembers("vercel-develop")` 包含 develop 的当前全部成员

#### Scenario: target 不存在时自动创建

- **WHEN** 用户执行 `skillsmgr group add vercel-develop --group develop`, 且 vercel-develop 不存在
- **THEN** 自动创建虚拟 group vercel-develop 并写入 `group:develop`

#### Scenario: 重复添加同一引用幂等

- **WHEN** `group:develop` 已在 vercel-develop 中, 再次执行 `skillsmgr group add vercel-develop --group develop`
- **THEN** 不重复添加, 提示该引用已存在

#### Scenario: 引用不存在的 group 给出警告

- **WHEN** 用户执行 `skillsmgr group add vercel-develop --group nosuch`, 且 nosuch 不存在
- **THEN** SHALL 报错或警告 "Group 'nosuch' not found.", 不写入引用

#### Scenario: 自引用防护

- **WHEN** 用户执行 `skillsmgr group add develop --group develop`
- **THEN** 输出 "Cannot reference a group from itself." 并退出, 不写入引用

#### Scenario: positional 快照与 --group 引用并存

- **WHEN** 用户执行 `skillsmgr group add vercel-develop develop` (positional)
- **THEN** 维持原快照复制语义 (把 develop 当前成员逐条复制进 vercel-develop), 不写入 `group:develop` 引用项

### Requirement: group remove --group 移除动态引用

`skillsmgr group remove <target> --group <src>` SHALL 从 target 虚拟 group 移除对 src 的引用项 (`group:<src>`).  与 `group add --group` 对称.

#### Scenario: 移除 group 引用

- **WHEN** vercel-develop 含 `group:develop`, 用户执行 `skillsmgr group remove vercel-develop --group develop`
- **THEN** 移除该引用项
- **AND** 之后 `getGroupMembers("vercel-develop")` 不再包含 develop 的成员

#### Scenario: 引用不在 target 中

- **WHEN** vercel-develop 不含 `group:develop`, 用户执行 `skillsmgr group remove vercel-develop --group develop`
- **THEN** 输出提示该引用不存在, 不报致命错误

#### Scenario: 移除引用不影响被引用 group

- **WHEN** 用户执行 `skillsmgr group remove vercel-develop --group develop`
- **THEN** develop 本身及其成员不受影响, 仅 vercel-develop 的引用项被删

### Requirement: group list 标注引用项

`skillsmgr group list <name>` SHALL 在列出成员时标注哪些来自 group 引用, 并标注悬空引用.

#### Scenario: 标注引用来源

- **GIVEN** `vercel-develop` 含 `["group:develop", "custom/jt-role-vercel-logger"]`, develop 有成员
- **WHEN** 用户执行 `skillsmgr group list vercel-develop`
- **THEN** 输出中 SHALL 标明 `develop` 是一个被引用的 group (例如 `→ group: develop`), 与直接 skill 区分

#### Scenario: 标注悬空引用

- **GIVEN** `vercel-develop` 含 `group:gone`, 不存在名为 gone 的 group
- **WHEN** 用户执行 `skillsmgr group list vercel-develop`
- **THEN** 输出 SHALL 将该引用标注为 dangling (例如 `→ group: gone (dangling)`)
