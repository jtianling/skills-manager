## MODIFIED Requirements

### Requirement: 批量安装重名 bundle 冲突检测

`install` 批量本地目录时, 系统 SHALL 在物理写入前按以下顺序检查命名冲突:

1. **同 basename 物理 group 同 URL** (`normalizeLocalPath(group.url) === normalizeLocalPath(skillDir)`): 正常进入批量安装流程, 后续每个子 skill 的 overwrite 行为保持现状
2. **同 basename 物理 group 不同 URL**: 系统 SHALL 报错终止安装, 不写入 `groups.json`/`sources.json`, 不修改物理目录.  错误文案 SHALL 指出已记录的原路径并引导用户运行 `skillsmgr update ./<dirName>` 触发 rebind
3. **同 basename 逻辑 group**: 系统 SHALL 报错终止安装, 错误文案 SHALL 指出存在同名逻辑 group, 引导用户运行 `skillsmgr group rename <dirName> <new-name>` 后再 install
4. 无冲突: 进入批量安装流程, 创建物理 group entry

basename 定义: `basename(normalizeLocalPath(skillDir))`, 其中 `skillDir` 是用户 install 的目标目录.

#### Scenario: 批量安装同路径 idempotent
- **WHEN** 用户执行 `skillsmgr install ./tdd-spec`, 物理 group `tdd-spec` 已存在且 `url` 归一化后等于 `./tdd-spec` 的绝对路径
- **THEN** 系统 SHALL 正常进入批量安装流程, 不报冲突错误

#### Scenario: 批量安装同 basename 不同路径被拒绝
- **WHEN** 用户执行 `skillsmgr install /new/path/tdd-spec`, 物理 group `tdd-spec` 已存在且 `url` 归一化后为 `/old/path/tdd-spec` (basename 相同, 路径不同)
- **THEN** 系统 SHALL 报错, 错误文案 SHALL 形如 `Error: A local-batch group 'tdd-spec' is already installed from /old/path/tdd-spec. To move it to /new/path/tdd-spec, run: skillsmgr update /new/path/tdd-spec`
- **AND** 系统 SHALL 以非 0 退出码终止, 不写入 `groups.json`/`sources.json`, 不修改 `~/.skills-manager/custom/tdd-spec/` 下任何内容

#### Scenario: 批量安装撞名逻辑 group 被拒绝
- **GIVEN** 逻辑 group `tdd-spec` 已存在 (`groups.json` 中 `kind: 'virtual'`)
- **WHEN** 用户执行 `skillsmgr install ./tdd-spec`
- **THEN** 系统 SHALL 报错, 错误文案 SHALL 形如 `Error: A virtual group 'tdd-spec' already exists. Physical and virtual groups must not share a name. Run: skillsmgr group rename tdd-spec <new-name> first, or use a different directory name.`
- **AND** 系统 SHALL 以非 0 退出码终止, 不修改任何文件

#### Scenario: 批量安装与同名单 skill 共存不冲突
- **WHEN** 用户执行 `skillsmgr install ./tdd-spec` (batch), 已存在单 skill `custom/tdd-spec` 但无同名物理或逻辑 group
- **THEN** 系统 SHALL 按现有行为处理 (不触发本需求的冲突检测), 因为目标物理路径和 source key 结构不同 (`custom/tdd-spec/{child}` vs `custom/tdd-spec`)

#### Scenario: 批量安装遇到历史脏数据多 group
- **WHEN** 用户执行 `skillsmgr install ./tdd-spec`, `groups.json` 中存在多个同 basename 的物理 group (历史脏数据)
- **THEN** 系统 SHALL 报错列出所有冲突的 group 名和 URL, 提示用户手动清理后重试

### Requirement: 批量安装自动创建虚拟 group

批量安装 SHALL 自动创建一个**物理 group** entry, 名称为源目录的 basename, 该物理 group 的 members 由物理目录派生 (无需显式 add).  `--group <name>` 选项 SHALL 额外创建/复用一个**逻辑** group, 把所有安装的 skill key 加入该逻辑 group, 但不影响物理 group 的存在.

物理 group 的存储参见 `virtual-group` capability 的 "groups.json 存储" 需求 (`{ kind: 'local-batch', url, installedAt, updatedAt }`).

物理 group 不再使用旧的 "auto-group" 机制 (即不再 `createGroup(<dirName>)` + 逐个 `addSkill`).  物理 group 即承载该单元的所有成员.

#### Scenario: 自动创建物理 group
- **WHEN** 用户执行 `skillsmgr install ./openspec`, 安装了 3 个 skills
- **THEN** `groups.json` 中 SHALL 新增 `"openspec": { kind: 'local-batch', url: '<abs>', installedAt: <now>, updatedAt: <now> }`
- **THEN** 不再向 groups.json 写入 `openspec: ['custom/openspec/...', ...]` 这种 V1 风格的 members 数组
- **THEN** 查询 `getGroupMembers("openspec")` 时实时扫物理目录返回 3 个

#### Scenario: --group 创建额外的逻辑 group
- **WHEN** 用户执行 `skillsmgr install ./openspec --group tools`
- **THEN** `groups.json` 中物理 group `openspec` 被创建 (带 url 等 metadata)
- **THEN** 同时逻辑 group `tools` 被创建/复用, 包含 3 个安装的 skill key
- **THEN** 物理存储路径仍为 `custom/openspec/{skillName}/`

#### Scenario: --group 撞名物理 group 报错
- **GIVEN** 物理 group `tools` 已存在
- **WHEN** 用户执行 `skillsmgr install ./openspec --group tools`
- **THEN** 系统 SHALL 报错 `Cannot add to physical group 'tools'. Members of physical groups are derived from custom/tools/.  Use a virtual group name instead.`
- **AND** 不安装 skill, 不修改任何文件

#### Scenario: 物理 group 已存在追加 skill (不动 group entry)
- **WHEN** 用户执行 `skillsmgr install ./openspec`, 物理 group `openspec` 已存在 (同 url), 且物理目录下已有部分 skill
- **THEN** 新安装的 skill 写入物理目录, sources.json 增加对应 entry
- **THEN** 物理 group entry `groups.json[openspec]` 仅刷新 `updatedAt`, 其余字段不变
- **THEN** members 由物理目录派生, 自然包含新增的 skill
