## MODIFIED Requirements

### Requirement: groups.json 存储

系统 SHALL 使用 `~/.skills-manager/groups.json` 存储所有 group 的元数据.  顶层结构为 `{ version: '2.0', groups: Record<string, GroupEntry> }`.  每个 GroupEntry 必含 `kind: 'virtual' | 'local-batch'` 字段:

- **virtual**: `{ kind: 'virtual', members: string[] }`
- **local-batch**: `{ kind: 'local-batch', url: string, installedAt: string, updatedAt: string }` (无 `members` 字段, 由 `~/.skills-manager/custom/<name>/` 物理目录实时派生)

文件不存在时视为 `{ version: '2.0', groups: {} }`.  旧格式 (顶层为 `Record<string, string[]>`, V1) 在 load 时自动迁移为 V2 (见 `group-as-first-class-unit` capability 的 "迁移策略" 需求).

#### Scenario: V2 groups.json 格式
- **GIVEN** 用户创建了逻辑 group `python` 含 2 个 skill, 安装了物理 group `tdd-spec` (源目录 `/dev/tdd-spec`)
- **THEN** `groups.json` 内容为:
  ```json
  {
    "version": "2.0",
    "groups": {
      "python": { "kind": "virtual", "members": ["custom/my-linter", "official/anthropic/skills/commit"] },
      "tdd-spec": { "kind": "local-batch", "url": "/dev/tdd-spec", "installedAt": "...", "updatedAt": "..." }
    }
  }
  ```

#### Scenario: groups.json 不存在时
- **WHEN** `~/.skills-manager/groups.json` 不存在
- **THEN** 系统 SHALL 视为 `{ version: '2.0', groups: {} }`, 不报错

#### Scenario: V1 格式自动迁移
- **GIVEN** `groups.json` 为 V1 格式 `{"python":["custom/foo"]}`
- **WHEN** 系统 load
- **THEN** 自动迁移为 V2, `python` entry 升级为 `{ kind: 'virtual', members: ['custom/foo'] }`
- **THEN** 写出 `groups.json.v1.backup`

### Requirement: GroupsService CRUD

系统 SHALL 提供 `GroupsService` 服务, 读写 `groups.json`, 提供以下方法:

- `listGroups()`: 返回所有 group 名数组 (含物理和逻辑)
- `getGroup(name)`: 返回 GroupEntry (含 kind 和对应字段), group 不存在时返回 `null`
- `getGroupKind(name)`: 返回 `'virtual' | 'local-batch' | null`
- `getGroupMembers(name)`: 返回 group 的 skill key 数组. 物理 group 实时扫 `~/.skills-manager/custom/<name>/`, 逻辑 group 读 `members` 字段
- `createGroup(name)`: 创建空逻辑 group (`{ kind: 'virtual', members: [] }`).  group 已存在时报错 (含同名物理 group)
- `createLocalBatchGroup(name, url)`: 创建物理 group entry (`{ kind: 'local-batch', url, installedAt, updatedAt }`).  group 已存在时报错
- `deleteGroup(name)`: 删除 group entry. 仅作用于 `groups.json`, 不删除 skill 文件, 不删除物理目录
- `deletePhysicalGroup(name)`: `deleteGroup` 的别名, 语义上专用于物理 group (调用方需自行处理物理目录)
- `addSkill(group, skillKey)`: 向**逻辑** group 添加 skill 引用. group 不存在时自动创建为逻辑 group. group 是物理 group 时 SHALL 报错
- `removeSkill(group, skillKey)`: 从**逻辑** group 移除引用. group 是物理 group 时 SHALL 报错 (物理 group 的 members 由物理目录派生, 不可手动移除)
- `removeSkillFromAll(skillKey)`: 从所有**逻辑** group 中移除指定 skill 引用. 物理 group 不影响 (物理目录自然反映)
- `renameGroup(oldName, newName)`: 重命名 group entry key.  仅 `groups.json` 改 key, 不动物理目录或 sources.json (物理 group 的完整 rename 由 `groupCommandRename` 协调多个 service)
- `updatePhysicalGroupTimestamp(name)`: 仅刷新物理 group 的 `updatedAt` 字段

`remove` 命令移除 skill 后 SHALL 调用 `removeSkillFromAll(skillKey)` 清理引用, 与 `uninstall` 行为对齐.

#### Scenario: getGroup 返回带 kind 的 GroupEntry
- **WHEN** 物理 group `tdd-spec` 存在
- **THEN** `getGroup("tdd-spec")` SHALL 返回 `{ kind: 'local-batch', url: '...', installedAt: '...', updatedAt: '...' }`

#### Scenario: getGroup 不存在返回 null
- **WHEN** 请求不存在的 group
- **THEN** `getGroup("nonexistent")` SHALL 返回 `null`

#### Scenario: getGroupMembers 物理 group 实时派生
- **GIVEN** 物理 group `tdd-spec`, `custom/tdd-spec/` 含 `ts-apply/SKILL.md`, `ts-verify/SKILL.md`
- **WHEN** 调用 `getGroupMembers("tdd-spec")`
- **THEN** SHALL 扫 `custom/tdd-spec/` 子目录, 返回 `['custom/tdd-spec/ts-apply', 'custom/tdd-spec/ts-verify']`
- **AND** 不读取 `groups.json` 的 members 字段 (物理 group 没有该字段)

#### Scenario: getGroupMembers 逻辑 group 读字段
- **GIVEN** 逻辑 group `python` 含 `['custom/foo', 'official/anthropic/skills/commit']`
- **WHEN** 调用 `getGroupMembers("python")`
- **THEN** 返回该数组

#### Scenario: createGroup 空逻辑 group
- **WHEN** 调用 `createGroup("frontend")`
- **THEN** `groups.json[frontend]` 为 `{ kind: 'virtual', members: [] }`

#### Scenario: createGroup 撞名物理 group 报错
- **GIVEN** 物理 group `tdd-spec` 已存在
- **WHEN** 调用 `createGroup("tdd-spec")`
- **THEN** SHALL 抛出错误, 含 "already exists as a local-batch group"

#### Scenario: createGroup 撞名逻辑 group 报错
- **GIVEN** 逻辑 group `python` 已存在
- **WHEN** 调用 `createGroup("python")`
- **THEN** SHALL 抛出错误 `Group 'python' already exists.`

#### Scenario: createLocalBatchGroup 创建物理 group
- **WHEN** 调用 `createLocalBatchGroup("tdd-spec", "/dev/tdd-spec")`
- **THEN** `groups.json[tdd-spec]` 为 `{ kind: 'local-batch', url: '/dev/tdd-spec', installedAt: <now>, updatedAt: <now> }`

#### Scenario: createLocalBatchGroup 撞名报错
- **WHEN** 调用 `createLocalBatchGroup("tdd-spec", ...)`, group 已存在
- **THEN** SHALL 抛出错误

#### Scenario: addSkill 向物理 group 报错
- **GIVEN** 物理 group `tdd-spec` 已存在
- **WHEN** 调用 `addSkill("tdd-spec", "custom/tdd-spec/foo")`
- **THEN** SHALL 抛出错误, 含 "physical group, members are derived from custom/tdd-spec/"

#### Scenario: removeSkill 从物理 group 报错
- **GIVEN** 物理 group `tdd-spec` 已存在
- **WHEN** 调用 `removeSkill("tdd-spec", "custom/tdd-spec/foo")`
- **THEN** SHALL 抛出错误, 同上

#### Scenario: removeSkillFromAll 仅清理逻辑 group
- **GIVEN** 逻辑 group `python` 含 `custom/foo`, 物理 group `tdd-spec` 存在
- **WHEN** 调用 `removeSkillFromAll("custom/foo")`
- **THEN** `python` 中 `custom/foo` 被移除
- **THEN** 物理 group `tdd-spec` 不被影响

#### Scenario: addSkill 自动创建逻辑 group
- **WHEN** group "new-group" 不存在, 调用 `addSkill("new-group", "custom/foo")`
- **THEN** 系统 SHALL 自动创建 `{ kind: 'virtual', members: ['custom/foo'] }`

#### Scenario: addSkill 重复添加幂等
- **WHEN** `custom/foo` 已在逻辑 group `python` 中, 再次调用 `addSkill("python", "custom/foo")`
- **THEN** SHALL 不重复添加, members 中仍只有一个

#### Scenario: deleteGroup 删除 entry 不动物理目录
- **WHEN** 物理 group `tdd-spec` 存在 + `custom/tdd-spec/` 含 skills, 调用 `deleteGroup("tdd-spec")`
- **THEN** `groups.json` 中 `tdd-spec` 被删
- **THEN** `custom/tdd-spec/` 物理目录 NOT 受影响

#### Scenario: deleteGroup 不存在报错
- **WHEN** 调用 `deleteGroup("nonexistent")`
- **THEN** SHALL 抛出错误

## ADDED Requirements

### Requirement: physical group 与 virtual group 命名空间统一

`groups.json` 中所有 group entry SHALL 共享同一命名空间, 物理和逻辑 group MUST NOT 同名.  此约束 SHALL 由 `createGroup` / `createLocalBatchGroup` / `renameGroup` 在写入路径强制.

#### Scenario: 命名空间统一查找
- **GIVEN** 物理 group `tdd-spec` 和逻辑 group `python` 均存在
- **WHEN** 调用 `listGroups()`
- **THEN** 返回 `["python", "tdd-spec"]` (排序), 不区分 kind
